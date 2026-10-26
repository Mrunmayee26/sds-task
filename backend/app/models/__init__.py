"""
Models package for Pydantic schemas.
"""
from .auth import (
    UserRegisterRequest,
    UserLoginRequest,
    UserProfile,
    TokenResponse,
    ApprovalGroupBrief,
    RegisterInitResponse,
    VerifyOtpRequest,
    ResendOtpRequest,
    UserDepartmentBrief,
)

__all__ = [
    "UserRegisterRequest",
    "UserLoginRequest",
    "UserProfile",
    "TokenResponse",
    "ApprovalGroupBrief",
    "RegisterInitResponse",
    "VerifyOtpRequest",
    "ResendOtpRequest",
]
