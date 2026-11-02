import logging
from typing import Dict, List, Any, Tuple, Optional
from django.utils import timezone
from .models import ICPConfig, ResearchReport

logger = logging.getLogger(__name__)

class EvidenceBasedScoringEngine:
    """
    Calculates explainable Company Fit Scores (0-100) and separate Research Confidence Scores (0-100)
    using the active Ideal Customer Profile (ICP) configuration and verified factual evidence.
    """

    @classmethod
    def calculate_scores(
        cls,
        report_data: Dict[str, Any],
        lead_data: Dict[str, Any],
        icp_config: Optional[ICPConfig] = None
    ) -> Dict[str, Any]:
        if not icp_config:
            icp_config = ICPConfig.get_active_config()

        coverage = report_data.get('coverage', {})
        is_accessible = coverage.get('is_accessible', False)

        # -------------------------------------------------------------
        # STEP 1: Compute Research Confidence Score (0 to 100)
        # -------------------------------------------------------------
        confidence_breakdown, confidence_score = cls._compute_research_confidence(report_data, coverage)

        # If website was not accessible or confidence is lower than 40%, flag insufficient evidence
        if not is_accessible or confidence_score < 40:
            breakdown = cls._build_insufficient_evidence_breakdown(icp_config)
            return {
                'company_fit_score': 0,
                'research_confidence_score': confidence_score,
                'confidence_score': confidence_score,
                'qualification_status': 'INSUFFICIENT_EVIDENCE',
                'scoring_breakdown': breakdown,
                'scoring_version': icp_config.scoring_version,
                'scoring_calculated_at': timezone.now().isoformat(),
                'confidence_breakdown': confidence_breakdown
            }

        # -------------------------------------------------------------
        # STEP 2: Compute Explainable Company Fit Score (0 to 100)
        # -------------------------------------------------------------
        criteria_scores = []
        total_fit_score = 0

        # Criterion 1: Industry & Target Market Relevance (Weight: 15)
        c1 = cls._score_industry(report_data, icp_config)
        criteria_scores.append(c1)
        total_fit_score += c1['score']

        # Criterion 2: Service & Solution Fit (Weight: 20)
        c2 = cls._score_service_fit(report_data, icp_config)
        criteria_scores.append(c2)
        total_fit_score += c2['score']

        # Criterion 3: Evidence of Potential Business Needs (Weight: 20)
        c3 = cls._score_business_needs(report_data, icp_config)
        criteria_scores.append(c3)
        total_fit_score += c3['score']

        # Criterion 4: Company Size & Business Capacity (Weight: 10)
        c4 = cls._score_company_size(report_data, lead_data, icp_config)
        criteria_scores.append(c4)
        total_fit_score += c4['score']

        # Criterion 5: Technology & Digital Maturity (Weight: 10)
        c5 = cls._score_tech_maturity(report_data, icp_config)
        criteria_scores.append(c5)
        total_fit_score += c5['score']

        # Criterion 6: Growth & Expansion Signals (Weight: 10)
        c6 = cls._score_growth_signals(report_data, icp_config)
        criteria_scores.append(c6)
        total_fit_score += c6['score']

        # Criterion 7: Geographic & Market Compatibility (Weight: 5)
        c7 = cls._score_geography(report_data, lead_data, icp_config)
        criteria_scores.append(c7)
        total_fit_score += c7['score']

        # Criterion 8: Contact & Decision-Maker Accessibility (Weight: 10)
        c8 = cls._score_contact_accessibility(lead_data, icp_config)
        criteria_scores.append(c8)
        total_fit_score += c8['score']

        total_fit_score = max(0, min(100, total_fit_score))

        # Determine Qualification Status
        if total_fit_score >= icp_config.threshold_hot and confidence_score >= 60:
            qualification_status = 'QUALIFIED_HOT'
        elif total_fit_score >= icp_config.threshold_warm and confidence_score >= 50:
            qualification_status = 'QUALIFIED_WARM'
        elif total_fit_score >= 35:
            qualification_status = 'LOW_PRIORITY'
        else:
            qualification_status = 'NOT_QUALIFIED'

        return {
            'company_fit_score': total_fit_score,
            'research_confidence_score': confidence_score,
            'confidence_score': confidence_score,
            'qualification_status': qualification_status,
            'scoring_breakdown': {
                'criteria': criteria_scores,
                'total_score': total_fit_score,
                'max_score': 100,
                'summary': f"Company achieved {total_fit_score}/100 Company Fit ({qualification_status}) with {confidence_score}% Research Confidence."
            },
            'scoring_version': icp_config.scoring_version,
            'scoring_calculated_at': timezone.now().isoformat(),
            'confidence_breakdown': confidence_breakdown
        }

    # -------------------------------------------------------------
    # Confidence Score Calculation (0-100)
    # -------------------------------------------------------------
    @classmethod
    def _compute_research_confidence(
        cls, 
        report_data: Dict[str, Any], 
        coverage: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], int]:
        score = 0
        factors = []

        # 1. Official website reachability (25 pts)
        if coverage.get('is_accessible'):
            score += 25
            factors.append("Official website reachable and responded with HTTP 200 (+25)")
        else:
            factors.append("Official website was unreachable (0/25)")

        # 2. Page coverage depth (25 pts)
        pages_inv = coverage.get('pages_investigated', 0)
        if pages_inv >= 5:
            score += 25
            factors.append(f"High website coverage ({pages_inv} pages investigated) (+25)")
        elif pages_inv >= 3:
            score += 18
            factors.append(f"Moderate website coverage ({pages_inv} pages investigated) (+18)")
        elif pages_inv >= 1:
            score += 10
            factors.append(f"Minimal website coverage ({pages_inv} page investigated) (+10)")
        else:
            factors.append("Zero pages investigated (0/25)")

        # 3. Evidence quotes backing claims (20 pts)
        findings = report_data.get('findings', [])
        verified_quotes = [f for f in findings if f.get('supporting_quote') and f.get('verification_status') == 'VERIFIED']
        if len(verified_quotes) >= 8:
            score += 20
            factors.append(f"Rich evidence citations ({len(verified_quotes)} verified source quotes) (+20)")
        elif len(verified_quotes) >= 4:
            score += 14
            factors.append(f"Moderate evidence citations ({len(verified_quotes)} verified quotes) (+14)")
        elif len(verified_quotes) >= 1:
            score += 8
            factors.append(f"Few evidence citations ({len(verified_quotes)} quotes) (+8)")
        else:
            factors.append("No source quotes extracted (0/20)")

        # 4. Core identity & business model completeness (15 pts)
        overview = report_data.get('overview', {})
        if overview.get('business_model') and overview.get('industry') and overview.get('description'):
            score += 15
            factors.append("Core business identity, industry, and model fully resolved (+15)")
        else:
            factors.append("Partial business model or industry information (+5)")
            score += 5

        # 5. Domain correspondence & absence of contradictions (15 pts)
        if coverage.get('correspondence_match'):
            score += 15
            factors.append(f"High correspondence between company name and domain (+15)")
        else:
            score += 6
            factors.append("Domain does not explicitly match company name (+6)")

        final_conf = max(0, min(100, score))
        return {
            'score': final_conf,
            'factors': factors
        }, final_conf

    # -------------------------------------------------------------
    # 8 Criteria Fit Scoring Methods
    # -------------------------------------------------------------
    @classmethod
    def _score_industry(cls, report_data: Dict[str, Any], icp: ICPConfig) -> Dict[str, Any]:
        weight = icp.weight_industry
        industry = report_data.get('overview', {}).get('industry', '')
        target_industries = icp.target_industries or []
        
        is_exact = any(t.lower() in industry.lower() or industry.lower() in t.lower() for t in target_industries)
        if is_exact:
            earned = weight
            explanation = f"Primary industry '{industry}' directly matches our high-value target industry ICP."
        elif industry and industry != 'Undisclosed':
            earned = int(weight * 0.6)
            explanation = f"Industry '{industry}' is moderately aligned with commercial services."
        else:
            earned = 0
            explanation = "Industry could not be verified from public company records."

        return {
            'key': 'industry_relevance',
            'name': 'Industry & Target Market Relevance',
            'score': earned,
            'max_score': weight,
            'explanation': explanation,
            'evidence_quotes': [f"Identified primary sector: {industry}"],
            'missing_info_flags': [] if industry and industry != 'Undisclosed' else ['Industry unverified']
        }

    @classmethod
    def _score_service_fit(cls, report_data: Dict[str, Any], icp: ICPConfig) -> Dict[str, Any]:
        weight = icp.weight_service_fit
        opportunities = report_data.get('opportunities', [])
        services = report_data.get('products_and_services', {}).get('main_services', [])
        
        opp_count = len(opportunities)
        if opp_count >= 2:
            earned = weight
            explanation = f"High service synergy: {opp_count} distinct BPO service opportunities identified."
        elif opp_count == 1:
            earned = int(weight * 0.75)
            explanation = f"Moderate service fit: 1 high-priority BPO opportunity identified ({opportunities[0]['title']})."
        elif services:
            earned = int(weight * 0.4)
            explanation = "General service alignment; standard operational augmentation viable."
        else:
            earned = 0
            explanation = "No public service synergy identified."

        return {
            'key': 'service_fit',
            'name': 'Service & Solution Fit',
            'score': earned,
            'max_score': weight,
            'explanation': explanation,
            'evidence_quotes': [o['title'] for o in opportunities[:2]] if opportunities else [],
            'missing_info_flags': [] if opp_count > 0 else ['No explicit service opportunities detected']
        }

    @classmethod
    def _score_business_needs(cls, report_data: Dict[str, Any], icp: ICPConfig) -> Dict[str, Any]:
        weight = icp.weight_business_needs
        opportunities = report_data.get('opportunities', [])
        gaps = report_data.get('research_gaps', [])
        tech = report_data.get('technology', {})

        # High need evidence if customer support tool missing or modern digital expansion present
        has_chat = bool(tech.get('customer_support_tools'))
        if not has_chat and opportunities:
            earned = weight
            explanation = "Evidence of immediate operational need: Lack of automated customer chat combined with active digital operations."
        elif opportunities:
            earned = int(weight * 0.7)
            explanation = "Tangible business needs identified across operational expansion."
        else:
            earned = int(weight * 0.2)
            explanation = "General enterprise operational requirements."

        return {
            'key': 'business_needs',
            'name': 'Evidence of Potential Business Needs',
            'score': earned,
            'max_score': weight,
            'explanation': explanation,
            'evidence_quotes': [o.get('rationale', '') for o in opportunities[:2] if o.get('rationale')],
            'missing_info_flags': []
        }

    @classmethod
    def _score_company_size(cls, report_data: Dict[str, Any], lead_data: Dict[str, Any], icp: ICPConfig) -> Dict[str, Any]:
        weight = icp.weight_company_size
        verified_emp = report_data.get('size_and_capacity', {}).get('employee_count_verified', '')
        lead_emp = lead_data.get('employee_count') or ''
        
        emp_text = verified_emp if not verified_emp.startswith('Not publicly') else lead_emp
        if emp_text and not emp_text.startswith('Not publicly') and not emp_text.startswith('Undisclosed'):
            earned = weight
            explanation = f"Verified commercial capacity: Employee headcount cited as '{emp_text}'."
            quotes = [f"Employee metric: {emp_text}"]
            missing = []
        else:
            earned = int(weight * 0.3)
            explanation = "Specific employee headcount is unlisted; awarded minimal baseline commercial score."
            quotes = []
            missing = ['Employee count unlisted']

        return {
            'key': 'company_size',
            'name': 'Company Size & Business Capacity',
            'score': earned,
            'max_score': weight,
            'explanation': explanation,
            'evidence_quotes': quotes,
            'missing_info_flags': missing
        }

    @classmethod
    def _score_tech_maturity(cls, report_data: Dict[str, Any], icp: ICPConfig) -> Dict[str, Any]:
        weight = icp.weight_tech_maturity
        tech_list = report_data.get('technology', {}).get('tech_stack_detected', [])
        relevant = icp.relevant_technologies or []
        
        matched_tech = [t for t in tech_list if any(r.lower() in t.lower() for r in relevant)]
        if len(matched_tech) >= 3:
            earned = weight
            explanation = f"High digital maturity: Detected {len(matched_tech)} relevant enterprise technologies ({', '.join(matched_tech[:3])})."
        elif len(matched_tech) >= 1:
            earned = int(weight * 0.7)
            explanation = f"Moderate technology stack: Identified {', '.join(matched_tech)}."
        elif tech_list:
            earned = int(weight * 0.4)
            explanation = f"Standard web presence ({', '.join(tech_list[:2])})."
        else:
            earned = 0
            explanation = "No public technology signatures detected."

        return {
            'key': 'technology_maturity',
            'name': 'Technology & Digital Maturity',
            'score': earned,
            'max_score': weight,
            'explanation': explanation,
            'evidence_quotes': [f"Detected technology signature: {t}" for t in matched_tech[:3]],
            'missing_info_flags': [] if matched_tech else ['No ICP-matched tech stack found']
        }

    @classmethod
    def _score_growth_signals(cls, report_data: Dict[str, Any], icp: ICPConfig) -> Dict[str, Any]:
        weight = icp.weight_growth_signals
        signals = report_data.get('signals', {})
        openings = signals.get('job_openings', [])
        expansions = signals.get('expansion_signals', [])

        total_signals = len(openings) + len(expansions)
        if total_signals >= 3:
            earned = weight
            explanation = f"Strong hiring & growth momentum: {len(openings)} job openings and {len(expansions)} expansion signals."
        elif total_signals >= 1:
            earned = int(weight * 0.6)
            explanation = f"Active hiring/expansion activity detected on official web channels."
        else:
            earned = int(weight * 0.2)
            explanation = "No active job listings or recent press releases detected on crawled pages."

        return {
            'key': 'growth_signals',
            'name': 'Growth & Expansion Signals',
            'score': earned,
            'max_score': weight,
            'explanation': explanation,
            'evidence_quotes': expansions[:2] or openings[:2],
            'missing_info_flags': [] if total_signals > 0 else ['No active public hiring signals']
        }

    @classmethod
    def _score_geography(cls, report_data: Dict[str, Any], lead_data: Dict[str, Any], icp: ICPConfig) -> Dict[str, Any]:
        weight = icp.weight_geography
        lead_country = lead_data.get('country') or 'United States'
        geo_markets = icp.geographic_markets or ['United States', 'Canada', 'United Kingdom', 'Global']

        if any(g.lower() in lead_country.lower() for g in geo_markets):
            earned = weight
            explanation = f"Target market '{lead_country}' matches preferred geographic jurisdictions."
        else:
            earned = int(weight * 0.5)
            explanation = f"Market '{lead_country}' is supported internationally."

        return {
            'key': 'geographic_compatibility',
            'name': 'Geographic & Market Compatibility',
            'score': earned,
            'max_score': weight,
            'explanation': explanation,
            'evidence_quotes': [f"Lead country: {lead_country}"],
            'missing_info_flags': []
        }

    @classmethod
    def _score_contact_accessibility(cls, lead_data: Dict[str, Any], icp: ICPConfig) -> Dict[str, Any]:
        weight = icp.weight_contact_accessibility
        email = lead_data.get('business_email') or ''
        is_corp = lead_data.get('is_business_domain', False)
        contact_name = lead_data.get('contact_person')
        designation = lead_data.get('designation')

        points = 0
        if is_corp and '@' in email:
            points += 5
        elif '@' in email:
            points += 2

        if contact_name and len(contact_name.strip()) > 3:
            points += 3
        if designation and len(designation.strip()) > 2:
            points += 2

        points = min(weight, points)
        return {
            'key': 'contact_accessibility',
            'name': 'Contact & Decision-Maker Accessibility',
            'score': points,
            'max_score': weight,
            'explanation': f"Corporate direct contact availability: Email {'verified' if is_corp else 'present'}, decision maker '{contact_name or 'unnamed'} ({designation or 'unspecified'})'.",
            'evidence_quotes': [f"Contact: {contact_name} ({designation}) <{email}>"],
            'missing_info_flags': [] if contact_name and is_corp else ['Executive contact or corporate email missing']
        }

    @classmethod
    def _build_insufficient_evidence_breakdown(cls, icp: ICPConfig) -> Dict[str, Any]:
        return {
            'criteria': [
                {
                    'key': 'insufficient_evidence',
                    'name': 'Website Investigation Incomplete',
                    'score': 0,
                    'max_score': 100,
                    'explanation': 'Official company website was inaccessible or returned insufficient public data. No speculative points awarded.',
                    'evidence_quotes': [],
                    'missing_info_flags': ['Target website inaccessible / low confidence']
                }
            ],
            'total_score': 0,
            'max_score': 100,
            'summary': 'Insufficient verifiable evidence to calculate an accurate Company Fit Score. Manual review required.'
        }
