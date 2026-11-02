from celery import shared_task
import logging
from .models import Lead, LeadStatus
from .services import EmailDomainIntelligenceService

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def process_lead_pipeline_task(self, lead_id: str):
    """
    Asynchronous Celery task orchestrating the full AI BPO automation pipeline for a single lead:
    Lead Cleaning & Domain Intelligence -> Research & Crawling -> Requirement Analysis -> Scoring -> Email Draft.
    """
    try:
        lead = Lead.objects.get(id=lead_id)
    except Lead.DoesNotExist:
        logger.error(f"Lead with id {lead_id} does not exist.")
        return False

    logger.info(f"Starting pipeline for Lead {lead.lead_code} - {lead.company_name}")

    # Step 1: Email and Domain Intelligence
    domain_result = EmailDomainIntelligenceService.analyze_lead_domain(lead)
    logger.info(f"Domain analysis completed for {lead.lead_code}: {domain_result}")

    # If manual verification is required and confidence is critically low, halt automated progression
    if lead.manual_verification_required and lead.domain_confidence_score < 40:
        logger.warning(f"Lead {lead.lead_code} flagged for manual verification. Halting automated pipeline.")
        return "Awaiting Manual Verification"

    # Step 2: Queue Website Crawling & Company Research Engine
    from research.tasks import execute_company_research_task
    execute_company_research_task.delay(str(lead.id))

    return "Pipeline Started"


@shared_task
def bulk_process_lead_batch_task(lead_ids: list):
    """
    Spawns individual pipeline tasks for each lead in a newly uploaded batch.
    """
    for lead_id in lead_ids:
        process_lead_pipeline_task.delay(lead_id)
    return f"Enqueued {len(lead_ids)} leads for automated processing."
