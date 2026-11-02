export type UserRole = 
  | 'SUPER_ADMIN'
  | 'ADMINISTRATOR'
  | 'SENIOR_MANAGER'
  | 'BPO_TEAM_LEADER'
  | 'RESEARCH_EXECUTIVE'
  | 'EMAIL_MARKETING_EXECUTIVE'
  | 'SALES_EXECUTIVE'
  | 'ACCOUNTS_EXECUTIVE'
  | 'READ_ONLY';

export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone_number?: string;
  avatar_url?: string;
  is_approved: boolean;
}

export type LeadStatus =
  | 'NEW'
  | 'IN_RESEARCH'
  | 'RESEARCHED'
  | 'REQUIREMENTS_IDENTIFIED'
  | 'SCORED'
  | 'EMAIL_PREPARED'
  | 'AWAITING_APPROVAL'
  | 'EMAIL_SENT'
  | 'ENGAGED'
  | 'CONVERTED'
  | 'COLD'
  | 'DISQUALIFIED'
  | 'NEEDS_VERIFICATION';

export type LeadScoreCategory =
  | 'HOT'
  | 'WARM'
  | 'COLD'
  | 'NOT_RELEVANT'
  | 'NEEDS_VERIFICATION';

export interface Company {
  id: string;
  name: string;
  domain?: string;
  website_url?: string;
  industry?: string;
  country?: string;
  state?: string;
  city?: string;
  is_verified: boolean;
  verification_confidence: number;
}

export interface WebsitePage {
  id: string;
  url: string;
  page_type: string;
  page_title: string;
  status_code: number;
  content_snippet?: string;
  technologies_found: string[];
}

export interface ResearchReport {
  id: string;
  company_overview?: string;
  business_model?: string;
  industry?: string;
  target_customers?: string;
  operating_countries: string[];
  main_products: string[];
  main_services: string[];
  tech_stack_detected: string[];
  expansion_signals: string[];
  job_openings: string[];
  outsourcing_opportunities: string[];
  source_urls: string[];
  mobile_responsive: boolean;
  ssl_active: boolean;
  page_speed_grade: string;
  has_meta_description: boolean;
  has_chat_widget: boolean;
  social_profiles: Record<string, string>;
  website_issues: string[];
  digital_marketing_gaps: string[];
  confidence_score: number;
  executive_summary?: string;
  pages?: WebsitePage[];
}

export interface ServiceCatalogue {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string;
  deliverables: string[];
  key_benefits: string[];
  default_hourly_rate: number | string;
  default_fixed_price: number | string;
  currency: string;
  estimated_timeline: string;
  is_active: boolean;
}

export interface BusinessRequirement {
  id: string;
  lead: string;
  category: string;
  category_display?: string;
  requirement_type: 'CONFIRMED' | 'ADVERTISED' | 'INFERRED';
  title: string;
  potential_business_problem: string;
  evidence_found: string;
  relevant_source_url?: string;
  suggested_solution: string;
  matched_service?: string;
  matched_service_detail?: ServiceCatalogue;
  opportunity_score: number;
  confidence_score: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  priority_display?: string;
  suggested_intro_message: string;
  is_approved_by_human: boolean;
}

export interface LeadScore {
  total_score: number;
  category: string;
  company_verification_score: number;
  website_availability_score: number;
  industry_relevance_score: number;
  service_requirement_score: number;
  activity_and_buying_signals_score: number;
  business_email_validity_score: number;
  explanation: string;
}

export interface VerificationDetails {
  confidence_score: number;
  required_threshold: number;
  is_verified: boolean;
  passed_threshold: boolean;
  points_needed: number;
  identified_reasons: string[];
  summary: string;
  recommended_action: string;
}

export interface Lead {
  id: string;
  lead_code: string;
  company_name: string;
  contact_person?: string;
  designation?: string;
  business_email: string;
  contact_number?: string;
  country: string;
  state?: string;
  city?: string;
  industry?: string;
  website_url?: string;
  lead_source: string;
  lead_status: LeadStatus;
  status_display?: string;
  extracted_domain?: string;
  is_business_domain: boolean;
  domain_company_matched?: boolean;
  is_company_verified: boolean;
  domain_confidence_score: number;
  manual_verification_required: boolean;
  verification_reason?: string;
  verification_details?: VerificationDetails;
  lead_score: number;
  lead_score_category: LeadScoreCategory;
  score_category_display?: string;
  score_breakdown?: Record<string, any>;
  score_explanation?: string;
  company_detail?: Company;
  research_report?: ResearchReport;
  requirements?: BusinessRequirement[];
  score_detail?: LeadScore;
  created_at: string;
  updated_at: string;
}

