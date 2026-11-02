import logging
from typing import Dict, Any, List, Optional
from ..llm_gateway import LLMGateway
from communications.models import EmailType, CompanyOutreachProfile
from communications.template_engine import FallbackTemplateEngine
from communications.validator import EmailQualityValidator

logger = logging.getLogger(__name__)

class EmailGenerationAgent:
    """
    Agent 8: Enterprise-Grade B2B Email Generation Agent (Module 8)
    Generates exceptionally professional, personalized B2B outreach emails
    based strictly on verified company intelligence and our configured company profile.
    Integrates seamless fallback to polished predefined templates when AI is unavailable.
    """
    NAME = "EmailGenerationAgent"

    STYLE_PROMPT_INSTRUCTIONS = {
        'PERSONALIZED_INTRO': """
Outreach Objective: Personalized Business Introduction
- Introduce our company and explain why our services are relevant to their business model and industry.
- Ground the reason for outreach in observable facts from their website/business intelligence.
- Suggest a low-pressure introductory briefing to explore mutual synergy.
- Target Length: 110–160 words.
""",
        'VALUE_FOCUSED': """
Outreach Objective: Value-Focused Outreach
- Focus on a specific, evidence-supported business opportunity or operational workflow.
- Explain clearly and without hyperbole how our services help eliminate friction or deliver practical ROI.
- Offer to share relevant capability benchmarks or proof points.
- Target Length: 120–170 words.
""",
        'EXECUTIVE': """
Outreach Objective: Executive-Level Outreach (C-Suite / Founder / VP)
- Write for a busy executive: get to the point within the first two sentences.
- High-level business impact, operational capacity, and strategic leverage.
- Zero marketing jargon, zero buzzwords, no long paragraphs.
- Target Length: 80–120 words.
""",
        'TECH_SOLUTIONS': """
Outreach Objective: Technology & Digital Solutions
- Focus on software engineering, workflow automation, cloud infrastructure, or systems modernization.
- Emphasize our engineering rigor, production reliability, and security standards.
- Propose an introductory technical exchange with our solutions team.
- Target Length: 120–170 words.
""",
        'FOLLOW_UP': """
Outreach Objective: Polite Professional Follow-Up
- Reference our earlier correspondence politely without pretending they replied.
- Respect their busy schedule and reiterate why a connection could be beneficial.
- Provide a gracious exit if timing is not appropriate.
- Target Length: 70–110 words.
""",
        'MEETING_REQUEST': """
Outreach Objective: Meeting Request
- Propose a concise 15-minute introductory conversation.
- State clearly what will be covered and suggest concrete times (e.g. next Tuesday or Wednesday).
- Target Length: 80–120 words.
""",
        'SERVICE_SPECIFIC': """
Outreach Objective: Service-Specific Outreach
- Focus deeply on the single selected service offering.
- Explain our delivery model, key benefits, and why it is timely for their current trajectory.
- Target Length: 110–160 words.
"""
    }

    def generate(
        self, 
        lead, 
        report=None, 
        requirements: Optional[List[Any]] = None, 
        email_type: str = EmailType.COMPANY_INTRO,
        style: Optional[str] = None,
        tone: Optional[str] = None,
        service_focus: Optional[str] = None,
        instruction_override: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes AI email generation with strict validation and automatic fallback.
        """
        outreach_style = style or email_type
        if outreach_style not in self.STYLE_PROMPT_INSTRUCTIONS:
            # Map legacy types
            if outreach_style in [EmailType.SOFTWARE_INTRO, EmailType.AI_AUTOMATION, EmailType.CLOUD_TECH, EmailType.CUSTOM_SOFTWARE]:
                outreach_style = 'TECH_SOLUTIONS'
            elif outreach_style == EmailType.FOLLOW_UP:
                outreach_style = 'FOLLOW_UP'
            elif outreach_style == EmailType.MEETING_REQUEST:
                outreach_style = 'MEETING_REQUEST'
            else:
                outreach_style = 'PERSONALIZED_INTRO'

        profile = CompanyOutreachProfile.get_active_profile()
        company = (lead.company_name or "").strip()
        contact = (lead.contact_person or "").strip()
        designation = (lead.designation or "").strip()
        industry = (lead.industry or getattr(report, 'industry', '') or "").strip()
        website = (lead.website_url or getattr(report, 'target_url', '') or "").strip()
        
        # Determine service focus
        configured_services = profile.services_offered or ['AI Workflow Automation & Enterprise Software Engineering']
        chosen_service = service_focus or configured_services[0]

        # Gather requirements and intelligence findings
        reqs = requirements if requirements is not None else (list(lead.requirements.all()) if hasattr(lead, 'requirements') else [])
        req_summary = "; ".join([f"{r.title}: {r.potential_business_problem}" for r in reqs[:2]]) if reqs else "None stated"

        tech_stack = getattr(report, 'tech_stack_detected', []) if report else []
        tech_summary = ", ".join(tech_stack[:4]) if tech_stack else "Standard web infrastructure"

        style_instruction = self.STYLE_PROMPT_INSTRUCTIONS.get(outreach_style, self.STYLE_PROMPT_INSTRUCTIONS['PERSONALIZED_INTRO'])

        system_prompt = f"""You are an experienced Senior Business Development Executive writing a 1-to-1 personalized B2B outreach email on behalf of {profile.brand_name} ({profile.company_name}).

OUR COMPANY CONTEXT:
- Name: {profile.brand_name} ({profile.company_name})
- Website: {profile.website}
- Overview: {profile.business_introduction}
- Actual Services We Provide: {', '.join(configured_services)}
- Key Differentiators: {', '.join(profile.key_differentiators or ['Production-tested reliability', 'Senior engineering teams'])}
- Sender Name: {profile.sender_name}
- Sender Title: {profile.sender_designation}
- Sender Email: {profile.contact_email}
- Preferred CTA: {profile.desired_cta}
- Tone: {tone or profile.preferred_tone}

{style_instruction}

STRICT B2B QUALITY & ANTI-HALLUCINATION RULES:
1. NEVER start with "I hope this email finds you well" or robotic greeting clichés. Start with an appropriate, natural greeting ("Dear {contact.split()[0] if contact else 'Team'}," or "Hello {contact.split()[0] if contact else ''},").
2. NEVER use exaggerated flattery ("impressive market footprint", "world-class leader", "blown away by your website").
3. NEVER invent past conversations, referrals, mutual contacts, client names, or awards that do not exist.
4. DO NOT claim to have discovered a problem on their website unless supported by verified evidence.
5. Only pitch services that our company ACTUALLY provides: {', '.join(configured_services)}.
6. Word count MUST be between 100 and 180 words (or 80–120 words if Executive style).
7. End with a clean professional sign-off and sender signature:
   Best regards,
   {profile.sender_name}
   {profile.sender_designation}
   {profile.brand_name}
   {profile.website} | {profile.contact_email}

OUTPUT FORMAT:
Return pure valid JSON with no markdown wrapping:
{{
  "subject": "Concise, specific, low-spam subject line (under 60 chars)",
  "body_plain": "Complete plain text email body including greeting and signature",
  "body_html": "<div style=\\"font-family: Arial, sans-serif; font-size: 14px; line-height: 1.65; color: #1e293b;\\">HTML formatted email with <p> tags and signature</div>",
  "confidence_score": 95,
  "personalization_sources": ["Recipient Name", "Company Name", "Industry", "Evidence Finding"]
}}
"""

        user_prompt = f"""
RECIPIENT & COMPANY PROFILE:
- Recipient Name: {contact or 'Leadership Team'}
- Designation: {designation or 'Business Executive'}
- Company Name: {company}
- Website: {website or 'Not specified'}
- Industry: {industry or 'Not specified'}
- Technologies Detected: {tech_summary}
- Identified Requirements/Opportunities: {req_summary}
- Primary Service Focus: {chosen_service}
{f"- Special Direction: {instruction_override}" if instruction_override else ""}
"""

        # Attempt AI generation via LLMGateway
        try:
            ai_result = LLMGateway.call_llm(self.NAME, system_prompt, user_prompt, response_format_json=True)
            
            # Validate output quality
            if ai_result and ai_result.get("status") != "fallback_triggered" and ai_result.get("subject") and ai_result.get("body_plain"):
                # Run EmailQualityValidator
                validation = EmailQualityValidator.validate({
                    'subject': ai_result.get('subject'),
                    'body_plain': ai_result.get('body_plain'),
                    'body_html': ai_result.get('body_html'),
                    'recipient_email': lead.business_email
                })

                if validation['is_valid'] or validation['quality_score'] >= 75:
                    sources = ai_result.get('personalization_sources') or []
                    if not sources:
                        sources = ['Company Name']
                        if contact: sources.append('Recipient Name')
                        if industry: sources.append('Industry')
                        if req_summary != 'None stated': sources.append('Research Evidence')
                    
                    return {
                        'subject': ai_result['subject'].strip(),
                        'body_plain': ai_result['body_plain'].strip(),
                        'body_html': ai_result['body_html'].strip(),
                        'confidence_score': ai_result.get('confidence_score', 95),
                        'generation_method': 'AI_GENERATED',
                        'ai_model_used': 'gemini-2.5-flash',
                        'fallback_reason': None,
                        'personalization_sources': sources,
                        'quality_score': validation['quality_score'],
                        'validation_warnings': validation['warnings'],
                        'outreach_style': outreach_style
                    }
                else:
                    logger.warning(f"AI response failed quality validation: {validation['warnings']}. Triggering fallback template.")
                    fallback_reason = f"Gemini output failed quality check: {'; '.join(validation['warnings'][:2])}"
            else:
                fallback_reason = (
                    ai_result.get('reason') or 
                    ai_result.get('fallback_reason') or 
                    ai_result.get('error') or 
                    "Gemini AI returned an empty response or fallback status"
                )
        except Exception as e:
            e_str = str(e)
            if "ResourceExhausted" in e_str or "429" in e_str:
                fallback_reason = "Gemini API Quota Exceeded (HTTP 429: ResourceExhausted). Rate limit reached."
            elif "Deadline" in e_str or "timed out" in e_str.lower():
                fallback_reason = "Gemini Request Timed Out. Connection to Google AI server exceeded deadline."
            elif "11001" in e_str or "getaddrinfo" in e_str.lower():
                fallback_reason = "Network Connection Error: Server could not reach Google Gemini API (offline or DNS error)."
            else:
                fallback_reason = f"Gemini AI error: {e_str[:120]}"

        # Predefined High-Quality Fallback Template Engine
        logger.info(f"Rendering high-quality fallback template for {company} (style: {outreach_style}, reason: {fallback_reason})")
        fallback_draft = FallbackTemplateEngine.render_fallback(
            lead=lead,
            style=outreach_style,
            service_focus=chosen_service,
            profile=profile
        )
        fallback_draft['fallback_reason'] = fallback_reason

        # Validate fallback
        val = EmailQualityValidator.validate({
            'subject': fallback_draft['subject'],
            'body_plain': fallback_draft['body_plain'],
            'body_html': fallback_draft['body_html'],
            'recipient_email': lead.business_email
        })
        fallback_draft['quality_score'] = val['quality_score']
        fallback_draft['validation_warnings'] = val['warnings']

        return fallback_draft
