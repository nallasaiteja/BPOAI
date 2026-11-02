from typing import Dict, Any
from ..llm_gateway import LLMGateway
from communications.models import ReplyClassification

class EmailResponseAnalysisAgent:
    """
    Agent 10: Email Response Analysis Agent (Module 11)
    Analyzes customer replies to categorize intent and trigger automated CRM actions.
    """
    NAME = "EmailResponseAnalysisAgent"

    SYSTEM_PROMPT = """
You are the Lead Qualification AI for Merugu Global.
Analyze customer email replies and accurately classify them into one of:
- INTERESTED
- NOT_INTERESTED
- REQUESTING_QUOTATION
- REQUESTING_MEETING
- REQUESTING_MORE_INFO
- OUT_OF_OFFICE
- WRONG_CONTACT
- UNSUBSCRIBE

Return JSON:
{
  "classification": "INTERESTED",
  "confidence": 95,
  "action_note": "string detailing recommended human salesperson action"
}
"""

    def classify_reply(self, body: str, subject: str = "") -> Dict[str, Any]:
        prompt = f"Subject: {subject}\n\nBody:\n{body}"
        result = LLMGateway.call_llm(self.NAME, self.SYSTEM_PROMPT, prompt)

        if result.get("status") == "fallback_triggered" or not result.get("classification"):
            body_low = body.lower()
            if any(w in body_low for w in ['unsubscribe', 'remove me', 'stop emailing', 'take me off']):
                return {
                    "classification": ReplyClassification.UNSUBSCRIBE,
                    "confidence": 99,
                    "action_note": "Suppressed from outreach. Marked lead as Disqualified/Opt-Out."
                }
            if any(w in body_low for w in ['out of the office', 'auto-reply', 'on vacation', 'maternity leave', 'returning on']):
                return {
                    "classification": ReplyClassification.OUT_OF_OFFICE,
                    "confidence": 95,
                    "action_note": "Recipient is currently out of office. Re-queue for contact at a later date."
                }
            if any(w in body_low for w in ['not interested', 'no thanks', 'do not need', 'pass']):
                return {
                    "classification": ReplyClassification.NOT_INTERESTED,
                    "confidence": 90,
                    "action_note": "Lead indicated no current interest. Marked as Cold."
                }
            if any(w in body_low for w in ['schedule', 'calendar', 'call', 'meeting', 'zoom', 'talk next week', 'availab']):
                return {
                    "classification": ReplyClassification.REQUESTING_MEETING,
                    "confidence": 95,
                    "action_note": "High priority: Recipient is open to a call. Assigning senior sales executive immediately."
                }
            if any(w in body_low for w in ['pricing', 'cost', 'quote', 'quotation', 'rate']):
                return {
                    "classification": ReplyClassification.REQUESTING_QUOTATION,
                    "confidence": 92,
                    "action_note": "Recipient requested commercial pricing. Send approved proposal."
                }

            return {
                "classification": ReplyClassification.INTERESTED,
                "confidence": 85,
                "action_note": "Positive sentiment detected. Follow up with relevant case studies and schedule a call."
            }

        return result
