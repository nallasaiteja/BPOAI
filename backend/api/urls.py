from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AuthViewSet, UserViewSet, LeadViewSet, CompanyViewSet,
    ServiceCatalogueViewSet, BusinessRequirementViewSet, EmailDraftViewSet,
    EmailAccountViewSet, EmailReplyViewSet, FollowUpScheduleViewSet,
    ProposalViewSet, ProposalConfigViewSet, dashboard_analytics_view,
    LeadMappingTemplateViewSet, ImportBatchViewSet,
    ICPConfigViewSet, ResearchReportViewSet, ResearchJobViewSet,
    CompanyOutreachProfileViewSet
)

router = DefaultRouter()
router.register(r'auth', AuthViewSet, basename='auth')
router.register(r'users', UserViewSet, basename='users')
router.register(r'leads', LeadViewSet, basename='leads')
router.register(r'companies', CompanyViewSet, basename='companies')
router.register(r'services', ServiceCatalogueViewSet, basename='services')
router.register(r'requirements', BusinessRequirementViewSet, basename='requirements')
router.register(r'email-drafts', EmailDraftViewSet, basename='email-drafts')
router.register(r'email-accounts', EmailAccountViewSet, basename='email-accounts')
router.register(r'company-profile', CompanyOutreachProfileViewSet, basename='company-profile')
router.register(r'replies', EmailReplyViewSet, basename='replies')
router.register(r'followups', FollowUpScheduleViewSet, basename='followups')
router.register(r'proposals', ProposalViewSet, basename='proposals')
router.register(r'proposal-config', ProposalConfigViewSet, basename='proposal-config')
router.register(r'mapping-templates', LeadMappingTemplateViewSet, basename='mapping-templates')
router.register(r'import-batches', ImportBatchViewSet, basename='import-batches')
router.register(r'icp-config', ICPConfigViewSet, basename='icp-config')
router.register(r'research-reports', ResearchReportViewSet, basename='research-reports')
router.register(r'research-jobs', ResearchJobViewSet, basename='research-jobs')

urlpatterns = [
    path('auth/google/callback/', AuthViewSet.as_view({'get': 'google_callback'}), name='auth-google-callback-slash'),
    path('auth/google_callback/', AuthViewSet.as_view({'get': 'google_callback'}), name='auth-google-callback-underscore'),
    path('', include(router.urls)),
    path('analytics/dashboard/', dashboard_analytics_view, name='dashboard-analytics'),
]
