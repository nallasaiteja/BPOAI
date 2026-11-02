import json
import logging
from typing import Dict, Any
from leads.models import Lead, LeadStatus, Company
from .models import ResearchReport, WebsitePage, ResearchSource, CompanyProduct, CompanyService
from .crawler import RespectfulWebsiteCrawler
from ai_agents.agents.website_research_agent import WebsiteResearchAgent
from ai_agents.agents.business_intelligence_agent import BusinessIntelligenceAgent

logger = logging.getLogger(__name__)

class CompanyResearchService:
    """
    Executes website crawling, invokes specialized AI research agents,
    and stores structured company intelligence reports.
    """

    @classmethod
    def execute_company_research(cls, lead: Lead) -> ResearchReport:
        website_to_crawl = lead.website_url
        if not website_to_crawl and lead.extracted_domain:
            website_to_crawl = f"https://www.{lead.extracted_domain}"

        if not website_to_crawl:
            logger.warning(f"No website available for lead {lead.lead_code}")
            return None

        # 1. Polite Public Web Crawl
        crawler = RespectfulWebsiteCrawler(website_to_crawl)
        crawl_data = crawler.crawl_target_site()

        # 2. Invoke Website Research Agent (Agent 3)
        agent3 = WebsiteResearchAgent()
        site_analysis = agent3.analyze(crawl_data=crawl_data, company_name=lead.company_name)

        # 3. Invoke Business Intelligence Agent (Agent 4)
        agent4 = BusinessIntelligenceAgent()
        bi_analysis = agent4.analyze(
            company_name=lead.company_name,
            industry=lead.industry,
            site_analysis=site_analysis,
            crawl_text=home_text if (home_text := (crawl_data.get('homepage') or {}).get('text')) else ""
        )

        # 4. Save or update ResearchReport
        home_dict = crawl_data.get('homepage') or {}
        report, _ = ResearchReport.objects.update_or_create(
            lead=lead,
            defaults={
                'company': lead.company or Company.objects.get_or_create(name=lead.company_name, defaults={'normalized_name': lead.company_name.lower()})[0],
                'company_overview': bi_analysis.get('overview') or site_analysis.get('summary') or f"Corporate profile for {lead.company_name}",
                'business_model': bi_analysis.get('business_model', 'B2B'),
                'industry': bi_analysis.get('industry') or lead.industry or 'Information Technology',
                'target_customers': bi_analysis.get('target_customers', 'Enterprise & SMB clients'),
                'operating_countries': bi_analysis.get('operating_countries', [lead.country or 'United States']),
                'main_products': bi_analysis.get('products', []),
                'main_services': bi_analysis.get('services', []),
                'tech_stack_detected': list(crawl_data.get('all_tech') or []),
                'expansion_signals': bi_analysis.get('expansion_signals', []),
                'job_openings': bi_analysis.get('job_openings', []),
                'outsourcing_opportunities': bi_analysis.get('outsourcing_opportunities', []),
                'source_urls': [p['url'] for p in crawl_data.get('pages', [])],
                'mobile_responsive': site_analysis.get('mobile_responsive', True),
                'ssl_active': website_to_crawl.startswith('https'),
                'page_speed_grade': site_analysis.get('speed_grade', 'B+'),
                'has_meta_description': bool(home_dict.get('meta_description')),
                'has_chat_widget': home_dict.get('has_chat', False),
                'social_profiles': crawl_data.get('social_links', {}),
                'website_issues': site_analysis.get('website_issues', crawl_data.get('issues', [])),
                'digital_marketing_gaps': site_analysis.get('digital_marketing_gaps', []),
                'confidence_score': bi_analysis.get('confidence_score', 85),
                'executive_summary': bi_analysis.get('executive_summary', 'Detailed analysis conducted by Merugu AI research engine.')
            }
        )

        # 5. Save Crawled Pages
        report.pages.all().delete()
        for p in crawl_data.get('pages', []):
            WebsitePage.objects.create(
                research_report=report,
                url=p['url'],
                page_type=p['page_type'],
                page_title=p.get('title', ''),
                content_snippet=p.get('text', '')[:2000],
                technologies_found=p.get('tech', [])
            )

        # 6. Save products and services under company
        if lead.company:
            for prod in bi_analysis.get('products', []):
                prod_name = prod if isinstance(prod, str) else prod.get('name', str(prod))
                CompanyProduct.objects.get_or_create(company=lead.company, name=prod_name)

            for srv in bi_analysis.get('services', []):
                srv_name = srv if isinstance(srv, str) else srv.get('name', str(srv))
                CompanyService.objects.get_or_create(company=lead.company, name=srv_name)

        lead.is_crawled = True
        lead.lead_status = LeadStatus.RESEARCHED
        lead.save()

        return report
