import os
import logging
from django.core.files.base import ContentFile
from leads.models import Lead, LeadStatus
from requirements_ai.models import BusinessRequirement, ServiceCatalogue
from .models import Proposal, Quotation, QuotationLineItem, ProposalConfig, ProposalStatus, ProposalType
from .document_engine import ProposalDocumentEngine
from ai_agents.agents.proposal_generation_agent import ProposalGenerationAgent

logger = logging.getLogger(__name__)

class ProposalGenerationService:
    """
    Module 9: Automated proposal and quotation generator.
    Enforces that commercial pricing derives solely from configured ServiceCatalogue pricing rules.
    """

    @classmethod
    def get_or_create_config(cls) -> ProposalConfig:
        config = ProposalConfig.objects.first()
        if not config:
            config = ProposalConfig.objects.create()
        return config

    @classmethod
    def generate_initial_proposal(cls, lead: Lead, requirements: list) -> Proposal:
        config = cls.get_or_create_config()
        report = getattr(lead, 'research_report', None)

        # Invoke Proposal Generation Agent (Agent 9)
        agent9 = ProposalGenerationAgent()
        proposal_content = agent9.generate_proposal(lead=lead, report=report, requirements=requirements)

        # Deduplicate: Update existing proposal for this lead or create a new one
        existing_proposal = Proposal.objects.filter(lead=lead).first()
        if existing_proposal:
            existing_proposal.proposal_type = proposal_content.get('type', ProposalType.AI_AUTOMATION)
            existing_proposal.title = proposal_content.get('title', f"Digital Solutions Proposal for {lead.company_name}")
            existing_proposal.executive_summary = proposal_content.get('executive_summary', '')
            existing_proposal.identified_challenges = proposal_content.get('identified_challenges', '')
            existing_proposal.proposed_solution = proposal_content.get('proposed_solution', '')
            existing_proposal.deliverables = proposal_content.get('deliverables', [])
            existing_proposal.project_timeline = proposal_content.get('timeline', '6 - 8 Weeks')
            existing_proposal.save()
            return existing_proposal

        proposal = Proposal.objects.create(
            lead=lead,
            proposal_type=proposal_content.get('type', ProposalType.AI_AUTOMATION),
            title=proposal_content.get('title', f"Digital Solutions Proposal for {lead.company_name}"),
            executive_summary=proposal_content.get('executive_summary', ''),
            identified_challenges=proposal_content.get('identified_challenges', ''),
            proposed_solution=proposal_content.get('proposed_solution', ''),
            deliverables=proposal_content.get('deliverables', []),
            project_timeline=proposal_content.get('timeline', '6 - 8 Weeks'),
            status=ProposalStatus.AWAITING_APPROVAL
        )

        # Generate Quotation based STRICTLY on approved catalogue rates
        quotation = Quotation.objects.create(
            proposal=proposal,
            lead=lead,
            currency=config.default_currency,
            tax_rate=config.tax_percentage
        )

        # Populate Line items from matched requirements or active services
        matched_services = [req.matched_service for req in requirements if req.matched_service]
        if not matched_services:
            matched_services = list(ServiceCatalogue.objects.filter(is_active=True)[:2])

        from decimal import Decimal
        for srv in matched_services:
            QuotationLineItem.objects.create(
                quotation=quotation,
                service=srv,
                description=f"{srv.name} - Implementation & SLA",
                quantity=Decimal('1.00'),
                unit_price=srv.default_fixed_price
            )

        quotation.recalculate()

        # Render PDF & DOCX
        try:
            pdf_stream = ProposalDocumentEngine.generate_pdf(proposal, config)
            proposal.pdf_file.save(f"{proposal.proposal_code}.pdf", ContentFile(pdf_stream.read()))

            docx_stream = ProposalDocumentEngine.generate_docx(proposal, config)
            proposal.docx_file.save(f"{proposal.proposal_code}.docx", ContentFile(docx_stream.read()))
            proposal.save()
        except Exception as e:
            logger.error(f"Error rendering proposal documents: {e}")

        lead.is_proposal_generated = True
        lead.save()

        return proposal
