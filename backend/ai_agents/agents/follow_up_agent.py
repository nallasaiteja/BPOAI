from typing import Dict, Any
from ..llm_gateway import LLMGateway

class FollowUpAgent:
    """
    Agent 11: Follow-up Agent (Module 11)
    Generates courteous, value-oriented follow-up communications referencing previous context.
    """
    NAME = "FollowUpAgent"

    def generate_followup(self, lead, sequence_step: int = 1) -> Dict[str, Any]:
        contact = lead.contact_person or "Team"
        company = lead.company_name

        if sequence_step == 1:
            subject = f"Re: Quick follow up regarding {company}'s tech modernization"
            body_plain = f"""Hi {contact},

I wanted to briefly follow up on my previous note regarding {company}'s digital initiatives.

We understand that executive schedules are demanding. If timing is currently suboptimal, please let me know. Otherwise, I would be pleased to share a brief 2-page brief on how we recently helped similar organizations automate their operational workflows.

Would 10 minutes this Thursday work for a quick conversation?

Best regards,
Business Development Team
Merugu Global
"""
        elif sequence_step == 2:
            subject = f"Resource for {company}: Automated Operational Workflows"
            body_plain = f"""Hi {contact},

Following up to share a brief perspective on operational scalability in {lead.industry or 'enterprise technology'}.

At Merugu Global, we help firms eliminate manual bottlenecks across customer onboarding, CRM administration, and custom software development.

Are you available for a brief introductory call early next week?

Warm regards,
Business Development Team
Merugu Global
"""
        else:
            subject = f"Final follow-up: {company} & Merugu Global"
            body_plain = f"""Hi {contact},

I assume that optimizing your current digital systems or outsourcing workflow automation is not a strategic priority for {company} at this moment.

I will refrain from reaching out further, but please feel free to reconnect whenever you require enterprise-grade AI automation, full-stack development, or BPO operations.

Wishing you continued success.

Warm regards,
Business Development Team
Merugu Global
"""

        body_html = f"<div style='font-family: Arial, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6;'>{body_plain.replace(chr(10), '<br/>')}</div>"

        return {
            "subject": subject,
            "body_plain": body_plain,
            "body_html": body_html,
            "confidence_score": 95
        }
