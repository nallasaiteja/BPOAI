from celery import shared_task
from django.utils import timezone
from .models import AuditLog, Notification, User, UserRole
import logging

logger = logging.getLogger(__name__)

@shared_task
def generate_daily_executive_report():
    """
    Summarizes daily BPO operational performance and distributes notifications to Senior Managers.
    """
    now = timezone.now()
    yesterday = now - timezone.timedelta(days=1)

    # Count activities
    from leads.models import Lead
    from communications.models import SentEmail, EmailReply
    from proposals.models import Proposal

    leads_added = Lead.objects.filter(created_at__gte=yesterday).count()
    verified_companies = Lead.objects.filter(is_company_verified=True, updated_at__gte=yesterday).count()
    emails_dispatched = SentEmail.objects.filter(sent_at__gte=yesterday).count()
    replies_received = EmailReply.objects.filter(received_at__gte=yesterday).count()
    proposals_created = Proposal.objects.filter(created_at__gte=yesterday).count()

    summary_msg = (
        f"Daily BPO Performance Brief ({now.strftime('%d %b %Y')}): "
        f"{leads_added} new leads ingested, {verified_companies} companies verified, "
        f"{emails_dispatched} emails sent, {replies_received} replies received, "
        f"{proposals_created} proposals generated."
    )

    senior_managers = User.objects.filter(
        role__in=[UserRole.SUPER_ADMIN, UserRole.ADMINISTRATOR, UserRole.SENIOR_MANAGER]
    )

    for manager in senior_managers:
        Notification.objects.create(
            user=manager,
            title="Daily BPO Executive Summary",
            message=summary_msg,
            category="SYSTEM",
            link="/dashboard"
        )

    logger.info(f"Executive daily report distributed to {senior_managers.count()} managers.")
    return summary_msg