export interface EmailDraft {
  id: string;
  lead: string;
  lead_name: string;
  lead_email: string;
  email_type: string;
  subject: string;
  body_html: string;
  body_plain: string;
  status: 'DRAFT' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SENT';
  confidence_score: number;
  generated_at: string;
}

export interface Proposal {
  id: string;
  proposal_code: string;
  lead: string;
  company_name: string;
  proposal_type: string;
  type_display?: string;
  title: string;
  executive_summary: string;
  identified_challenges: string;
  proposed_solution: string;
  deliverables: string[];
  project_timeline: string;
  status: 'DRAFT' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'DELIVERED';
  status_display?: string;
  pdf_file?: string;
  docx_file?: string;
  created_at: string;
  quotation?: {
    id?: string;
    quotation_number: string;
    subtotal: number | string;
    discount_percentage?: number | string;
    discount_amount?: number | string;
    tax_rate?: number | string;
    tax_amount: number | string;
    total_amount: number | string;
    currency: string;
    notes?: string;
    is_pricing_pending?: boolean;
    line_items: Array<{
      id?: string;
      description: string;
      quantity: number | string;
      unit_price: number | string;
      total_price: number | string;
      service?: string;
      service_name?: string;
    }>;
  };
}

export interface DashboardKPIs {
  total_leads: number;
  verified_companies: number;
  unverified_companies: number;
  websites_discovered: number;
  requirements_identified: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  emails_generated: number;
  emails_awaiting_approval: number;
  emails_sent: number;
  replies_received: number;
  positive_responses: number;
  meetings_requested: number;
  quotations_generated: number;
  converted_customers: number;
  followups_pending: number;
}

export interface ExecutiveInsights {
  response_rate_percent: number;
  positive_conversion_percent: number;
  key_insights: string[];
  strategic_recommendations: string[];
  executive_brief: string;
}

export interface ColumnSuggestion {
  original_col: string;
  col_letter: string;
  sample_values: string[];
  suggested_field: string;
  suggested_field_label: string;
  confidence: number;
  reason: string;
  field_category: string;
  is_header: boolean;
}

export interface FileInspectionResult {
  file_token: string;
  filename: string;
  file_type: string;
  encoding?: string;
  delimiter?: string;
  sheet_names: string[];
  active_sheet?: string;
  total_rows: number;
  has_headers: boolean;
  header_confidence: number;
  header_reasons: string[];
  first_data_row_index: number;
  columns: ColumnSuggestion[];
  available_destinations: Array<{
    field: string;
    label: string;
    category: string;
    description: string;
  }>;
}

export interface MappingPreviewRow {
  row_num: number;
  status: 'valid' | 'invalid' | 'duplicate';
  errors: string[];
  normalized_data: Record<string, any>;
  original_data: Record<string, any>;
}

export interface MappingPreviewResult {
  file_token: string;
  total_rows: number;
  valid_count: number;
  invalid_count: number;
  duplicate_count: number;
  unmapped_columns: string[];
  sample_rows: MappingPreviewRow[];
  rejection_preview: Array<{
    row_num: number;
    reason: string;
    field: string;
    value: string;
  }>;
}

export interface CommitImportResult {
  batch_id: string;
  batch_number: string;
  total_rows: number;
  imported_count: number;
  rejected_count: number;
  duplicate_count: number;
  has_rejections: boolean;
  rejection_report_url?: string;
  summary_message: string;
}

export interface LeadMappingTemplate {
  id: string;
  name: string;
  description?: string;
  mappings: Record<string, string>;
  is_default: boolean;
  use_count: number;
  created_at: string;
}

export interface ImportBatch {
  id: string;
  batch_number: string;
  original_filename: string;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  duplicate_rows: number;
  status: string;
  created_at: string;
}
