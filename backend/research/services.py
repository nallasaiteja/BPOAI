import logging
from typing import Dict, Any, Optional, Tuple
from django.utils import timezone
from datetime import timedelta
from leads.models import Lead, LeadStatus, LeadScoreCategory, Company
from .models import (
    ResearchReport, WebsitePage, ResearchSource,
    CompanyProduct, CompanyService, ResearchJob,
    IntelligenceFinding, ICPConfig
)
from .crawler import RespectfulWebsiteCrawler
from .intelligence_engine import CompanyIntelligenceEngine
from .scoring_engine import EvidenceBasedScoringEngine

logger = logging.getLogger(__name__)

CACHE_EXPIRY_DAYS = 14

class CompanyResearchService:
    """
    Enterprise Company Intelligence orchestrator.
    Executes controlled website crawling, structured extraction, source verification,
    and ICP-based scoring with full job lifecycle tracking and caching.
    """

    @classmethod
    def initialize_and_run(
        cls, 
        lead_id: str, 
        force_refresh: bool = False, 
        user=None
    ) -> Tuple[Optional[ResearchReport], ResearchJob]:
        lead = Lead.objects.get(id=lead_id)

        # 1. Determine Target Website URL
        raw_url = lead.website_url or ""
        if not raw_url and lead.extracted_domain:
            raw_url = f"https://www.{lead.extracted_domain}"

        norm_url, canonical_domain = RespectfulWebsiteCrawler.normalize_url(raw_url)

        # Ensure associated Company record
        if not lead.company:
            comp, _ = Company.objects.get_or_create(
                name=lead.company_name,
                defaults={
                    'normalized_name': lead.company_name.lower().strip(),
                    'domain': canonical_domain,
                    'website_url': norm_url,
                    'industry': lead.industry,
                    'country': lead.country
                }
            )
            lead.company = comp
            lead.save(update_fields=['company'])
        else:
            comp = lead.company

        # 2. Create or initialize ResearchJob
        job = ResearchJob.objects.create(
            lead=lead,
            company=comp,
            target_url=raw_url or "(No URL provided)",
            normalized_url=norm_url,
            status='PENDING',
            progress_percent=5,
            current_step='Job initialized; validating cache and domain...',
            started_at=timezone.now()
        )

        # 3. Check Research Cache (if not force_refresh)
        existing_report = getattr(lead, 'research_report', None)
        if (
            not force_refresh and 
            existing_report and 
            existing_report.updated_at >= timezone.now() - timedelta(days=CACHE_EXPIRY_DAYS) and
            existing_report.findings.exists()
        ):
            logger.info(f"Using cached research report for lead {lead.lead_code} ({lead.company_name})")
            job.status = 'COMPLETED'
            job.progress_percent = 100
            job.is_cached = True
            job.current_step = f"Loaded fresh cached report from {existing_report.updated_at.strftime('%Y-%m-%d')}"
            job.completed_at = timezone.now()
            job.save()
            return existing_report, job

        # 4. Handle Missing URL Gracefully
        if not norm_url:
            job.status = 'INSUFFICIENT_EVIDENCE'
            job.progress_percent = 100
            job.current_step = 'No valid website URL or domain provided for this company.'
            job.completed_at = timezone.now()
            job.error_message = 'Missing website URL.'
            job.save()

            # Create an insufficient evidence report
            report = cls._create_or_update_report(
                lead=lead,
                company=comp,
                extracted_data=CompanyIntelligenceEngine.extract_intelligence(
                    company_name=lead.company_name,
                    crawl_result={'coverage': {'is_accessible': False, 'issues': ['No website URL provided']}}
                ),
                scoring_data=EvidenceBasedScoringEngine.calculate_scores(
                    report_data={'coverage': {'is_accessible': False}},
                    lead_data=cls._lead_to_dict(lead)
                ),
                user=user
            )
            lead.lead_status = LeadStatus.NEEDS_VERIFICATION
            lead.lead_score = 0
            lead.lead_score_category = LeadScoreCategory.NEEDS_VERIFICATION
            lead.save()
            return report, job

        try:
            # 5. STEP 1: Crawling
            job.status = 'CRAWLING'
            job.progress_percent = 25
            job.current_step = f"Investigating {norm_url} (inspecting robots.txt, sitemaps, and core pages)..."
            job.save()

            crawler = RespectfulWebsiteCrawler(norm_url, company_name=lead.company_name)
            crawl_result = crawler.investigate_company_site()

            coverage = crawl_result.get('coverage', {})
            job.pages_discovered_count = coverage.get('pages_discovered', 0)
            job.pages_crawled_count = coverage.get('pages_investigated', 0)
            job.pages_inaccessible_count = coverage.get('pages_inaccessible', 0)
            job.pages_skipped_count = coverage.get('pages_skipped', 0)

            # 6. STEP 2: Structured Intelligence Extraction
            job.status = 'EXTRACTING'
            job.progress_percent = 60
            job.current_step = 'Extracting structured intelligence and verifying findings against source citations...'
            job.save()

            extracted = CompanyIntelligenceEngine.extract_intelligence(
                company_name=lead.company_name,
                crawl_result=crawl_result,
                industry_hint=lead.industry or ''
            )

            # 7. STEP 3: Evidence-Based ICP Scoring
            job.status = 'SCORING'
            job.progress_percent = 85
            job.current_step = 'Calculating Company Fit and Research Confidence against active ICP...'
            job.save()

            icp_config = ICPConfig.get_active_config()
            lead_dict = cls._lead_to_dict(lead)
            scoring_res = EvidenceBasedScoringEngine.calculate_scores(
                report_data=extracted,
                lead_data=lead_dict,
                icp_config=icp_config
            )

            # 8. STEP 4: Persist Report, Pages, Findings, Products & Services
            report = cls._create_or_update_report(
                lead=lead,
                company=comp,
                extracted_data=extracted,
                scoring_data=scoring_res,
                user=user
            )

            # Save Crawled Pages
            report.pages.all().delete()
            for p in crawl_result.get('pages', []):
                WebsitePage.objects.create(
                    research_report=report,
                    url=p['url'],
                    page_type=p.get('page_type', 'OTHER'),
                    page_title=p.get('title', '')[:300],
                    status_code=p.get('status_code', 200),
                    discovery_method=p.get('discovery_method', 'HOMEPAGE_LINK'),
                    word_count=p.get('word_count', 0),
                    is_accessible=p.get('is_accessible', True),
                    crawl_error=p.get('crawl_error'),
                    content_snippet=p.get('text', '')[:2500],
                    technologies_found=p.get('technologies', [])
                )

            # Save Findings (Evidence Quotes)
            report.findings.all().delete()
            for f in extracted.get('findings', []):
                IntelligenceFinding.objects.create(
                    research_report=report,
                    finding_key=f['finding_key'],
                    category=f['category'],
                    claim_value=f['claim_value'],
                    source_url=f.get('source_url'),
                    source_page_title=f.get('source_page_title'),
                    source_type=f.get('source_type', 'OFFICIAL_WEBSITE'),
                    supporting_quote=f.get('supporting_quote'),
                    verification_status=f.get('verification_status', 'VERIFIED'),
                    confidence=f.get('confidence', 85)
                )

            # Save Company Products & Services
            for prod in extracted.get('products_and_services', {}).get('main_products', []):
                prod_name = prod if isinstance(prod, str) else str(prod)
                CompanyProduct.objects.get_or_create(company=comp, name=prod_name[:250])

            for srv in extracted.get('products_and_services', {}).get('main_services', []):
                srv_name = srv if isinstance(srv, str) else str(srv)
                CompanyService.objects.get_or_create(company=comp, name=srv_name[:250])

            # 9. Update Lead state with explainable scores
            fit_score = scoring_res['company_fit_score']
            conf_score = scoring_res['research_confidence_score']
            qual_status = scoring_res['qualification_status']

            lead.is_crawled = True
            lead.is_scored = True
            lead.lead_status = LeadStatus.RESEARCHED
            lead.lead_score = fit_score
            lead.score_breakdown = scoring_res['scoring_breakdown']
            lead.score_explanation = scoring_res['scoring_breakdown']['summary']

            if qual_status == 'QUALIFIED_HOT':
                lead.lead_score_category = LeadScoreCategory.HOT
            elif qual_status == 'QUALIFIED_WARM':
                lead.lead_score_category = LeadScoreCategory.WARM
            elif qual_status == 'INSUFFICIENT_EVIDENCE':
                lead.lead_score_category = LeadScoreCategory.NEEDS_VERIFICATION
            else:
                lead.lead_score_category = LeadScoreCategory.COLD

            lead.save()

            # Complete Job
            job.status = 'COMPLETED' if qual_status != 'INSUFFICIENT_EVIDENCE' else 'INSUFFICIENT_EVIDENCE'
            job.progress_percent = 100
            job.current_step = f"Investigation complete. Fit Score: {fit_score}/100, Confidence: {conf_score}% ({qual_status})"
            job.completed_at = timezone.now()
            job.save()

            return report, job

        except Exception as e:
            logger.exception(f"Company research failed for lead {lead.lead_code}: {e}")
            job.status = 'FAILED'
            job.error_message = str(e)
            job.completed_at = timezone.now()
            job.current_step = f"Failed with error: {str(e)}"
            job.save()
            return None, job

    @classmethod
    def recalculate_score(cls, report: ResearchReport, icp_config: Optional[ICPConfig] = None) -> ResearchReport:
        """
        Recalculates Company Fit and Confidence scores on an existing report
        (e.g. after ICP weights or target criteria are modified).
        """
        if not icp_config:
            icp_config = ICPConfig.get_active_config()

        extracted_data = {
            'overview': {
                'industry': report.industry,
                'business_model': report.business_model,
                'description': report.company_overview,
                'target_customers': report.target_customers
            },
            'products_and_services': {
                'main_services': report.main_services,
                'main_products': report.main_products
            },
            'technology': {
                'tech_stack_detected': report.tech_stack_detected,
                'customer_support_tools': [t for t in report.tech_stack_detected if t in ['Intercom', 'Zendesk', 'Drift', 'Tidio']]
            },
            'size_and_capacity': {
                'employee_count_verified': report.employee_count_verified
            },
            'signals': {
                'job_openings': report.job_openings,
                'expansion_signals': report.expansion_signals
            },
            'opportunities': report.business_opportunities,
            'findings': list(report.findings.values()),
            'coverage': report.research_coverage or {'is_accessible': True}
        }

        scoring = EvidenceBasedScoringEngine.calculate_scores(
            report_data=extracted_data,
            lead_data=cls._lead_to_dict(report.lead),
            icp_config=icp_config
        )

        report.company_fit_score = scoring['company_fit_score']
        report.research_confidence_score = scoring['research_confidence_score']
        report.confidence_score = scoring['research_confidence_score']
        report.scoring_breakdown = scoring['scoring_breakdown']
        report.qualification_status = scoring['qualification_status']
        report.scoring_version = icp_config.scoring_version
        report.scoring_calculated_at = timezone.now()
        report.save()

        # Sync back to Lead
        lead = report.lead
        lead.lead_score = report.company_fit_score
        lead.score_breakdown = report.scoring_breakdown
        lead.score_explanation = report.scoring_breakdown.get('summary', '')
        if report.qualification_status == 'QUALIFIED_HOT':
            lead.lead_score_category = LeadScoreCategory.HOT
        elif report.qualification_status == 'QUALIFIED_WARM':
            lead.lead_score_category = LeadScoreCategory.WARM
        elif report.qualification_status == 'INSUFFICIENT_EVIDENCE':
            lead.lead_score_category = LeadScoreCategory.NEEDS_VERIFICATION
        else:
            lead.lead_score_category = LeadScoreCategory.COLD
        lead.save()

        return report

    @classmethod
    def _create_or_update_report(
        cls, 
        lead: Lead, 
        company: Company, 
        extracted_data: Dict[str, Any], 
        scoring_data: Dict[str, Any], 
        user=None
    ) -> ResearchReport:
        ident = extracted_data.get('identity', {})
        overview = extracted_data.get('overview', {})
        ps = extracted_data.get('products_and_services', {})
        ops = extracted_data.get('operations', {})
        tech = extracted_data.get('technology', {})
        size = extracted_data.get('size_and_capacity', {})
        signals = extracted_data.get('signals', {})
        cov = extracted_data.get('coverage', {})

        report, _ = ResearchReport.objects.update_or_create(
            lead=lead,
            defaults={
                'company': company,
                'executive_summary': extracted_data.get('executive_summary'),
                'company_overview': overview.get('description'),
                'official_company_name': ident.get('official_company_name'),
                'canonical_domain': ident.get('canonical_domain'),
                'headquarters': ident.get('headquarters'),
                'business_locations': ident.get('business_locations', []),
                'founding_year': ident.get('founding_year'),
                'business_model': overview.get('business_model'),
                'industry': overview.get('industry'),
                'secondary_industries': overview.get('secondary_industries', []),
                'target_customers': overview.get('target_customers'),
                'operating_countries': [lead.country or 'United States'],
                'main_products': ps.get('main_products', []),
                'main_services': ps.get('main_services', []),
                'solutions_offered': ps.get('solutions_offered', []),
                'public_pricing_model': ps.get('public_pricing_model'),
                'documented_clients': ops.get('documented_clients', []),
                'partnerships': ops.get('partnerships', []),
                'case_studies_summary': ops.get('case_studies_summary', []),
                'tech_stack_detected': tech.get('tech_stack_detected', []),
                'frameworks_and_platforms': tech.get('frameworks_and_platforms', []),
                'cloud_providers': tech.get('cloud_providers', []),
                'ai_automation_capabilities': tech.get('ai_automation_capabilities', []),
                'employee_count_verified': size.get('employee_count_verified'),
                'revenue_verified': size.get('revenue_verified'),
                'expansion_signals': signals.get('expansion_signals', []),
                'job_openings': signals.get('job_openings', []),
                'digital_transformation_signals': signals.get('digital_transformation_signals', []),
                'public_challenges': signals.get('public_challenges', []),
                'business_opportunities': extracted_data.get('opportunities', []),
                'outsourcing_opportunities': extracted_data.get('opportunities', []),
                'research_gaps': extracted_data.get('research_gaps', []),
                'ssl_active': cov.get('has_ssl', True),
                'mobile_responsive': True,
                'has_meta_description': bool(overview.get('description')),
                'has_chat_widget': bool(tech.get('customer_support_tools')),
                'social_profiles': cov.get('social_profiles', {}),
                'website_issues': cov.get('issues', []),
                'source_urls': [cov.get('target_url', '')] if cov.get('target_url') else [],
                'company_fit_score': scoring_data.get('company_fit_score', 0),
                'research_confidence_score': scoring_data.get('research_confidence_score', 0),
                'confidence_score': scoring_data.get('research_confidence_score', 0),
                'scoring_breakdown': scoring_data.get('scoring_breakdown', {}),
                'scoring_version': scoring_data.get('scoring_version', '1.0'),
                'scoring_calculated_at': timezone.now(),
                'qualification_status': scoring_data.get('qualification_status', 'PENDING'),
                'research_coverage': cov,
            }
        )
        return report

    @staticmethod
    def _lead_to_dict(lead: Lead) -> Dict[str, Any]:
        return {
            'id': str(lead.id),
            'lead_code': lead.lead_code,
            'company_name': lead.company_name,
            'contact_person': lead.contact_person,
            'designation': lead.designation,
            'business_email': lead.business_email,
            'contact_number': lead.contact_number,
            'country': lead.country,
            'industry': lead.industry,
            'website_url': lead.website_url,
            'employee_count': lead.employee_count,
            'is_business_domain': lead.is_business_domain,
            'is_company_verified': lead.is_company_verified,
        }
