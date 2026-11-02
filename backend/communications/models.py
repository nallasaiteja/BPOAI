import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from core.models import User, Organization
from leads.models import Lead

class EmailProviderType(models.TextChoices):
    GMAIL = 'GMAIL', _('Google Workspace / Gmail')
    OUTLOOK = 'OUTLOOK', _('Microsoft 365 / Outlook')
    SMTP = 'SMTP', _('Standard SMTP / IMAP')

class EmailAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='email_accounts', null=True, blank=True)
    name = models.CharField(max_length=150, help_text="e.g. Sales Outreach (Hemanth)")
    provider = models.CharField(max_length=20, choices=EmailProviderType.choices, default=EmailProviderType.SMTP)
    email_address = models.EmailField(unique=True)
    sender_name = models.CharField(max_length=150, default="Merugu Global Business Development")
    
    # SMTP Credentials
    smtp_host = models.CharField(max_length=255, blank=True, null=True, default='smtp.gmail.com')
    smtp_port = models.IntegerField(default=587)
    smtp_user = models.CharField(max_length=255, blank=True, null=True)
    smtp_password = models.CharField(max_length=255, blank=True, null=True)
    use_tls = models.BooleanField(default=True)
    
    # OAuth Tokens (Encrypted or JSON string)
    oauth_credentials = models.JSONField(default=dict, blank=True)
    
    daily_send_limit = models.IntegerField(default=100)
    sent_count_today = models.IntegerField(default=0)
    last_reset_date = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    def can_send(self) -> bool:
        return self.is_active and (self.sent_count_today < self.daily_send_limit)

    def __str__(self):
        return f"{self.name} <{self.email_address}> ({self.provider})"

class EmailType(models.TextChoices):
    COMPANY_INTRO = 'COMPANY_INTRO', _('Company Introduction Email')
    PARTNERSHIP = 'PARTNERSHIP', _('Business Partnership Email')
    SOFTWARE_INTRO = 'SOFTWARE_INTRO', _('Software Development Introduction')
    WEBSITE_PROPOSAL = 'WEBSITE_PROPOSAL', _('Website Development Proposal')
    AI_AUTOMATION = 'AI_AUTOMATION', _('AI Automation Proposal')
    DIGITAL_MARKETING = 'DIGITAL_MARKETING', _('Digital Marketing Proposal')
    CLOUD_TECH = 'CLOUD_TECH', _('Cloud Technology Proposal')
    CUSTOM_SOFTWARE = 'CUSTOM_SOFTWARE', _('Custom Software Proposal')
    FOLLOW_UP = 'FOLLOW_UP', _('Follow-up Email')
    MEETING_REQUEST = 'MEETING_REQUEST', _('Meeting Request Email')

class EmailDraftStatus(models.TextChoices):
    DRAFT = 'DRAFT', _('Draft')
    AWAITING_APPROVAL = 'AWAITING_APPROVAL', _('Awaiting Approval')
    APPROVED = 'APPROVED', _('Approved')
    REJECTED = 'REJECTED', _('Rejected')
    SENT = 'SENT', _('Sent')

class EmailDraft(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='email_drafts')
    sender_account = models.ForeignKey(EmailAccount, on_delete=models.SET_NULL, null=True, blank=True)
    email_type = models.CharField(max_length=50, choices=EmailType.choices, default=EmailType.COMPANY_INTRO)
    
    subject = models.CharField(max_length=300)
    body_html = models.TextField()
    body_plain = models.TextField()
    
    status = models.CharField(max_length=30, choices=EmailDraftStatus.choices, default=EmailDraftStatus.AWAITING_APPROVAL)
    confidence_score = models.IntegerField(default=90)
    
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_emails')
    approval_notes = models.TextField(blank=True, null=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    
    generated_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-generated_at']

    def __str__(self):
        return f"[{self.status}] {self.subject} -> {self.lead.business_email}"

class SentEmail(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='sent_emails')
    draft = models.ForeignKey(EmailDraft, on_delete=models.SET_NULL, null=True, blank=True)
    sender_account = models.ForeignKey(EmailAccount, on_delete=models.SET_NULL, null=True, blank=True)
    recipient_email = models.EmailField()
    subject = models.CharField(max_length=300)
    body_html = models.TextField()
    message_id = models.CharField(max_length=255, unique=True, blank=True, null=True)
    
    sent_at = models.DateTimeField(auto_now_add=True)
    opened = models.BooleanField(default=False)
    opened_at = models.DateTimeField(null=True, blank=True)
    replied = models.BooleanField(default=False)

    class Meta:
        ordering = ['-sent_at']

    def __str__(self):
        return f"Sent to {self.recipient_email} on {self.sent_at.strftime('%Y-%m-%d %H:%M')}"

class ReplyClassification(models.TextChoices):
    INTERESTED = 'INTERESTED', _('Interested')
    NOT_INTERESTED = 'NOT_INTERESTED', _('Not Interested')
    REQUESTING_QUOTATION = 'REQUESTING_QUOTATION', _('Requesting Quotation')
    REQUESTING_MEETING = 'REQUESTING_MEETING', _('Requesting Meeting')
    REQUESTING_MORE_INFO = 'REQUESTING_MORE_INFO', _('Requesting More Information')
    OUT_OF_OFFICE = 'OUT_OF_OFFICE', _('Out of Office')
    WRONG_CONTACT = 'WRONG_CONTACT', _('Wrong Contact')
    UNSUBSCRIBE = 'UNSUBSCRIBE', _('Unsubscribe')

class EmailReply(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sent_email = models.ForeignKey(SentEmail, on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='replies')
    sender_email = models.EmailField()
    subject = models.CharField(max_length=300)
    body = models.TextField()
    
    ai_classification = models.CharField(max_length=50, choices=ReplyClassification.choices)
    classification_confidence = models.IntegerField(default=85)
    crm_task_created = models.BooleanField(default=False)
    action_note = models.TextField(blank=True, null=True)
    
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-received_at']

    def __str__(self):
        return f"[{self.ai_classification}] Reply from {self.sender_email}"

class FollowUpSchedule(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('EXECUTED', 'Executed'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='followup_schedules')
    sequence_step = models.IntegerField(default=1)  # 1 = Day 3, 2 = Day 7, 3 = Day 14
    due_date = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    cancellation_reason = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['due_date']

    def __str__(self):
        return f"Follow-up Step {self.sequence_step} for {self.lead.lead_code} due {self.due_date.strftime('%Y-%m-%d')}"
