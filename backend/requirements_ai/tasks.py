from celery import shared_task
import logging
from leads.models import Lead

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=2, default_retry_delay=10)
def analyze_lead_requirements_task(self, lead_id: str):
    """
    Celery task executing Requirement Analysis (Module 5) and Lead Scoring (Module 6).
    Upon scoring, triggers AI Email and Proposal Generation.
    """
    try:
        lead = Lead.objects.get(id=lead_id)
    except Lead.DoesNotExist:
        logger.error(f"Lead {lead_id} not found in analyze_lead_requirements_task.")
        return False

    from .services import RequirementAnalysisService, LeadScoringService

    # 1. Identify Requirements
    requirements = RequirementAnalysisService.analyze_requirements_for_lead(lead)
    logger.info(f"Identified {len(requirements)} requirements for {lead.lead_code}")

    # 2. Score Lead
    lead_score = LeadScoringService.calculate_score(lead)
    logger.info(f"Scored Lead {lead.lead_code}: {lead_score.total_score} ({lead_score.category})")

    # 3. Next step: queue Email Generation (Module 8)
    from communications.tasks import generate_email_draft_task
    generate_email_draft_task.delay(str(lead.id))

    return f"Requirements and Scoring complete for {lead.lead_code}"
