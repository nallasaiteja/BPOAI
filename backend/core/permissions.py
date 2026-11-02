from rest_framework import permissions
from .models import UserRole

class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.role == UserRole.SUPER_ADMIN or request.user.is_superuser))

class IsManagerOrAbove(permissions.BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.user.role in [
            UserRole.SUPER_ADMIN,
            UserRole.ADMINISTRATOR,
            UserRole.SENIOR_MANAGER
        ] or request.user.is_superuser

class CanApproveEmails(permissions.BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.user.can_approve_communications() or request.user.is_superuser

class CanManagePricing(permissions.BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.user.can_manage_pricing() or request.user.is_superuser

class IsAuthenticatedAndApproved(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_approved)
