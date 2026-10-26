"""
FastAPI route dependencies for authentication and authorization.
"""
from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

from app.core.security import decode_access_token
from app.repositories.user_repo import get_user_by_id, get_user_approval_groups
from app.models.auth import UserProfile, ApprovalGroupBrief

security_scheme = HTTPBearer(auto_error=False)

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)) -> UserProfile:
    """
    Dependency that decodes the Bearer JWT token and returns the authenticated user profile.
    Raises 401 Unauthorized if the token is missing, expired, or invalid.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token payload is invalid.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id = int(sub)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive.",
        )

    # Fetch assigned approval groups
    groups_data = get_user_approval_groups(user_id)
    groups = [
        ApprovalGroupBrief(
            access_id=g["access_id"],
            group_name=g["group_name"],
            member_role=g["member_role"],
            can_approve=g["can_approve"]
        ) for g in groups_data
    ]

    return UserProfile(
        user_id=user["user_id"],
        full_name=user["full_name"],
        email=user["email"],
        user_type=user["user_type"],
        home_unit_id=user["home_unit_id"],
        unit_name=user.get("unit_name"),
        is_active=user["is_active"],
        approval_groups=groups
    )

def require_role(allowed_roles: List[str]):
    """Role-based authorization guard factory."""
    def role_checker(current_user: UserProfile = Depends(get_current_user)) -> UserProfile:
        if current_user.user_type not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {', '.join(allowed_roles)}.",
            )
        return current_user
    return role_checker

def require_approver(current_user: UserProfile = Depends(get_current_user)) -> UserProfile:
    """Ensures the authenticated user has approver privileges or group membership."""
    has_approval_rights = any(g.can_approve for g in current_user.approval_groups)
    if not has_approval_rights:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to authorized venue approvers.",
        )
    return current_user
