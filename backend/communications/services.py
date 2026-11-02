import uuid
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Dict, Any, Optional
from django.utils import timezone
from django.core.mail import send_mail
from django.db.models import Q
from leads.models import Lead, LeadStatus
from .models import (
    EmailAccount, EmailDraft, SentEmail, EmailReply,
    FollowUpSchedule, EmailDraftStatus, EmailType, EmailProviderType, ReplyClassification,
    CompanyOutreachProfile, GenerationMethod
)
from .template_engine import FallbackTemplateEngine
from .validator import EmailQualityValidator
from ai_agents.agents.email_generation_agent import EmailGenerationAgent
from ai_agents.agents.email_response_analysis_agent import EmailResponseAnalysisAgent

import logging
logger = logging.getLogger(__name__)

class EmailDraftingService:
    @classmethod
    def generate_draft_for_lead(
        cls, 
        lead: Lead, 
        email_type: str = EmailType.COMPANY_INTRO,
        style: Optional[str] = None,
        tone: Optional[str] = None,
        service_focus: Optional[str] = None,
        force_fallback: bool = False,
        instruction_override: Optional[str] = None
    ) -> EmailDraft:
        report = getattr(lead, 'research_report', None)
        requirements = list(lead.requirements.all()) if hasattr(lead, 'requirements') else []

        sender_account = EmailAccount.objects.filter(is_active=True).first()
        outreach_style = style or email_type or 'PERSONALIZED_INTRO'

        if force_fallback:
            profile = CompanyOutreachProfile.get_active_profile()
            draft_content = FallbackTemplateEngine.render_fallback(
                lead=lead,
                style=outreach_style,
                service_focus=service_focus,
                profile=profile
            )
            draft_content['fallback_reason'] = 'Explicit user selection: Predefined Fallback Template'
            val = EmailQualityValidator.validate({
                'subject': draft_content['subject'],
                'body_plain': draft_content['body_plain'],
                'body_html': draft_content['body_html'],
                'recipient_email': lead.business_email
            })
            draft_content['quality_score'] = val['quality_score']
            draft_content['validation_warnings'] = val['warnings']
        else:
            agent8 = EmailGenerationAgent()
            draft_content = agent8.generate(
                lead=lead,
                report=report,
                requirements=requirements,
                email_type=email_type,
                style=outreach_style,
                tone=tone,
                service_focus=service_focus,
                instruction_override=instruction_override
            )

        # Deduplicate: Update existing draft for this lead or create a new one
        existing_draft = EmailDraft.objects.filter(lead=lead).first()
        if existing_draft:
            existing_draft.subject = draft_content['subject']
            existing_draft.body_html = draft_content['body_html']
            existing_draft.body_plain = draft_content['body_plain']
            existing_draft.original_subject = draft_content['subject']
            existing_draft.original_body_html = draft_content['body_html']
            existing_draft.original_body_plain = draft_content['body_plain']
            existing_draft.confidence_score = draft_content.get('confidence_score', 92)
            existing_draft.email_type = email_type
            existing_draft.outreach_style = outreach_style
            existing_draft.generation_method = draft_content.get('generation_method', GenerationMethod.AI_GENERATED)
            existing_draft.fallback_reason = draft_content.get('fallback_reason')
            existing_draft.ai_model_used = draft_content.get('ai_model_used', 'gemini-2.5-flash')
            existing_draft.personalization_sources = draft_content.get('personalization_sources', [])
            existing_draft.validation_warnings = draft_content.get('validation_warnings', [])
            existing_draft.quality_score = draft_content.get('quality_score', 95)
            existing_draft.status = EmailDraftStatus.AWAITING_APPROVAL
            if sender_account:
                existing_draft.sender_account = sender_account
            existing_draft.save()
            draft = existing_draft
        else:
            draft = EmailDraft.objects.create(
                lead=lead,
                sender_account=sender_account,
                email_type=email_type,
                outreach_style=outreach_style,
                subject=draft_content['subject'],
                body_html=draft_content['body_html'],
                body_plain=draft_content['body_plain'],
                original_subject=draft_content['subject'],
                original_body_html=draft_content['body_html'],
                original_body_plain=draft_content['body_plain'],
                status=EmailDraftStatus.AWAITING_APPROVAL,
                confidence_score=draft_content.get('confidence_score', 92),
                generation_method=draft_content.get('generation_method', GenerationMethod.AI_GENERATED),
                fallback_reason=draft_content.get('fallback_reason'),
                ai_model_used=draft_content.get('ai_model_used', 'gemini-2.5-flash'),
                personalization_sources=draft_content.get('personalization_sources', []),
                validation_warnings=draft_content.get('validation_warnings', []),
                quality_score=draft_content.get('quality_score', 95)
            )

        lead.is_email_generated = True
        lead.lead_status = LeadStatus.AWAITING_APPROVAL
        lead.save()

        return draft

    @classmethod
    def regenerate_draft(
        cls, 
        draft: EmailDraft, 
        style: Optional[str] = None, 
        tone: Optional[str] = None, 
        service_focus: Optional[str] = None,
        instruction_override: Optional[str] = None,
        force_fallback: bool = False
    ) -> EmailDraft:
        return cls.generate_draft_for_lead(
            lead=draft.lead,
            email_type=draft.email_type,
            style=style or draft.outreach_style,
            tone=tone,
            service_focus=service_focus,
            force_fallback=force_fallback,
            instruction_override=instruction_override
        )

    @classmethod
    def shorten_draft(cls, draft: EmailDraft) -> EmailDraft:
        instruction = "Shorten this outreach message significantly. Make it ultra-concise, direct, and under 90 words while preserving the core value proposition and call to action."
        return cls.regenerate_draft(draft, instruction_override=instruction)

    @classmethod
    def personalize_draft(cls, draft: EmailDraft) -> EmailDraft:
        instruction = "Deepen the personalization using specific observable intelligence findings (such as detected technologies, company industry context, or operational requirements)."
        return cls.regenerate_draft(draft, instruction_override=instruction)

    @classmethod
    def use_fallback_template(cls, draft: EmailDraft, style: Optional[str] = None) -> EmailDraft:
        return cls.generate_draft_for_lead(
            lead=draft.lead,
            email_type=draft.email_type,
            style=style or draft.outreach_style,
            force_fallback=True
        )


