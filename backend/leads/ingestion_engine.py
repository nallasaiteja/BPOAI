import io
import re
import csv
import uuid
import hashlib
import logging
from typing import List, Dict, Any, Tuple, Optional
import openpyxl

logger = logging.getLogger(__name__)

# Maximum file size: 15 MB
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024
MAX_ROW_LIMIT = 50000

# Target Destination Fields Schema
TARGET_FIELDS = [
    {'key': 'company_name', 'label': 'Company Name', 'required': True, 'category': 'Core Identity'},
    {'key': 'business_email', 'label': 'Primary Email', 'required': True, 'category': 'Communication'},
    {'key': 'secondary_email', 'label': 'Secondary Email', 'required': False, 'category': 'Communication'},
    {'key': 'contact_person', 'label': 'Contact Person (Full Name)', 'required': False, 'category': 'Contact Identity'},
    {'key': 'first_name', 'label': 'First Name', 'required': False, 'category': 'Contact Identity'},
    {'key': 'last_name', 'label': 'Last Name', 'required': False, 'category': 'Contact Identity'},
    {'key': 'designation', 'label': 'Designation / Job Title', 'required': False, 'category': 'Contact Identity'},
    {'key': 'website_url', 'label': 'Website / Domain', 'required': False, 'category': 'Core Identity'},
    {'key': 'contact_number', 'label': 'Phone Number', 'required': False, 'category': 'Communication'},
    {'key': 'mobile_number', 'label': 'Mobile Number', 'required': False, 'category': 'Communication'},
    {'key': 'industry', 'label': 'Industry / Sector', 'required': False, 'category': 'Business Intelligence'},
    {'key': 'country', 'label': 'Country', 'required': False, 'category': 'Location'},
    {'key': 'state', 'label': 'State / Province', 'required': False, 'category': 'Location'},
    {'key': 'city', 'label': 'City', 'required': False, 'category': 'Location'},
    {'key': 'company_description', 'label': 'Company Description', 'required': False, 'category': 'Business Intelligence'},
    {'key': 'employee_count', 'label': 'Employee Count', 'required': False, 'category': 'Business Intelligence'},
    {'key': 'annual_revenue', 'label': 'Annual Revenue', 'required': False, 'category': 'Business Intelligence'},
    {'key': 'linkedin_url', 'label': 'LinkedIn URL', 'required': False, 'category': 'Communication'},
    {'key': 'lead_source', 'label': 'Lead Source', 'required': False, 'category': 'CRM Metadata'},
    {'key': 'notes', 'label': 'Additional Notes', 'required': False, 'category': 'CRM Metadata'},
    {'key': 'ignore', 'label': '-- Ignore this column --', 'required': False, 'category': 'Special'},
]

# Comprehensive Synonym Dictionary
FIELD_SYNONYMS: Dict[str, List[str]] = {
    'company_name': [
        'company', 'company_name', 'companyname', 'organization', 'organisation',
        'organization_name', 'business', 'business_name', 'account', 'account_name',
        'firm', 'firm_name', 'client', 'client_name', 'enterprise', 'lead_name',
        'employer', 'agency', 'corp', 'corporation', 'legal_entity'
    ],
    'business_email': [
        'email', 'business_email', 'work_email', 'primary_email', 'corporate_email',
        'email_address', 'mail', 'e_mail', 'email_id', 'contact_email', 'mail_id',
        'emailaddress', 'user_email', 'official_email', 'direct_email'
    ],
    'secondary_email': [
        'secondary_email', 'alt_email', 'alternative_email', 'personal_email',
        'other_email', 'email_2', 'email2', 'backup_email', 'additional_email'
    ],
    'contact_person': [
        'contact_person', 'contact', 'full_name', 'name', 'person', 'representative',
        'lead_contact', 'contact_name', 'decision_maker', 'owner', 'poc',
        'point_of_contact', 'executive_name'
    ],
    'first_name': ['first_name', 'fname', 'given_name', 'first', 'forename'],
    'last_name': ['last_name', 'lname', 'surname', 'family_name', 'last'],
    'designation': [
        'designation', 'job_title', 'title', 'role', 'position', 'occupation',
        'job_role', 'level', 'profession', 'job_position'
    ],
    'website_url': [
        'website', 'website_url', 'url', 'web', 'domain', 'site', 'company_url',
        'link', 'webpage', 'homepage', 'web_address', 'company_website'
    ],
    'contact_number': [
        'phone', 'phone_number', 'contact_number', 'telephone', 'tel', 'phone_no',
        'work_phone', 'office_phone', 'landline', 'desk_phone', 'phonenumber'
    ],
    'mobile_number': [
        'mobile', 'mobile_number', 'cell', 'cellular', 'mobile_no', 'cell_phone',
        'whatsapp', 'direct_phone'
    ],
    'industry': ['industry', 'sector', 'vertical', 'category', 'domain', 'line_of_business', 'market'],
    'country': ['country', 'nation', 'location', 'region_country', 'geo'],
    'state': ['state', 'province', 'region', 'state_province', 'territory'],
    'city': ['city', 'town', 'municipality', 'metro'],
    'company_description': ['description', 'about', 'overview', 'company_description', 'summary', 'bio', 'mission'],
    'employee_count': ['employee_count', 'employees', 'company_size', 'headcount', 'size', 'team_size', 'staff_count', 'num_employees'],
    'annual_revenue': ['revenue', 'annual_revenue', 'turnover', 'sales', 'arr', 'estimated_revenue'],
    'linkedin_url': ['linkedin', 'linkedin_url', 'linkedin_profile', 'company_linkedin', 'linkedin_page'],
    'lead_source': ['source', 'lead_source', 'channel', 'campaign', 'medium', 'origin'],
    'notes': ['notes', 'comments', 'remarks', 'extra', 'message', 'description_notes']
}

