import re
import csv
import io
import openpyxl
import pandas as pd
import tldextract
from typing import List, Dict, Any, Tuple
from django.utils import timezone
from .models import Lead, Company, CompanyDomain, LeadStatus, LeadScoreCategory, LeadSource

FREE_EMAIL_PROVIDERS = {
    'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com',
    'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
    'aol.com', 'proton.me', 'protonmail.com', 'zoho.com', 'mail.com',
    'gmx.com', 'yandex.com', 'fastmail.com'
}

class LeadIngestionService:
    """
    Handles CSV, Excel, and manual lead ingestion with automated deduplication and cleaning.
    """

    @staticmethod
    def clean_text(val: Any) -> str:
        if val is None or pd.isna(val):
            return ""
        return str(val).strip()

    @staticmethod
    def parse_csv(file_obj) -> List[Dict[str, Any]]:
        decoded = file_obj.read().decode('utf-8', errors='ignore')
        reader = csv.DictReader(io.StringIO(decoded))
        leads = []
        for row in reader:
            normalized_row = {k.strip().lower().replace(" ", "_"): v.strip() for k, v in row.items() if k}
            leads.append(normalized_row)
        return leads

    @staticmethod
    def parse_excel(file_obj) -> List[Dict[str, Any]]:
        wb = openpyxl.load_workbook(file_obj, data_only=True)
        sheet = wb.active
        headers = [str(cell.value or '').strip().lower().replace(" ", "_") for cell in sheet[1]]
        leads = []
        for row in sheet.iter_rows(min_row=2, values_only=True):
            if not any(row):
                continue
            item = {}
            for idx, h in enumerate(headers):
                if h and idx < len(row):
                    item[h] = LeadIngestionService.clean_text(row[idx])
            leads.append(item)
        return leads

    @classmethod
    def ingest_lead_batch(cls, raw_data_list: List[Dict[str, Any]], uploaded_by=None, source=LeadSource.CSV) -> Dict[str, Any]:
        created_count = 0
        duplicate_count = 0
        missing_info_count = 0
        created_lead_ids = []

        for item in raw_data_list:
            # Map standard variations of column headers
            company_name = item.get('company_name') or item.get('company') or item.get('organization') or ''
            business_email = item.get('business_email') or item.get('email') or item.get('work_email') or ''
            contact_person = item.get('contact_person') or item.get('name') or item.get('full_name') or ''
            designation = item.get('designation') or item.get('title') or item.get('role') or ''
            contact_number = item.get('contact_number') or item.get('phone') or item.get('mobile') or ''
            country = item.get('country') or 'United States'
            state = item.get('state') or ''
            city = item.get('city') or ''
            industry = item.get('industry') or ''
            website_url = item.get('website_url') or item.get('website') or item.get('url') or ''

            if not company_name or not business_email:
                missing_info_count += 1
                continue

            # Standardize email
            clean_email = business_email.strip().lower()
            clean_company = company_name.strip()

            # Deduplication check
            existing = Lead.objects.filter(business_email__iexact=clean_email, company_name__iexact=clean_company).first()
            if existing:
                duplicate_count += 1
                continue

            # Create lead instance
            lead = Lead.objects.create(
                company_name=clean_company,
                contact_person=contact_person,
                designation=designation,
                business_email=clean_email,
                contact_number=contact_number,
                country=country,
                state=state,
                city=city,
                industry=industry,
                website_url=website_url if website_url.startswith(('http://', 'https://')) else (f"https://{website_url}" if website_url else ""),
                lead_source=source,
                uploaded_by=uploaded_by,
                is_cleaned=True
            )
            created_count += 1
            created_lead_ids.append(str(lead.id))

        return {
            'total_submitted': len(raw_data_list),
            'created_count': created_count,
            'duplicate_count': duplicate_count,
            'missing_info_count': missing_info_count,
            'lead_ids': created_lead_ids
        }


