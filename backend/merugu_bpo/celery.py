import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'merugu_bpo.settings')

app = Celery('merugu_bpo')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Celery Beat Periodic Task Schedules
app.conf.beat_schedule = {
    'process-followup-queue-every-15-mins': {
        'task': 'communications.tasks.process_scheduled_followups',
        'schedule': crontab(minute='*/15'),
    },
    'poll-incoming-email-replies-every-10-mins': {
        'task': 'communications.tasks.poll_email_inboxes_for_replies',
        'schedule': crontab(minute='*/10'),
    },
    'generate-daily-reporting-summary': {
        'task': 'core.tasks.generate_daily_executive_report',
        'schedule': crontab(hour=23, minute=45),
    },
}

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