DESIGNATION_TERMS = {
    'ceo', 'founder', 'co-founder', 'director', 'partner', 'head', 'president',
    'manager', 'lead', 'chief', 'officer', 'md', 'executive', 'vp', 'chairman',
    'proprietor', 'owner', 'consultant', 'architect', 'principal', 'specialist',
    'engineer', 'developer', 'cfo', 'cto', 'coo', 'cmo', 'cro'
}

COMMON_INDUSTRIES = {
    'software', 'technology', 'saas', 'it', 'healthcare', 'fintech', 'finance',
    'ecommerce', 'e-commerce', 'retail', 'logistics', 'manufacturing', 'real estate',
    'education', 'marketing', 'advertising', 'consulting', 'hospitality', 'travel',
    'automotive', 'telecom', 'energy', 'insurance', 'banking', 'pharma', 'biotech'
}

COMMON_COUNTRIES = {
    'united states', 'usa', 'india', 'united kingdom', 'uk', 'canada', 'australia',
    'germany', 'france', 'singapore', 'uae', 'united arab emirates', 'netherlands',
    'ireland', 'switzerland', 'sweden', 'japan', 'brazil', 'israel', 'mexico'
}

GENERIC_EMAIL_DOMAINS = {
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
    'aol.com', 'mail.com', 'zoho.com', 'protonmail.com', 'yandex.com'
}


