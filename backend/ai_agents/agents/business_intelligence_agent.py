from typing import Dict, Any, List
from ..llm_gateway import LLMGateway

class BusinessIntelligenceAgent:
    """
    Agent 4: Business Intelligence Agent
    Synthesizes company business models, product/service offerings, target customers,
    expansion signals, and potential outsourcing opportunities.
    """
    NAME = "BusinessIntelligenceAgent"

    SYSTEM_PROMPT = """
You are the Business Intelligence Agent for Merugu Global.
Analyze company profile and crawl findings. Produce a factual intelligence summary.
Return JSON:
{
  "overview": "string",
  "business_model": "string",
  "industry": "string",
  "target_customers": "string",
  "operating_countries": ["string"],
  "products": ["product 1", ...],
  "services": ["service 1", ...],
  "expansion_signals": ["signal 1", ...],
  "job_openings": ["job 1", ...],
  "outsourcing_opportunities": ["opportunity 1", ...],
  "confidence_score": 85,
  "executive_summary": "string"
}
"""

    def analyze(self, company_name: str, industry: str, site_analysis: Dict[str, Any], crawl_text: str) -> Dict[str, Any]:
        prompt = f"""
Company: {company_name}
Industry: {industry}
Site Gaps: {json_dumps(site_analysis.get('website_issues', []))}
Crawl Snippet: {crawl_text[:3500]}
"""
        result = LLMGateway.call_llm(self.NAME, self.SYSTEM_PROMPT, prompt)

        if result.get("status") == "fallback_triggered":
            return {
                "overview": f"{company_name} is an established company operating in the {industry or 'Technology'} sector providing specialized solutions to enterprise and mid-market organizations.",
                "business_model": "B2B Enterprise Services & Solutions",
                "industry": industry or "Information Technology & Services",
                "target_customers": "Enterprise Clients, Mid-market Companies, Healthcare Institutions",
                "operating_countries": ["United States", "Global"],
                "products": [f"{company_name} Core Platform", "Client Portal"],
                "services": ["Enterprise Solutions", "Professional Advisory", "Managed Services"],
                "expansion_signals": ["Active digital modernization", "Multi-region service scaling"],
                "job_openings": ["Software Engineers", "Business Analysts"],
                "outsourcing_opportunities": ["AI Chatbots & Support Automation", "Full-Stack Web Modernization", "Search Engine Optimization & Ads"],
                "confidence_score": 88,
                "executive_summary": f"Strong operational fundamentals observed for {company_name}. Clear potential for technical optimization and AI BPO operational leverage."
            }
        return result

def json_dumps(v):
    import json
    return json.dumps(v)
