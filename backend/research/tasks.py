from celery import shared_task
import logging
from leads.models import Lead

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=2, default_retry_delay=15)
def execute_company_research_task(self, lead_id: str):
    """
    Background Celery task that executes Module 3 & Module 4 research and website crawl.
    On success, invokes Module 5 & 6 requirement analysis and lead scoring.
    """
    try:
        lead = Lead.objects.get(id=lead_id)
    except Lead.DoesNotExist:
        logger.error(f"Lead {lead_id} not found in research task.")
        return False

    from .services import CompanyResearchService
    report = CompanyResearchService.execute_company_research(lead)

    if report:
        logger.info(f"Research completed successfully for {lead.lead_code}. Queueing requirement analysis.")
        from requirements_ai.tasks import analyze_lead_requirements_task
        analyze_lead_requirements_task.delay(str(lead.id))
        return f"Research completed for {lead.company_name}"
    else:
        logger.warning(f"Research skipped or failed for {lead.lead_code}")
        return "Research skipped"
