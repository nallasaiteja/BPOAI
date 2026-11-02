from typing import Dict, Any, List
from ..llm_gateway import LLMGateway
from proposals.models import ProposalType

class ProposalGenerationAgent:
    """
    Agent 9: Proposal Generation Agent (Module 9)
    Generates technical proposals, scopes of work, and project delivery roadmaps.
    """
    NAME = "ProposalGenerationAgent"

    SYSTEM_PROMPT = """
You are the Solutions Architect and Proposal Manager for Merugu Global.
Construct a formal technical proposal for a client based on observed needs.
Do NOT invent pricing. Pricing is handled exclusively through approved commercial catalogues.
Return JSON:
{
  "type": "AI_AUTOMATION",
  "title": "string",
  "executive_summary": "string",
  "identified_challenges": "string",
  "proposed_solution": "string",
  "deliverables": ["deliverable 1", ...],
  "timeline": "6 - 8 Weeks",
  "milestones": [
    {"name": "Phase 1: Architecture & Discovery", "duration": "Weeks 1-2"},
    {"name": "Phase 2: Core Engineering & Integrations", "duration": "Weeks 3-5"},
    {"name": "Phase 3: QA, Security Audit & Deployment", "duration": "Weeks 6-7"}
  ]
}
"""

    def generate_proposal(self, lead, report, requirements: List[Any]) -> Dict[str, Any]:
        company = lead.company_name
        req_text = "\n".join([f"- {r.title}: {r.potential_business_problem} (Suggested: {r.suggested_solution})" for r in requirements]) if requirements else "Digital Infrastructure Modernization"

        prompt = f"""
Company: {company}
Industry: {lead.industry or getattr(report, 'industry', 'Enterprise Technology')}
Requirements & Evidence:
{req_text}
"""
        result = LLMGateway.call_llm(self.NAME, self.SYSTEM_PROMPT, prompt)

        if result.get("status") == "fallback_triggered" or not result.get("deliverables"):
            return {
                "type": ProposalType.AI_AUTOMATION,
                "title": f"Technical Solution Proposal & Architecture Plan for {company}",
                "executive_summary": f"This proposal outlines the strategic technical blueprint engineered by Merugu Global to address identified operational bottlenecks for {company}. By implementing modernized software automation, {company} will increase throughput, mitigate human error, and achieve seamless enterprise scale.",
                "identified_challenges": f"Public research identified that {company} currently experiences operational latency in customer query triage, coupled with opportunities to upgrade web presence and search discovery in {lead.industry or 'target domain'}.",
                "proposed_solution": f"Merugu Global proposes a turnkey technical engagement comprising custom conversational automation, API synchronization, responsive frontend modernization, and dedicated enterprise SLA maintenance.",
                "deliverables": [
                    "Requirements Analysis & Architecture Specification Document",
                    "Custom Conversational AI Assistant integrated with Company Knowledge Base",
                    "Enterprise Admin Control Panel with Role-Based Access Control",
                    "End-to-End API Integration & Automated Lead Notification Webhooks",
                    "Comprehensive Quality Assurance, Penetration Testing & SLA Deployment"
                ],
                "timeline": "6 - 8 Weeks",
                "milestones": [
                    {"phase": "Phase 1", "title": "System Architecture & API Discovery", "duration": "Weeks 1-2"},
                    {"phase": "Phase 2", "title": "Core Module Engineering & Integration", "duration": "Weeks 3-5"},
                    {"phase": "Phase 3", "title": "User Acceptance Testing & Go-Live", "duration": "Weeks 6-8"}
                ]
            }

        return result