class IntelligentIngestionEngine:
    """
    Enterprise-grade intelligent ingestion engine:
    1. Multi-format & multi-encoding file reader with multi-sheet workbook support.
    2. Statistical and pattern-based automatic header detection.
    3. Hybrid semantic column recognition engine with confidence scoring.
    4. Comprehensive record validation, deduplication, and rejection reporting.
    5. Formula-injection safe export generation.
    """

    @classmethod
    def sanitize_formula_injection(cls, val: Any) -> str:
        """
        Protects against CSV/Excel Formula Injection by prepending a quote
        if cell starts with =, +, -, @, tab, or carriage return.
        """
        if val is None:
            return ""
        s = str(val).strip()
        if s and s[0] in ('=', '+', '-', '@', '\t', '\r'):
            return f"'{s}"
        return s

    @classmethod
    def clean_text(cls, val: Any) -> str:
        if val is None:
            return ""
        s = str(val).strip()
        # Remove null characters and trailing carriage returns
        return re.sub(r'[\x00\r]', '', s)

    @classmethod
    def parse_file_raw(cls, file_bytes: bytes, filename: str, sheet_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Reads raw file bytes (CSV, XLSX, XLS), detects sheets, delimiters, and returns raw matrix of rows.
        """
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise ValueError(f"File size exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES // (1024*1024)} MB.")
        if len(file_bytes) == 0:
            raise ValueError("The uploaded file is empty (0 bytes).")

        filename_lower = filename.lower()
        sheets_list: List[str] = []
        selected_sheet: Optional[str] = None
        raw_rows: List[List[str]] = []

        if filename_lower.endswith(('.xlsx', '.xlsm', '.xltx')):
            try:
                wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True, read_only=True)
            except Exception as e:
                err_str = str(e).lower()
                if 'password' in err_str or 'encrypted' in err_str:
                    raise ValueError("Password-protected Excel workbooks are not supported. Please remove password encryption and retry.")
                raise ValueError(f"Unable to parse Excel workbook: {str(e)}")

            sheets_list = wb.sheetnames
            if not sheets_list:
                raise ValueError("Excel workbook contains no readable sheets.")

            selected_sheet = sheet_name if sheet_name in sheets_list else sheets_list[0]
            ws = wb[selected_sheet]

            for row in ws.iter_rows(values_only=True):
                # Filter out completely empty rows
                cleaned_row = [cls.clean_text(c) for c in row]
                if any(cleaned_row):
                    raw_rows.append(cleaned_row)
                if len(raw_rows) >= MAX_ROW_LIMIT:
                    break
            wb.close()

        elif filename_lower.endswith('.csv'):
            # Encoding detection sequence
            encodings = ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
            decoded_text = None
            for enc in encodings:
                try:
                    decoded_text = file_bytes.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue

            if decoded_text is None:
                decoded_text = file_bytes.decode('utf-8', errors='ignore')

            # Delimiter detection
            sample = decoded_text[:4096]
            delimiter = ','
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=',;\t|')
                delimiter = dialect.delimiter
            except Exception:
                # Fallback heuristics
                for candidate in [',', ';', '\t', '|']:
                    if candidate in sample:
                        delimiter = candidate
                        break

            reader = csv.reader(io.StringIO(decoded_text), delimiter=delimiter)
            for row in reader:
                cleaned_row = [cls.clean_text(c) for c in row]
                if any(cleaned_row):
                    raw_rows.append(cleaned_row)
                if len(raw_rows) >= MAX_ROW_LIMIT:
                    break

            sheets_list = ['Sheet1']
            selected_sheet = 'Sheet1'
        else:
            raise ValueError("Unsupported file format. Please upload a .xlsx, .csv, or .xls file.")

        if not raw_rows:
            raise ValueError("The uploaded file does not contain any readable data rows.")

        return {
            'filename': filename,
            'file_size': len(file_bytes),
            'sheets': sheets_list,
            'selected_sheet': selected_sheet,
            'total_rows': len(raw_rows),
            'raw_rows': raw_rows
        }

    @classmethod
    def detect_headers(cls, raw_rows: List[List[str]]) -> Dict[str, Any]:
        """
        Intelligently analyzes whether row 0 represents column headers or live customer data.
        """
        if not raw_rows:
            return {'has_headers': False, 'confidence': 0, 'reason': 'No rows available'}

        row0 = raw_rows[0]
        row0_text = " ".join(row0).lower()

        # Check for immediate live data signals in Row 0
        has_email_in_row0 = any(re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', c) for c in row0)
        has_phone_in_row0 = any(re.search(r'^\+?[\d\s\-().]{7,15}$', c) and len(re.sub(r'\D', '', c)) >= 7 for c in row0)
        has_url_in_row0 = any(c.lower().startswith(('http://', 'https://', 'www.')) for c in row0)

        # Count header synonym matches in Row 0
        all_synonyms = set()
        for syns in FIELD_SYNONYMS.values():
            all_synonyms.update(syns)

        matched_synonyms_count = 0
        for cell in row0:
            norm_c = re.sub(r'[^a-z0-9]', '', cell.lower())
            if norm_c in all_synonyms or any(k in norm_c for k in ['name', 'email', 'phone', 'company', 'lead', 'title', 'website', 'country', 'state']):
                matched_synonyms_count += 1

        total_cols = len(row0)
        synonym_ratio = matched_synonyms_count / max(1, total_cols)

        # Decision rules
        if has_email_in_row0 or has_phone_in_row0:
            return {
                'has_headers': False,
                'confidence': 95,
                'header_row_index': None,
                'reason': 'First row contains live customer data (such as emails or phone numbers), not column headers.'
            }

        if synonym_ratio >= 0.4 or matched_synonyms_count >= 2:
            return {
                'has_headers': True,
                'confidence': min(98, int(60 + synonym_ratio * 40)),
                'header_row_index': 0,
                'reason': f"Detected {matched_synonyms_count} standard column headers (e.g. {', '.join([c for c in row0[:3] if c])})."
            }

        # Check rows 1-4 in case a title row preceded the header row
        for idx, row in enumerate(raw_rows[1:5], start=1):
            sub_matches = sum(1 for c in row if re.sub(r'[^a-z0-9]', '', c.lower()) in all_synonyms)
            if sub_matches >= 2:
                return {
                    'has_headers': True,
                    'confidence': 85,
                    'header_row_index': idx,
                    'reason': f"Detected header row at Row {idx + 1} with title header above it."
                }

        # Ambiguous / uncertain fallback
        return {
            'has_headers': False,
            'confidence': 55,
            'header_row_index': None,
            'reason': 'First row does not contain recognizable column header names. Suggesting headerless mode.'
        }

    @classmethod
    def analyze_columns(
        cls, 
        raw_rows: List[List[str]], 
        has_headers: bool, 
        header_row_index: Optional[int] = 0
    ) -> List[Dict[str, Any]]:
        """
        Examines every column in the dataset:
        1. Original header or letter (e.g., "Company Name", "Col A")
        2. Sample values
        3. Statistical data pattern ratios
        4. Proposed destination field with confidence score and human-readable explanation
        """
        if not raw_rows:
            return []

        # Determine header names & data rows
        num_cols = max(len(r) for r in raw_rows[:50])
        headers = []
        data_rows = []

        if has_headers:
            h_idx = header_row_index if header_row_index is not None else 0
            raw_h = raw_rows[h_idx]
            headers = [raw_h[i] if i < len(raw_h) and raw_h[i] else f"Col_{chr(65 + i)}" for i in range(num_cols)]
            data_rows = raw_rows[h_idx + 1:]
        else:
            headers = [f"Column {chr(65 + i)}" if i < 26 else f"Column {i + 1}" for i in range(num_cols)]
            data_rows = raw_rows

        assigned_targets = set()
        columns_analysis: List[Dict[str, Any]] = []

        for col_idx in range(num_cols):
            header_name = headers[col_idx] if col_idx < len(headers) else f"Column {col_idx + 1}"
            norm_header = re.sub(r'[^a-z0-9]', '', header_name.lower())

            # Gather non-empty sample values (first 25 rows)
            sample_values = []
            for r in data_rows[:25]:
                if col_idx < len(r) and r[col_idx].strip():
                    sample_values.append(r[col_idx].strip())

            total_samples = len(sample_values)
            display_samples = sample_values[:4]

            # Content pattern metrics
            email_count = sum(1 for v in sample_values if re.search(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', v))
            phone_count = sum(1 for v in sample_values if re.search(r'^\+?[\d\s\-().]{7,20}$', v) and len(re.sub(r'\D', '', v)) >= 7)
            url_count = sum(1 for v in sample_values if v.lower().startswith(('http://', 'https://', 'www.')) or re.search(r'\.[a-z]{2,6}(/.*)?$', v.lower()))
            linkedin_count = sum(1 for v in sample_values if 'linkedin.com' in v.lower())
            designation_count = sum(1 for v in sample_values if any(term in v.lower().split() or term in v.lower() for term in DESIGNATION_TERMS))
            industry_count = sum(1 for v in sample_values if any(ind in v.lower() for ind in COMMON_INDUSTRIES))
            country_count = sum(1 for v in sample_values if any(ctry in v.lower() for ctry in COMMON_COUNTRIES))
            number_count = sum(1 for v in sample_values if re.match(r'^[\$\€\₹\£]?\s*[\d,.]+\s*[kmB%]?$', v, re.I))

            email_ratio = email_count / max(1, total_samples)
            phone_ratio = phone_count / max(1, total_samples)
            url_ratio = url_count / max(1, total_samples)
            linkedin_ratio = linkedin_count / max(1, total_samples)
            designation_ratio = designation_count / max(1, total_samples)

            # Header match scores
            header_target = None
            header_match_score = 0
            for target_key, synonyms in FIELD_SYNONYMS.items():
                for syn in synonyms:
                    syn_norm = re.sub(r'[^a-z0-9]', '', syn)
                    if norm_header == syn_norm:
                        header_target = target_key
                        header_match_score = 100
                        break
                    elif syn_norm in norm_header or norm_header in syn_norm:
                        if len(norm_header) >= 3 and len(syn_norm) >= 3:
                            header_target = target_key
                            header_match_score = 75
                if header_match_score == 100:
                    break

            suggested_field = 'ignore'
            confidence = 30
            reason = "Unrecognized column format"
            alternatives = []

            # Rule 1: LinkedIn URL
            if linkedin_ratio >= 0.5 or (header_target == 'linkedin_url' and linkedin_ratio > 0):
                suggested_field = 'linkedin_url'
                confidence = 96 if linkedin_ratio >= 0.5 else 80
                reason = f"{int(linkedin_ratio*100)}% of cell values contain LinkedIn URLs"

            # Rule 2: Email (Primary vs Secondary)
            elif email_ratio >= 0.6 or (header_target in ('business_email', 'secondary_email') and email_ratio > 0.3):
                if 'business_email' not in assigned_targets:
                    suggested_field = 'business_email'
                    confidence = 98 if has_headers and header_target == 'business_email' else 92
                    reason = f"{int(email_ratio*100)}% of rows contain valid email addresses (Suggested as Primary Email)"
                    alternatives = ['secondary_email']
                else:
                    suggested_field = 'secondary_email'
                    confidence = 90
                    reason = "Additional email column detected (Suggested as Secondary Email)"

            # Rule 3: Phone (Primary vs Mobile)
            elif phone_ratio >= 0.6 or (header_target in ('contact_number', 'mobile_number') and phone_ratio > 0.3):
                if 'contact_number' not in assigned_targets:
                    suggested_field = 'contact_number'
                    confidence = 95 if has_headers and header_target == 'contact_number' else 90
                    reason = f"{int(phone_ratio*100)}% of rows contain valid phone numbers"
                    alternatives = ['mobile_number']
                else:
                    suggested_field = 'mobile_number'
                    confidence = 88
                    reason = "Additional phone column detected (Suggested as Mobile Number)"

            # Rule 4: Website URL
            elif url_ratio >= 0.5 or (header_target == 'website_url' and url_ratio > 0.2):
                suggested_field = 'website_url'
                confidence = 95 if header_target == 'website_url' else 85
                reason = f"{int(url_ratio*100)}% of cells contain domain/website URLs"

            # Rule 5: Job Title / Designation
            elif designation_ratio >= 0.4 or (header_target == 'designation' and designation_ratio > 0.2):
                suggested_field = 'designation'
                confidence = 95 if header_target == 'designation' else 86
                reason = f"Detected job titles & executive roles (e.g. {', '.join([v for v in sample_values if any(t in v.lower() for t in DESIGNATION_TERMS)][:2])})"

            # Rule 6: Header-driven exact matching
            elif header_target and header_match_score >= 75:
                suggested_field = header_target
                confidence = min(95, header_match_score + (10 if total_samples > 0 else 0))
                reason = f"Column header matches standard dictionary for '{header_name}'"

            # Rule 7: Geographic matches
            elif country_count / max(1, total_samples) >= 0.5:
                suggested_field = 'country'
                confidence = 88
                reason = f"Values match known global country names"
            elif industry_count / max(1, total_samples) >= 0.5:
                suggested_field = 'industry'
                confidence = 85
                reason = f"Values match standard industry sectors"

            # Rule 8: Company Name vs Contact Person heuristics
            elif 'company_name' not in assigned_targets and total_samples > 0:
                suggested_field = 'company_name'
                confidence = 70
                reason = f"Primary textual entity name (e.g. '{display_samples[0] if display_samples else ''}')"
                alternatives = ['contact_person', 'notes']
            elif 'contact_person' not in assigned_targets and total_samples > 0:
                suggested_field = 'contact_person'
                confidence = 65
                reason = f"Secondary text column representing individual contact"
                alternatives = ['company_description', 'notes']
            elif number_count / max(1, total_samples) >= 0.7:
                suggested_field = 'employee_count' if 'employee_count' not in assigned_targets else 'annual_revenue'
                confidence = 60
                reason = "Numeric data values"
                alternatives = ['annual_revenue', 'employee_count', 'ignore']
            else:
                suggested_field = 'ignore'
                confidence = 40
                reason = "No high-confidence match found; review or ignore"

            if suggested_field != 'ignore':
                assigned_targets.add(suggested_field)

            confidence_level = 'high' if confidence >= 80 else ('medium' if confidence >= 55 else 'low')

            columns_analysis.append({
                'column_index': col_idx,
                'header_name': header_name,
                'sample_values': display_samples,
                'suggested_field': suggested_field,
                'confidence': confidence,
                'confidence_level': confidence_level,
                'reason': reason,
                'alternatives': alternatives
            })

        return columns_analysis

    @classmethod
    def validate_and_preview_dataset(
        cls, 
        raw_rows: List[List[str]], 
        mappings: Dict[str, str], 
        has_headers: bool,
        header_row_index: Optional[int] = 0
    ) -> Dict[str, Any]:
        """
        Validates mapped records, computes data quality summary, checks duplicates in DB,
        and provides live preview of the first 5 records with a full rejection report.
        """
        from .models import Lead

        h_idx = (header_row_index if header_row_index is not None else 0) if has_headers else -1
        data_rows = raw_rows[h_idx + 1:] if has_headers else raw_rows

        # Invert mapping to col_index -> target_field
        index_to_target: Dict[int, str] = {}
        target_counts: Dict[str, int] = {}

        for col_key, target in mappings.items():
            if target and target != 'ignore':
                try:
                    c_idx = int(col_key.replace('col_', ''))
                    index_to_target[c_idx] = target
                    target_counts[target] = target_counts.get(target, 0) + 1
                except ValueError:
                    continue

        duplicate_target_warnings = [
            f"Multiple columns are mapped to '{t}'" for t, cnt in target_counts.items() if cnt > 1
        ]

        # Pre-fetch existing emails and companies in database for quick set membership lookup
        existing_emails = set(Lead.objects.values_list('business_email', flat=True))
        existing_companies = set(Lead.objects.values_list('company_name', flat=True))

        valid_records: List[Dict[str, Any]] = []
        preview_records: List[Dict[str, Any]] = []
        rejection_report: List[Dict[str, Any]] = []
        seen_file_emails = set()
        duplicate_count = 0
        invalid_count = 0
        incomplete_count = 0

        for r_num, row in enumerate(data_rows, start=h_idx + 2 if has_headers else 1):
            record: Dict[str, Any] = {
                'original_row_number': r_num,
                'raw_imported_data': {},
                'company_name': '',
                'business_email': '',
                'secondary_email': '',
                'contact_person': '',
                'first_name': '',
                'last_name': '',
                'designation': '',
                'job_title': '',
                'website_url': '',
                'contact_number': '',
                'mobile_number': '',
                'industry': '',
                'country': 'United States',
                'state': '',
                'city': '',
                'company_description': '',
                'employee_count': '',
                'annual_revenue': '',
                'linkedin_url': '',
                'lead_source': 'EXCEL' if has_headers else 'CSV',
                'notes': ''
            }

            for col_idx, cell_value in enumerate(row):
                record['raw_imported_data'][f"col_{col_idx}"] = cell_value
                if col_idx in index_to_target:
                    target_field = index_to_target[col_idx]
                    record[target_field] = cell_value

            # Combine First Name + Last Name if provided
            if record['first_name'] and not record['contact_person']:
                record['contact_person'] = f"{record['first_name']} {record['last_name']}".strip()

            # Fallback company from domain if company is missing
            if not record['company_name'] and record['business_email'] and '@' in record['business_email']:
                domain = record['business_email'].split('@')[-1].lower()
                if domain not in GENERIC_EMAIL_DOMAINS:
                    record['company_name'] = domain.split('.')[0].capitalize()

            # Fallback website from corporate domain
            if not record['website_url'] and record['business_email'] and '@' in record['business_email']:
                domain = record['business_email'].split('@')[-1].lower()
                if domain not in GENERIC_EMAIL_DOMAINS:
                    record['website_url'] = f"https://{domain}"

            # Auto-clean website protocol
            if record['website_url'] and not record['website_url'].startswith(('http://', 'https://')):
                record['website_url'] = f"https://{record['website_url']}"

            # Validate Record
            errors = []
            clean_company = record['company_name'].strip()
            clean_email = record['business_email'].strip().lower()

            if not clean_company:
                errors.append("Missing required Company Name")
            if not clean_email:
                errors.append("Missing required Primary Email")
            elif not re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', clean_email):
                errors.append(f"Invalid email address syntax: '{clean_email}'")

            # Check Duplicates
            is_duplicate = False
            if clean_email and clean_email in existing_emails:
                is_duplicate = True
                errors.append(f"Duplicate contact: '{clean_email}' already exists in CRM database")
            elif clean_company and clean_company in existing_companies:
                is_duplicate = True
                errors.append(f"Duplicate company: '{clean_company}' already exists in CRM database")
            elif clean_email and clean_email in seen_file_emails:
                is_duplicate = True
                errors.append(f"Duplicate row within this uploaded file for email '{clean_email}'")

            if clean_email:
                seen_file_emails.add(clean_email)

            if is_duplicate:
                duplicate_count += 1
                rejection_report.append({
                    'row_number': r_num,
                    'company_name': clean_company or '(Empty)',
                    'business_email': clean_email or '(Empty)',
                    'reasons': errors,
                    'status': 'DUPLICATE'
                })
            elif errors:
                invalid_count += 1
                rejection_report.append({
                    'row_number': r_num,
                    'company_name': clean_company or '(Empty)',
                    'business_email': clean_email or '(Empty)',
                    'reasons': errors,
                    'status': 'INVALID'
                })
            else:
                # Check for completeness warning (optional fields missing)
                missing_optional = []
                if not record['website_url']: missing_optional.append('Website')
                if not record['contact_number']: missing_optional.append('Phone')
                if not record['contact_person']: missing_optional.append('Contact Person')
                if missing_optional:
                    incomplete_count += 1

                record['company_name'] = clean_company
                record['business_email'] = clean_email
                valid_records.append(record)
                if len(preview_records) < 5:
                    preview_records.append({
                        'row_number': r_num,
                        'company_name': record['company_name'],
                        'business_email': record['business_email'],
                        'contact_person': record['contact_person'] or '—',
                        'designation': record['designation'] or '—',
                        'website_url': record['website_url'] or '—',
                        'contact_number': record['contact_number'] or '—',
                        'industry': record['industry'] or '—',
                        'country': record['country'] or '—',
                    })

        return {
            'total_rows': len(data_rows),
            'valid_count': len(valid_records),
            'invalid_count': invalid_count,
            'duplicate_count': duplicate_count,
            'incomplete_count': incomplete_count,
            'duplicate_warnings': duplicate_target_warnings,
            'preview_records': preview_records,
            'valid_records': valid_records,
            'rejection_report': rejection_report
        }

    @classmethod
    def commit_import(
        cls, 
        valid_records: List[Dict[str, Any]], 
        rejection_report: List[Dict[str, Any]],
        file_name: str, 
        file_size: int,
        sheet_name: str,
        has_headers: bool,
        mappings: Dict[str, str],
        user=None
    ) -> Dict[str, Any]:
        """
        Performs transactional commit into Lead & ImportBatch models.
        """
        from django.db import transaction
        from .models import Lead, ImportBatch
        from .services import EmailDomainIntelligenceService

        with transaction.atomic():
            batch = ImportBatch.objects.create(
                file_name=file_name,
                file_size=file_size,
                sheet_name=sheet_name,
                has_headers=has_headers,
                total_rows=len(valid_records) + len(rejection_report),
                imported_count=len(valid_records),
                duplicate_count=sum(1 for r in rejection_report if r.get('status') == 'DUPLICATE'),
                invalid_count=sum(1 for r in rejection_report if r.get('status') == 'INVALID'),
                mapping_decisions=mappings,
                rejection_report=rejection_report,
                uploaded_by=user if user and user.is_authenticated else None
            )

            created_leads = []
            for rec in valid_records:
                lead = Lead(
                    import_batch=batch,
                    original_row_number=rec.get('original_row_number'),
                    raw_imported_data=rec.get('raw_imported_data', {}),
                    company_name=cls.sanitize_formula_injection(rec['company_name']),
                    contact_person=cls.sanitize_formula_injection(rec.get('contact_person', '')),
                    first_name=cls.sanitize_formula_injection(rec.get('first_name', '')),
                    last_name=cls.sanitize_formula_injection(rec.get('last_name', '')),
                    designation=cls.sanitize_formula_injection(rec.get('designation', '')),
                    job_title=cls.sanitize_formula_injection(rec.get('job_title', '')),
                    business_email=rec['business_email'],
                    secondary_email=rec.get('secondary_email', ''),
                    contact_number=cls.sanitize_formula_injection(rec.get('contact_number', '')),
                    mobile_number=cls.sanitize_formula_injection(rec.get('mobile_number', '')),
                    country=cls.sanitize_formula_injection(rec.get('country', 'United States')),
                    state=cls.sanitize_formula_injection(rec.get('state', '')),
                    city=cls.sanitize_formula_injection(rec.get('city', '')),
                    industry=cls.sanitize_formula_injection(rec.get('industry', '')),
                    website_url=rec.get('website_url', ''),
                    company_description=cls.sanitize_formula_injection(rec.get('company_description', '')),
                    employee_count=cls.sanitize_formula_injection(rec.get('employee_count', '')),
                    annual_revenue=cls.sanitize_formula_injection(rec.get('annual_revenue', '')),
                    linkedin_url=rec.get('linkedin_url', ''),
                    notes=cls.sanitize_formula_injection(rec.get('notes', '')),
                    lead_source='EXCEL' if has_headers else 'CSV',
                    uploaded_by=user if user and user.is_authenticated else None,
                    is_cleaned=True
                )
                lead.save()
                created_leads.append(lead)

                # Trigger domain intelligence in-process to set verification score & initial lead score
                try:
                    EmailDomainIntelligenceService.analyze_lead_domain(lead)
                except Exception as e:
                    logger.warning(f"Domain analysis failed for lead {lead.id}: {e}")

        # Automatically start website crawling, research, and outreach preparation in the background for all verified leads
        verified_lead_ids = [str(l.id) for l in created_leads if l.is_company_verified]
        if verified_lead_ids:
            import threading
            threading.Thread(
                target=cls.process_verified_leads_to_outreach,
                args=(verified_lead_ids,),
                daemon=True
            ).start()

        return {
            'batch_id': str(batch.id),
            'batch_code': batch.batch_code,
            'imported_count': len(created_leads),
            'rejected_count': len(rejection_report),
            'duplicate_count': batch.duplicate_count,
            'invalid_count': batch.invalid_count,
            'message': f"Successfully committed import: {len(created_leads)} leads saved, {len(rejection_report)} rejected."
        }

    @classmethod
    def process_verified_leads_to_outreach(cls, lead_ids: List[str]) -> None:
        """
        Background worker that processes verified leads:
        Crawls company website using fast deterministic engine ($0 AI cost),
        extracts structured intelligence, identifies BPO requirements,
        generates personalized email draft & proposal,
        and transitions the lead to AWAITING_APPROVAL for the email outreach queue.
        """
        from .models import Lead, LeadStatus
        from research.services import CompanyResearchService
        from requirements_ai.services import RequirementAnalysisService
        from email_engine.services import EmailDraftingService

        for lead_id in lead_ids:
            try:
                lead = Lead.objects.filter(id=lead_id).first()
                if not lead or not lead.is_company_verified:
                    continue

                # 1. Controlled website crawling and evidence extraction (Fast, deterministic, $0 cost)
                report, _ = CompanyResearchService.initialize_and_run(lead_id=str(lead.id), force_refresh=False)

                # 2. Extract requirements
                RequirementAnalysisService.analyze_requirements_for_lead(lead)

                # 3. Generate tailored outreach email draft & proposal
                EmailDraftingService.generate_draft_for_lead(lead)

                # 4. Mark report approved and advance lead to outreach queue
                if report:
                    report.human_review_status = 'APPROVED'
                    report.save()

                lead.lead_status = LeadStatus.AWAITING_APPROVAL
                lead.is_email_generated = True
                lead.save()
                logger.info(f"Auto-processed verified lead {lead.company_name} to email outreach.")
            except Exception as e:
                logger.error(f"Error auto-processing verified lead {lead_id}: {e}")


import json
from pathlib import Path

def save_temp_inspection(token: str, data: Dict[str, Any]) -> None:
    from django.conf import settings
    temp_dir = settings.BASE_DIR / 'media' / 'temp_imports'
    temp_dir.mkdir(parents=True, exist_ok=True)
    with open(temp_dir / f"{token}.json", "w", encoding="utf-8") as f:
        json.dump(data, f)

def get_temp_inspection(token: str) -> Optional[Dict[str, Any]]:
    from django.conf import settings
    path = settings.BASE_DIR / 'media' / 'temp_imports' / f"{token}.json"
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

def delete_temp_inspection(token: str) -> None:
    from django.conf import settings
    path = settings.BASE_DIR / 'media' / 'temp_imports' / f"{token}.json"
    if path.exists():
        try:
            path.unlink()
        except Exception:
            pass

