from rest_framework import serializers
from core.models import User, Organization, AuditLog, Notification, AIUsageLog
from leads.models import Lead, Company, CompanyDomain
from research.models import ResearchReport, WebsitePage, CompanyProduct, CompanyService
from requirements_ai.models import BusinessRequirement, ServiceCatalogue, LeadScore
from communications.models import EmailAccount, EmailDraft, SentEmail, EmailReply, FollowUpSchedule
from proposals.models import Proposal, Quotation, QuotationLineItem, ProposalConfig

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone_number', 'avatar_url', 'is_approved', 'created_at']
        read_only_fields = ['id', 'created_at']

class CompanyDomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyDomain
        fields = '__all__'

class CompanySerializer(serializers.ModelSerializer):
    domains = CompanyDomainSerializer(many=True, read_only=True)
    class Meta:
        model = Company
        fields = '__all__'

class WebsitePageSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebsitePage
        fields = '__all__'

class ResearchReportSerializer(serializers.ModelSerializer):
    pages = WebsitePageSerializer(many=True, read_only=True)
    class Meta:
        model = ResearchReport
        fields = '__all__'

class ServiceCatalogueSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCatalogue
        fields = '__all__'

class BusinessRequirementSerializer(serializers.ModelSerializer):
    matched_service_detail = ServiceCatalogueSerializer(source='matched_service', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)

    class Meta:
        model = BusinessRequirement
        fields = '__all__'

class LeadScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadScore
        fields = '__all__'

class LeadSerializer(serializers.ModelSerializer):
    company_detail = CompanySerializer(source='company', read_only=True)
    research_report = ResearchReportSerializer(read_only=True)
    requirements = BusinessRequirementSerializer(many=True, read_only=True)
    score_detail = LeadScoreSerializer(read_only=True)
    status_display = serializers.CharField(source='get_lead_status_display', read_only=True)
    score_category_display = serializers.CharField(source='get_lead_score_category_display', read_only=True)
    verification_reason = serializers.SerializerMethodField()
    verification_details = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = '__all__'
        read_only_fields = ['id', 'lead_code', 'dedup_hash', 'created_at', 'updated_at']

    def get_verification_reason(self, obj):
        if obj.company and obj.company.verification_notes:
            return obj.company.verification_notes

        email = (obj.business_email or '').lower().strip()
        domain = obj.extracted_domain or (email.split('@')[-1] if '@' in email else '')
        conf = obj.domain_confidence_score

        if not email or '@' not in email:
            return "Missing or invalid corporate email address (0% confidence)."

        from leads.services import FREE_EMAIL_PROVIDERS
        if domain in FREE_EMAIL_PROVIDERS:
            return f"Free/public email provider (@{domain}) used. Corporate email domain is required for automated identity verification (Confidence: {conf}%, Required: >= 70%)."

        if not obj.domain_company_matched and conf < 70:
            if not obj.website_url:
                return f"Domain '@{domain}' does not match company name '{obj.company_name}', and no corporate website URL was provided to corroborate ownership (Confidence: {conf}%, Required: >= 70%)."
            return f"Domain '@{domain}' could not be matched with company name '{obj.company_name}' (Confidence: {conf}%, Required: >= 70%)."

        if conf >= 70:
            return f"Corporate business domain '@{domain}' verified and matched with company '{obj.company_name}' ({conf}% confidence)."

        return f"Domain verification score is {conf}%, which is below the mandatory 70% threshold for automated processing."

    def get_verification_details(self, obj):
        conf = obj.domain_confidence_score
        threshold = 70
        is_verified = obj.is_company_verified
        email = (obj.business_email or '').lower().strip()
        domain = obj.extracted_domain or (email.split('@')[-1] if '@' in email else '')
        from leads.services import FREE_EMAIL_PROVIDERS
        is_free_provider = domain in FREE_EMAIL_PROVIDERS
        has_website = bool(obj.website_url)
        name_matched = bool(obj.domain_company_matched)

        reasons = []
        if '@' not in email:
            reasons.append("Email is missing valid '@' domain separator (-100% penalty)")
        if is_free_provider:
            reasons.append(f"Domain '@{domain}' is a free/public email host (Gmail/Yahoo/Outlook), not a corporate domain (-45% penalty)")
        if not name_matched and not is_free_provider:
            reasons.append(f"Domain name '@{domain}' does not align with company name '{obj.company_name}' (-30% penalty)")
        if not has_website:
            reasons.append("No official corporate website URL provided to validate domain association (-15% penalty)")

        return {
            'confidence_score': conf,
            'required_threshold': threshold,
            'is_verified': is_verified,
            'passed_threshold': conf >= threshold,
            'points_needed': max(0, threshold - conf),
            'identified_reasons': reasons if conf < threshold else ["All domain identity and MX checks passed."],
            'summary': self.get_verification_reason(obj),
            'recommended_action': "Management user can click 'Verify Identity' button to manually override and approve this company." if conf < threshold else "Ready for automated AI pipeline."
        }

class EmailAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailAccount
        exclude = ['smtp_password', 'oauth_credentials']

class EmailDraftSerializer(serializers.ModelSerializer):
    lead_name = serializers.CharField(source='lead.company_name', read_only=True)
    lead_email = serializers.CharField(source='lead.business_email', read_only=True)

    class Meta:
        model = EmailDraft
        fields = '__all__'

class SentEmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = SentEmail
        fields = '__all__'

class EmailReplySerializer(serializers.ModelSerializer):
    lead_code = serializers.CharField(source='lead.lead_code', read_only=True)
    company_name = serializers.CharField(source='lead.company_name', read_only=True)

    class Meta:
        model = EmailReply
        fields = '__all__'

class FollowUpScheduleSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='lead.company_name', read_only=True)

    class Meta:
        model = FollowUpSchedule
        fields = '__all__'

class QuotationLineItemSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source='service.name', read_only=True)

    class Meta:
        model = QuotationLineItem
        fields = '__all__'

class QuotationSerializer(serializers.ModelSerializer):
    line_items = QuotationLineItemSerializer(many=True, read_only=True)
    is_pricing_pending = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = '__all__'

    def get_is_pricing_pending(self, obj):
        return not obj.line_items.exists() or obj.total_amount <= 0

class ProposalSerializer(serializers.ModelSerializer):
    quotation = QuotationSerializer(read_only=True)
    company_name = serializers.CharField(source='lead.company_name', read_only=True)
    type_display = serializers.CharField(source='get_proposal_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Proposal
        fields = '__all__'

class ProposalConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProposalConfig
        fields = '__all__'

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'

class AIUsageLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIUsageLog
        fields = '__all__'
