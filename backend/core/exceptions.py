from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        response.data = {
            'success': False,
            'status_code': response.status_code,
            'errors': response.data,
            'message': 'Request processing failed due to validation or permission error.'
        }
    else:
        logger.error(f"Unhandled Exception: {exc}", exc_info=True)
        response = Response(
            {
                'success': False,
                'status_code': status.HTTP_500_INTERNAL_SERVER_ERROR,
                'message': 'An internal server error occurred. Please contact the administrator.',
                'detail': str(exc)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return response
