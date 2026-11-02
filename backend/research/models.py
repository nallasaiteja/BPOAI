import uuid
from django.db import models
from leads.models import Company, Lead

class ResearchSource(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='sources')
    title = models.CharField(max_length=255)
    url = models.URLField(max_length=600)
    source_type = models.CharField(max_length=50, default='WEBSITE')  # WEBSITE, SEARCH, REGISTRY, JOB_BOARD
    verified_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} - {self.url}"

class ResearchReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.OneToOneField(Lead, on_delete=models.CASCADE, related_name='research_report')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='research_reports')

    company_overview = models.TextField(blank=True, null=True)
    business_model = models.CharField(max_length=150, blank=True, null=True)  # B2B, B2C, D2C, Enterprise SaaS, etc.
    industry = models.CharField(max_length=150, blank=True, null=True)
    target_customers = models.TextField(blank=True, null=True)
    operating_countries = models.JSONField(default=list, blank=True)

    # Detailed extractions
    main_products = models.JSONField(default=list, blank=True)
    main_services = models.JSONField(default=list, blank=True)
    tech_stack_detected = models.JSONField(default=list, blank=True)
    expansion_signals = models.JSONField(default=list, blank=True)
    job_openings = models.JSONField(default=list, blank=True)
    outsourcing_opportunities = models.JSONField(default=list, blank=True)
    source_urls = models.JSONField(default=list, blank=True)

    # Website analysis findings
    ssl_active = models.BooleanField(default=True)
    mobile_responsive = models.BooleanField(default=True)
    page_speed_grade = models.CharField(max_length=10, default='B')
    has_meta_description = models.BooleanField(default=True)
    has_chat_widget = models.BooleanField(default=False)
    social_profiles = models.JSONField(default=dict, blank=True)
    website_issues = models.JSONField(default=list, blank=True)
    digital_marketing_gaps = models.JSONField(default=list, blank=True)

    confidence_score = models.IntegerField(default=0)
    executive_summary = models.TextField(blank=True, null=True)
    research_date = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-research_date']

    def __str__(self):
        return f"Research Report: {self.company.name} ({self.research_date.strftime('%Y-%m-%d')})"

class WebsitePage(models.Model):
    PAGE_TYPE_CHOICES = [
        ('HOMEPAGE', 'Homepage'),
        ('ABOUT', 'About Us'),
        ('SERVICES', 'Services'),
        ('PRODUCTS', 'Products'),
        ('CAREERS', 'Careers & Jobs'),
        ('CONTACT', 'Contact Us'),
        ('BLOG', 'Blog / Insights'),
        ('OTHER', 'Other Page'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    research_report = models.ForeignKey(ResearchReport, on_delete=models.CASCADE, related_name='pages')
    url = models.URLField(max_length=600)
    page_type = models.CharField(max_length=20, choices=PAGE_TYPE_CHOICES, default='OTHER')
    page_title = models.CharField(max_length=300, blank=True, null=True)
    status_code = models.IntegerField(default=200)
    content_snippet = models.TextField(blank=True, null=True)
    technologies_found = models.JSONField(default=list, blank=True)
    scraped_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_page_type_display()} - {self.url}"

class CompanyProduct(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='products')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    source_url = models.URLField(max_length=600, blank=True, null=True)

    def __str__(self):
        return f"{self.name} ({self.company.name})"

class CompanyService(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='services')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    source_url = models.URLField(max_length=600, blank=True, null=True)

    def __str__(self):
        return f"{self.name} ({self.company.name})"
