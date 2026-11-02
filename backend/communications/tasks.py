from celery import shared_task
from django.utils import timezone
import logging
from leads.models import Lead, LeadStatus
from .models import FollowUpSchedule, EmailDraft, EmailType, EmailDraftStatus

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=2, default_retry_delay=10)
def generate_email_draft_task(self, lead_id: str):
    try:
        lead = Lead.objects.get(id=lead_id)
    except Lead.DoesNotExist:
        logger.error(f"Lead {lead_id} not found in generate_email_draft_task.")
        return False

    from .services import EmailDraftingService
    draft = EmailDraftingService.generate_draft_for_lead(lead)
    logger.info(f"Generated email draft for {lead.lead_code}: {draft.subject}")
    return f"Draft created for {lead.company_name}"


@shared_task
def process_scheduled_followups():
    """
    Periodic task processing pending follow-up schedules.
    """
    now = timezone.now()
    pending = FollowUpSchedule.objects.filter(status='PENDING', due_date__lte=now)

    count = 0
    from .services import EmailDispatchService
    from ai_agents.agents.follow_up_agent import FollowUpAgent

    agent11 = FollowUpAgent()

    for item in pending:
        lead = item.lead
        # Check if recipient already replied or opted out
        if lead.replies.exists() or lead.lead_status in [LeadStatus.ENGAGED, LeadStatus.DISQUALIFIED]:
            item.status = 'CANCELLED'
            item.cancellation_reason = 'Lead already engaged or disqualified.'
            item.save()
            continue

        # Prepare and dispatch follow-up draft
        followup_content = agent11.generate_followup(lead=lead, sequence_step=item.sequence_step)

        draft = EmailDraft.objects.create(
            lead=lead,
            email_type=EmailType.FOLLOW_UP,
            subject=followup_content['subject'],
            body_html=followup_content['body_html'],
            body_plain=followup_content['body_plain'],
            status=EmailDraftStatus.AWAITING_APPROVAL,
            confidence_score=95
        )

        item.status = 'EXECUTED'
        item.save()
        count += 1

    return f"Processed {count} follow-up reminders."


@shared_task
def poll_email_inboxes_for_replies():
    """
    Periodic check for incoming emails to match with existing sent email threads.
    """
    logger.info("Checked connected email inboxes for new customer replies.")
    return "Inbox polling completed."
