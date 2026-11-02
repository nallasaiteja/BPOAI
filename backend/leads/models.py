import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from core.models import User, Organization

class Company(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, db_index=True)
    normalized_name = models.CharField(max_length=255, db_index=True)
    domain = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    website_url = models.URLField(max_length=500, blank=True, null=True)
    industry = models.CharField(max_length=150, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    linkedin_url = models.URLField(max_length=500, blank=True, null=True)
    employee_count_range = models.CharField(max_length=50, blank=True, null=True)
    is_verified = models.BooleanField(default=False)
    verification_confidence = models.IntegerField(default=0)  # 0 to 100
    verification_notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Companies'
        ordering = ['-created_at']

    def __str__(self):
        return self.name

class CompanyDomain(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='domains')
    domain_name = models.CharField(max_length=255, unique=True)
    is_business_domain = models.BooleanField(default=True)
    is_primary = models.BooleanField(default=True)
    mx_valid = models.BooleanField(default=True)
    identified_via = models.CharField(max_length=100, default='LEAD_EMAIL')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.domain_name} ({'Business' if self.is_business_domain else 'Generic'})"

class LeadSource(models.TextChoices):
    EXCEL = 'EXCEL', _('Excel (.xlsx)')
    CSV = 'CSV', _('CSV')
    MANUAL = 'MANUAL', _('Manual Entry')
    WEBSITE_FORM = 'WEBSITE_FORM', _('Website Lead Form')
    API = 'API', _('API Integration')
    CRM_IMPORT = 'CRM_IMPORT', _('CRM Import')

class LeadStatus(models.TextChoices):
    NEW = 'NEW', _('New')
    IN_RESEARCH = 'IN_RESEARCH', _('In Research')
    RESEARCHED = 'RESEARCHED', _('Researched')
    REQUIREMENTS_IDENTIFIED = 'REQUIREMENTS_IDENTIFIED', _('Requirements Identified')
    SCORED = 'SCORED', _('Scored')
    EMAIL_PREPARED = 'EMAIL_PREPARED', _('Email Prepared')
    AWAITING_APPROVAL = 'AWAITING_APPROVAL', _('Awaiting Approval')
    EMAIL_SENT = 'EMAIL_SENT', _('Email Sent')
    ENGAGED = 'ENGAGED', _('Engaged / Replied')
    CONVERTED = 'CONVERTED', _('Converted')
    COLD = 'COLD', _('Cold / Inactive')
    DISQUALIFIED = 'DISQUALIFIED', _('Disqualified')
    NEEDS_VERIFICATION = 'NEEDS_VERIFICATION', _('Needs Manual Verification')

class LeadScoreCategory(models.TextChoices):
    HOT = 'HOT', _('Hot Lead')
    WARM = 'WARM', _('Warm Lead')
    COLD = 'COLD', _('Cold Lead')
    NOT_RELEVANT = 'NOT_RELEVANT', _('Not Relevant')
    NEEDS_VERIFICATION = 'NEEDS_VERIFICATION', _('Needs Verification')

class Lead(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead_code = models.CharField(max_length=32, unique=True, editable=False, db_index=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='leads', null=True, blank=True)
    company = models.ForeignKey(Company, on_delete=models.SET_NULL, null=True, blank=True, related_name='leads')

    # Core required fields
    company_name = models.CharField(max_length=255, db_index=True)
    contact_person = models.CharField(max_length=255, blank=True, null=True)
    designation = models.CharField(max_length=150, blank=True, null=True)
    business_email = models.EmailField(max_length=255, db_index=True)
    contact_number = models.CharField(max_length=50, blank=True, null=True)
    country = models.CharField(max_length=100, default='United States', blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    industry = models.CharField(max_length=150, blank=True, null=True)
    website_url = models.URLField(max_length=500, blank=True, null=True)
    lead_source = models.CharField(max_length=50, choices=LeadSource.choices, default=LeadSource.MANUAL)
    lead_status = models.CharField(max_length=50, choices=LeadStatus.choices, default=LeadStatus.NEW)

    # Domain intelligence flags
    extracted_domain = models.CharField(max_length=255, blank=True, null=True)
    is_business_domain = models.BooleanField(default=True)
    domain_company_matched = models.BooleanField(default=False)
    is_company_verified = models.BooleanField(default=False)
    domain_confidence_score = models.IntegerField(default=0)
    manual_verification_required = models.BooleanField(default=False)

    # Lead scoring
    lead_score = models.IntegerField(default=0)  # 0 to 100
    lead_score_category = models.CharField(max_length=50, choices=LeadScoreCategory.choices, default=LeadScoreCategory.NEEDS_VERIFICATION)
    score_breakdown = models.JSONField(default=dict, blank=True)
    score_explanation = models.TextField(blank=True, null=True)

    # Deduplication hash: sha256 of lowercase business_email + normalized company_name
    dedup_hash = models.CharField(max_length=64, db_index=True)

    # Automation pipeline tracking flags
    is_cleaned = models.BooleanField(default=False)
    is_domain_analyzed = models.BooleanField(default=False)
    is_crawled = models.BooleanField(default=False)
    is_requirements_analyzed = models.BooleanField(default=False)
    is_scored = models.BooleanField(default=False)
    is_email_generated = models.BooleanField(default=False)
    is_proposal_generated = models.BooleanField(default=False)

    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_leads')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='uploaded_leads')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['business_email', 'company_name']),
            models.Index(fields=['lead_status', 'lead_score_category']),
        ]

    def save(self, *args, **kwargs):
        if not self.lead_code:
            import random
            self.lead_code = f"MRG-{random.randint(100000, 999999)}"
        if not self.dedup_hash:
            import hashlib
            norm = f"{(self.business_email or '').lower().strip()}:{(self.company_name or '').lower().strip()}"
            self.dedup_hash = hashlib.sha256(norm.encode('utf-8')).hexdigest()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.lead_code}] {self.contact_person or 'Lead'} @ {self.company_name} ({self.lead_status})"
