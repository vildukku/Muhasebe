"""
Authentication, Authorization (RBAC), and Session Management.
"""

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from app.db import execute_write, query_one


def generate_salt() -> str:
    """Generates a secure random salt in hex format."""
    return secrets.token_hex(16)


def hash_password(password: str, salt: str) -> str:
    """Hashes a password using PBKDF2-HMAC-SHA256 with 100,000 iterations."""
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return key.hex()


def verify_password(password: str, salt: str, password_hash: str) -> bool:
    """Constant-time verification of password hash."""
    expected_hash = hash_password(password, salt)
    return hmac.compare_digest(expected_hash, password_hash)


def create_session(user_id: int, duration_days: int = 7) -> str:
    """Creates a new session token for the user."""
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.utcnow() + timedelta(days=duration_days)).strftime("%Y-%m-%d %H:%M:%S")
    execute_write(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
        (token, user_id, expires_at)
    )
    return token


def validate_session(token: str) -> Optional[Dict[str, Any]]:
    """Validates session token and returns the user record if valid and active."""
    if not token:
        return None

    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    query = """
    SELECT u.id, u.username, u.email, u.full_name, u.role, u.is_active, s.expires_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ? AND u.is_active = 1
    """
    user = query_one(query, (token, now_str))
    return user


def delete_session(token: str):
    """Logs out by deleting the session token."""
    execute_write("DELETE FROM sessions WHERE token = ?", (token,))


# RBAC Role hierarchy & permission checks
ROLE_PERMISSIONS = {
    "admin": {
        "can_view_dashboard": True,
        "can_view_accounts": True,
        "can_manage_accounts": True,
        "can_view_transactions": True,
        "can_create_transactions": True,
        "can_edit_transactions": True,
        "can_delete_transactions": True,
        "can_transfer": True,
        "can_view_reports": True,
        "can_manage_z_reports": True,
        "can_manage_subscriptions": True,
        "can_manage_users": True,
        "can_view_audit_logs": True,
        "can_manage_settings": True,
    },
    "manager": {
        "can_view_dashboard": True,
        "can_view_accounts": True,
        "can_manage_accounts": True,
        "can_view_transactions": True,
        "can_create_transactions": True,
        "can_edit_transactions": True,
        "can_delete_transactions": True,
        "can_transfer": True,
        "can_view_reports": True,
        "can_manage_z_reports": True,
        "can_manage_subscriptions": True,
        "can_manage_users": False,
        "can_view_audit_logs": True,
        "can_manage_settings": False,
    },
    "operator": {
        "can_view_dashboard": True,
        "can_view_accounts": True,
        "can_manage_accounts": False,
        "can_view_transactions": True,
        "can_create_transactions": True,
        "can_edit_transactions": False,
        "can_delete_transactions": False,
        "can_transfer": True,
        "can_view_reports": False,
        "can_manage_z_reports": False,
        "can_manage_subscriptions": False,
        "can_manage_users": False,
        "can_view_audit_logs": False,
        "can_manage_settings": False,
    },
    "viewer": {
        "can_view_dashboard": True,
        "can_view_accounts": True,
        "can_manage_accounts": False,
        "can_view_transactions": True,
        "can_create_transactions": False,
        "can_edit_transactions": False,
        "can_delete_transactions": False,
        "can_transfer": False,
        "can_view_reports": True,
        "can_manage_z_reports": False,
        "can_manage_subscriptions": False,
        "can_manage_users": False,
        "can_view_audit_logs": True,
        "can_manage_settings": False,
    }
}


def has_permission(user_role: str, permission_name: str) -> bool:
    """Checks if the given role has the specific permission."""
    perms = ROLE_PERMISSIONS.get(user_role, {})
    return perms.get(permission_name, False)
