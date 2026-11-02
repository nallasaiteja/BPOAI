import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _

class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, default='Merugu Digital Marketing And Life Science Pvt. Ltd.')
    domain = models.CharField(max_length=255, default='meruguglobal.com')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class UserRole(models.TextChoices):
    SUPER_ADMIN = 'SUPER_ADMIN', _('Super Administrator')
    ADMINISTRATOR = 'ADMINISTRATOR', _('Administrator')
    SENIOR_MANAGER = 'SENIOR_MANAGER', _('Senior Manager')
    BPO_TEAM_LEADER = 'BPO_TEAM_LEADER', _('BPO Team Leader')
    RESEARCH_EXECUTIVE = 'RESEARCH_EXECUTIVE', _('Research Executive')
    EMAIL_MARKETING_EXECUTIVE = 'EMAIL_MARKETING_EXECUTIVE', _('Email Marketing Executive')
    SALES_EXECUTIVE = 'SALES_EXECUTIVE', _('Sales Executive')
    ACCOUNTS_EXECUTIVE = 'ACCOUNTS_EXECUTIVE', _('Accounts Executive')
    READ_ONLY = 'READ_ONLY', _('Read-only User')

class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='users', null=True, blank=True)
    role = models.CharField(max_length=32, choices=UserRole.choices, default=UserRole.RESEARCH_EXECUTIVE)
    phone_number = models.CharField(max_length=30, blank=True, null=True)
    avatar_url = models.URLField(blank=True, null=True)
    is_approved = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def is_management(self):
        return self.role in [
            UserRole.SUPER_ADMIN,
            UserRole.ADMINISTRATOR,
            UserRole.SENIOR_MANAGER
        ]

    def can_approve_communications(self):
        return self.role in [
            UserRole.SUPER_ADMIN,
            UserRole.ADMINISTRATOR,
            UserRole.SENIOR_MANAGER,
            UserRole.BPO_TEAM_LEADER
        ]

    def can_manage_pricing(self):
        return self.role in [
            UserRole.SUPER_ADMIN,
            UserRole.ADMINISTRATOR,
            UserRole.SENIOR_MANAGER,
            UserRole.ACCOUNTS_EXECUTIVE
        ]

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"

class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100, blank=True, null=True)
    object_id = models.CharField(max_length=100, blank=True, null=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    details = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M')}] {self.user} - {self.action} on {self.model_name}"

class AIUsageLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agent_name = models.CharField(max_length=100)
    provider = models.CharField(max_length=50, default='gemini')
    model = models.CharField(max_length=50, default='gemini-2.0-flash')
    prompt_tokens = models.IntegerField(default=0)
    completion_tokens = models.IntegerField(default=0)
    total_tokens = models.IntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=8, decimal_places=5, default=0.0)
    execution_time_ms = models.IntegerField(default=0)
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.agent_name} ({self.model}) - {self.total_tokens} tokens"

class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    category = models.CharField(max_length=50, default='INFO')  # INFO, WARNING, APPROVAL, LEAD, SYSTEM
    link = models.CharField(max_length=255, blank=True, null=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.category}] {self.title} for {self.user.username}"
