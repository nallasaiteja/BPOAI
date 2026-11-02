import re
from typing import Dict, Any, List

class EmailQualityValidator:
    """
    Validates outbound B2B email quality before approval or dispatch.
    Enforces strict anti-hallucination, absence of unresolved placeholders,
    professional CTA, valid recipient email, and safe HTML.
    """

    @classmethod
    def validate(cls, draft_or_data: Any) -> Dict[str, Any]:
        if hasattr(draft_or_data, 'subject'):
            subject = draft_or_data.subject or ""
            body_plain = draft_or_data.body_plain or ""
            body_html = draft_or_data.body_html or ""
            recipient_email = getattr(draft_or_data, 'lead_email', '') or getattr(getattr(draft_or_data, 'lead', None), 'business_email', '')
        else:
            subject = draft_or_data.get('subject', '')
            body_plain = draft_or_data.get('body_plain', '')
            body_html = draft_or_data.get('body_html', '')
            recipient_email = draft_or_data.get('recipient_email', '') or draft_or_data.get('lead_email', '')

        warnings: List[str] = []
        checks_passed = 0
        total_checks = 8

        # Check 1: Subject line presence & validity
        clean_subj = subject.strip()
        if not clean_subj:
            warnings.append("Subject line is missing.")
        elif len(clean_subj) < 5:
            warnings.append("Subject line is too short (< 5 characters).")
        elif any(token in clean_subj for token in ['{{', '}}', '[Company Name]', 'undefined', 'null']):
            warnings.append("Subject contains unresolved template variables.")
        else:
            checks_passed += 1

        # Check 2: Recipient email address syntax
        clean_email = recipient_email.strip().lower()
        if not clean_email or not re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', clean_email):
            warnings.append(f"Invalid or missing recipient email address: '{clean_email}'")
        else:
            checks_passed += 1

        # Check 3: Body text length (100–180 words ideal, 30–350 words allowed)
        words = body_plain.split()
        word_count = len(words)
        if word_count == 0:
            warnings.append("Email body is empty.")
        elif word_count < 30:
            warnings.append(f"Email body is too brief ({word_count} words). Minimum 30 words required.")
        elif word_count > 350:
            warnings.append(f"Email body is excessively long ({word_count} words). Business outreach should be concise (< 300 words).")
        else:
            checks_passed += 1

        # Check 4: Unresolved placeholder scan
        unresolved = re.findall(r'\{\{[^}]+\}\}|\[[A-Z_]{3,}\]', body_plain)
        if unresolved:
            warnings.append(f"Unresolved placeholders found in body: {', '.join(unresolved[:3])}")
        elif 'undefined' in body_plain or 'NaN' in body_plain or 'null' in body_plain.lower():
            warnings.append("Detected possible unpopulated variable values ('undefined' / 'null') in body.")
        else:
            checks_passed += 1

        # Check 5: Clear Call to Action (CTA) presence
        cta_keywords = ['call', 'briefing', 'meeting', 'conversation', 'discuss', 'time', 'tuesday', 'wednesday', 'thursday', 'explore', 'connect']
        has_cta = any(k in body_plain.lower() for k in cta_keywords)
        if not has_cta:
            warnings.append("No clear low-pressure Call to Action (e.g. requesting a brief introductory discussion) detected.")
        else:
            checks_passed += 1

        # Check 6: Sender identity & sign-off presence
        sign_off_keywords = ['regards', 'sincerely', 'best', 'warmly', 'respectfully', 'cheers']
        has_signoff = any(k in body_plain.lower() for k in sign_off_keywords)
        if not has_signoff:
            warnings.append("Professional sign-off or closing signature appears to be missing.")
        else:
            checks_passed += 1

        # Check 7: Safe HTML content
        if '<script' in body_html.lower() or 'javascript:' in body_html.lower() or 'onerror=' in body_html.lower():
            warnings.append("Potentially unsafe script content detected in HTML email body.")
        else:
            checks_passed += 1

        # Check 8: No duplicate paragraphs or robotic repetition
        paragraphs = [p.strip() for p in body_plain.split('\n\n') if len(p.strip()) > 30]
        has_duplicates = len(paragraphs) != len(set(paragraphs))
        if has_duplicates:
            warnings.append("Detected identical duplicate paragraphs in email body.")
        else:
            checks_passed += 1

        # Check: Strict Anti-Hallucination & Cliché Checks
        lower_body = (body_plain + " " + body_html).lower()
        if "hope this email finds you well" in lower_body or "hope this note finds you well" in lower_body:
            warnings.append("Generic cliché detected ('I hope this email finds you well'). Vary the opening naturally.")
        if "as discussed on our call" in lower_body or "per our conversation" in lower_body or "as discussed yesterday" in lower_body:
            warnings.append("Ungrounded past conversation claim detected ('as discussed on our call'). Never invent previous interactions.")
        if "impressive market footprint" in lower_body or "blown away by your website" in lower_body:
            warnings.append("Exaggerated artificial flattery detected.")

        quality_score = max(20, int((checks_passed / total_checks) * 100))
        is_valid = len(warnings) == 0

        return {
            'is_valid': is_valid,
            'quality_score': quality_score,
            'checks_passed': checks_passed,
            'total_checks': total_checks,
            'word_count': word_count,
            'warnings': warnings
        }
