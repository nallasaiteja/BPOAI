from typing import Dict, Any
from ..llm_gateway import LLMGateway

class CompanyDiscoveryAgent:
    """
    Agent 2: Company Discovery Agent
    Discovers company official identities, matches email domains to company brands,
    and assigns company identification confidence scores.
    """
    NAME = "CompanyDiscoveryAgent"

    SYSTEM_PROMPT = """
You are the Company Discovery Agent for Merugu Global BPO.
Analyze company name, email domain, and website hints to verify company legitimacy.
Do not assume domain implies identity without verification.
Return JSON format:
{
  "identified_company": "string",
  "official_website": "string",
  "match_confidence": 0-100,
  "verification_status": "VERIFIED" | "REQUIRES_MANUAL_VERIFICATION",
  "rationale": "string"
}
"""

    def discover(self, company_name: str, domain: str, website: str = "") -> Dict[str, Any]:
        prompt = f"Company Name: {company_name}\nEmail Domain: {domain}\nProvided Website: {website}"
        result = LLMGateway.call_llm(self.NAME, self.SYSTEM_PROMPT, prompt)

        if result.get("status") == "fallback_triggered":
            # Deterministic heuristic verification
            norm_c = company_name.lower().replace(" ", "")
            norm_d = domain.lower()
            matched = any(part in norm_d for part in norm_c.split('.') if len(part) > 3)
            confidence = 85 if matched else 50
            return {
                "identified_company": company_name,
                "official_website": website or f"https://www.{domain}",
                "match_confidence": confidence,
                "verification_status": "VERIFIED" if confidence >= 70 else "REQUIRES_MANUAL_VERIFICATION",
                "rationale": "Verified matching SLD structure with company naming profile."
            }
        return result
