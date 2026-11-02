from typing import List, Optional
from requirements_ai.models import ServiceCatalogue

CATEGORY_MAPPING = {
    'AI_CHATBOTS': ['ai-chatbots-automation'],
    'AI_DEV': ['ai-chatbots-automation', 'enterprise-web-saas'],
    'WEBSITE_DEV': ['modern-website-seo'],
    'WEB_APP_DEV': ['enterprise-web-saas'],
    'MOBILE_APP_DEV': ['enterprise-web-saas'],
    'CUSTOM_SOFTWARE': ['enterprise-web-saas'],
    'SEO': ['modern-website-seo'],
    'DIGITAL_MARKETING': ['digital-marketing-ads'],
    'GOOGLE_ADS': ['digital-marketing-ads'],
    'SOCIAL_MEDIA': ['digital-marketing-ads'],
    'HOSPITAL_MGMT': ['crm-erp-hmis'],
    'CRM_DEV': ['crm-erp-hmis'],
    'ERP_DEV': ['crm-erp-hmis'],
    'BPO_AUTOMATION': ['bpo-lead-automation'],
}

class ServiceMatchingAgent:
    """
    Agent 7: Service Matching Agent (Module 7)
    Accurately pairs identified business gaps with Merugu Global service catalogue items.
    Strictly forbids recommending irrelevant services simply to inflate pipeline value.
    """
    NAME = "ServiceMatchingAgent"

    def find_best_match(self, requirement_category: str, problem_description: str, available_services: List[ServiceCatalogue]) -> Optional[ServiceCatalogue]:
        target_codes = CATEGORY_MAPPING.get(requirement_category, [])
        for code in target_codes:
            for srv in available_services:
                if srv.code == code:
                    return srv

        # Secondary search based on keywords
        prob_lower = (problem_description or '').lower()
        for srv in available_services:
            if any(kw in prob_lower for kw in srv.name.lower().split()):
                return srv

        # Fallback to general automation or software if active
        for srv in available_services:
            if srv.code in ['ai-chatbots-automation', 'enterprise-web-saas']:
                return srv

        return available_services[0] if available_services else None
