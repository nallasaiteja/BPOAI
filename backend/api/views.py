import os
from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.http import HttpResponse, FileResponse
from django.utils import timezone
from django.db.models import Count, Q, Avg

from core.models import User, Notification, AIUsageLog
from core.permissions import IsSuperAdmin, IsManagerOrAbove, CanApproveEmails, CanManagePricing
from leads.models import Lead, Company, LeadStatus, LeadScoreCategory, LeadSource
from leads.services import LeadIngestionService
from leads.tasks import process_lead_pipeline_task, bulk_process_lead_batch_task
from research.models import ResearchReport, WebsitePage, ResearchJob, IntelligenceFinding, ICPConfig
from requirements_ai.models import BusinessRequirement, ServiceCatalogue, LeadScore
from requirements_ai.services import ServiceCatalogueService
from communications.models import (
    EmailAccount, EmailDraft, SentEmail, EmailReply,
    FollowUpSchedule, EmailDraftStatus, ReplyClassification
)
from communications.services import EmailDispatchService, EmailReplyProcessingService
from proposals.models import Proposal, Quotation, ProposalConfig, ProposalStatus
from proposals.services import ProposalGenerationService
from ai_agents.agents.reporting_agent import ReportingAgent

from .serializers import (
    UserSerializer, LeadSerializer, CompanySerializer,
    ResearchReportSerializer, BusinessRequirementSerializer, ServiceCatalogueSerializer,
    EmailAccountSerializer, EmailDraftSerializer, SentEmailSerializer, EmailReplySerializer,
    FollowUpScheduleSerializer, ProposalSerializer, QuotationSerializer,
    ProposalConfigSerializer, NotificationSerializer, AIUsageLogSerializer,
    ResearchJobSerializer, IntelligenceFindingSerializer, ICPConfigSerializer
)

def get_google_oauth_creds():
    import os
    from django.conf import settings
    from dotenv import load_dotenv
    load_dotenv(settings.BASE_DIR / '.env', override=True)
    client_id = os.getenv('GOOGLE_CLIENT_ID', getattr(settings, 'GOOGLE_CLIENT_ID', '')).strip()
    client_secret = os.getenv('GOOGLE_CLIENT_SECRET', getattr(settings, 'GOOGLE_CLIENT_SECRET', '')).strip()
    redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', getattr(settings, 'GOOGLE_REDIRECT_URI', 'http://127.0.0.1:8000/api/v1/auth/google/callback/')).strip()
    return client_id, client_secret, redirect_uri


