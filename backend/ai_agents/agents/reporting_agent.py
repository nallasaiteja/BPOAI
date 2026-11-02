from typing import Dict, Any

class ReportingAgent:
    """
    Agent 12: Reporting Agent (Module 12)
    Synthesizes operational BPO analytics, evaluates pipeline health, and generates managerial insights.
    """
    NAME = "ReportingAgent"

    def generate_executive_insights(self, stats: Dict[str, Any]) -> Dict[str, Any]:
        total_leads = stats.get('total_leads', 0)
        verified = stats.get('verified_companies', 0)
        hot_leads = stats.get('hot_leads', 0)
        emails_sent = stats.get('emails_sent', 0)
        replies = stats.get('replies_received', 0)
        positive_replies = stats.get('positive_responses', 0)

        response_rate = (replies / emails_sent * 100) if emails_sent > 0 else 0
        positive_conversion = (positive_replies / replies * 100) if replies > 0 else 0

        insights = []
        if response_rate >= 12:
            insights.append("Outreach personalization is performing above industry B2B benchmark (12%+ response rate).")
        elif emails_sent > 20 and response_rate < 5:
            insights.append("Response rate is below 5%. Consider refining intro subject lines and focusing on Hot leads.")

        if hot_leads > 0:
            insights.append(f"{hot_leads} Hot Leads identified with high-conviction technical requirements ready for executive engagement.")

        if verified < (total_leads * 0.5) and total_leads > 10:
            insights.append("Over 50% of ingested leads required manual verification. Review lead data source quality.")

        recommendations = [
            "Maintain cadence of Day 3 and Day 7 follow-ups to maximize response capture.",
            "Prioritize human approval for proposals matching enterprise HMIS and Custom SaaS categories.",
            "Verify email deliverability metrics to safeguard corporate sender domain reputation."
        ]

        return {
            "response_rate_percent": round(response_rate, 1),
            "positive_conversion_percent": round(positive_conversion, 1),
            "key_insights": insights,
            "strategic_recommendations": recommendations,
            "executive_brief": (
                f"The BPO AI pipeline has ingested {total_leads} leads, yielding {hot_leads} Hot qualified prospects. "
                f"Outreach dispatches total {emails_sent} with {replies} incoming replies ({response_rate:.1f}% response rate)."
            )
        }
