"""
Repositories package for direct database access.
"""
from .user_repo import (
    get_user_by_email,
    get_user_by_id,
    get_user_approval_groups,
    create_user,
    assign_user_to_group,
    ensure_default_accounts,
)
from .otp_repo import (
    save_otp,
    verify_and_consume_otp,
    get_latest_pending_payload,
)

__all__ = [
    "get_user_by_email",
    "get_user_by_id",
    "get_user_approval_groups",
    "create_user",
    "assign_user_to_group",
    "ensure_default_accounts",
    "save_otp",
    "verify_and_consume_otp",
    "get_latest_pending_payload",
]
