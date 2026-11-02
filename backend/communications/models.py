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
    COMPANY_INTRO = 'COMPANY_INTRO', _('Company Introduction')
    PERSONALIZED_INTRO = 'PERSONALIZED_INTRO', _('Personalized Business Introduction')
    VALUE_FOCUSED = 'VALUE_FOCUSED', _('Value-Focused Outreach')
    EXECUTIVE = 'EXECUTIVE', _('Executive-Level Outreach')
    TECH_SOLUTIONS = 'TECH_SOLUTIONS', _('Technology & Digital Solutions')
    FOLLOW_UP = 'FOLLOW_UP', _('Follow-up Email')
    MEETING_REQUEST = 'MEETING_REQUEST', _('Meeting Request')
    SERVICE_SPECIFIC = 'SERVICE_SPECIFIC', _('Service-Specific Outreach')
    PARTNERSHIP = 'PARTNERSHIP', _('Business Partnership Email')
    SOFTWARE_INTRO = 'SOFTWARE_INTRO', _('Software Development Introduction')
    WEBSITE_PROPOSAL = 'WEBSITE_PROPOSAL', _('Website Development Proposal')
    AI_AUTOMATION = 'AI_AUTOMATION', _('AI Automation Proposal')
    DIGITAL_MARKETING = 'DIGITAL_MARKETING', _('Digital Marketing Proposal')
    CLOUD_TECH = 'CLOUD_TECH', _('Cloud Technology Proposal')
    CUSTOM_SOFTWARE = 'CUSTOM_SOFTWARE', _('Custom Software Proposal')

class EmailDraftStatus(models.TextChoices):
    DRAFT = 'DRAFT', _('Draft')
    AWAITING_APPROVAL = 'AWAITING_APPROVAL', _('Awaiting Approval')
    APPROVED = 'APPROVED', _('Approved')
    REJECTED = 'REJECTED', _('Rejected')
    SENT = 'SENT', _('Sent')

class GenerationMethod(models.TextChoices):
    AI_GENERATED = 'AI_GENERATED', _('AI Generated')
    TEMPLATE_FALLBACK = 'TEMPLATE_FALLBACK', _('Template Fallback')

