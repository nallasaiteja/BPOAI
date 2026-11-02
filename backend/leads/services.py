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
    def _row_to_smart_dict(row_cells: list) -> Dict[str, Any]:
        """
        Classifies cells in a headerless row by content pattern:
        detects Email, Phone Number, Designation, and Company Name.
        """
        import re
        item = {}
        email = None
        phone = None
        designation = None
        website = None
        remaining = []

        DESIGNATION_TERMS = [
            'ceo', 'founder', 'co-founder', 'director', 'partner', 'head', 
            'president', 'manager', 'lead', 'chief', 'officer', 'md', 
            'executive', 'vp', 'chairman', 'proprietor', 'owner'
        ]

        for cell in row_cells:
            val = str(cell or '').strip()
            if not val:
                continue

            # Check email
            if not email and re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', val):
                match = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', val)
                if match:
                    email = match.group(0)
            # Check website
            elif not website and (val.startswith(('http://', 'https://', 'www.')) or re.search(r'\.[a-z]{2,6}(\/.*)?$', val.lower())):
                website = val
            # Check phone number (mostly digits, +, parentheses, spaces)
            elif not phone and re.search(r'^\+?[\d\s\-().]{7,20}$', val) and len(re.sub(r'\D', '', val)) >= 7:
                phone = val
            # Check designation / title
            elif not designation and any(term in val.lower().split() or term in val.lower() for term in DESIGNATION_TERMS):
                designation = val
            else:
                remaining.append(val)

        if email:
            item['business_email'] = email
        if phone:
            item['contact_number'] = phone
        if designation:
            item['designation'] = designation
        if website:
            item['website_url'] = website

        if remaining:
            item['company_name'] = remaining[0]
            if len(remaining) > 1:
                item['contact_person'] = remaining[1]

        return item

    @staticmethod
    def parse_csv(file_obj) -> List[Dict[str, Any]]:
        import re
        decoded = file_obj.read().decode('utf-8', errors='ignore')
        reader = csv.reader(io.StringIO(decoded))
        all_rows = [row for row in reader if any(cell.strip() for cell in row)]
        if not all_rows:
            return []

        # Check if row 0 is actually data (contains an @ email address or phone)
        row0_str = " ".join([str(c or '') for c in all_rows[0]]).lower()
        is_headerless = ('@' in row0_str) or not any(k in row0_str for k in ['company', 'email', 'name', 'lead', 'phone', 'contact', 'designation', 'organization'])

        if is_headerless:
            leads = []
            for row in all_rows:
                lead_dict = LeadIngestionService._row_to_smart_dict(row)
                if lead_dict:
                    leads.append(lead_dict)
            return leads

        # Find the header row (first row with keywords)
        header_idx = 0
        for i, row in enumerate(all_rows[:5]):
            r_str = " ".join(row).lower()
            if any(k in r_str for k in ['company', 'email', 'name', 'lead', 'phone', 'contact', 'designation']):
                header_idx = i
                break

        raw_headers = all_rows[header_idx]
        headers = [re.sub(r'[^a-z0-9]', '', str(h).lower()) for h in raw_headers]
        leads = []
        for row in all_rows[header_idx + 1:]:
            item = {}
            for idx, h in enumerate(headers):
                if h and idx < len(row):
                    item[h] = LeadIngestionService.clean_text(row[idx])
            if item:
                leads.append(item)
        return leads

    @staticmethod
    def parse_excel(file_obj) -> List[Dict[str, Any]]:
        import re
        wb = openpyxl.load_workbook(file_obj, data_only=True)
        sheet = wb.active
        all_rows = list(sheet.iter_rows(values_only=True))
        all_rows = [row for row in all_rows if any(cell is not None and str(cell).strip() != '' for cell in row)]
        if not all_rows:
            return []

        # Check if row 0 is actually data (contains an @ email address or lacks keywords)
        row0_str = " ".join([str(c or '') for c in all_rows[0]]).lower()
        is_headerless = ('@' in row0_str) or not any(k in row0_str for k in ['company', 'email', 'name', 'lead', 'phone', 'contact', 'designation', 'organization'])

        if is_headerless:
            leads = []
            for row in all_rows:
                lead_dict = LeadIngestionService._row_to_smart_dict(row)
                if lead_dict:
                    leads.append(lead_dict)
            return leads

        # Find the header row
        header_idx = 0
        for i, row in enumerate(all_rows[:5]):
            r_str = " ".join([str(c or '') for c in row]).lower()
            if any(k in r_str for k in ['company', 'email', 'name', 'lead', 'phone', 'contact', 'designation']):
                header_idx = i
                break

        raw_headers = all_rows[header_idx]
        headers = [re.sub(r'[^a-z0-9]', '', str(h or '').lower()) for h in raw_headers]
        leads = []
        for row in all_rows[header_idx + 1:]:
            item = {}
            for idx, h in enumerate(headers):
                if h and idx < len(row):
                    item[h] = LeadIngestionService.clean_text(row[idx])
            if item:
                leads.append(item)
        return leads

    @classmethod
    def ingest_lead_batch(cls, raw_data_list: List[Dict[str, Any]], uploaded_by=None, source=LeadSource.CSV) -> Dict[str, Any]:
        import re
        created_count = 0
        duplicate_count = 0
        missing_info_count = 0
        created_lead_ids = []

        # Common public free email domains
        GENERIC_DOMAINS = {'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'mail.com'}

        for item in raw_data_list:
            # Flexible helper: match keys ignoring underscores/spaces/symbols
            def get_val(*possible_keys):
                for pk in possible_keys:
                    norm_pk = re.sub(r'[^a-z0-9]', '', pk.lower())
                    if norm_pk in item and item[norm_pk]:
                        return item[norm_pk]
                return ''

            company_name = get_val(
                'company_name', 'company', 'organization', 'organization_name', 
                'business', 'business_name', 'client', 'client_name', 
                'account', 'account_name', 'firm', 'firm_name', 'lead_name', 'companyname'
            )
            business_email = get_val(
                'business_email', 'email', 'work_email', 'contact_email', 
                'corporate_email', 'email_address', 'emailaddress', 'mail', 
                'mail_id', 'email_id', 'e_mail'
            )
            contact_person = get_val(
                'contact_person', 'contact', 'full_name', 'name', 
                'person', 'representative', 'contact_name', 'lead_contact'
            )
            designation = get_val('designation', 'title', 'role', 'job_title', 'position')
            contact_number = get_val('contact_number', 'phone', 'phone_number', 'mobile', 'mobile_number', 'tel', 'cell')
            country = get_val('country', 'nation', 'location') or 'United States'
            state = get_val('state', 'province', 'region')
            city = get_val('city', 'town')
            industry = get_val('industry', 'sector', 'vertical', 'category')
            website_url = get_val('website_url', 'website', 'url', 'web', 'domain', 'site', 'link')

            # Fallback 1: If email column was not explicitly named, search all item values for an email regex
            if not business_email:
                for val in item.values():
                    match = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', str(val))
                    if match:
                        business_email = match.group(0)
                        break

            # Fallback 2: If company name wasn't provided, but contact name was
            if not company_name and contact_person:
                # If there's only a single 'name' column and no other company, see if it represents company or person
                company_name = contact_person

            # Fallback 3: If company name is still missing, derive company from corporate email domain
            if not company_name and business_email and '@' in business_email:
                domain_part = business_email.split('@')[-1].lower()
                if domain_part not in GENERIC_DOMAINS:
                    base_domain = domain_part.split('.')[0]
                    company_name = base_domain.capitalize()

            # Fallback 4: Auto-populate website if missing and email domain is corporate
            if not website_url and business_email and '@' in business_email:
                domain_part = business_email.split('@')[-1].lower()
                if domain_part not in GENERIC_DOMAINS:
                    website_url = f"https://{domain_part}"

            # Both company_name and business_email are required
            if not company_name or not business_email:
                missing_info_count += 1
                continue

            # Standardize email & company
            clean_email = business_email.strip().lower()
            clean_company = company_name.strip()

            # Deduplication check
            existing = Lead.objects.filter(business_email__iexact=clean_email).first()
            if not existing:
                existing = Lead.objects.filter(company_name__iexact=clean_company).first()

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
            'lead_ids': created_lead_ids,
            'message': f"Ingested {created_count} new leads ({duplicate_count} duplicates skipped, {missing_info_count} missing info)."
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