class EmailDomainIntelligenceService:
    """
    Module 2: Evaluates email domain validity, distinguishes generic providers from business domains,
    matches with company names, and establishes verification confidence scores.
    """

    @classmethod
    def analyze_lead_domain(cls, lead: Lead) -> Dict[str, Any]:
        email = (lead.business_email or "").strip().lower()
        if '@' not in email:
            lead.manual_verification_required = True
            lead.domain_confidence_score = 0
            lead.lead_status = LeadStatus.NEEDS_VERIFICATION
            lead.save()
            return {'status': 'invalid_email', 'confidence': 0}

        domain_part = email.split('@')[-1].strip()
        lead.extracted_domain = domain_part

        # Check if generic provider
        if domain_part in FREE_EMAIL_PROVIDERS:
            lead.is_business_domain = False
            if lead.is_company_verified:
                lead.manual_verification_required = False
                lead.domain_confidence_score = 85
                reason = f"Free/public email provider (@{domain_part}) approved via management manual override."
            else:
                lead.manual_verification_required = True
                lead.domain_confidence_score = 25
                lead.lead_status = LeadStatus.NEEDS_VERIFICATION
                reason = f"Public free email provider (@{domain_part}) used instead of official corporate domain. Automated verification requires corporate domain ownership (Confidence: 25%, Required: >= 70%)."

            lead.domain_company_matched = False
            lead.is_domain_analyzed = True

            # Ensure company object exists with verification notes
            company_cleaned = re.sub(r'[^a-zA-Z0-9\s]', '', lead.company_name.lower())
            company, _ = Company.objects.get_or_create(
                normalized_name=company_cleaned,
                defaults={
                    'name': lead.company_name,
                    'domain': domain_part,
                    'is_verified': lead.is_company_verified,
                    'verification_confidence': lead.domain_confidence_score,
                    'verification_notes': reason
                }
            )
            company.verification_notes = reason
            company.verification_confidence = lead.domain_confidence_score
            company.is_verified = lead.is_company_verified
            company.save()
            lead.company = company
            lead.save()

            return {
                'domain': domain_part,
                'is_business_domain': False,
                'confidence': lead.domain_confidence_score,
                'reason': reason
            }

        lead.is_business_domain = True
        extracted = tldextract.extract(domain_part)
        domain_sld = extracted.domain.lower()  # e.g. "microsoft" from "microsoft.com"

        # Clean company name for fuzzy matching
        company_cleaned = re.sub(r'[^a-zA-Z0-9\s]', '', lead.company_name.lower())
        company_words = company_cleaned.split()

        # Check company name vs domain name
        match_found = False
        if domain_sld in company_cleaned.replace(" ", ""):
            match_found = True
        elif any(w in domain_sld for w in company_words if len(w) > 3):
            match_found = True

        confidence = 85 if match_found else 55

        # If website URL is already provided and matches domain
        website_provided = bool(lead.website_url)
        if lead.website_url and domain_part in lead.website_url.lower():
            confidence = min(100, confidence + 15)
            match_found = True

        if confidence < 70:
            if not match_found and not website_provided:
                reason = f"Domain '@{domain_part}' does not match company name '{lead.company_name}', and no corporate website was provided to verify identity (Confidence: {confidence}%, Required: >= 70%)."
            elif not match_found:
                reason = f"Domain '@{domain_part}' does not clearly match company name '{lead.company_name}' (Confidence: {confidence}%, Required: >= 70%)."
            else:
                reason = f"Verification confidence score is {confidence}%, which is below the mandatory 70% threshold."
        else:
            reason = f"Corporate domain '@{domain_part}' successfully verified and matched to '{lead.company_name}' ({confidence}% confidence)."

        lead.domain_company_matched = match_found
        lead.domain_confidence_score = confidence
        lead.is_domain_analyzed = True

        # Link or create Company
        company, _ = Company.objects.get_or_create(
            normalized_name=company_cleaned,
            defaults={
                'name': lead.company_name,
                'domain': domain_part,
                'website_url': lead.website_url or f"https://www.{domain_part}",
                'industry': lead.industry,
                'country': lead.country,
                'state': lead.state,
                'city': lead.city,
                'is_verified': confidence >= 70,
                'verification_confidence': confidence,
                'verification_notes': reason
            }
        )
        company.verification_notes = reason
        company.verification_confidence = confidence
        company.is_verified = (confidence >= 70)
        company.save()

        CompanyDomain.objects.get_or_create(
            company=company,
            domain_name=domain_part,
            defaults={
                'is_business_domain': True,
                'is_primary': True
            }
        )

        lead.company = company
        lead.is_company_verified = (confidence >= 70)
        lead.manual_verification_required = (confidence < 70)
        if confidence < 70:
            lead.lead_status = LeadStatus.NEEDS_VERIFICATION
        else:
            lead.lead_status = LeadStatus.IN_RESEARCH

        lead.save()

        return {
            'domain': domain_part,
            'is_business_domain': True,
            'company_matched': match_found,
            'confidence': confidence,
            'verified': lead.is_company_verified,
            'company_id': str(company.id)
        }
