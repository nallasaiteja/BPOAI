import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'merugu_bpo.settings')
django.setup()

from core.models import User, UserRole, Organization
from leads.models import Lead, Company, LeadStatus, LeadScoreCategory, LeadSource
from requirements_ai.models import ServiceCatalogue, BusinessRequirement, RequirementCategory, RequirementType
from requirements_ai.services import ServiceCatalogueService
from communications.models import EmailAccount, EmailDraft, EmailType, EmailDraftStatus
from proposals.models import ProposalConfig

def run_seed():
    print("Seeding initial data for Merugu AI BPO Platform...")

    # 1. Organization
    org, _ = Organization.objects.get_or_create(
        name="Merugu Digital Marketing And Life Science Pvt. Ltd.",
        domain="meruguglobal.com"
    )
    print(f"Verified Organization: {org.name}")

    # 2. RBAC Role Accounts
    roles_data = [
        ('admin', UserRole.SUPER_ADMIN, 'Hemanth', 'Merugu', 'admin@meruguglobal.com', 'adminpassword123'),
        ('administrator', UserRole.ADMINISTRATOR, 'Anita', 'Sharma', 'anita.s@meruguglobal.com', 'password123'),
        ('manager', UserRole.SENIOR_MANAGER, 'Rajesh', 'Verma', 'rajesh.v@meruguglobal.com', 'password123'),
        ('teamlead', UserRole.BPO_TEAM_LEADER, 'Priya', 'Patel', 'priya.p@meruguglobal.com', 'password123'),
        ('researcher', UserRole.RESEARCH_EXECUTIVE, 'Vikram', 'Rao', 'vikram.r@meruguglobal.com', 'password123'),
        ('emailmarketer', UserRole.EMAIL_MARKETING_EXECUTIVE, 'Sneha', 'Reddy', 'sneha.r@meruguglobal.com', 'password123'),
        ('salesexec', UserRole.SALES_EXECUTIVE, 'Rohan', 'Mehta', 'rohan.m@meruguglobal.com', 'password123'),
        ('accountant', UserRole.ACCOUNTS_EXECUTIVE, 'Suresh', 'Kumar', 'suresh.k@meruguglobal.com', 'password123'),
        ('auditor', UserRole.READ_ONLY, 'Neha', 'Joshi', 'neha.j@meruguglobal.com', 'password123')
    ]
    for username, role, fn, ln, email, pwd in roles_data:
        u, created = User.objects.update_or_create(
            username=username,
            defaults={
                'role': role,
                'first_name': fn,
                'last_name': ln,
                'email': email,
                'organization': org,
                'is_staff': True,
                'is_superuser': (role == UserRole.SUPER_ADMIN)
            }
        )
        u.set_password(pwd)
        u.save()
    print("Seeded all 9 RBAC user accounts.")

    # 3. Service Catalogue
    ServiceCatalogueService.ensure_default_services()
    print("Service catalogue initialized.")

    # 4. Proposal Config
    ProposalConfig.objects.get_or_create(
        company_legal_name="Merugu Digital Marketing And Life Science Pvt. Ltd.",
        brand_display_name="Merugu Global",
        tax_percentage=18.00,
        default_currency="USD"
    )
    print("Commercial Proposal configuration set.")

    # 5. Default Email Account
    EmailAccount.objects.get_or_create(
        email_address="outreach@meruguglobal.com",
        defaults={
            'name': 'Merugu Global Outreach Desk',
            'sender_name': 'Merugu Global Business Development',
            'provider': 'SMTP',
            'smtp_host': 'smtp.gmail.com',
            'smtp_port': 587,
            'is_active': True,
            'daily_send_limit': 150
        }
    )

    print("\nInitialization successfully completed! Genuine configuration and RBAC accounts are ready.")

if __name__ == '__main__':
    run_seed()
