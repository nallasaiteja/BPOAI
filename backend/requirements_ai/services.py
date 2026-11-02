import logging
from typing import Dict, List, Any
from leads.models import Lead, LeadStatus, LeadScoreCategory
from research.models import ResearchReport
from .models import ServiceCatalogue, BusinessRequirement, LeadScore, RequirementCategory, RequirementType
from ai_agents.agents.requirement_analysis_agent import RequirementAnalysisAgent
from ai_agents.agents.lead_scoring_agent import LeadScoringAgent
from ai_agents.agents.service_matching_agent import ServiceMatchingAgent

logger = logging.getLogger(__name__)

INITIAL_MERUGU_SERVICES = [
    {
        'name': 'AI Chatbots & Intelligent Workflow Automation',
        'code': 'ai-chatbots-automation',
        'category': 'AI_AUTOMATION',
        'description': 'End-to-end intelligent customer support chatbots, LLM workflow automations, and BPO agent copilot systems.',
        'deliverables': ['Custom RAG knowledge base', 'Omnichannel WhatsApp/Web bot', 'CRM synchronization', 'Human-in-the-loop fallback'],
        'key_benefits': ['80% reduction in response latency', '24/7 autonomous query resolution', 'Scalable support capacity'],
        'default_fixed_price': 4500.00,
        'default_hourly_rate': 65.00
    },
    {
        'name': 'Enterprise Web Application & SaaS Development',
        'code': 'enterprise-web-saas',
        'category': 'SOFTWARE_DEV',
        'description': 'Full-stack enterprise SaaS development with modern architecture, robust APIs, and high scalability.',
        'deliverables': ['React/Next.js frontend', 'Django/FastAPI backend', 'Role-based access control', 'Automated CI/CD pipelines'],
        'key_benefits': ['Cloud-native scalability', 'High security compliance', 'Intuitive user experience'],
        'default_fixed_price': 8500.00,
        'default_hourly_rate': 55.00
    },
    {
        'name': 'Modern Website Redesign & SEO/AEO Optimization',
        'code': 'modern-website-seo',
        'category': 'SEO_AEO_GEO',
        'description': 'Modern responsive web development tailored for search engines and Generative AI Search Engine (GEO/AEO) discovery.',
        'deliverables': ['Custom responsive design', 'Schema markup & rich snippets', 'Sub-second page speed', 'Conversion-optimized landing pages'],
        'key_benefits': ['Higher organic inbound traffic', 'Enhanced brand credibility', 'Top tier mobile responsiveness'],
        'default_fixed_price': 3200.00,
        'default_hourly_rate': 45.00
    },
    {
        'name': 'Full-Funnel Digital Marketing & Performance Ads',
        'code': 'digital-marketing-ads',
        'category': 'DIGITAL_MARKETING',
        'description': 'Hyper-targeted Google Ads, Meta Ads, and LinkedIn B2B campaigns driving qualified customer acquisition.',
        'deliverables': ['Ad copy & creative testing', 'Conversion tracking setup', 'Audience segmentation', 'Weekly ROI analytics'],
        'key_benefits': ['Lower customer acquisition costs (CAC)', 'Predictable inbound pipeline', 'Multi-channel attribution'],
        'default_fixed_price': 2500.00,
        'default_hourly_rate': 50.00
    },
    {
        'name': 'Custom CRM, ERP & Hospital Management Systems (HMIS)',
        'code': 'crm-erp-hmis',
        'category': 'HEALTHCARE_TECH',
        'description': 'Tailored healthcare and enterprise management software, electronic health records (EHR), and patient scheduling.',
        'deliverables': ['HIPAA/GDPR compliant architecture', 'Patient portal & telemedicine', 'Automated billing & insurance claims', 'Laboratory info system'],
        'key_benefits': ['Streamlined clinical workflows', 'Reduced paperwork overhead', 'Stringent data privacy & auditability'],
        'default_fixed_price': 12000.00,
        'default_hourly_rate': 70.00
    },
    {
        'name': 'Business Process Outsourcing & Lead Automation',
        'code': 'bpo-lead-automation',
        'category': 'BPO_OPERATIONS',
        'description': 'Comprehensive automated outbound sales, lead research, data cleansing, and back-office customer support operations.',
        'deliverables': ['AI lead verification pipeline', 'Personalized email outreach engine', 'CRM sync & follow-up scheduler', 'Dedicated account team'],
        'key_benefits': ['10x lead qualification velocity', 'Zero manual data entry burden', 'Guaranteed SLA compliance'],
        'default_fixed_price': 3000.00,
        'default_hourly_rate': 35.00
    }
]

