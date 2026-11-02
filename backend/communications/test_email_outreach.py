import os
import unittest
from unittest.mock import patch, MagicMock
from django.test import TestCase, Client
from django.utils import timezone
from core.models import User, Organization
from leads.models import Lead, Company, LeadStatus, LeadSource
from communications.models import (
    EmailDraft, SentEmail, EmailAccount, EmailType, EmailDraftStatus,
    GenerationMethod, CompanyOutreachProfile, EmailProviderType
)
from communications.services import EmailDraftingService, EmailDispatchService
from communications.template_engine import FallbackTemplateEngine
from communications.validator import EmailQualityValidator
from ai_agents.agents.email_generation_agent import EmailGenerationAgent


class EmailOutreachComprehensiveTests(TestCase):
    """
    Automated test suite verifying all 13 core scenarios of the B2B Email Outreach Upgrade.
    """

    def setUp(self):
        # Setup organization and user
        self.org = Organization.objects.create(name="Merugu Test Org", domain="merugutest.com")
        self.admin_user = User.objects.create_superuser(
            username="admin_user",
            email="admin@merugutest.com",
            password="testpassword123",
            role="SUPER_ADMIN",
            organization=self.org
        )
        self.manager_user = User.objects.create_user(
            username="manager_user",
            email="manager@merugutest.com",
            password="testpassword123",
            role="OPERATIONS_MANAGER",
            organization=self.org
        )
        self.unauthorized_user = User.objects.create_user(
            username="junior_user",
            email="junior@merugutest.com",
            password="testpassword123",
            role="DATA_ENTRY_ANALYST",  # No approval permissions
            organization=self.org
        )

        # Setup company outreach profile
        self.profile = CompanyOutreachProfile.get_active_profile()
        self.profile.company_name = "Merugu Digital Marketing And Life Science Pvt. Ltd."
        self.profile.brand_name = "Merugu Global"
        self.profile.website = "https://meruguglobal.com"
        self.profile.sender_name = "Hemanth Kumar"
        self.profile.sender_designation = "Head of Business Development"
        self.profile.services_offered = [
            "AI Workflow Automation & Intelligent Processing",
            "Enterprise Web & Cloud Software Engineering",
            "Healthcare Software Systems (HMIS)"
        ]
        self.profile.save()

        # Setup test company and complete lead
        self.company = Company.objects.create(
            name="Apex Dynamics Tech",
            normalized_name="apex dynamics tech",
            domain="apexdynamics.io",
            website_url="https://apexdynamics.io",
            industry="Healthcare Technology"
        )
        self.complete_lead = Lead.objects.create(
            company=self.company,
            company_name="Apex Dynamics Tech",
            contact_person="Dr. Vikram Rao",
            first_name="Vikram",
            last_name="Rao",
            designation="Chief Operating Officer",
            business_email="vikram.rao@apexdynamics.io",
            website_url="https://apexdynamics.io",
            industry="Healthcare Technology",
            lead_source=LeadSource.MANUAL,
            lead_status=LeadStatus.SCORED
        )

        # Lead with missing name and website
        self.sparse_lead = Lead.objects.create(
            company_name="Solaria Cloud Systems",
            contact_person="",
            designation="",
            business_email="team@solariacloud.com",
            website_url="",
            industry="Information Technology",
            lead_source=LeadSource.MANUAL,
            lead_status=LeadStatus.SCORED
        )

        # Setup test sender account
        self.email_account = EmailAccount.objects.create(
            organization=self.org,
            name="Sales Outreach (Hemanth)",
            email_address="hemanth.kumar@meruguglobal.com",
            sender_name="Hemanth Kumar",
            provider=EmailProviderType.SMTP,
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            is_active=True
        )

    # --------------------------------------------------------------------------
    # Scenario 1: AI email generation succeeds with complete lead data
    # --------------------------------------------------------------------------
    def test_scenario_01_ai_generation_succeeds(self):
        mock_ai_response = {
            "subject": "Tailored automation architecture for Apex Dynamics Tech",
            "body_html": "<p>Dear Dr. Vikram Rao,</p><p>I am reaching out from Merugu Global after reviewing Apex Dynamics Tech's clinical platform operations.</p><p>We specialize in enterprise AI workflow automation and HIPAA-compliant data workflows. Given your expanding healthcare presence, our engineering team can integrate specialized processing pipelines to lower operational cycle times.</p><p>Would you be open to a brief 15-minute briefing next Tuesday?</p><p>Best regards,<br/>Hemanth Kumar<br/>Head of Business Development<br/>Merugu Global</p>",
            "body_plain": "Dear Dr. Vikram Rao,\n\nI am reaching out from Merugu Global after reviewing Apex Dynamics Tech's clinical platform operations.\n\nWe specialize in enterprise AI workflow automation and HIPAA-compliant data workflows. Given your expanding healthcare presence, our engineering team can integrate specialized processing pipelines to lower operational cycle times.\n\nWould you be open to a brief 15-minute briefing next Tuesday?\n\nBest regards,\nHemanth Kumar\nHead of Business Development\nMerugu Global",
            "confidence_score": 96,
            "quality_score": 98,
            "personalization_sources": ["Company Name", "Contact Designation", "Healthcare Technology Industry"]
        }

        with patch('ai_agents.llm_gateway.LLMGateway.call_llm', return_value=mock_ai_response):
            draft = EmailDraftingService.generate_draft_for_lead(
                lead=self.complete_lead,
                style='PERSONALIZED_INTRO'
            )
            self.assertIsNotNone(draft)
            self.assertEqual(draft.generation_method, GenerationMethod.AI_GENERATED)
            self.assertIn("Apex Dynamics Tech", draft.subject)
            self.assertIn("Dr. Vikram Rao", draft.body_html)
            self.assertNotIn("I hope this email finds you well", draft.body_html)
            self.assertNotIn("{{", draft.body_html)

    # --------------------------------------------------------------------------
    # Scenario 2: Fallback succeeds when AI provider API key is missing
    # --------------------------------------------------------------------------
    def test_scenario_02_fallback_when_api_key_missing(self):
        fallback_resp = {
            "status": "fallback_triggered",
            "error": "API key missing or empty",
            "fallback_reason": "Gemini API key missing or invalid."
        }
        with patch('ai_agents.llm_gateway.LLMGateway.call_llm', return_value=fallback_resp):
            draft = EmailDraftingService.generate_draft_for_lead(
                lead=self.complete_lead,
                style="PERSONALIZED_INTRO"
            )
            self.assertEqual(draft.generation_method, GenerationMethod.TEMPLATE_FALLBACK)
            self.assertIn("Apex Dynamics Tech", draft.subject)
            self.assertNotIn("{{", draft.body_html)
            self.assertNotIn("I hope this email finds you well", draft.body_html)

    # --------------------------------------------------------------------------
    # Scenario 3: Fallback succeeds when AI provider returns rate limit / quota error
    # --------------------------------------------------------------------------
    def test_scenario_03_fallback_when_quota_exceeded(self):
        with patch('ai_agents.llm_gateway.LLMGateway.call_llm', side_effect=Exception("ResourceExhausted: 429 Quota exceeded")):
            draft = EmailDraftingService.generate_draft_for_lead(
                lead=self.complete_lead,
                style="VALUE_FOCUSED"
            )
            self.assertEqual(draft.generation_method, GenerationMethod.TEMPLATE_FALLBACK)
            self.assertIn("Apex Dynamics Tech", draft.subject)
            self.assertNotIn("{{", draft.body_html)

    # --------------------------------------------------------------------------
    # Scenario 4: Fallback succeeds when AI provider times out
    # --------------------------------------------------------------------------
    def test_scenario_04_fallback_when_ai_times_out(self):
        with patch('ai_agents.llm_gateway.LLMGateway.call_llm', side_effect=TimeoutError("Deadline exceeded")):
            draft = EmailDraftingService.generate_draft_for_lead(
                lead=self.complete_lead,
                style="EXECUTIVE"
            )
            self.assertEqual(draft.generation_method, GenerationMethod.TEMPLATE_FALLBACK)
            self.assertIn("Apex Dynamics Tech", draft.subject)
            self.assertNotIn("{{", draft.body_html)

    # --------------------------------------------------------------------------
    # Scenario 5: Fallback succeeds when AI provider returns empty or malformed output
    # --------------------------------------------------------------------------
    def test_scenario_05_fallback_when_output_malformed(self):
        with patch('ai_agents.llm_gateway.LLMGateway.call_llm', return_value={"corrupted": None}):
            draft = EmailDraftingService.generate_draft_for_lead(
                lead=self.complete_lead,
                style="TECH_SOLUTIONS"
            )
            self.assertEqual(draft.generation_method, GenerationMethod.TEMPLATE_FALLBACK)
            self.assertIn("Apex Dynamics Tech", draft.subject)
            self.assertNotIn("{{", draft.body_html)

    # --------------------------------------------------------------------------
    # Scenario 6: Fallback templates for all 7 styles produce clean, valid emails
    # --------------------------------------------------------------------------
    def test_scenario_06_all_seven_fallback_styles_valid(self):
        styles = [
            'PERSONALIZED_INTRO',
            'VALUE_FOCUSED',
            'EXECUTIVE',
            'TECH_SOLUTIONS',
            'FOLLOW_UP',
            'MEETING_REQUEST',
            'SERVICE_SPECIFIC'
        ]
        lead_dict = {
            "company_name": "Apex Dynamics Tech",
            "contact_name": "Dr. Vikram Rao",
            "designation": "COO",
            "industry": "Healthcare Technology",
            "website": "https://apexdynamics.io"
        }

        for style in styles:
            rendered = FallbackTemplateEngine.render(lead_dict, style=style)
            # 1. Non-empty subject and bodies
            self.assertTrue(len(rendered['subject']) > 5, f"Subject empty for {style}")
            self.assertTrue(len(rendered['body_html']) > 50, f"Body HTML too short for {style}")
            self.assertTrue(len(rendered['body_plain']) > 50, f"Body plain too short for {style}")
            # 2. No unresolved placeholders
            self.assertNotIn("{{", rendered['subject'], f"Placeholder in subject for {style}")
            self.assertNotIn("{{", rendered['body_html'], f"Placeholder in HTML for {style}")
            self.assertNotIn("{{", rendered['body_plain'], f"Placeholder in plain for {style}")
            # 3. No generic cliché greetings
            self.assertNotIn("I hope this email finds you well", rendered['body_html'])
            self.assertNotIn("noted your impressive market footprint", rendered['body_html'])
            # 4. Correct method provenance
            self.assertEqual(rendered['generation_method'], GenerationMethod.TEMPLATE_FALLBACK)

    # --------------------------------------------------------------------------
    # Scenario 7: Leads with missing contact names or websites handled gracefully
    # --------------------------------------------------------------------------
    def test_scenario_07_sparse_lead_handled_gracefully(self):
        draft = EmailDraftingService.generate_draft_for_lead(
            lead=self.sparse_lead,
            style='PERSONALIZED_INTRO',
            force_fallback=True
        )
        self.assertNotIn("Dear undefined", draft.body_html)
        self.assertNotIn("Dear None", draft.body_html)
        self.assertNotIn("Dear ,", draft.body_html)
        self.assertNotIn("{{", draft.body_html)
        self.assertIn("Solaria Cloud Systems", draft.body_html)
        self.assertTrue(draft.body_html.startswith("<p>Hello Solaria Cloud Systems Team,") or "Solaria Cloud Systems" in draft.body_html)

    # --------------------------------------------------------------------------
    # Scenario 8: Anti-hallucination guard prevents referencing unverified claims
    # --------------------------------------------------------------------------
    def test_scenario_08_anti_hallucination_validation(self):
        # A draft claiming ungrounded things or clichés gets flagged by validator
        draft = EmailDraft(
            lead=self.complete_lead,
            subject="Quick question",
            body_html="<p>I hope this email finds you well. As discussed on our call yesterday, we can fix the bugs on your site.</p>",
            body_plain="I hope this email finds you well. As discussed on our call yesterday, we can fix the bugs on your site."
        )
        result = EmailQualityValidator.validate(draft)
        self.assertFalse(result["is_valid"])
        warnings_str = " ".join(result["warnings"])
        self.assertIn("finds you well", warnings_str.lower())
        self.assertIn("call", warnings_str.lower())

    # --------------------------------------------------------------------------
    # Scenario 9: An edited email can be saved, reverted, and re-edited
    # --------------------------------------------------------------------------
    def test_scenario_09_save_revert_reedit_lifecycle(self):
        client = Client()
        client.force_login(self.admin_user)

        draft = EmailDraftingService.generate_draft_for_lead(
            lead=self.complete_lead,
            style='PERSONALIZED_INTRO',
            force_fallback=True
        )
        original_subject = draft.subject
        original_html = draft.body_html

        # 1. Edit and Save via PATCH
        edited_subject = "Updated Custom Subject for Vikram"
        edited_html = "<p>Completely personalized manual revision for Dr. Rao.</p>"
        save_resp = client.patch(
            f"/api/v1/email-drafts/{draft.id}/",
            data={"subject": edited_subject, "body_html": edited_html},
            content_type="application/json"
        )
        self.assertEqual(save_resp.status_code, 200)
        draft.refresh_from_db()
        self.assertEqual(draft.subject, edited_subject)
        self.assertEqual(draft.body_html, edited_html)

        # 2. Revert back to original version
        revert_resp = client.post(f"/api/v1/email-drafts/{draft.id}/revert/")
        self.assertEqual(revert_resp.status_code, 200)
        draft.refresh_from_db()
        self.assertEqual(draft.subject, original_subject)
        self.assertEqual(draft.body_html, original_html)

        # 3. Re-edit again
        new_edit_subject = "Second round revisions"
        reedit_resp = client.patch(
            f"/api/v1/email-drafts/{draft.id}/",
            data={"subject": new_edit_subject},
            content_type="application/json"
        )
        self.assertEqual(reedit_resp.status_code, 200)
        draft.refresh_from_db()
        self.assertEqual(draft.subject, new_edit_subject)

    # --------------------------------------------------------------------------
    # Scenario 10: Email preview matches the content sent via email provider
    # --------------------------------------------------------------------------
    def test_scenario_10_preview_matches_dispatched_content(self):
        draft = EmailDraftingService.generate_draft_for_lead(
            lead=self.complete_lead,
            style='EXECUTIVE',
            force_fallback=True
        )

        with patch('django.core.mail.send_mail') as mock_send_mail:
            sent_record = EmailDispatchService.dispatch_email(draft, approved_by=self.admin_user)
            self.assertEqual(sent_record.subject, draft.subject)
            self.assertEqual(sent_record.body_html, draft.body_html)
            self.assertEqual(sent_record.recipient_email, self.complete_lead.business_email)

    # --------------------------------------------------------------------------
    # Scenario 11: Unauthorized user cannot approve or send an email
    # --------------------------------------------------------------------------
    def test_scenario_11_unauthorized_user_blocked(self):
        client = Client()
        client.force_login(self.unauthorized_user)

        draft = EmailDraftingService.generate_draft_for_lead(
            lead=self.complete_lead,
            style='PERSONALIZED_INTRO',
            force_fallback=True
        )

        resp = client.post(f"/api/v1/email-drafts/{draft.id}/approve_and_send/")
        self.assertEqual(resp.status_code, 403, "Unauthorized role must receive 403 Forbidden")
        draft.refresh_from_db()
        self.assertNotEqual(draft.status, EmailDraftStatus.SENT)

    # --------------------------------------------------------------------------
    # Scenario 12: Duplicate email send is prevented without explicit override
    # --------------------------------------------------------------------------
    def test_scenario_12_duplicate_send_prevention(self):
        draft = EmailDraftingService.generate_draft_for_lead(
            lead=self.complete_lead,
            style='PERSONALIZED_INTRO',
            force_fallback=True
        )

        # First dispatch succeeds
        EmailDispatchService.dispatch_email(draft, approved_by=self.admin_user)
        self.assertEqual(SentEmail.objects.filter(lead=self.complete_lead).count(), 1)

        # Second dispatch attempt without override raises ValueError
        with self.assertRaises(ValueError) as ctx:
            EmailDispatchService.dispatch_email(draft, approved_by=self.admin_user, allow_duplicate=False)
        self.assertIn("Duplicate email send prevented", str(ctx.exception))

        # Second dispatch attempt WITH explicit override succeeds
        second_sent = EmailDispatchService.dispatch_email(draft, approved_by=self.admin_user, allow_duplicate=True)
        self.assertIsNotNone(second_sent)
        self.assertEqual(SentEmail.objects.filter(lead=self.complete_lead).count(), 2)

    # --------------------------------------------------------------------------
    # Scenario 13: Application functions 100% when AI provider is offline
    # --------------------------------------------------------------------------
    def test_scenario_13_full_functionality_when_ai_offline(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}), patch('google.generativeai.GenerativeModel', side_effect=Exception("Network Unreachable")):
            # 1. Can generate draft
            draft = EmailDraftingService.generate_draft_for_lead(self.complete_lead, style='PERSONALIZED_INTRO')
            self.assertIsNotNone(draft)
            self.assertEqual(draft.generation_method, GenerationMethod.TEMPLATE_FALLBACK)

            # 2. Can switch styles
            switched = EmailDraftingService.use_fallback_template(draft, style='TECH_SOLUTIONS')
            self.assertEqual(switched.outreach_style, 'TECH_SOLUTIONS')
            self.assertIn("AI Workflow Automation", switched.body_html)

            # 3. Can run quality check
            quality = EmailQualityValidator.validate(switched)
            self.assertTrue(quality['is_valid'])
            self.assertGreaterEqual(quality['quality_score'], 80)

            # 4. Can dispatch email successfully
            sent = EmailDispatchService.dispatch_email(switched, approved_by=self.admin_user)
            self.assertEqual(sent.draft_id, switched.id)
            self.assertEqual(switched.status, EmailDraftStatus.SENT)
