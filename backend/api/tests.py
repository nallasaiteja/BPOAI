from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from core.models import User, UserRole, Organization
from leads.models import Lead, LeadStatus, LeadSource, LeadScoreCategory
from requirements_ai.models import ServiceCatalogue
from communications.models import EmailDraft, EmailDraftStatus
from proposals.models import Proposal, ProposalStatus
from leads.services import EmailDomainIntelligenceService

class MeruguBPOComprehensiveBackendTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(
            name="Merugu Digital Marketing And Life Science Pvt. Ltd.",
            domain="meruguglobal.com"
        )
        
        # Test users
        self.admin_user = User.objects.create_user(
            username="test_admin",
            email="admin@merugutest.com",
            password="TestPassword123!",
            role=UserRole.SUPER_ADMIN,
            organization=self.org,
            is_approved=True
        )
        self.researcher_user = User.objects.create_user(
            username="test_researcher",
            email="researcher@merugutest.com",
            password="TestPassword123!",
            role=UserRole.RESEARCH_EXECUTIVE,
            organization=self.org,
            is_approved=True
        )
        self.readonly_user = User.objects.create_user(
            username="test_readonly",
            email="readonly@merugutest.com",
            password="TestPassword123!",
            role=UserRole.READ_ONLY,
            organization=self.org,
            is_approved=True
        )

        # Service Catalogue
        self.service = ServiceCatalogue.objects.create(
            name="AI-Powered Customer Support & BPO",
            code="ai-bpo-support",
            category="BPO_OPERATIONS",
            description="24/7 intelligent omnichannel customer support",
            default_fixed_price=2500.00,
            currency="USD"
        )

    # 1. AUTHENTICATION & RBAC TESTS
    def test_auth_login_success(self):
        """Verify login endpoint generates auth token for valid user."""
        response = self.client.post('/api/v1/auth/login/', {
            'username': 'test_admin',
            'password': 'TestPassword123!'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('token', response.data)
        self.assertEqual(response.data['user']['role'], UserRole.SUPER_ADMIN)

    def test_auth_login_invalid_credentials(self):
        """Verify invalid login attempt returns 400."""
        response = self.client.post('/api/v1/auth/login/', {
            'username': 'test_admin',
            'password': 'WrongPassword999!'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthenticated_access_denied(self):
        """Verify protected endpoints reject unauthenticated requests."""
        response = self.client.get('/api/v1/leads/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # 2. LEAD DOMAIN INTELLIGENCE & EXPLAINABILITY TESTS
    def test_email_domain_service_corporate_domain(self):
        """Verify high confidence score for verified corporate domain."""
        lead = Lead.objects.create(
            contact_person="Satya Nadella",
            business_email="contact@microsoft.com",
            company_name="Microsoft Corporation",
            website_url="https://microsoft.com"
        )
        EmailDomainIntelligenceService.analyze_lead_domain(lead)
        lead.refresh_from_db()
        self.assertGreaterEqual(lead.domain_confidence_score, 70)
        self.assertTrue(lead.is_business_domain)
        self.assertFalse(lead.manual_verification_required)

    def test_email_domain_service_free_email_low_percentage_explanation(self):
        """Verify low confidence score (< 70%) provides explicit deduction reasons."""
        lead = Lead.objects.create(
            contact_person="John Doe",
            business_email="testuser@gmail.com",
            company_name="Acme Global Solutions"
        )
        EmailDomainIntelligenceService.analyze_lead_domain(lead)
        lead.refresh_from_db()
        self.assertLess(lead.domain_confidence_score, 70)
        self.assertFalse(lead.is_business_domain)
        self.assertTrue(lead.manual_verification_required)
        self.assertIn("Public free email provider", lead.company.verification_notes)
        self.assertIn(">= 70%", lead.company.verification_notes)

    # 3. LEAD CREATION, EXPLAINABILITY SERIALIZATION & CRUD TESTS
    def test_create_lead_with_explainability(self):
        """Verify creating a lead runs domain analysis and saves verification reason."""
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "contact_person": "Sundar Pichai",
            "business_email": "sundar@google.com",
            "company_name": "Google",
            "website_url": "https://google.com",
            "industry": "Information Technology",
            "lead_source": LeadSource.MANUAL,
            "lead_status": LeadStatus.NEW
        }
        response = self.client.post('/api/v1/leads/', payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['company_name'], "Google")
        self.assertIsNotNone(response.data.get('domain_confidence_score'))
        self.assertIsNotNone(response.data.get('verification_reason'))
        self.assertIsNotNone(response.data.get('verification_details'))

    def test_create_lead_low_score_has_deduction_reasons(self):
        """Verify manual lead with gmail receives low score and explanation."""
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "contact_person": "John Doe",
            "business_email": "johndoe123@gmail.com",
            "company_name": "Apex Freelancing",
            "lead_source": LeadSource.MANUAL
        }
        response = self.client.post('/api/v1/leads/', payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertLess(response.data['domain_confidence_score'], 70)
        self.assertIn("Public free email provider", response.data['verification_reason'])
        self.assertIn(">= 70%", response.data['verification_reason'])

    # 4. LEAD DELETION IN ALL SECTIONS & CASCADE VERIFICATION
    def test_delete_lead_and_cascade_cleanup(self):
        """Verify deleting a lead cleanly deletes lead and downstream drafts/proposals."""
        self.client.force_authenticate(user=self.admin_user)
        lead = Lead.objects.create(
            contact_person="Temp Lead",
            business_email="temp@example.com",
            company_name="Temporary Inc."
        )
        lead_id = str(lead.id)

        # Create associated draft and proposal
        draft = EmailDraft.objects.create(
            lead=lead,
            subject="Test Outreach",
            body_html="<p>Test</p>",
            body_plain="Test",
            status=EmailDraftStatus.AWAITING_APPROVAL
        )
        proposal = Proposal.objects.create(
            lead=lead,
            title="Temp Proposal",
            executive_summary="Summary",
            identified_challenges="Challenges",
            proposed_solution="Solutions",
            status=ProposalStatus.DRAFT
        )

        # Confirm existence
        self.assertTrue(Lead.objects.filter(id=lead_id).exists())
        self.assertTrue(EmailDraft.objects.filter(id=draft.id).exists())
        self.assertTrue(Proposal.objects.filter(id=proposal.id).exists())

        # Perform API deletion
        delete_resp = self.client.delete(f'/api/v1/leads/{lead_id}/')
        self.assertEqual(delete_resp.status_code, status.HTTP_204_NO_CONTENT)

        # Verify cascade removal
        self.assertFalse(Lead.objects.filter(id=lead_id).exists())
        self.assertFalse(EmailDraft.objects.filter(id=draft.id).exists())
        self.assertFalse(Proposal.objects.filter(id=proposal.id).exists())

    # 5. EMAIL OUTREACH REJECTION AND APPROVAL
    def test_email_draft_rejection_and_deletion(self):
        """Verify rejecting an email draft deletes it cleanly from queue."""
        self.client.force_authenticate(user=self.admin_user)
        lead = Lead.objects.create(
            contact_person="Jane Smith",
            business_email="jane@innovatecorp.com",
            company_name="Innovate Corp"
        )
        draft = EmailDraft.objects.create(
            lead=lead,
            subject="Outreach Proposal",
            body_html="<p>Custom Proposal Content</p>",
            body_plain="Custom Proposal Content",
            status=EmailDraftStatus.AWAITING_APPROVAL
        )
        draft_id = str(draft.id)
        
        # Test draft rejection endpoint
        reject_resp = self.client.post(f'/api/v1/email-drafts/{draft_id}/reject/', {
            'reason': 'Content needs revision'
        })
        self.assertEqual(reject_resp.status_code, status.HTTP_200_OK)
        # Verify draft was removed from queue/database
        self.assertFalse(EmailDraft.objects.filter(id=draft_id).exists())

    # 6. DASHBOARD ANALYTICS DYNAMIC CALCULATION
    def test_dashboard_analytics_derived_from_db(self):
        """Verify analytics endpoint derives statistics directly from database records."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/analytics/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertIn('kpis', data)
        kpis = data['kpis']
        self.assertIn('total_leads', kpis)
        self.assertIn('emails_sent', kpis)
        self.assertIn('quotations_generated', kpis)
        self.assertIsInstance(kpis['total_leads'], int)

    # 7. SECURITY & SQL INJECTION RESISTANCE
    def test_search_sql_injection_resistance(self):
        """Verify search parameters are SQL injection safe."""
        self.client.force_authenticate(user=self.admin_user)
        sqli_query = "'; DROP TABLE leads_lead; --"
        response = self.client.get(f'/api/v1/leads/?search={sqli_query}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Lead.objects.all().count() >= 0)

    # 8. QUOTATION PRICING, INR CURRENCY & EDIT WORKFLOW
    def test_approve_unpriced_proposal_rejected(self):
        """Verify approving an unpriced proposal returns 400 Bad Request."""
        self.client.force_authenticate(user=self.admin_user)
        lead = Lead.objects.create(
            contact_person="Price Test",
            business_email="price@test.com",
            company_name="Unpriced Corp"
        )
        proposal = Proposal.objects.create(
            lead=lead,
            title="Unpriced Proposal",
            status=ProposalStatus.AWAITING_APPROVAL
        )
        # Attempt to approve without quotation line items
        res = self.client.post(f'/api/v1/proposals/{proposal.id}/approve/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Quotation pricing is incomplete", res.data.get('error', ''))

    def test_update_quotation_and_approve_in_inr(self):
        """Verify updating quotation in INR calculates totals and allows approval."""
        self.client.force_authenticate(user=self.admin_user)
        lead = Lead.objects.create(
            contact_person="Priced Test",
            business_email="priced@test.com",
            company_name="Priced Corp"
        )
        proposal = Proposal.objects.create(
            lead=lead,
            title="Priced Proposal",
            status=ProposalStatus.AWAITING_APPROVAL
        )
        payload = {
            "currency": "INR",
            "tax_rate": 18.00,
            "discount_percentage": 5.00,
            "line_items": [
                {
                    "description": "AI Workflow Automation Suite",
                    "quantity": 1,
                    "unit_price": 150000.00
                }
            ],
            "notes": "50% advance on sign-off."
        }
        update_res = self.client.post(f'/api/v1/proposals/{proposal.id}/update_quotation/', payload, format='json')
        self.assertEqual(update_res.status_code, status.HTTP_200_OK)
        quot_data = update_res.data['quotation']
        self.assertEqual(quot_data['currency'], 'INR')
        self.assertEqual(float(quot_data['subtotal']), 150000.00)
        self.assertEqual(float(quot_data['discount_amount']), 7500.00)
        self.assertEqual(float(quot_data['tax_amount']), 25650.00)
        self.assertEqual(float(quot_data['total_amount']), 168150.00)

        # Now approval should succeed
        approve_res = self.client.post(f'/api/v1/proposals/{proposal.id}/approve/')
        self.assertEqual(approve_res.status_code, status.HTTP_200_OK)
        proposal.refresh_from_db()
        self.assertEqual(proposal.status, ProposalStatus.APPROVED)