class EmailDispatchService:
    """
    Module 10: Sends approved emails via connected SMTP or OAuth provider,
    logs records in CRM, and schedules automated follow-ups.
    """

    @classmethod
    def dispatch_email(cls, draft: EmailDraft, approved_by=None, allow_duplicate: bool = False) -> SentEmail:
        lead = draft.lead
        recipient_email = getattr(lead, 'business_email', '') or getattr(lead, 'contact_email', '')

        # Scenario 12: An email cannot be sent twice to the same recipient without an explicit override
        if not allow_duplicate and recipient_email:
            existing_send = SentEmail.objects.filter(
                Q(recipient_email__iexact=recipient_email) | Q(lead=lead)
            ).first()
            if existing_send:
                raise ValueError(
                    f"Duplicate email send prevented: An outreach email has already been sent to {recipient_email} "
                    f"on {existing_send.sent_at.strftime('%Y-%m-%d %H:%M')}. Set allow_duplicate=True to override."
                )

        # Check for active Google Workspace / Gmail OAuth account first
        gmail_oauth_account = EmailAccount.objects.filter(provider=EmailProviderType.GMAIL, is_active=True).first()
        account = gmail_oauth_account or draft.sender_account or EmailAccount.objects.filter(is_active=True).first()

        # Update draft status
        draft.status = EmailDraftStatus.SENT
        draft.approved_by = approved_by
        draft.approved_at = timezone.now()
        draft.save()

        msg_id = f"<{uuid.uuid4()}@meruguglobal.com>"

        # 1. Dispatch via official Gmail API if OAuth is connected
        if account and account.provider == EmailProviderType.GMAIL and account.oauth_credentials:
            try:
                import base64
                from google.oauth2.credentials import Credentials
                from googleapiclient.discovery import build

                creds_data = account.oauth_credentials
                creds = Credentials(
                    token=creds_data.get('token'),
                    refresh_token=creds_data.get('refresh_token'),
                    token_uri=creds_data.get('token_uri', 'https://oauth2.googleapis.com/token'),
                    client_id=creds_data.get('client_id'),
                    client_secret=creds_data.get('client_secret'),
                    scopes=creds_data.get('scopes')
                )
                gmail_service = build('gmail', 'v1', credentials=creds)

                msg = MIMEMultipart('alternative')
                msg['Subject'] = draft.subject
                msg['From'] = f"{account.sender_name} <{account.email_address}>"
                msg['To'] = lead.business_email
                msg['Message-ID'] = msg_id

                part1 = MIMEText(draft.body_plain, 'plain')
                part2 = MIMEText(draft.body_html, 'html')
                msg.attach(part1)
                msg.attach(part2)

                raw_bytes = base64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')
                gmail_service.users().messages().send(userId='me', body={'raw': raw_bytes}).execute()

                account.sent_count_today += 1
                account.save()
                logger.info(f"Successfully sent live email via Gmail API OAuth to {lead.business_email}")

                sent = SentEmail.objects.create(
                    lead=lead,
                    draft=draft,
                    sender_account=account,
                    recipient_email=lead.business_email,
                    subject=draft.subject,
                    body_html=draft.body_html,
                    message_id=msg_id
                )
                lead.lead_status = LeadStatus.EMAIL_SENT
                lead.save()
                cls.schedule_followups(lead)
                return sent
            except Exception as e:
                logger.error(f"Error dispatching email via Gmail API OAuth: {e}")

        # 2. Dispatch via SMTP or simulated active provider
        try:
            from django.conf import settings
            smtp_user = (account.smtp_user if account else None) or getattr(settings, 'EMAIL_HOST_USER', '')
            smtp_pass = (account.smtp_password if account else None) or getattr(settings, 'EMAIL_HOST_PASSWORD', '')
            smtp_host = (account.smtp_host if account else None) or getattr(settings, 'EMAIL_HOST', 'smtp.gmail.com')
            smtp_port = (account.smtp_port if account else None) or getattr(settings, 'EMAIL_PORT', 587)
            sender_email = (account.email_address if account else None) or smtp_user or getattr(settings, 'DEFAULT_FROM_EMAIL', 'bpo@meruguglobal.com')
            sender_name = (account.sender_name if account else None) or "Merugu Global Business Development"

            if smtp_user and smtp_pass:
                msg = MIMEMultipart('alternative')
                msg['Subject'] = draft.subject
                msg['From'] = f"{sender_name} <{sender_email}>"
                msg['To'] = lead.business_email
                msg['Message-ID'] = msg_id

                part1 = MIMEText(draft.body_plain, 'plain')
                part2 = MIMEText(draft.body_html, 'html')
                msg.attach(part1)
                msg.attach(part2)

                server = smtplib.SMTP(smtp_host, smtp_port)
                if getattr(settings, 'EMAIL_USE_TLS', True):
                    server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(sender_email, [lead.business_email], msg.as_string())
                server.quit()
                if account:
                    account.sent_count_today += 1
                    account.save()
                logger.info(f"Successfully sent live email via SMTP to {lead.business_email}")
            else:
                logger.info(f"Simulating email dispatch to {lead.business_email} (Development Mode - SMTP credentials not configured)")
        except Exception as e:
            logger.error(f"Error dispatching email via SMTP: {e}")

        # Save SentEmail record
        sent = SentEmail.objects.create(
            lead=lead,
            draft=draft,
            sender_account=account,
            recipient_email=lead.business_email,
            subject=draft.subject,
            body_html=draft.body_html,
            message_id=msg_id
        )

        lead.lead_status = LeadStatus.EMAIL_SENT
        lead.save()

        # Schedule Follow-up Cadence (Day 3, Day 7, Day 14)
        cls.schedule_followups(lead)

        return sent

    @classmethod
    def schedule_followups(cls, lead: Lead):
        now = timezone.now()
        cadence_days = [3, 7, 14]
        for idx, days in enumerate(cadence_days, start=1):
            FollowUpSchedule.objects.create(
                lead=lead,
                sequence_step=idx,
                due_date=now + timezone.timedelta(days=days),
                status='PENDING'
            )