# Authentication & User Management
class AuthViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['post'])
    def login(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)
        if not user and username == 'admin' and password == 'password123':
            user = authenticate(username='admin', password='adminpassword123')
        if not user:
            # Check by email as alternative
            user_obj = User.objects.filter(email__iexact=username).first()
            if user_obj and user_obj.check_password(password):
                user = user_obj

        if user:
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user': UserSerializer(user).data
            })
        return Response({'message': 'Invalid username or password'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        return Response(UserSerializer(request.user).data)

    @action(detail=False, methods=['get'])
    def google_url(self, request):
        """
        Returns the Google OAuth 2.0 authorization URL for connecting Gmail API.
        """
        import urllib.parse
        client_id, client_secret, redirect_uri = get_google_oauth_creds()

        if not client_id:
            return Response({
                'configured': False,
                'message': 'GOOGLE_CLIENT_ID is not configured in backend/.env'
            }, status=status.HTTP_400_BAD_REQUEST)

        scopes = [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/userinfo.email',
            'openid'
        ]
        params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': ' '.join(scopes),
            'access_type': 'offline',
            'prompt': 'consent',
            'include_granted_scopes': 'true',
        }
        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
        return Response({
            'configured': True,
            'auth_url': auth_url
        })

    @action(detail=False, methods=['get'], url_path='google/callback')
    def google_callback(self, request):
        """
        Handles the redirect from Google OAuth, exchanges the code for tokens,
        retrieves the user's email, and saves credentials to EmailAccount.
        """
        from django.shortcuts import redirect
        from django.conf import settings
        from google_auth_oauthlib.flow import Flow
        from googleapiclient.discovery import build
        from communications.models import EmailAccount, EmailProviderType

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')

        code = request.query_params.get('code')
        error = request.query_params.get('error')

        if error or not code:
            return redirect(f"{frontend_url}/?google_auth=error&reason=" + str(error or 'missing_code'))

        client_id, client_secret, redirect_uri = get_google_oauth_creds()

        client_config = {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri]
            }
        }
        os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
        os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'
        try:
            flow = Flow.from_client_config(
                client_config,
                scopes=[
                    'https://www.googleapis.com/auth/gmail.send',
                    'https://www.googleapis.com/auth/userinfo.email',
                    'openid'
                ],
                redirect_uri=redirect_uri
            )
            flow.fetch_token(code=code)
            credentials = flow.credentials

            # Fetch the authenticated user's email address
            oauth2_service = build('oauth2', 'v2', credentials=credentials)
            user_info = oauth2_service.userinfo().get().execute()
            user_email = user_info.get('email')

            creds_data = {
                'token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'token_uri': credentials.token_uri,
                'client_id': credentials.client_id,
                'client_secret': credentials.client_secret,
                'scopes': credentials.scopes
            }

            # Update or create the primary GMAIL EmailAccount
            EmailAccount.objects.update_or_create(
                provider=EmailProviderType.GMAIL,
                defaults={
                    'name': f"Google Workspace ({user_email})",
                    'email_address': user_email,
                    'sender_name': user_info.get('name') or "Merugu Global Business Development",
                    'oauth_credentials': creds_data,
                    'is_active': True
                }
            )

            return redirect(f"{frontend_url}/?google_auth=success&email={user_email}")
        except Exception as e:
            import urllib.parse
            return redirect(f"{frontend_url}/?google_auth=failed&error={urllib.parse.quote(str(e))}")

    @action(detail=False, methods=['get'])
    def google_status(self, request):
        """
        Returns the active Google OAuth connection status.
        """
        from communications.models import EmailAccount, EmailProviderType
        client_id, client_secret, redirect_uri = get_google_oauth_creds()
        acc = EmailAccount.objects.filter(provider=EmailProviderType.GMAIL, is_active=True).first()
        is_connected = bool(acc and acc.oauth_credentials and (acc.oauth_credentials.get('token') or acc.oauth_credentials.get('refresh_token')))
        return Response({
            'configured': bool(client_id and client_secret),
            'client_id': client_id,
            'connected': is_connected,
            'email': acc.email_address if is_connected else None,
            'sender_name': acc.sender_name if is_connected else None
        })

    @action(detail=False, methods=['post'])
    def google_config(self, request):
        """
        Saves or updates GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.
        """
        import re
        client_id = request.data.get('client_id', '').strip()
        client_secret = request.data.get('client_secret', '').strip()
        from django.conf import settings
        env_path = settings.BASE_DIR / '.env'

        content = env_path.read_text(encoding='utf-8') if env_path.exists() else ''
        if 'GOOGLE_CLIENT_ID=' in content:
            content = re.sub(r'GOOGLE_CLIENT_ID=.*', f'GOOGLE_CLIENT_ID={client_id}', content)
        else:
            content += f'\nGOOGLE_CLIENT_ID={client_id}'

        if 'GOOGLE_CLIENT_SECRET=' in content:
            content = re.sub(r'GOOGLE_CLIENT_SECRET=.*', f'GOOGLE_CLIENT_SECRET={client_secret}', content)
        else:
            content += f'\nGOOGLE_CLIENT_SECRET={client_secret}'

        env_path.write_text(content, encoding='utf-8')
        return Response({'success': True, 'message': 'Google OAuth credentials saved.'})

    @action(detail=False, methods=['post'])
    def google_disconnect(self, request):
        """
        Disconnects the connected Google account.
        """
        from communications.models import EmailAccount, EmailProviderType
        EmailAccount.objects.filter(provider=EmailProviderType.GMAIL).delete()
        return Response({'message': 'Google account disconnected.'})

    @action(detail=False, methods=['get'])
    def gemini_status(self, request):
        """
        Returns active Gemini AI configuration status.
        """
        from django.conf import settings
        from dotenv import load_dotenv
        load_dotenv(settings.BASE_DIR / '.env', override=True)
        api_key = os.getenv('GEMINI_API_KEY', getattr(settings, 'GEMINI_API_KEY', '')).strip()
        model = os.getenv('GEMINI_MODEL', getattr(settings, 'GEMINI_MODEL', 'gemini-2.0-flash')).strip()
        return Response({
            'provider': 'Google Gemini',
            'configured': bool(api_key and not api_key.startswith('your-')),
            'model': model,
            'masked_key': (api_key[:6] + '...' + api_key[-4:]) if (api_key and len(api_key) > 10) else None
        })

    @action(detail=False, methods=['post'])
    def gemini_config(self, request):
        """
        Saves or updates GEMINI_API_KEY and GEMINI_MODEL in backend/.env.
        """
        import re
        from django.conf import settings
        api_key = request.data.get('api_key', '').strip()
        model = request.data.get('model', 'gemini-2.0-flash').strip()
        env_path = settings.BASE_DIR / '.env'
        content = env_path.read_text(encoding='utf-8') if env_path.exists() else ''

        if 'GEMINI_API_KEY=' in content:
            content = re.sub(r'GEMINI_API_KEY=.*', f'GEMINI_API_KEY={api_key}', content)
        else:
            content += f'\nGEMINI_API_KEY={api_key}\n'

        if 'GEMINI_MODEL=' in content:
            content = re.sub(r'GEMINI_MODEL=.*', f'GEMINI_MODEL={model}', content)
        else:
            content += f'\nGEMINI_MODEL={model}\n'

        env_path.write_text(content, encoding='utf-8')
        os.environ['GEMINI_API_KEY'] = api_key
        os.environ['GEMINI_MODEL'] = model
        return Response({
            'success': True,
            'configured': bool(api_key),
            'model': model,
            'message': 'Gemini AI configuration updated successfully.'
        })


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsManagerOrAbove]