class CompanyOutreachProfile(models.Model):
    """
    Configurable Company Profile defining our organization's identity,
    verified service capabilities, differentiators, case studies, and sender profile.
    Used by AI prompts and predefined fallback templates.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_name = models.CharField(max_length=255, default='Merugu Digital Marketing And Life Science Pvt. Ltd.')
    brand_name = models.CharField(max_length=150, default='Merugu Global')
    website = models.URLField(max_length=255, default='https://meruguglobal.com')
    business_introduction = models.TextField(
        default="Merugu Global is a technology solutions and business process automation partner delivering high-impact software engineering, AI workflow integration, and digital operations support for growing enterprises."
    )
    services_offered = models.JSONField(
        default=list,
        blank=True,
        help_text="Services we provide (e.g. ['AI Workflow Automation & Intelligent Processing', 'Enterprise Web & Cloud Software Engineering', 'Healthcare Software Systems (HMIS)', 'Back-Office Operations Automation'])"
    )
    target_industries = models.JSONField(
        default=list,
        blank=True,
        help_text="Target industry verticals"
    )
    ideal_customer_profile = models.TextField(
        default="Mid-market and enterprise organizations seeking to modernize legacy operations, eliminate repetitive bottlenecks, and deploy enterprise-grade digital solutions."
    )
    key_differentiators = models.JSONField(
        default=list,
        blank=True,
        help_text="Key differentiators & proof points"
    )
    case_studies = models.JSONField(
        default=list,
        blank=True,
        help_text="Verified portfolio references"
    )
    testimonials = models.JSONField(
        default=list,
        blank=True,
        help_text="Approved testimonials"
    )
    contact_email = models.EmailField(default='bpo@meruguglobal.com')
    contact_phone = models.CharField(max_length=50, default='+91 80 4123 4567')
    business_address = models.TextField(default='Bangalore, Karnataka, India')
    sender_name = models.CharField(max_length=150, default='Hemanth Kumar')
    sender_designation = models.CharField(max_length=150, default='Head of Business Development')
    preferred_tone = models.CharField(max_length=50, default='PROFESSIONAL_CONSULTATIVE')
    desired_cta = models.CharField(max_length=255, default='Brief 15-minute introductory call next Tuesday or Wednesday')
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Company Outreach Profile'
        verbose_name_plural = 'Company Outreach Profiles'

    @classmethod
    def get_active_profile(cls):
        profile = cls.objects.filter(is_active=True).first()
        if not profile:
            profile = cls.objects.create(
                company_name='Merugu Digital Marketing And Life Science Pvt. Ltd.',
                brand_name='Merugu Global',
                website='https://meruguglobal.com',
                business_introduction='Merugu Global engineers enterprise-grade AI automation, full-stack software solutions, and healthcare systems that eliminate operational friction and accelerate growth.',
                services_offered=[
                    'AI Workflow Automation & Intelligent Document Processing',
                    'Enterprise Web & Cloud Software Engineering',
                    'Healthcare Software Systems (HMIS & Clinical Workflows)',
                    'Back-Office Process Modernization & Data Extraction'
                ],
                target_industries=[
                    'Healthcare & Life Sciences',
                    'Information Technology & Software',
                    'Financial Services',
                    'E-Commerce & Digital Services'
                ],
                key_differentiators=[
                    'Production-tested architecture and high-availability systems',
                    'Data security and regulatory compliance focus',
                    'Flexible engagement models with transparent timelines'
                ],
                case_studies=[
                    {
                        'title': 'Healthcare Workflow Intake Engine',
                        'result': 'Modernized intake throughput by 65% with zero data loss.'
                    }
                ],
                contact_email='bpo@meruguglobal.com',
                contact_phone='+91 80 4123 4567',
                business_address='Bangalore, Karnataka, India',
                sender_name='Hemanth Kumar',
                sender_designation='Head of Business Development',
                preferred_tone='PROFESSIONAL_CONSULTATIVE',
                desired_cta='Brief 15-minute introductory conversation next week'
            )
        return profile

    def get_missing_fields_warning(self):
        warnings = []
        if not self.company_name: warnings.append('Company Name is missing.')
        if not self.website: warnings.append('Company Website URL is missing.')
        if not self.services_offered: warnings.append('No services are configured in company profile.')
        if not self.sender_name: warnings.append('Sender Name is missing.')
        if not self.sender_designation: warnings.append('Sender Designation is missing.')
        if not self.contact_email: warnings.append('Contact Email address is missing.')
        return warnings

    def __str__(self):
        return f"{self.brand_name} ({self.company_name})"


class EmailDraft(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='email_drafts')
    sender_account = models.ForeignKey(EmailAccount, on_delete=models.SET_NULL, null=True, blank=True)
    email_type = models.CharField(max_length=50, choices=EmailType.choices, default=EmailType.COMPANY_INTRO)
    outreach_style = models.CharField(max_length=50, default='PERSONALIZED_INTRO')
    
    subject = models.CharField(max_length=300)
    body_html = models.TextField()
    body_plain = models.TextField()

    # Original versions for revert support
    original_subject = models.CharField(max_length=300, blank=True, null=True)
    original_body_html = models.TextField(blank=True, null=True)
    original_body_plain = models.TextField(blank=True, null=True)
    
    status = models.CharField(max_length=30, choices=EmailDraftStatus.choices, default=EmailDraftStatus.AWAITING_APPROVAL)
    confidence_score = models.IntegerField(default=90)

    # AI vs Fallback tracking & provenance
    generation_method = models.CharField(max_length=30, choices=GenerationMethod.choices, default=GenerationMethod.AI_GENERATED)
    fallback_reason = models.CharField(max_length=200, blank=True, null=True)
    ai_model_used = models.CharField(max_length=100, default='gemini-2.5-flash', blank=True, null=True)
    personalization_sources = models.JSONField(default=list, blank=True)
    validation_warnings = models.JSONField(default=list, blank=True)
    quality_score = models.IntegerField(default=95)
    
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