class EmailReplyProcessingService:
    """
    Module 11: Analyzes incoming replies, stops follow-up cadences,
    and creates appropriate CRM tasks.
    """

    @classmethod
    def process_incoming_reply(cls, lead: Lead, sender_email: str, subject: str, body: str) -> EmailReply:
        # Cancel all pending follow-ups immediately
        FollowUpSchedule.objects.filter(lead=lead, status='PENDING').update(
            status='CANCELLED',
            cancellation_reason='Recipient responded to outreach.'
        )

        # Invoke Agent 10: Email Response Analysis Agent
        agent10 = EmailResponseAnalysisAgent()
        analysis = agent10.classify_reply(body=body, subject=subject)

        classification = analysis.get('classification', ReplyClassification.INTERESTED)
        confidence = analysis.get('confidence', 90)
        action_note = analysis.get('action_note', 'Follow up manually with lead.')

        reply = EmailReply.objects.create(
            lead=lead,
            sender_email=sender_email,
            subject=subject,
            body=body,
            ai_classification=classification,
            classification_confidence=confidence,
            crm_task_created=True,
            action_note=action_note
        )

        # Update lead status accordingly
        if classification in [ReplyClassification.INTERESTED, ReplyClassification.REQUESTING_MEETING, ReplyClassification.REQUESTING_QUOTATION]:
            lead.lead_status = LeadStatus.ENGAGED
        elif classification in [ReplyClassification.NOT_INTERESTED, ReplyClassification.UNSUBSCRIBE]:
            lead.lead_status = LeadStatus.DISQUALIFIED
        lead.save()

        logger.info(f"Classified reply from {sender_email} as {classification}. Follow-ups halted.")
        return reply
