import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from core.models import User
from leads.models import Company, Lead

class ResearchSource(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='sources')
    title = models.CharField(max_length=255)
    url = models.URLField(max_length=600)
    source_type = models.CharField(max_length=50, default='WEBSITE')  # WEBSITE, SITEMAP, REGISTRY, JOB_BOARD
    verified_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} - {self.url}"

class ICPConfig(models.Model):
    """
    Ideal Customer Profile (ICP) Configuration.
    Defines the reference services offered by our BPO firm, target industries,
    target company types, technologies, and configurable 100-point scoring weights.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150, default='Default BPO Enterprise ICP')
    is_active = models.BooleanField(default=True)
    description = models.TextField(default='Primary scoring profile for Merugu Global BPO service offerings and enterprise solutions.')

    services_offered = models.JSONField(default=list, blank=True)
    target_industries = models.JSONField(default=list, blank=True)
    target_company_types = models.JSONField(default=list, blank=True)
    preferred_company_size_min = models.IntegerField(default=20)
    preferred_company_size_max = models.IntegerField(default=5000)
    geographic_markets = models.JSONField(default=list, blank=True)
    relevant_technologies = models.JSONField(default=list, blank=True)
    exclusion_criteria = models.JSONField(default=list, blank=True)

    # 100-point scoring weights (Must sum to 100)
    weight_industry = models.IntegerField(default=15)
    weight_service_fit = models.IntegerField(default=20)
    weight_business_needs = models.IntegerField(default=20)
    weight_company_size = models.IntegerField(default=10)
    weight_tech_maturity = models.IntegerField(default=10)
    weight_growth_signals = models.IntegerField(default=10)
    weight_geography = models.IntegerField(default=5)
    weight_contact_accessibility = models.IntegerField(default=10)

    # Qualification Thresholds
    threshold_hot = models.IntegerField(default=75)
    threshold_warm = models.IntegerField(default=50)

    scoring_version = models.CharField(max_length=50, default='1.0')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='icp_configs')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_active', '-updated_at']

    def __str__(self):
        return f"{self.name} (v{self.scoring_version}) {'[Active]' if self.is_active else ''}"

    @classmethod
    def get_active_config(cls) -> 'ICPConfig':
        config = cls.objects.filter(is_active=True).first()
        if not config:
            config = cls.objects.create(
                name='Default BPO Enterprise ICP',
                is_active=True,
                services_offered=[
                    {
                        'key': 'ai_chatbots',
                        'name': 'AI Chatbots & Intelligent Workflow Automation',
                        'category': 'AI_AUTOMATION',
                        'description': 'Customer support bots, LLM workflows, ticket triage, and conversational AI.'
                    },
                    {
                        'key': 'customer_support',
                        'name': 'Omnichannel BPO Customer Support & Contact Center',
                        'category': 'BPO_OPERATIONS',
                        'description': '24/7 Tier-1/2 customer support, chat assistance, email helpdesk, and ticketing.'
                    },
                    {
                        'key': 'web_saas_dev',
                        'name': 'Enterprise Web Application & SaaS Development',
                        'category': 'SOFTWARE_DEV',
                        'description': 'Full-stack React, Django, Next.js, and cloud portal engineering.'
                    },
                    {
                        'key': 'digital_marketing',
                        'name': 'Full-Funnel Digital Marketing & Performance Ads',
                        'category': 'DIGITAL_MARKETING',
                        'description': 'Google Ads, Meta campaigns, SEO/AEO optimization, and inbound lead generation.'
                    },
                    {
                        'key': 'data_backoffice',
                        'name': 'Back-Office Operations & Data Annotation',
                        'category': 'BPO_OPERATIONS',
                        'description': 'Data labeling for AI, catalog management, invoice processing, and CRM data hygiene.'
                    },
                    {
                        'key': 'crm_erp_hmis',
                        'name': 'Custom CRM, ERP & Hospital Management Systems (HMIS)',
                        'category': 'HEALTHCARE_TECH',
                        'description': 'Specialized clinical software, patient scheduling, EHR systems, and enterprise ERP.'
                    }
                ],
                target_industries=[
                    'Technology & SaaS', 'Healthcare & Life Sciences', 'Information Technology',
                    'Financial Services & FinTech', 'E-commerce & Retail', 'Logistics & Supply Chain',
                    'Manufacturing & Industrial', 'Telecommunications'
                ],
                target_company_types=['B2B', 'B2B2C', 'Enterprise SaaS', 'High-Growth Tech', 'Service Provider'],
                preferred_company_size_min=20,
                preferred_company_size_max=5000,
                geographic_markets=['United States', 'Canada', 'United Kingdom', 'Australia', 'Europe', 'India', 'Global'],
                relevant_technologies=[
                    'Zendesk', 'Intercom', 'Salesforce', 'HubSpot', 'React', 'Next.js',
                    'Shopify', 'WordPress', 'AWS', 'Google Cloud', 'Cloudflare', 'Stripe'
                ],
                exclusion_criteria=[
                    'Direct competitor BPO agencies', 'Non-commercial personal sites',
                    'Gambling or adult entertainment', 'Government agencies without active procurement tender'
                ]
            )
        return config

class ResearchJob(models.Model):
    """
    Tracks asynchronous and background company website investigation jobs.
    """
    JOB_STATUS_CHOICES = [
        ('PENDING', 'Pending Initialization'),
        ('CRAWLING', 'Investigating Website Pages'),
        ('EXTRACTING', 'Extracting Structured Intelligence'),
        ('SCORING', 'Calculating ICP Fit & Confidence'),
        ('COMPLETED', 'Completed Successfully'),
        ('INSUFFICIENT_EVIDENCE', 'Insufficient Evidence (Low Confidence)'),
        ('FAILED', 'Investigation Failed'),
        ('CANCELLED', 'Cancelled by User'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='research_jobs')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='research_jobs', null=True, blank=True)
    target_url = models.URLField(max_length=600)
    normalized_url = models.URLField(max_length=600, blank=True, null=True)

    status = models.CharField(max_length=40, choices=JOB_STATUS_CHOICES, default='PENDING')
    progress_percent = models.IntegerField(default=0)
    current_step = models.CharField(max_length=255, default='Initialized research job')

    pages_discovered_count = models.IntegerField(default=0)
    pages_crawled_count = models.IntegerField(default=0)
    pages_inaccessible_count = models.IntegerField(default=0)
    pages_skipped_count = models.IntegerField(default=0)

    is_cached = models.BooleanField(default=False)
    error_message = models.TextField(blank=True, null=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"ResearchJob [{self.status}] {self.target_url} ({self.progress_percent}%)"

class ResearchReport(models.Model):
    """
    Comprehensive Company Intelligence Report.
    Stores structured business information, evidence findings,
    separate Company Fit and Research Confidence scores, and audit history.
    """
    QUALIFICATION_STATUS_CHOICES = [
        ('QUALIFIED_HOT', 'High-Priority Prospect (Hot)'),
        ('QUALIFIED_WARM', 'Normal Review Queue (Warm)'),
        ('LOW_PRIORITY', 'Low Priority Prospect (Cold)'),
        ('INSUFFICIENT_EVIDENCE', 'Insufficient Evidence'),
        ('NOT_QUALIFIED', 'Poor Fit / Disqualified'),
    ]

    HUMAN_REVIEW_STATUS_CHOICES = [
        ('PENDING', 'Pending Review'),
        ('APPROVED', 'Approved for Outreach'),
        ('REJECTED', 'Rejected'),
        ('RE_RESEARCH_REQUESTED', 'Re-research Requested'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.OneToOneField(Lead, on_delete=models.CASCADE, related_name='research_report')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='research_reports')

    # Executive & Identity
    executive_summary = models.TextField(blank=True, null=True)
    company_overview = models.TextField(blank=True, null=True)
    official_company_name = models.CharField(max_length=255, blank=True, null=True)
    canonical_domain = models.CharField(max_length=255, blank=True, null=True)
    headquarters = models.CharField(max_length=255, blank=True, null=True)
    business_locations = models.JSONField(default=list, blank=True)
    founding_year = models.CharField(max_length=50, blank=True, null=True)

    # Business Overview
    business_model = models.CharField(max_length=150, blank=True, null=True)  # B2B, B2C, B2B2C, Enterprise SaaS
    industry = models.CharField(max_length=150, blank=True, null=True)
    secondary_industries = models.JSONField(default=list, blank=True)
    target_customers = models.TextField(blank=True, null=True)
    operating_countries = models.JSONField(default=list, blank=True)

    # Products & Services
    main_products = models.JSONField(default=list, blank=True)
    main_services = models.JSONField(default=list, blank=True)
    solutions_offered = models.JSONField(default=list, blank=True)
    public_pricing_model = models.CharField(max_length=255, blank=True, null=True)

    # Operations & Clients
    documented_clients = models.JSONField(default=list, blank=True)
    partnerships = models.JSONField(default=list, blank=True)
    case_studies_summary = models.JSONField(default=list, blank=True)

    # Technology Intelligence
    tech_stack_detected = models.JSONField(default=list, blank=True)
    frameworks_and_platforms = models.JSONField(default=list, blank=True)
    cloud_providers = models.JSONField(default=list, blank=True)
    ai_automation_capabilities = models.JSONField(default=list, blank=True)

    # Company Size & Capacity
    employee_count_verified = models.CharField(max_length=100, blank=True, null=True)
    revenue_verified = models.CharField(max_length=100, blank=True, null=True)

    # Business Signals
    expansion_signals = models.JSONField(default=list, blank=True)
    job_openings = models.JSONField(default=list, blank=True)
    digital_transformation_signals = models.JSONField(default=list, blank=True)
    public_challenges = models.JSONField(default=list, blank=True)

    # Opportunities & Gaps
    outsourcing_opportunities = models.JSONField(default=list, blank=True)
    business_opportunities = models.JSONField(default=list, blank=True)
    research_gaps = models.JSONField(default=list, blank=True)

    # Website Performance & Metadata
    ssl_active = models.BooleanField(default=True)
    mobile_responsive = models.BooleanField(default=True)
    page_speed_grade = models.CharField(max_length=10, default='B')
    has_meta_description = models.BooleanField(default=True)
    has_chat_widget = models.BooleanField(default=False)
    social_profiles = models.JSONField(default=dict, blank=True)
    website_issues = models.JSONField(default=list, blank=True)
    digital_marketing_gaps = models.JSONField(default=list, blank=True)
    source_urls = models.JSONField(default=list, blank=True)

    # Dual Scoring System
    company_fit_score = models.IntegerField(default=0)  # 0 to 100
    research_confidence_score = models.IntegerField(default=0)  # 0 to 100
    confidence_score = models.IntegerField(default=0)  # Legacy compatibility alias
    scoring_breakdown = models.JSONField(default=dict, blank=True)
    scoring_version = models.CharField(max_length=50, default='1.0')
    scoring_calculated_at = models.DateTimeField(null=True, blank=True)
    qualification_status = models.CharField(max_length=50, choices=QUALIFICATION_STATUS_CHOICES, default='PENDING')

    # Coverage Metrics
    research_coverage = models.JSONField(default=dict, blank=True)

    # Human Review Workflow
    human_review_status = models.CharField(max_length=50, choices=HUMAN_REVIEW_STATUS_CHOICES, default='PENDING')
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_reports')
    review_notes = models.TextField(blank=True, null=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    research_date = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-research_date']

    def __str__(self):
        return f"Report: {self.company.name} [Fit: {self.company_fit_score}%, Conf: {self.research_confidence_score}%]"

class IntelligenceFinding(models.Model):
    """
    Granular evidence finding supporting extracted company intelligence claims.
    Stores verbatim source quotes, URL, page title, and verification status.
    """
    CATEGORY_CHOICES = [
        ('IDENTITY', 'Company Identity'),
        ('OVERVIEW', 'Business Overview & Model'),
        ('PRODUCTS_SERVICES', 'Products & Services'),
        ('OPERATIONS', 'Business Operations & Clients'),
        ('TECHNOLOGY', 'Technology & Infrastructure'),
        ('SIZE_CAPACITY', 'Company Size & Capacity'),
        ('SIGNALS', 'Business Signals & Hiring'),
        ('OPPORTUNITY', 'BPO Business Opportunity'),
    ]

    VERIFICATION_CHOICES = [
        ('VERIFIED', 'Verified with Official Evidence'),
        ('INFERRED', 'AI Inferred (High Plausibility)'),
        ('CONTRADICTORY', 'Conflicting Sources Detected'),
        ('UNVERIFIED', 'Unverified / Disclosed Claim'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    research_report = models.ForeignKey(ResearchReport, on_delete=models.CASCADE, related_name='findings')
    finding_key = models.CharField(max_length=100)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    claim_value = models.TextField()

    source_url = models.URLField(max_length=600, blank=True, null=True)
    source_page_title = models.CharField(max_length=300, blank=True, null=True)
    source_type = models.CharField(max_length=50, default='OFFICIAL_WEBSITE')
    supporting_quote = models.TextField(blank=True, null=True)
    verification_status = models.CharField(max_length=30, choices=VERIFICATION_CHOICES, default='VERIFIED')
    confidence = models.IntegerField(default=85)
    contradiction_details = models.TextField(blank=True, null=True)
    retrieved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['category', '-confidence']

    def __str__(self):
        return f"[{self.category}] {self.finding_key}: {self.claim_value[:40]}"

class WebsitePage(models.Model):
    PAGE_TYPE_CHOICES = [
        ('HOMEPAGE', 'Homepage'),
        ('ABOUT', 'About Us'),
        ('OVERVIEW', 'Company Overview / Leadership'),
        ('SERVICES', 'Services'),
        ('PRODUCTS', 'Products'),
        ('SOLUTIONS', 'Solutions & Use Cases'),
        ('INDUSTRIES', 'Industries / Verticals'),
        ('CASE_STUDIES', 'Case Studies & Customers'),
        ('PARTNERS', 'Partners & Clients'),
        ('TECHNOLOGY', 'Technology & Architecture'),
        ('CAREERS', 'Careers & Jobs'),
        ('NEWS', 'News & Blog'),
        ('CONTACT', 'Contact Us & Locations'),
        ('PRICING', 'Pricing & Plans'),
        ('OTHER', 'Other Page'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    research_report = models.ForeignKey(ResearchReport, on_delete=models.CASCADE, related_name='pages')
    url = models.URLField(max_length=600)
    page_type = models.CharField(max_length=30, choices=PAGE_TYPE_CHOICES, default='OTHER')
    page_title = models.CharField(max_length=300, blank=True, null=True)
    status_code = models.IntegerField(default=200)
    discovery_method = models.CharField(max_length=50, default='HOMEPAGE_LINK')
    word_count = models.IntegerField(default=0)
    is_accessible = models.BooleanField(default=True)
    crawl_error = models.TextField(blank=True, null=True)
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
