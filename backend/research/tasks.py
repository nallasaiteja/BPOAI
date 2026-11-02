from celery import shared_task
import logging
from leads.models import Lead

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=2, default_retry_delay=15)
def execute_company_research_task(self, lead_id: str, force_refresh: bool = False):
    """
    Background Celery task that executes enterprise company website discovery,
    evidence-based intelligence extraction, and ICP-based scoring.
    """
    try:
        lead = Lead.objects.get(id=lead_id)
    except Lead.DoesNotExist:
        logger.error(f"Lead {lead_id} not found in research task.")
        return False

    from .services import CompanyResearchService
    report, job = CompanyResearchService.initialize_and_run(lead_id=str(lead.id), force_refresh=force_refresh)

    if report:
        logger.info(f"Research completed successfully for {lead.lead_code} ({lead.company_name}).")
        try:
            from requirements_ai.tasks import analyze_lead_requirements_task
            analyze_lead_requirements_task.delay(str(lead.id))
        except Exception as e:
            logger.debug(f"Async downstream queue not reachable: {e}")
        return f"Research completed for {lead.company_name} (Fit: {report.company_fit_score}%, Confidence: {report.research_confidence_score}%)"
    else:
        logger.warning(f"Research finished with error for {lead.lead_code}: {job.error_message}")
        return f"Research failed: {job.error_message}"
