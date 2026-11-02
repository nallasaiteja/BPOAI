import json
from .models import AuditLog

class AuditLoggingMiddleware:
    """
    Middleware that records mutating requests (POST, PUT, PATCH, DELETE) to the AuditLog.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Only log mutating actions for authenticated users or API actions
        if request.method in ['POST', 'PUT', 'PATCH', 'DELETE'] and not request.path.startswith('/admin/'):
            user = request.user if hasattr(request, 'user') and request.user.is_authenticated else None
            ip = self._get_client_ip(request)
            
            # Keep log safe, don't log passwords or sensitive tokens
            body_summary = {}
            if request.content_type == 'application/json':
                try:
                    payload = json.loads(request.body.decode('utf-8'))
                    if isinstance(payload, dict):
                        body_summary = {k: ('***' if 'password' in k.lower() or 'secret' in k.lower() else v) for k, v in payload.items()}
                except Exception:
                    pass

            try:
                AuditLog.objects.create(
                    user=user,
                    action=f"{request.method} {request.path}",
                    model_name=request.path.split('/')[3] if len(request.path.split('/')) > 3 else 'general',
                    ip_address=ip,
                    details={
                        'status_code': response.status_code,
                        'query_params': dict(request.GET),
                        'payload_summary': body_summary
                    }
                )
            except Exception:
                pass

        return response

    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
