import re
from typing import Dict, Any, Optional
from .models import CompanyOutreachProfile

class FallbackTemplateEngine:
    """
    High-Quality Predefined Fallback Template Engine.
    Executes when AI is unavailable, quota is exhausted, timeout occurs,
    or on explicit user request.
    Ensures every fallback is exceptionally professional, correctly punctuated,
    free of unresolved placeholders, and tailored to the chosen outreach style.
    """

    @classmethod
    def _extract_val(cls, lead, field_names: list, default: str = "") -> str:
        if isinstance(lead, dict):
            for f in field_names:
                v = lead.get(f)
                if v and str(v).strip():
                    return str(v).strip()
            return default
        for f in field_names:
            v = getattr(lead, f, None)
            if v and str(v).strip():
                return str(v).strip()
        return default

    @classmethod
    def get_greeting(cls, lead) -> str:
        contact = cls._extract_val(lead, ['contact_person', 'contact_name'])
        first_name = cls._extract_val(lead, ['first_name'])
        if not first_name and contact:
            first_name = contact.split()[0]

        if first_name and len(first_name) > 1 and first_name.lower() not in ['lead', 'contact', 'admin', 'team']:
            return f"Dear {first_name},"
        elif contact and contact.lower() not in ['lead', 'contact', 'admin', 'team']:
            return f"Dear {contact},"
        else:
            company = cls._extract_val(lead, ['company_name'])
            return f"Hello {company} Team," if company else "Hello,"

    @classmethod
    def clean_unresolved(cls, text: str) -> str:
        # Remove any lingering {{variable}} tags cleanly
        text = re.sub(r'\{\{[^}]+\}\}', '', text)
        # Clean double spaces
        text = re.sub(r'[ \t]+', ' ', text)
        # Clean spacing before punctuation
        text = re.sub(r' +([.,?!;:])', r'\1', text)
        # Clean multiple newlines
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()

    @classmethod
    def build_signature_block(cls, profile: CompanyOutreachProfile, is_html: bool = False) -> str:
        sender_name = profile.sender_name or "Business Development"
        sender_title = profile.sender_designation or "Strategic Partnerships"
        company_name = profile.brand_name or profile.company_name or "Merugu Global"
        website = profile.website or "https://meruguglobal.com"
        email = profile.contact_email or "bpo@meruguglobal.com"
        phone = profile.contact_phone or ""

        if is_html:
            phone_part = f" | {phone}" if phone else ""
            return f"""
<p style="margin-top: 20px; margin-bottom: 4px; color: #334155;">Best regards,</p>
<p style="margin: 0; font-weight: bold; color: #0f172a;">{sender_name}</p>
<p style="margin: 0; color: #64748b; font-size: 13px;">{sender_title} &bull; {company_name}</p>
<p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">
  <a href="{website}" style="color: #2563eb; text-decoration: none;">{website.replace('https://', '')}</a> | {email}{phone_part}
</p>
""".strip()
        else:
            phone_part = f" | {phone}" if phone else ""
            return f"""Best regards,

{sender_name}
{sender_title}
{company_name}
{website} | {email}{phone_part}""".strip()

    @classmethod
    def render(
        cls, 
        lead, 
        style: str = 'PERSONALIZED_INTRO',
        service_focus: Optional[str] = None,
        profile: Optional[CompanyOutreachProfile] = None,
        previous_date: Optional[str] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        return cls.render_fallback(lead=lead, style=style, service_focus=service_focus, profile=profile, previous_date=previous_date, reason=reason)

    @classmethod
    def render_fallback(
        cls, 
        lead, 
        style: str = 'PERSONALIZED_INTRO',
        service_focus: Optional[str] = None,
        profile: Optional[CompanyOutreachProfile] = None,
        previous_date: Optional[str] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Renders a polished, style-specific fallback email with zero unresolved variables.
        """
        if not profile:
            profile = CompanyOutreachProfile.get_active_profile()

        company = cls._extract_val(lead, ['company_name'], default="your organization")
        contact = cls._extract_val(lead, ['contact_person', 'contact_name'])
        greeting = cls.get_greeting(lead)
        industry = cls._extract_val(lead, ['industry'])
        designation = cls._extract_val(lead, ['designation', 'job_title'])
        
        # Primary service focus from configured services or specific override
        services = profile.services_offered or ['AI Workflow Automation & Enterprise Software Engineering']
        chosen_service = service_focus or services[0]
        if len(services) > 1 and not service_focus:
            secondary_service = services[1]
        else:
            secondary_service = "back-office operational scaling"

        # Check for verified business requirement
        requirements = list(lead.requirements.all()) if hasattr(lead, 'requirements') else []
        req_title = requirements[0].title if requirements else ""

        our_company = profile.brand_name or profile.company_name
        cta = profile.desired_cta or "a brief 15-minute introductory conversation"

        subject = ""
        body_paras = []

        # ==========================================
        # STYLE A: Personalized Business Introduction
        # ==========================================
        if style in ['PERSONALIZED_INTRO', 'COMPANY_INTRO']:
            subject = f"Exploring a Potential Collaboration with {company}"
            
            p1 = f"{greeting}"
            
            if industry:
                p2 = f"I am writing to introduce {our_company} and explore how our capabilities in {chosen_service} might support {company}'s strategic goals in the {industry} sector."
            else:
                p2 = f"I am writing to introduce {our_company} and explore how our work in {chosen_service} might align with {company}'s operational priorities."

            p3 = f"At {our_company}, we specialize in delivering enterprise-grade {chosen_service} and {secondary_service}. Our focus is helping established organizations eliminate repetitive bottlenecks and scale their digital capacity with dependable engineering."

            if req_title:
                p4 = f"Given your work, we see potential opportunities around {req_title.lower()} where tailored execution can deliver measurable efficiency gains."
            else:
                p4 = f"We have observed positive momentum in your market space and believe our engineering and workflow capabilities could be directly relevant to your upcoming initiatives."

            p5 = f"Would you be open to {cta.lower()} next week to explore whether there is mutual alignment?"
            
            p6 = "Thank you for your time and consideration."

            body_paras = [p1, p2, p3, p4, p5, p6]

        # ==========================================
        # STYLE B: Value-Focused Outreach
        # ==========================================
        elif style == 'VALUE_FOCUSED':
            subject = f"Practical Efficiency Opportunities for {company}"
            
            p1 = f"{greeting}"
            
            if req_title:
                p2 = f"While researching {company}'s digital ecosystem, our team noted an opportunity to streamline {req_title.lower()}."
            elif industry:
                p2 = f"In reviewing market benchmarks across the {industry} sector, we frequently see mid-sized leaders looking to optimize digital workflows without adding operational overhead."
            else:
                p2 = f"I am reaching out from {our_company} with a specific focus on helping companies like {company} enhance operational efficiency and reduce manual processing friction."

            p3 = f"{our_company} designs targeted solutions in {chosen_service}. Rather than generic technology platforms, we build focused automations and software interfaces that seamlessly fit existing infrastructure."

            p4 = f"If this is an area {company} is actively addressing this quarter, I would welcome the chance to share brief, relevant examples of how we have helped peer organizations achieve similar outcomes."

            p5 = f"Could we schedule {cta.lower()} over the coming days?"

            body_paras = [p1, p2, p3, p4, p5]

        # ==========================================
        # STYLE C: Executive-Level Outreach (C-Suite / Concise)
        # ==========================================
        elif style == 'EXECUTIVE':
            subject = f"{company} & {our_company} — Strategic Introduction"
            
            p1 = f"{greeting}"
            
            role_ref = f" as {designation}" if designation else ""
            p2 = f"I appreciate your time{role_ref} and will keep this brief."

            p3 = f"{our_company} partners with leadership teams to deploy high-reliability {chosen_service} that directly impacts bottom-line performance."

            if req_title:
                p4 = f"We identified an avenue where {company} could accelerate {req_title.lower()} through pragmatic technology execution."
            else:
                p4 = f"Given your growth trajectory, we believe our engineering and automation capabilities could provide valuable leverage for your current roadmap."

            p5 = f"Would you or a member of your leadership team be open to {cta.lower()} next Tuesday or Wednesday?"

            body_paras = [p1, p2, p3, p4, p5]

        # ==========================================
        # STYLE D: Technology and Digital Solutions
        # ==========================================
        elif style in ['TECH_SOLUTIONS', 'SOFTWARE_INTRO', 'AI_AUTOMATION', 'CLOUD_TECH', 'CUSTOM_SOFTWARE']:
            subject = f"Engineering & Automation Capabilities for {company}"
            
            p1 = f"{greeting}"

            p2 = f"I am reaching out from {our_company}'s engineering practice to introduce our work supporting technology and operations teams with {chosen_service}."

            p3 = f"We engineer production-grade web applications, secure cloud infrastructure, and intelligent workflow automations designed to eliminate data silos and accelerate delivery cycles."

            if req_title:
                p4 = f"In particular, our team could assist {company} in addressing {req_title.lower()} with robust architecture and enterprise data security."
            else:
                p4 = f"Whether augmenting internal engineering sprints or modernizing core business workflows, our teams deliver dependable execution with transparent milestones."

            p5 = f"If your technical leadership is evaluating external engineering or automation partners, would you be available for {cta.lower()}?"

            body_paras = [p1, p2, p3, p4, p5]

        # ==========================================
        # STYLE E: Follow-Up Email
        # ==========================================
        elif style == 'FOLLOW_UP':
            subject = f"Following up: {company} & {our_company}"
            
            p1 = f"{greeting}"

            date_str = f"on {previous_date}" if previous_date else "a few days ago"
            p2 = f"I wanted to follow up briefly on my earlier note regarding {our_company}'s capabilities in {chosen_service}."

            p3 = f"I recognize you manage a demanding schedule. I simply wanted to reiterate our interest in connecting if exploring {chosen_service} is relevant to {company}'s current initiatives."

            p4 = f"If so, would {cta.lower()} be feasible sometime over the next two weeks? Alternatively, please let me know if there is a more appropriate contact on your team."

            p5 = "Thank you for your consideration."

            body_paras = [p1, p2, p3, p4, p5]

        # ==========================================
        # STYLE F: Meeting Request
        # ==========================================
        elif style == 'MEETING_REQUEST':
            subject = f"Introductory discussion: {company} / {our_company}"
            
            p1 = f"{greeting}"

            p2 = f"I am reaching out to propose a short introductory discussion between {company} and {our_company} regarding {chosen_service}."

            p3 = f"We help companies modernise operational workflows and engineer dependable digital solutions tailored to their exact business model."

            p4 = f"Would you have 15 minutes available next Tuesday at 11:00 AM or Wednesday at 2:00 PM for an introductory exchange? I would be glad to work around your calendar."

            p5 = "Looking forward to hearing from you."

            body_paras = [p1, p2, p3, p4, p5]

        # ==========================================
        # STYLE G: Service-Specific Outreach
        # ==========================================
        else: # SERVICE_SPECIFIC or default
            subject = f"{chosen_service} for {company}"
            
            p1 = f"{greeting}"

            p2 = f"I am contacting you from {our_company} regarding our dedicated service offering in {chosen_service}."

            p3 = f"Our team works closely with enterprise partners to deliver measurable outcomes in this domain, focusing on rigorous quality, rapid deployment, and high operational reliability."

            if req_title:
                p4 = f"We believe this service could be especially timely for {company} as you evaluate {req_title.lower()}."
            else:
                p4 = f"We would be pleased to share a targeted briefing outlining how we structure deliverables and timelines in this area."

            p5 = f"Would you be open to {cta.lower()} to discuss how this might fit into your current roadmap?"

            body_paras = [p1, p2, p3, p4, p5]

        # Clean all paragraphs
        cleaned_paras = [cls.clean_unresolved(p) for p in body_paras if p.strip()]
        
        # Build plain text body
        plain_body = "\n\n".join(cleaned_paras) + "\n\n" + cls.build_signature_block(profile, is_html=False)

        # Build clean HTML body
        html_paras = "".join([f'<p style="margin: 0 0 14px 0; color: #1e293b; line-height: 1.65;">{p}</p>' for p in cleaned_paras])
        sig_html = cls.build_signature_block(profile, is_html=True)
        html_body = f"""<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #1e293b; max-width: 620px; line-height: 1.65;">
{html_paras}
{sig_html}
</div>"""

        return {
            'subject': cls.clean_unresolved(subject),
            'body_plain': plain_body,
            'body_html': html_body,
            'confidence_score': 90,
            'generation_method': 'TEMPLATE_FALLBACK',
            'fallback_reason': reason or 'Deterministic high-quality fallback template',
            'personalization_sources': [
                'Lead Name' if contact else 'General Salutation',
                'Company Name',
                f'Industry ({industry})' if industry else 'General Sector',
                f'Service Focus ({chosen_service})',
                'Company Outreach Profile'
            ],
            'outreach_style': style
        }
