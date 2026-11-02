import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from leads.models import Lead, Company

class ServiceCatalogue(models.Model):
    SERVICE_CATEGORY_CHOICES = [
        ('DIGITAL_MARKETING', 'Digital Marketing & Ads'),
        ('SEO_AEO_GEO', 'SEO, AEO and GEO'),
        ('SOFTWARE_DEV', 'Software & Web Development'),
        ('MOBILE_DEV', 'Mobile Applications'),
        ('AI_AUTOMATION', 'AI, Chatbots & Automation'),
        ('CLOUD_DEVOPS', 'Cloud & Infrastructure'),
        ('ENTERPRISE_SOLUTIONS', 'CRM, ERP & HRMS'),
        ('HEALTHCARE_TECH', 'Healthcare & Life Sciences Software'),
        ('ECOMMERCE', 'E-commerce Solutions'),
        ('BPO_OPERATIONS', 'Business Process Outsourcing & Support'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    code = models.SlugField(max_length=100, unique=True)
    category = models.CharField(max_length=50, choices=SERVICE_CATEGORY_CHOICES)
    description = models.TextField()
    deliverables = models.JSONField(default=list, blank=True)
    key_benefits = models.JSONField(default=list, blank=True)
    default_hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=1500.00)
    default_fixed_price = models.DecimalField(max_digits=12, decimal_places=2, default=125000.00)
    currency = models.CharField(max_length=10, default='INR')
    estimated_timeline = models.CharField(max_length=100, default='4-8 Weeks')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.name} [{self.get_category_display()}]"

class RequirementCategory(models.TextChoices):
    WEBSITE_DEV = 'WEBSITE_DEV', _('Website Development')
    WEB_APP_DEV = 'WEB_APP_DEV', _('Web Application Development')
    MOBILE_APP_DEV = 'MOBILE_APP_DEV', _('Mobile Application Development')
    CUSTOM_SOFTWARE = 'CUSTOM_SOFTWARE', _('Custom Software Development')
    AI_DEV = 'AI_DEV', _('AI Development')
    AI_CHATBOTS = 'AI_CHATBOTS', _('AI Chatbots and Automation')
    CRM_DEV = 'CRM_DEV', _('CRM Development')
    ERP_DEV = 'ERP_DEV', _('ERP Development')
    HRMS_DEV = 'HRMS_DEV', _('HRMS Development')
    HOSPITAL_MGMT = 'HOSPITAL_MGMT', _('Hospital Management Software')
    CLOUD_TECH = 'CLOUD_TECH', _('Cloud Technologies')
    SAAS_DEV = 'SAAS_DEV', _('SaaS Development')
    ECOMMERCE_DEV = 'ECOMMERCE_DEV', _('E-commerce Development')
    DIGITAL_MARKETING = 'DIGITAL_MARKETING', _('Digital Marketing')
    SEO = 'SEO', _('Search Engine Optimization')
    GOOGLE_ADS = 'GOOGLE_ADS', _('Google Ads')
    SOCIAL_MEDIA = 'SOCIAL_MEDIA', _('Social Media Marketing')
    DATA_ANALYTICS = 'DATA_ANALYTICS', _('Data Analytics')
    BPO_AUTOMATION = 'BPO_AUTOMATION', _('Business Process Automation')
    IT_CONSULTING = 'IT_CONSULTING', _('IT Consulting and Support')

class RequirementType(models.TextChoices):
    CONFIRMED = 'CONFIRMED', _('Confirmed Requirement (Explicitly Stated)')
    ADVERTISED = 'ADVERTISED', _('Publicly Advertised Need (Job Postings/RFP)')
    INFERRED = 'INFERRED', _('AI-Inferred Opportunity (Gaps & Evidence Detected)')

class BusinessRequirement(models.Model):
    PRIORITY_CHOICES = [
        ('HIGH', 'High'),
        ('MEDIUM', 'Medium'),
        ('LOW', 'Low'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='requirements')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='requirements', null=True, blank=True)
    category = models.CharField(max_length=50, choices=RequirementCategory.choices)
    requirement_type = models.CharField(max_length=30, choices=RequirementType.choices, default=RequirementType.INFERRED)
    
    title = models.CharField(max_length=255)
    potential_business_problem = models.TextField()
    evidence_found = models.TextField(help_text="Direct quote, technology gap, or observable evidence from website/public sources")
    relevant_source_url = models.URLField(max_length=600, blank=True, null=True)
    suggested_solution = models.TextField()
    
    # Matching Merugu Service
    matched_service = models.ForeignKey(ServiceCatalogue, on_delete=models.SET_NULL, null=True, blank=True, related_name='matched_requirements')
    
    opportunity_score = models.IntegerField(default=75)  # 0 to 100
    confidence_score = models.IntegerField(default=80)   # 0 to 100
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='MEDIUM')
    suggested_intro_message = models.TextField()
    
    is_approved_by_human = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-opportunity_score', '-created_at']

    def __str__(self):
        return f"[{self.priority}] {self.get_category_display()} - {self.title} ({self.lead.company_name})"

class LeadScore(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.OneToOneField(Lead, on_delete=models.CASCADE, related_name='score_detail')
    total_score = models.IntegerField(default=0)  # 0 to 100
    category = models.CharField(max_length=30)     # Hot, Warm, Cold, etc.
    
    company_verification_score = models.IntegerField(default=0)     # Max 20
    website_availability_score = models.IntegerField(default=0)     # Max 15
    industry_relevance_score = models.IntegerField(default=0)       # Max 15
    service_requirement_score = models.IntegerField(default=0)      # Max 20
    activity_and_buying_signals_score = models.IntegerField(default=0) # Max 15
    business_email_validity_score = models.IntegerField(default=0)  # Max 15
    
    explanation = models.TextField()
    calculated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.lead.lead_code} - Score: {self.total_score} ({self.category})"
