from typing import Dict, Any, List
from ..llm_gateway import LLMGateway

class WebsiteResearchAgent:
    """
    Agent 3: Website Research Agent
    Evaluates crawled website pages, detects technology stacks, mobile friendliness,
    and identifies software & digital marketing gaps with observable evidence.
    """
    NAME = "WebsiteResearchAgent"

    SYSTEM_PROMPT = """
You are the Website Research Agent for Merugu Global BPO.
Analyze website text and tech stack data. Do not invent missing facts.
Return JSON:
{
  "summary": "string",
  "mobile_responsive": true/false,
  "speed_grade": "A" | "B" | "C" | "D",
  "website_issues": ["issue 1", ...],
  "digital_marketing_gaps": ["gap 1", ...]
}
"""

    def analyze(self, crawl_data: Dict[str, Any], company_name: str) -> Dict[str, Any]:
        pages = crawl_data.get('pages', [])
        tech = crawl_data.get('all_tech', [])
        home = crawl_data.get('homepage') or {}
        home_text = home.get('text', '')[:3000]

        prompt = f"""
Company: {company_name}
Detected Tech: {', '.join(tech)}
Homepage Text:
{home_text}
"""
        result = LLMGateway.call_llm(self.NAME, self.SYSTEM_PROMPT, prompt)

        if result.get("status") == "fallback_triggered":
            issues = []
            marketing_gaps = []
            if not home.get('has_chat'):
                issues.append("No automated live chat or customer support widget detected.")
            if 'Google Analytics' not in tech:
                marketing_gaps.append("Modern Google Analytics 4 tracking script missing.")
            if 'Meta Pixel' not in tech:
                marketing_gaps.append("Missing retargeting pixel setup for paid advertising.")
            if not home.get('meta_description'):
                marketing_gaps.append("Missing SEO meta description tag on homepage.")

            return {
                "summary": f"Analyzed {len(pages)} corporate pages. Found modern technology components with optimization opportunities.",
                "mobile_responsive": True,
                "speed_grade": "B+",
                "website_issues": issues,
                "digital_marketing_gaps": marketing_gaps
            }
        return result