class ServiceCatalogueService:
    @staticmethod
    def ensure_default_services():
        for srv in INITIAL_MERUGU_SERVICES:
            ServiceCatalogue.objects.get_or_create(
                code=srv['code'],
                defaults=srv
            )

class RequirementAnalysisService:
    """
    Identifies high-value business requirements backed by direct website evidence,
    and accurately pairs them with Merugu Global service offerings.
    """

    @classmethod
    def analyze_requirements_for_lead(cls, lead: Lead) -> List[BusinessRequirement]:
        ServiceCatalogueService.ensure_default_services()

        report = getattr(lead, 'research_report', None)
        if not report:
            logger.warning(f"No research report found for lead {lead.lead_code}")
            return []

        # Invoke Requirement Analysis Agent (Agent 5)
        agent5 = RequirementAnalysisAgent()
        identified_raw = agent5.analyze(lead=lead, report=report)

        # Invoke Service Matching Agent (Agent 7)
        agent7 = ServiceMatchingAgent()
        all_services = list(ServiceCatalogue.objects.filter(is_active=True))

        created_requirements = []
        for raw in identified_raw:
            matched_service = agent7.find_best_match(
                requirement_category=raw.get('category'),
                problem_description=raw.get('potential_business_problem'),
                available_services=all_services
            )

            req = BusinessRequirement.objects.create(
                lead=lead,
                company=lead.company,
                category=raw.get('category', RequirementCategory.CUSTOM_SOFTWARE),
                requirement_type=raw.get('requirement_type', RequirementType.INFERRED),
                title=raw.get('title', 'Digital Enhancement Opportunity'),
                potential_business_problem=raw.get('potential_business_problem', ''),
                evidence_found=raw.get('evidence_found', 'Identified from public website review.'),
                relevant_source_url=raw.get('relevant_source_url', lead.website_url or ''),
                suggested_solution=raw.get('suggested_solution', ''),
                matched_service=matched_service,
                opportunity_score=raw.get('opportunity_score', 75),
                confidence_score=raw.get('confidence_score', 80),
                priority=raw.get('priority', 'MEDIUM'),
                suggested_intro_message=raw.get('suggested_intro_message', '')
            )
            created_requirements.append(req)

        lead.is_requirements_analyzed = True
        lead.lead_status = LeadStatus.REQUIREMENTS_IDENTIFIED
        lead.save()

        return created_requirements


class LeadScoringService:
    """
    Module 6: Multi-factor scoring engine with explainability.
    """

    @classmethod
    def calculate_score(cls, lead: Lead) -> LeadScore:
        report = getattr(lead, 'research_report', None)
        requirements = lead.requirements.all()

        # Invoke Lead Scoring Agent (Agent 6)
        agent6 = LeadScoringAgent()
        scoring_data = agent6.score_lead(lead=lead, report=report, requirements=requirements)

        total = scoring_data['total_score']
        category = scoring_data['category']

        lead_score_obj, _ = LeadScore.objects.update_or_create(
            lead=lead,
            defaults={
                'total_score': total,
                'category': category,
                'company_verification_score': scoring_data['company_verification'],
                'website_availability_score': scoring_data['website_availability'],
                'industry_relevance_score': scoring_data['industry_relevance'],
                'service_requirement_score': scoring_data['service_requirement'],
                'activity_and_buying_signals_score': scoring_data['activity_signals'],
                'business_email_validity_score': scoring_data['email_validity'],
                'explanation': scoring_data['explanation']
            }
        )

        lead.lead_score = total
        lead.lead_score_category = category
        lead.score_breakdown = scoring_data['breakdown']
        lead.score_explanation = scoring_data['explanation']
        lead.is_scored = True
        lead.lead_status = LeadStatus.SCORED
        lead.save()

        return lead_score_obj
