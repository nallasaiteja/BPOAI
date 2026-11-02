from typing import Dict, Any
from leads.models import LeadScoreCategory

class LeadScoringAgent:
    """
    Agent 6: Lead Scoring Agent (Module 6)
    Calculates multi-dimensional lead scores with granular breakdown and natural-language explainability.
    """
    NAME = "LeadScoringAgent"

    def score_lead(self, lead, report, requirements) -> Dict[str, Any]:
        # 1. Company Verification (0 to 20 pts)
        verif_score = 0
        if lead.is_company_verified:
            verif_score = 20
        elif lead.domain_confidence_score > 60:
            verif_score = 14
        elif lead.company:
            verif_score = 8
        else:
            verif_score = 4

        # 2. Business Website Availability (0 to 15 pts)
        web_score = 0
        if lead.website_url and lead.website_url.startswith('https'):
            web_score = 15
        elif lead.website_url:
            web_score = 11
        elif getattr(report, 'source_urls', None):
            web_score = 8
        else:
            web_score = 0

        # 3. Industry Relevance (0 to 15 pts)
        ind_score = 0
        high_value_industries = ['technology', 'software', 'healthcare', 'life sciences', 'pharmaceutical', 'finance', 'manufacturing']
        lead_ind = (lead.industry or '').lower()
        if any(h in lead_ind for h in high_value_industries):
            ind_score = 15
        elif lead_ind:
            ind_score = 10
        else:
            ind_score = 6

        # 4. Potential Service Requirement (0 to 20 pts)
        req_count = len(requirements) if requirements else 0
        if req_count >= 3:
            req_score = 20
        elif req_count == 2:
            req_score = 16
        elif req_count == 1:
            req_score = 12
        else:
            req_score = 5

        # 5. Activity and Buying Signals (0 to 15 pts)
        signals = getattr(report, 'expansion_signals', [])
        sig_score = 12 if signals else 8

        # 6. Business Email Validity (0 to 15 pts)
        email_score = 0
        if lead.is_business_domain and '@' in (lead.business_email or ''):
            email_score = 15
        elif '@' in (lead.business_email or ''):
            email_score = 7

        total = verif_score + web_score + ind_score + req_score + sig_score + email_score

        # Category determination
        if lead.manual_verification_required:
            category = LeadScoreCategory.NEEDS_VERIFICATION
        elif total >= 80:
            category = LeadScoreCategory.HOT
        elif total >= 60:
            category = LeadScoreCategory.WARM
        elif total >= 35:
            category = LeadScoreCategory.COLD
        else:
            category = LeadScoreCategory.NOT_RELEVANT

        explanation = (
            f"Lead achieved {total}/100 total score ({category}). "
            f"Company verification contributed {verif_score}/20; "
            f"corporate website presence contributed {web_score}/15; "
            f"industry alignment in {lead.industry or 'target sector'} earned {ind_score}/15; "
            f"{req_count} tangible technical requirement(s) added {req_score}/20; "
            f"growth signals provided {sig_score}/15; "
            f"and authenticated business email accounted for {email_score}/15."
        )

        return {
            "total_score": total,
            "category": category,
            "company_verification": verif_score,
            "website_availability": web_score,
            "industry_relevance": ind_score,
            "service_requirement": req_score,
            "activity_signals": sig_score,
            "email_validity": email_score,
            "breakdown": {
                "company_verification": f"{verif_score}/20",
                "website_availability": f"{web_score}/15",
                "industry_relevance": f"{ind_score}/15",
                "service_requirements": f"{req_score}/20",
                "buying_signals": f"{sig_score}/15",
                "email_validity": f"{email_score}/15"
            },
            "explanation": explanation
        }