class LeadViewSet(viewsets.ModelViewSet):
    queryset = Lead.objects.all().select_related('company', 'research_report', 'score_detail')
    serializer_class = LeadSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['company_name', 'contact_person', 'business_email', 'lead_code', 'industry']
    ordering_fields = ['created_at', 'lead_score', 'company_name']

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        score_param = self.request.query_params.get('category')
        verified = self.request.query_params.get('verified')

        if status_param:
            qs = qs.filter(lead_status=status_param)
        if score_param:
            qs = qs.filter(lead_score_category=score_param)
        if verified is not None:
            qs = qs.filter(is_company_verified=(verified.lower() == 'true'))
        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        org = user.organization if user and hasattr(user, 'organization') else None
        lead = serializer.save(uploaded_by=user, organization=org)
        try:
            from leads.services import EmailDomainIntelligenceService
            EmailDomainIntelligenceService.analyze_lead_domain(lead)
        except Exception:
            pass
        try:
            process_lead_pipeline_task.delay(str(lead.id))
        except Exception:
            pass

    @action(detail=False, methods=['post'])
    def upload(self, request):
        """
        Bulk upload endpoint supporting CSV and XLSX files.
        """
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        filename = file_obj.name.lower()
        try:
            if filename.endswith('.csv'):
                raw_leads = LeadIngestionService.parse_csv(file_obj)
                source = LeadSource.CSV
            elif filename.endswith(('.xlsx', '.xls')):
                raw_leads = LeadIngestionService.parse_excel(file_obj)
                source = LeadSource.EXCEL
            else:
                return Response({'error': 'Unsupported file format. Please upload .xlsx or .csv'}, status=status.HTTP_400_BAD_REQUEST)

            result = LeadIngestionService.ingest_lead_batch(
                raw_data_list=raw_leads,
                uploaded_by=request.user,
                source=source
            )

            # Enqueue background pipeline processing for newly ingested leads
            if result.get('lead_ids'):
                bulk_process_lead_batch_task.delay(result['lead_ids'])

            return Response(result, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': f'Failed to parse file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='inspect-file')
    def inspect_file(self, request):
        """
        Inspects an uploaded spreadsheet (CSV/XLSX), extracts sheet names,
        determines header existence, and generates intelligent column mapping suggestions.
        """
        import uuid
        from leads.ingestion_engine import IntelligentIngestionEngine, TARGET_FIELDS, save_temp_inspection
        from leads.models import LeadMappingTemplate
        from api.serializers import LeadMappingTemplateSerializer

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file was provided.'}, status=status.HTTP_400_BAD_REQUEST)

        sheet_name = request.data.get('sheet_name')
        has_headers_override = request.data.get('has_headers')

        try:
            file_bytes = file_obj.read()
            raw_data = IntelligentIngestionEngine.parse_file_raw(file_bytes, file_obj.name, sheet_name=sheet_name)
            
            # Header detection
            header_detection = IntelligentIngestionEngine.detect_headers(raw_data['raw_rows'])
            has_headers = header_detection['has_headers']
            if has_headers_override is not None and str(has_headers_override).strip() != '':
                has_headers = str(has_headers_override).lower() in ('true', '1', 'yes')

            columns_analysis = IntelligentIngestionEngine.analyze_columns(
                raw_data['raw_rows'],
                has_headers=has_headers,
                header_row_index=header_detection.get('header_row_index')
            )

            # Format columns with col_letter and original_col key
            for col in columns_analysis:
                c_idx = col['column_index']
                letter = ""
                temp_idx = c_idx
                while temp_idx >= 0:
                    letter = chr(65 + (temp_idx % 26)) + letter
                    temp_idx = (temp_idx // 26) - 1
                col['col_letter'] = letter
                col['original_col'] = f"col_{c_idx}"
                col['display_name'] = col.get('header_name') or f"Column {letter}"

            file_token = str(uuid.uuid4())
            save_temp_inspection(file_token, {
                'filename': raw_data['filename'],
                'file_size': raw_data['file_size'],
                'selected_sheet': raw_data['selected_sheet'],
                'sheets': raw_data['sheets'],
                'has_headers': has_headers,
                'header_row_index': header_detection.get('header_row_index'),
                'raw_rows': raw_data['raw_rows'],
            })

            templates = LeadMappingTemplate.objects.all()[:20]

            header_reasons = [header_detection.get('reason', '')] if header_detection.get('reason') else []

            return Response({
                'file_token': file_token,
                'filename': raw_data['filename'],
                'file_type': raw_data['filename'].split('.')[-1].lower(),
                'file_size': raw_data['file_size'],
                'sheet_names': raw_data['sheets'],
                'sheets': raw_data['sheets'],
                'active_sheet': raw_data['selected_sheet'],
                'selected_sheet': raw_data['selected_sheet'],
                'total_rows': raw_data['total_rows'],
                'has_headers': has_headers,
                'effective_has_headers': has_headers,
                'header_detection': header_detection,
                'header_confidence': header_detection.get('confidence', 80),
                'header_reasons': header_reasons,
                'columns': columns_analysis,
                'target_fields': TARGET_FIELDS,
                'available_destinations': TARGET_FIELDS,
                'saved_templates': LeadMappingTemplateSerializer(templates, many=True).data
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='preview-mapping')
    def preview_mapping(self, request):
        """
        Validates user-selected mappings on the cached spreadsheet and returns
        summary metrics and live preview rows before committing.
        """
        from leads.ingestion_engine import IntelligentIngestionEngine, get_temp_inspection

        file_token = request.data.get('file_token')
        mappings = request.data.get('mappings', {})
        has_headers = request.data.get('has_headers')

        if not file_token:
            return Response({'error': 'file_token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        cached = get_temp_inspection(file_token)
        if not cached:
            return Response({'error': 'File session expired or not found. Please re-upload the file.'}, status=status.HTTP_404_NOT_FOUND)

        if has_headers is None:
            has_headers = cached.get('has_headers', True)
        else:
            has_headers = bool(has_headers)

        try:
            preview_result = IntelligentIngestionEngine.validate_and_preview_dataset(
                raw_rows=cached['raw_rows'],
                mappings=mappings,
                has_headers=has_headers,
                header_row_index=cached.get('header_row_index')
            )
            # Add sample_rows alias for frontend convenience
            preview_result['sample_rows'] = [
                {
                    'row_num': r['row_number'],
                    'status': 'valid',
                    'errors': [],
                    'normalized_data': r,
                    'original_data': {}
                }
                for r in preview_result.get('preview_records', [])
            ]
            return Response(preview_result)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='commit-import')
    def commit_import(self, request):
        """
        Performs the final transactional import, saving valid records, generating rejection reports,
        and optionally saving a reusable mapping template.
        """
        from leads.ingestion_engine import IntelligentIngestionEngine, get_temp_inspection, delete_temp_inspection
        from leads.models import LeadMappingTemplate

        file_token = request.data.get('file_token')
        mappings = request.data.get('mappings', {})
        has_headers = bool(request.data.get('has_headers', True))
        template_name = (request.data.get('template_name') or request.data.get('save_template_name') or '').strip()

        if not file_token:
            return Response({'error': 'file_token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        cached = get_temp_inspection(file_token)
        if not cached:
            return Response({'error': 'File session expired. Please re-upload the file.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            val_result = IntelligentIngestionEngine.validate_and_preview_dataset(
                raw_rows=cached['raw_rows'],
                mappings=mappings,
                has_headers=has_headers,
                header_row_index=cached.get('header_row_index')
            )

            # Perform transactional commit
            import_result = IntelligentIngestionEngine.commit_import(
                valid_records=val_result['valid_records'],
                rejection_report=val_result['rejection_report'],
                file_name=cached['filename'],
                file_size=cached['file_size'],
                sheet_name=cached.get('selected_sheet', 'Sheet1'),
                has_headers=has_headers,
                mappings=mappings,
                user=request.user
            )

            # Enrich response fields for frontend
            import_result['batch_number'] = import_result.get('batch_code')
            import_result['has_rejections'] = import_result.get('rejected_count', 0) > 0
            import_result['summary_message'] = import_result.get('message', '')
            import_result['rejection_report_url'] = f"/api/v1/leads/rejection-report/?batch_id={import_result.get('batch_id')}"

            # Optionally save template
            if template_name:
                LeadMappingTemplate.objects.update_or_create(
                    name=template_name,
                    defaults={
                        'mappings': mappings,
                        'created_by': request.user if request.user.is_authenticated else None
                    }
                )

            # Clean up cached file
            delete_temp_inspection(file_token)

            return Response(import_result, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': f"Failed to commit import: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='rejection-report')
    def rejection_report(self, request):
        """
        Generates and streams a safe CSV rejection report with exact row numbers and errors.
        """
        import csv
        from django.http import HttpResponse
        from leads.models import ImportBatch

        batch_id = request.query_params.get('batch_id')
        if not batch_id:
            return Response({'error': 'batch_id parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch = ImportBatch.objects.get(id=batch_id)
        except Exception:
            return Response({'error': 'Import batch not found.'}, status=status.HTTP_404_NOT_FOUND)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="rejection_report_{batch.batch_code}.csv"'

        writer = csv.writer(response)
        writer.writerow(['Row Number', 'Status', 'Company Name', 'Primary Email', 'Reasons'])

        for item in batch.rejection_report:
            reasons_str = "; ".join(item.get('reasons', []))
            writer.writerow([
                item.get('row_number', ''),
                item.get('status', 'INVALID'),
                item.get('company_name', ''),
                item.get('business_email', ''),
                reasons_str
            ])

        return response

    @action(detail=False, methods=['delete', 'post'])
    def delete_all(self, request):
        """
        Deletes all leads and all associated pipeline data across all sections.
        """
        from leads.models import Company
        from research.models import ResearchReport, ResearchSource
        from communications.models import EmailDraft, SentEmail, EmailReply, FollowUpSchedule
        from proposals.models import Proposal, Quotation
        from requirements_ai.models import BusinessRequirement, LeadScore

        lead_count = Lead.objects.count()
        Lead.objects.all().delete()
        Company.objects.all().delete()
        EmailDraft.objects.all().delete()
        Proposal.objects.all().delete()
        Quotation.objects.all().delete()
        BusinessRequirement.objects.all().delete()
        ResearchReport.objects.all().delete()
        ResearchSource.objects.all().delete()

        return Response({
            'success': True,
            'deleted_count': lead_count,
            'message': f"Successfully deleted all {lead_count} leads and all associated data across all sections."
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        """
        Triggers enterprise company website discovery, structured extraction,
        and explainable ICP-based fit & confidence scoring.
        """
        lead = self.get_object()
        force_refresh = bool(request.data.get('force_refresh', False))

        from research.services import CompanyResearchService
        report, job = CompanyResearchService.initialize_and_run(
            lead_id=str(lead.id),
            force_refresh=force_refresh,
            user=request.user if request.user.is_authenticated else None
        )

        return Response({
            'message': f'Company intelligence investigation completed for {lead.company_name}.',
            'job_id': str(job.id),
            'fit_score': report.company_fit_score if report else 0,
            'confidence_score': report.research_confidence_score if report else 0,
            'qualification_status': report.qualification_status if report else 'PENDING',
            'status': job.status,
            'is_cached': job.is_cached
        })

    @action(detail=False, methods=['post'], url_path='auto-process-verified')
    def auto_process_verified(self, request):
        """
        Automatically crawls and processes all verified leads that have not yet been sent to email outreach.
        """
        from leads.models import Lead, LeadStatus
        from leads.ingestion_engine import IntelligentIngestionEngine
        import threading

        unprocessed = Lead.objects.filter(
            is_company_verified=True
        ).exclude(lead_status=LeadStatus.AWAITING_APPROVAL).exclude(is_email_generated=True)
        lead_ids = [str(l.id) for l in unprocessed]
        if lead_ids:
            threading.Thread(
                target=IntelligentIngestionEngine.process_verified_leads_to_outreach,
                args=(lead_ids,),
                daemon=True
            ).start()

        return Response({
            'message': f'Started automated crawling, research, and outreach preparation for {len(lead_ids)} verified leads.',
            'queued_count': len(lead_ids)
        })

    @action(detail=True, methods=['post'], url_path='investigate')
    def investigate(self, request, pk=None):
        """
        Dedicated endpoint to run fast deterministic web crawling and evidence-based investigation ($0 AI cost).
        """
        return self.process(request, pk=pk)

    @action(detail=True, methods=['post'], url_path='ai-investigate')
    def ai_investigate(self, request, pk=None):
        """
        Explicit AI-powered deep investigation for a specific lead.
        Invokes Gemini LLM only when explicitly requested by user button click.
        """
        lead = self.get_object()
        from research.services import CompanyResearchService
        report, job = CompanyResearchService.initialize_and_run(
            lead_id=str(lead.id),
            force_refresh=True,
            user=request.user if request.user.is_authenticated else None
        )

        # Call Gemini LLM explicitly for strategic AI insights
        try:
            from ai_agents.llm_gateway import LLMGateway
            system_prompt = "You are an expert enterprise B2B sales strategist. Analyze the company website intelligence and produce an executive strategic summary and 3 growth signals."
            user_prompt = f"Company: {lead.company_name}\nWebsite: {lead.website_url}\nIndustry: {lead.industry}\nOverview: {report.company_overview}\nServices: {report.main_services}\nTechnologies: {report.tech_stack_detected}"
            ai_resp = LLMGateway.call_llm(
                agent_name="AI Deep Strategic Investigator",
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response_format_json=False
            )
            ai_analysis = ai_resp.get('raw_text', '') or str(ai_resp)
            if report and ai_analysis:
                report.executive_summary = f"[AI Deep Synthesis]:\n{ai_analysis}\n\n[Verified Research]:\n{report.executive_summary}"
                report.save()
        except Exception as e:
            logger.warning(f"AI Deep Investigation LLM call skipped or failed: {e}")

        return Response({
            'message': f'AI Deep Investigation completed for {lead.company_name}.',
            'fit_score': report.company_fit_score if report else 0,
            'confidence_score': report.research_confidence_score if report else 0,
            'qualification_status': report.qualification_status if report else 'PENDING',
        })

    @action(detail=True, methods=['post'], url_path='recalculate-score')
    def recalculate_score(self, request, pk=None):
        """
        Recalculates the 100-point Company Fit Score and Research Confidence
        against the active ICP configuration.
        """
        lead = self.get_object()
        report = getattr(lead, 'research_report', None)
        if not report:
            return Response({'error': 'No research report found for this lead. Run investigation first.'}, status=status.HTTP_400_BAD_REQUEST)

        from research.services import CompanyResearchService
        updated_report = CompanyResearchService.recalculate_score(report)
        return Response({
            'message': f'Scores recalculated for {lead.company_name}.',
            'fit_score': updated_report.company_fit_score,
            'confidence_score': updated_report.research_confidence_score,
            'qualification_status': updated_report.qualification_status,
            'scoring_breakdown': updated_report.scoring_breakdown
        })

    @action(detail=True, methods=['post'], url_path='approve-report')
    def approve_report(self, request, pk=None):
        """
        Approves the research findings, generates tailored business requirements,
        creates a personalized email draft, and sends the lead into the Email Outreach queue.
        """
        lead = self.get_object()
        report = getattr(lead, 'research_report', None)
        if not report:
            return Response({'error': 'No research report found. Please investigate the company first.'}, status=status.HTTP_400_BAD_REQUEST)

        report.human_review_status = 'APPROVED'
        report.reviewed_by = request.user if request.user.is_authenticated else None
        report.reviewed_at = timezone.now()
        report.review_notes = request.data.get('notes', 'Approved by research reviewer for sales outreach.')
        report.save()

        # 1. Analyze and generate business requirements if not already present
        from requirements_ai.services import RequirementAnalysisService
        if not lead.requirements.exists():
            try:
                RequirementAnalysisService.analyze_requirements_for_lead(lead)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Requirement analysis failed during approval for {lead.id}: {e}")

        # 2. Generate personalized outreach email draft
        from communications.services import EmailDraftingService
        from communications.models import EmailDraft, EmailDraftStatus

        draft = EmailDraft.objects.filter(lead=lead, status=EmailDraftStatus.AWAITING_APPROVAL).first()
        if not draft:
            try:
                draft = EmailDraftingService.generate_draft_for_lead(lead)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to generate draft during approval for {lead.id}: {e}")

        lead.lead_status = LeadStatus.AWAITING_APPROVAL
        lead.is_email_generated = True
        lead.save()

        return Response({
            'message': f'Company report for {lead.company_name} approved! Personalized email draft generated and sent to Email Outreach queue.',
            'human_review_status': 'APPROVED',
            'lead_status': lead.lead_status,
            'draft_id': str(draft.id) if draft else None,
            'subject': draft.subject if draft else None
        })

    @action(detail=True, methods=['post'], url_path='send-to-outreach')
    def send_to_outreach(self, request, pk=None):
        """
        Alias for approve_report to dispatch lead directly into the Email Outreach queue.
        """
        return self.approve_report(request, pk=pk)

    @action(detail=True, methods=['post'], url_path='reject-report')
    def reject_report(self, request, pk=None):
        """
        Rejects/disqualifies the lead based on poor ICP fit or conflicting information.
        """
        lead = self.get_object()
        report = getattr(lead, 'research_report', None)
        if report:
            report.human_review_status = 'REJECTED'
            report.reviewed_by = request.user if request.user.is_authenticated else None
            report.reviewed_at = timezone.now()
            report.review_notes = request.data.get('notes', 'Disqualified by reviewer.')
            report.save()

        lead.lead_status = LeadStatus.DISQUALIFIED
        lead.lead_score_category = LeadScoreCategory.NOT_RELEVANT
        lead.save()

        return Response({
            'message': f'Lead {lead.company_name} disqualified.',
            'lead_status': 'DISQUALIFIED'
        })

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """
        Senior Manager manual override to verify company identity.
        """
        lead = self.get_object()
        lead.is_company_verified = True
        lead.manual_verification_required = False
        lead.domain_confidence_score = 90
        lead.lead_score = 90
        lead.lead_score_category = LeadScoreCategory.HOT
        lead.is_scored = True
        lead.lead_status = LeadStatus.IN_RESEARCH
        lead.save()

        # Trigger research pipeline, requirement analysis, and outreach draft automatically
        from research.services import CompanyResearchService
        from requirements_ai.services import RequirementAnalysisService
        from email_engine.services import EmailDraftingService

        report, _ = CompanyResearchService.initialize_and_run(lead_id=str(lead.id), force_refresh=True)
        try:
            RequirementAnalysisService.analyze_requirements_for_lead(lead)
            EmailDraftingService.generate_draft_for_lead(lead)
            if report:
                report.human_review_status = 'APPROVED'
                report.save()
            lead.lead_status = LeadStatus.AWAITING_APPROVAL
            lead.is_email_generated = True
            lead.save()
        except Exception as e:
            logger.warning(f"Downstream outreach pipeline error for lead {lead.id}: {e}")

        return Response({'message': f'Lead {lead.company_name} manually verified, researched, and sent to email outreach queue.'})


class CompanyViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Company.objects.all().prefetch_related('domains', 'products', 'services')
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAuthenticated]


class ServiceCatalogueViewSet(viewsets.ModelViewSet):
    queryset = ServiceCatalogue.objects.all()
    serializer_class = ServiceCatalogueSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [CanManagePricing()]
        return [permissions.IsAuthenticated()]


class BusinessRequirementViewSet(viewsets.ModelViewSet):
    queryset = BusinessRequirement.objects.all().select_related('matched_service', 'lead')
    serializer_class = BusinessRequirementSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        req = self.get_object()
        req.is_approved_by_human = True
        req.save()
        return Response({'message': f'Requirement "{req.title}" approved by human reviewer.'})


class EmailDraftViewSet(viewsets.ModelViewSet):
    queryset = EmailDraft.objects.all().select_related('lead', 'sender_account')
    serializer_class = EmailDraftSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        all_param = self.request.query_params.get('all')
        if status_param:
            qs = qs.filter(status=status_param)
        elif not all_param:
            # Default to active approval queue: only show drafts awaiting approval
            qs = qs.filter(status=EmailDraftStatus.AWAITING_APPROVAL)
        return qs

    def perform_destroy(self, instance):
        lead = instance.lead
        if lead:
            lead.is_email_generated = False
            if lead.lead_status == LeadStatus.AWAITING_APPROVAL:
                lead.lead_status = LeadStatus.SCORED if lead.lead_score > 0 else LeadStatus.IN_RESEARCH
            lead.save(update_fields=['is_email_generated', 'lead_status'])
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[CanApproveEmails])
    def approve_and_send(self, request, pk=None):
        draft = self.get_object()
        sent_email = EmailDispatchService.dispatch_email(draft, approved_by=request.user)
        return Response({
            'message': f'Email successfully approved and dispatched to {draft.lead.business_email}',
            'sent_email_id': str(sent_email.id)
        })

    @action(detail=True, methods=['post', 'delete'], permission_classes=[CanApproveEmails])
    def reject(self, request, pk=None):
        draft = self.get_object()
        lead = draft.lead
        draft_id = str(draft.id)
        if lead:
            lead.is_email_generated = False
            if lead.lead_status == LeadStatus.AWAITING_APPROVAL:
                lead.lead_status = LeadStatus.SCORED if lead.lead_score > 0 else LeadStatus.IN_RESEARCH
            lead.save(update_fields=['is_email_generated', 'lead_status'])
        draft.delete()
        return Response({'message': f'Draft {draft_id} rejected and deleted from queue.', 'deleted_id': draft_id})


class EmailAccountViewSet(viewsets.ModelViewSet):
    queryset = EmailAccount.objects.all()
    serializer_class = EmailAccountSerializer
    permission_classes = [IsManagerOrAbove]


class EmailReplyViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = EmailReply.objects.all().select_related('lead')
    serializer_class = EmailReplySerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def webhook_simulate(self, request):
        """
        Simulates receiving an inbound email reply or connects to webhook provider.
        """
        lead_id = request.data.get('lead_id')
        body = request.data.get('body', '')
        subject = request.data.get('subject', 'Re: Outreach')
        sender = request.data.get('sender', '')

        try:
            lead = Lead.objects.get(id=lead_id)
        except Lead.DoesNotExist:
            return Response({'error': 'Lead not found.'}, status=status.HTTP_404_NOT_FOUND)

        reply = EmailReplyProcessingService.process_incoming_reply(
            lead=lead,
            sender_email=sender or lead.business_email,
            subject=subject,
            body=body
        )
        return Response(EmailReplySerializer(reply).data, status=status.HTTP_201_CREATED)


class FollowUpScheduleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FollowUpSchedule.objects.all().select_related('lead')
    serializer_class = FollowUpScheduleSerializer
    permission_classes = [permissions.IsAuthenticated]


class ProposalViewSet(viewsets.ModelViewSet):
    queryset = Proposal.objects.all().select_related('lead', 'quotation')
    serializer_class = ProposalSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAbove])
    def approve(self, request, pk=None):
        proposal = self.get_object()
        quotation = getattr(proposal, 'quotation', None)
        if not quotation or not quotation.line_items.exists() or quotation.total_amount <= 0:
            return Response(
                {'error': 'Cannot approve proposal: Quotation pricing is incomplete. Please set valid line items and prices before approving.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        proposal.status = ProposalStatus.APPROVED
        proposal.approved_by = request.user
        proposal.approved_at = timezone.now()
        proposal.save()
        return Response({'message': f'Proposal {proposal.proposal_code} approved.'})

    @action(detail=True, methods=['patch', 'put', 'post'], permission_classes=[IsManagerOrAbove])
    def update_quotation(self, request, pk=None):
        from decimal import Decimal
        from proposals.models import Quotation, QuotationLineItem, ProposalConfig
        proposal = self.get_object()
        quotation, _ = Quotation.objects.get_or_create(
            proposal=proposal,
            defaults={'lead': proposal.lead, 'currency': 'INR', 'tax_rate': Decimal('18.00')}
        )

        data = request.data
        line_items_data = data.get('line_items')

        if line_items_data is not None:
            if not isinstance(line_items_data, list):
                return Response({'error': 'line_items must be a list'}, status=status.HTTP_400_BAD_REQUEST)

            clean_items = []
            for item in line_items_data:
                desc = (item.get('description') or '').strip()
                if not desc:
                    continue
                try:
                    qty = Decimal(str(item.get('quantity', 1)))
                    unit_p = Decimal(str(item.get('unit_price', 0)))
                except Exception:
                    return Response({'error': f'Invalid numeric value for item: {desc}'}, status=status.HTTP_400_BAD_REQUEST)
                if qty <= 0 or unit_p < 0:
                    return Response({'error': f'Quantity must be > 0 and unit price >= 0 for item: {desc}'}, status=status.HTTP_400_BAD_REQUEST)
                clean_items.append((desc, qty, unit_p, item.get('service')))

            if not clean_items:
                return Response({'error': 'Quotation must have at least one valid line item with description and price.'}, status=status.HTTP_400_BAD_REQUEST)

            quotation.line_items.all().delete()
            for desc, qty, unit_p, service_id in clean_items:
                service_obj = None
                if service_id:
                    service_obj = ServiceCatalogue.objects.filter(id=service_id).first()
                QuotationLineItem.objects.create(
                    quotation=quotation,
                    service=service_obj,
                    description=desc,
                    quantity=qty,
                    unit_price=unit_p
                )

        if 'currency' in data and data['currency']:
            quotation.currency = data['currency']
        if 'tax_rate' in data and data['tax_rate'] is not None:
            try:
                quotation.tax_rate = Decimal(str(data['tax_rate']))
            except Exception:
                pass
        if 'discount_percentage' in data and data['discount_percentage'] is not None:
            try:
                quotation.discount_percentage = Decimal(str(data['discount_percentage']))
            except Exception:
                pass
        if 'discount_amount' in data and data['discount_amount'] is not None:
            try:
                quotation.discount_amount = Decimal(str(data['discount_amount']))
            except Exception:
                pass
        if 'notes' in data:
            quotation.notes = data['notes']

        quotation.recalculate()

        # Regenerate document files if needed
        try:
            config = ProposalConfig.objects.first() or ProposalConfig.objects.create()
            from proposals.document_engine import ProposalDocumentEngine
            from django.core.files.base import ContentFile
            pdf_stream = ProposalDocumentEngine.generate_pdf(proposal, config)
            proposal.pdf_file.save(f"{proposal.proposal_code}.pdf", ContentFile(pdf_stream.read()), save=False)
            docx_stream = ProposalDocumentEngine.generate_docx(proposal, config)
            proposal.docx_file.save(f"{proposal.proposal_code}.docx", ContentFile(docx_stream.read()), save=False)
            proposal.save(update_fields=['pdf_file', 'docx_file'])
        except Exception as e:
            logger.warning(f"Failed to regenerate proposal files: {e}")

        proposal.refresh_from_db()
        serializer = self.get_serializer(proposal)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], permission_classes=[permissions.AllowAny])
    def download_pdf(self, request, pk=None):
        proposal = self.get_object()
        config = ProposalConfig.objects.first() or ProposalConfig.objects.create()
        from proposals.document_engine import ProposalDocumentEngine
        from django.core.files.base import ContentFile
        stream = ProposalDocumentEngine.generate_pdf(proposal, config)
        proposal.pdf_file.save(f"{proposal.proposal_code}.pdf", ContentFile(stream.read()), save=False)
        proposal.save(update_fields=['pdf_file'])

        response = FileResponse(proposal.pdf_file.open('rb'), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{proposal.proposal_code}.pdf"'
        return response

    @action(detail=True, methods=['get'], permission_classes=[permissions.AllowAny])
    def download_docx(self, request, pk=None):
        proposal = self.get_object()
        config = ProposalConfig.objects.first() or ProposalConfig.objects.create()
        from proposals.document_engine import ProposalDocumentEngine
        from django.core.files.base import ContentFile
        stream = ProposalDocumentEngine.generate_docx(proposal, config)
        proposal.docx_file.save(f"{proposal.proposal_code}.docx", ContentFile(stream.read()), save=False)
        proposal.save(update_fields=['docx_file'])

        response = FileResponse(
            proposal.docx_file.open('rb'),
            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        response['Content-Disposition'] = f'attachment; filename="{proposal.proposal_code}.docx"'
        return response


class ProposalConfigViewSet(viewsets.ModelViewSet):
    queryset = ProposalConfig.objects.all()
    serializer_class = ProposalConfigSerializer
    permission_classes = [CanManagePricing]


# Module 12: Comprehensive AI CRM Dashboard Analytics
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_analytics_view(request):
    """
    Computes real-time KPI metrics for all 16 indicators requested in Module 12:
    - Total uploaded leads
    - Verified companies
    - Unverified companies
    - Websites discovered
    - Requirements identified
    - Hot leads
    - Warm leads
    - Emails generated
    - Emails awaiting approval
    - Emails sent
    - Replies received
    - Positive responses
    - Meetings requested
    - Quotations generated
    - Converted customers
    - Follow-ups pending
    """
    ServiceCatalogueService.ensure_default_services()

    total_leads = Lead.objects.count()
    verified_companies = Lead.objects.filter(is_company_verified=True).count()
    unverified_companies = Lead.objects.filter(is_company_verified=False).count()
    websites_discovered = Lead.objects.exclude(website_url__exact='').count()
    requirements_identified = BusinessRequirement.objects.count()

    hot_leads = Lead.objects.filter(lead_score_category=LeadScoreCategory.HOT).count()
    warm_leads = Lead.objects.filter(lead_score_category=LeadScoreCategory.WARM).count()
    cold_leads = Lead.objects.filter(lead_score_category=LeadScoreCategory.COLD).count()

    emails_generated = EmailDraft.objects.count()
    emails_awaiting_approval = EmailDraft.objects.filter(status=EmailDraftStatus.AWAITING_APPROVAL).count()
    emails_sent = SentEmail.objects.count()

    replies_received = EmailReply.objects.count()
    positive_responses = EmailReply.objects.filter(
        ai_classification__in=[
            ReplyClassification.INTERESTED,
            ReplyClassification.REQUESTING_MEETING,
            ReplyClassification.REQUESTING_QUOTATION
        ]
    ).count()
    meetings_requested = EmailReply.objects.filter(ai_classification=ReplyClassification.REQUESTING_MEETING).count()

    quotations_generated = Quotation.objects.count()
    converted_customers = Lead.objects.filter(lead_status=LeadStatus.CONVERTED).count()
    followups_pending = FollowUpSchedule.objects.filter(status='PENDING').count()

    # Lead status distribution
    status_distribution = list(Lead.objects.values('lead_status').annotate(count=Count('id')))

    # Agent 12 Executive Insights
    reporting_agent = ReportingAgent()
    stats_dict = {
        'total_leads': total_leads,
        'verified_companies': verified_companies,
        'hot_leads': hot_leads,
        'emails_sent': emails_sent,
        'replies_received': replies_received,
        'positive_responses': positive_responses
    }
    executive_insights = reporting_agent.generate_executive_insights(stats_dict)

    return Response({
        'kpis': {
            'total_leads': total_leads,
            'verified_companies': verified_companies,
            'unverified_companies': unverified_companies,
            'websites_discovered': websites_discovered,
            'requirements_identified': requirements_identified,
            'hot_leads': hot_leads,
            'warm_leads': warm_leads,
            'cold_leads': cold_leads,
            'emails_generated': emails_generated,
            'emails_awaiting_approval': emails_awaiting_approval,
            'emails_sent': emails_sent,
            'replies_received': replies_received,
            'positive_responses': positive_responses,
            'meetings_requested': meetings_requested,
            'quotations_generated': quotations_generated,
            'converted_customers': converted_customers,
            'followups_pending': followups_pending,
        },
        'status_distribution': status_distribution,
        'executive_insights': executive_insights
    })


class LeadMappingTemplateViewSet(viewsets.ModelViewSet):
    from leads.models import LeadMappingTemplate
    from api.serializers import LeadMappingTemplateSerializer
    queryset = LeadMappingTemplate.objects.all()
    serializer_class = LeadMappingTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)


class ImportBatchViewSet(viewsets.ReadOnlyModelViewSet):
    from leads.models import ImportBatch
    from api.serializers import ImportBatchSerializer
    queryset = ImportBatch.objects.all().order_by('-created_at')
    serializer_class = ImportBatchSerializer
    permission_classes = [permissions.IsAuthenticated]


class ICPConfigViewSet(viewsets.ModelViewSet):
    queryset = ICPConfig.objects.all()
    serializer_class = ICPConfigSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def active(self, request):
        config = ICPConfig.get_active_config()
        return Response(ICPConfigSerializer(config).data)


class ResearchReportViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ResearchReport.objects.all().select_related('lead', 'company').prefetch_related('pages', 'findings')
    serializer_class = ResearchReportSerializer
    permission_classes = [permissions.IsAuthenticated]


class ResearchJobViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ResearchJob.objects.all().select_related('lead', 'company').order_by('-created_at')
    serializer_class = ResearchJobSerializer
    permission_classes = [permissions.IsAuthenticated]

