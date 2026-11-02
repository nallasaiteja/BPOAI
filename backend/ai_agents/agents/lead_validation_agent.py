import re
from typing import Dict, Any
from ..llm_gateway import LLMGateway

class LeadValidationAgent:
    """
    Agent 1: Lead Validation Agent
    Validates uploaded contact data, checks corporate email format, identifies missing fields.
    """
    NAME = "LeadValidationAgent"

    SYSTEM_PROMPT = """
You are the Lead Validation Agent for Merugu Global BPO.
Your job is to validate inbound lead contact details, detect data discrepancies,
and assess data cleanliness. Return JSON format with fields:
{
  "is_valid": true/false,
  "email_syntax_valid": true/false,
  "missing_critical_fields": ["field1", ...],
  "cleaning_notes": "string"
}
"""

    def validate(self, lead_data: Dict[str, Any]) -> Dict[str, Any]:
        email = lead_data.get('business_email', '')
        company = lead_data.get('company_name', '')
        
        email_regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
        syntax_valid = bool(re.match(email_regex, email))
        
        missing = []
        if not company:
            missing.append("company_name")
        if not email:
            missing.append("business_email")
        if not lead_data.get('contact_person'):
            missing.append("contact_person")
        if not lead_data.get('country'):
            missing.append("country")

        return {
            "is_valid": syntax_valid and bool(company),
            "email_syntax_valid": syntax_valid,
            "missing_critical_fields": missing,
            "cleaning_notes": f"Validated lead record for {company or 'Unknown Company'}."
        }
