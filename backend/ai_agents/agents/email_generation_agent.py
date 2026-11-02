from typing import Dict, Any, List
from ..llm_gateway import LLMGateway
from communications.models import EmailType

class EmailGenerationAgent:
    """
    Agent 8: Email Generation Agent (Module 8)
    Generates personalized, evidence-grounded outreach communications.
    Strictly forbids hallucinated case studies, fabricated client logos, or false pricing.
    """
    NAME = "EmailGenerationAgent"

    SYSTEM_PROMPT = """
You are the Senior Email Marketing Executive for Merugu Digital Marketing And Life Science Pvt. Ltd. (Merugu Global).
Generate a highly targeted, personalized business email based strictly on the verified research findings provided.
Guidelines:
- Subject line must be concise, relevant, and avoid spam triggers.
- Salutation: use contact person's name or professional company greeting.
- Directly reference observable facts about the company from research (e.g. tech stack, current website architecture).
- Connect their observable situation to a tangible Merugu Global solution.
- Professional, value-driven tone. No generic sales fluff.
- Clear, low-friction Call to Action (e.g. 15-minute introductory technical briefing).
- Professional Merugu Global signature.
Return JSON:
{
  "subject": "string",
  "body_plain": "string",
  "body_html": "string",
  "confidence_score": 95
}
"""

    def generate(self, lead, report, requirements: List[Any], email_type: str = EmailType.COMPANY_INTRO) -> Dict[str, Any]:
        contact = lead.contact_person or "Business Development Team"
        company = lead.company_name
        req_summary = "; ".join([f"{r.title}: {r.potential_business_problem}" for r in requirements[:2]]) if requirements else "Digital process optimization"

        prompt = f"""
Email Type: {email_type}
Recipient: {contact} at {company}
Designation: {lead.designation or 'Leadership'}
Industry: {lead.industry or getattr(report, 'industry', 'Technology')}
Identified Evidence & Requirements: {req_summary}
Services Available: AI Automation, Enterprise Web Applications, HMIS & Healthcare Software, Digital Marketing
"""
        result = LLMGateway.call_llm(self.NAME, self.SYSTEM_PROMPT, prompt)

        if result.get("status") == "fallback_triggered" or not result.get("subject"):
            subject = f"Optimizing {company}'s Digital Capabilities | Merugu Global"
            body_plain = f"""Hi {contact},

I hope this note finds you well.

While reviewing {company}'s current public web infrastructure and market presence in {lead.industry or 'your industry'}, our research team noted your impressive market footprint. We also identified a specific technical opportunity around {requirements[0].title if requirements else 'intelligent process automation and web capability'}.

At Merugu Digital Marketing And Life Science, we engineer enterprise-grade AI automation, full-stack software solutions, and healthcare software systems that help organizations eliminate operational friction and accelerate growth.

Specifically, we could assist {company} in deploying tailored automation solutions designed to seamlessly interface with your current workflows.

Would you be open to a brief 15-minute briefing next Tuesday or Wednesday to explore if this aligns with your current strategic objectives?

Warm regards,

Business Development Team
Merugu Digital Marketing And Life Science Pvt. Ltd.
Web: https://meruguglobal.com | Email: bpo@meruguglobal.com
"""
            body_html = f"""<div style="font-family: Arial, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6;">
  <p>Hi {contact},</p>
  <p>I hope this note finds you well.</p>
  <p>While reviewing <strong>{company}</strong>'s current public web infrastructure and market presence in {lead.industry or 'your industry'}, our research team noted your impressive market footprint. We also identified a specific technical opportunity around <strong>{requirements[0].title if requirements else 'intelligent process automation and web capability'}</strong>.</p>
  <p>At <strong>Merugu Digital Marketing And Life Science</strong>, we engineer enterprise-grade AI automation, full-stack software solutions, and healthcare software systems that help organizations eliminate operational friction and accelerate growth.</p>
  <p>Specifically, we could assist {company} in deploying tailored automation solutions designed to seamlessly interface with your current workflows.</p>
  <p>Would you be open to a brief 15-minute briefing next Tuesday or Wednesday to explore if this aligns with your current strategic objectives?</p>
  <br/>
  <p>Warm regards,</p>
  <p><strong>Business Development Team</strong><br/>
  Merugu Digital Marketing And Life Science Pvt. Ltd.<br/>
  <a href="https://meruguglobal.com" style="color: #2563eb;">meruguglobal.com</a> | bpo@meruguglobal.com</p>
</div>"""
            return {
                "subject": subject,
                "body_plain": body_plain,
                "body_html": body_html,
                "confidence_score": 92
            }

        return result
