import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from core.models import User
from leads.models import Lead
from requirements_ai.models import ServiceCatalogue

class ProposalConfig(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_legal_name = models.CharField(max_length=255, default='Merugu Digital Marketing And Life Science Pvt. Ltd.')
    brand_display_name = models.CharField(max_length=150, default='Merugu Global')
    tax_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=18.00)
    default_currency = models.CharField(max_length=10, default='INR')
    payment_terms = models.TextField(
        default="50% upfront deposit upon SOW signing, 30% upon milestone 2 review, 20% upon final delivery & sign-off."
    )
    terms_and_conditions = models.TextField(
        default="All intellectual property developed transfers to client upon final payment settlement. Standard 30-day warranty and SLA support included."
    )
    authorized_signatory_name = models.CharField(max_length=150, default='Authorized Director')
    authorized_signatory_title = models.CharField(max_length=150, default='Director of Global Operations')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.brand_display_name} Commercial Settings"

class ProposalType(models.TextChoices):
    COMPANY_INTRO = 'COMPANY_INTRO', _('Company Introduction')
    SERVICE_PROPOSAL = 'SERVICE_PROPOSAL', _('Service Proposal')
    TECHNICAL_PROPOSAL = 'TECHNICAL_PROPOSAL', _('Technical Proposal')
    SOFTWARE_DEV = 'SOFTWARE_DEV', _('Software Development Proposal')
    DIGITAL_MARKETING = 'DIGITAL_MARKETING', _('Digital Marketing Proposal')
    AI_AUTOMATION = 'AI_AUTOMATION', _('AI Automation Proposal')
    STATEMENT_OF_WORK = 'STATEMENT_OF_WORK', _('Statement of Work (SOW)')

class ProposalStatus(models.TextChoices):
    DRAFT = 'DRAFT', _('Draft')
    AWAITING_APPROVAL = 'AWAITING_APPROVAL', _('Awaiting Approval')
    APPROVED = 'APPROVED', _('Approved')
    REJECTED = 'REJECTED', _('Rejected')
    DELIVERED = 'DELIVERED', _('Delivered to Client')

class Proposal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    proposal_code = models.CharField(max_length=32, unique=True, editable=False)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='proposals')
    proposal_type = models.CharField(max_length=50, choices=ProposalType.choices, default=ProposalType.AI_AUTOMATION)
    title = models.CharField(max_length=300)
    
    executive_summary = models.TextField()
    identified_challenges = models.TextField()
    proposed_solution = models.TextField()
    deliverables = models.JSONField(default=list, blank=True)
    project_timeline = models.CharField(max_length=150, default='6 - 8 Weeks')
    milestones = models.JSONField(default=list, blank=True)
    
    status = models.CharField(max_length=30, choices=ProposalStatus.choices, default=ProposalStatus.DRAFT)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_proposals')
    approved_at = models.DateTimeField(null=True, blank=True)
    
    pdf_file = models.FileField(upload_to='proposals/pdf/', blank=True, null=True)
    docx_file = models.FileField(upload_to='proposals/docx/', blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.proposal_code:
            import random
            self.proposal_code = f"PROP-{random.randint(10000, 99999)}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.proposal_code}] {self.title} for {self.lead.company_name}"

class Quotation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quotation_number = models.CharField(max_length=32, unique=True, editable=False)
    proposal = models.OneToOneField(Proposal, on_delete=models.CASCADE, related_name='quotation')
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='quotations')
    
    currency = models.CharField(max_length=10, default='INR')
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=18.00)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    is_admin_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.quotation_number:
            import random
            self.quotation_number = f"QUO-{random.randint(10000, 99999)}"
        super().save(*args, **kwargs)

    def recalculate(self):
        from decimal import Decimal
        items = list(QuotationLineItem.objects.filter(quotation=self))
        sub = sum((item.total_price or Decimal('0.00')) for item in items)
        disc = Decimal('0.00')
        if self.discount_percentage and self.discount_percentage > 0:
            disc = (sub * Decimal(str(self.discount_percentage))) / Decimal('100.00')
        elif self.discount_amount and self.discount_amount > 0:
            disc = Decimal(str(self.discount_amount))
        self.discount_amount = disc
        taxable = max(Decimal('0.00'), sub - disc)
        tax = (taxable * Decimal(str(self.tax_rate))) / Decimal('100.00')
        self.subtotal = sub
        self.tax_amount = tax
        self.total_amount = taxable + tax
        self.save()

    def __str__(self):
        return f"{self.quotation_number} - {self.currency} {self.total_amount}"

class QuotationLineItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='line_items')
    service = models.ForeignKey(ServiceCatalogue, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.CharField(max_length=300)
    quantity = models.DecimalField(max_digits=8, decimal_places=2, default=1.00)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    def save(self, *args, **kwargs):
        from decimal import Decimal
        qty = Decimal(str(self.quantity)) if self.quantity is not None else Decimal('1.00')
        price = Decimal(str(self.unit_price)) if self.unit_price is not None else Decimal('0.00')
        self.total_price = qty * price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.description}: {self.quantity} x {self.unit_price}"
