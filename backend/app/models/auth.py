"""
Pydantic models for authentication, registration, and user profiles.
"""
from typing import List, Optional
from pydantic import BaseModel, Field

EMAIL_PATTERN = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"

class UserRegisterRequest(BaseModel):
    firstName: Optional[str] = Field(default=None, max_length=74)
    lastName: Optional[str] = Field(default=None, max_length=75)
    full_name: Optional[str] = Field(default=None, max_length=150)
    email: str = Field(pattern=EMAIL_PATTERN, description="Valid email address")
    password: str = Field(min_length=6, max_length=72, description="Password, maximum 72 UTF-8 bytes")
    role: str = Field(default="applicant", description="Role: 'applicant' or 'approver'")
    identifier: Optional[str] = None
    home_unit_id: Optional[int] = None
    designation: Optional[str] = Field(default=None, max_length=100, description="Approver designation or title")

    def get_full_name(self) -> str:
        if self.full_name and self.full_name.strip():
            return self.full_name.strip()
        parts = [p.strip() for p in (self.firstName, self.lastName) if p and p.strip()]
        return " ".join(parts) if parts else self.email.split("@")[0]

class UserDepartmentBrief(BaseModel):
    unit_id: int
    unit_name: str
    unit_code: Optional[str] = None
    unit_type: Optional[str] = None

class UserLoginRequest(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN)
    password: str
    role: Optional[str] = None

class ApprovalGroupBrief(BaseModel):
    access_id: int
    group_name: str
    member_role: str
    can_approve: bool

class UserProfile(BaseModel):
    user_id: int
    full_name: str
    email: str
    user_type: str
    home_unit_id: Optional[int] = None
    unit_name: Optional[str] = None
    is_active: bool
    approval_groups: List[ApprovalGroupBrief] = []

class TokenResponse(BaseModel):
    access_token: Optional[str] = ""
    token_type: str = "bearer"
    user: Optional[UserProfile] = None
    status: str = "verified"
    message: Optional[str] = None

class RegisterInitResponse(BaseModel):
    status: str = "otp_sent"
    message: str
    email: str

class VerifyOtpRequest(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN)
    otp: str = Field(min_length=6, max_length=6, description="6-digit verification code")

class ResendOtpRequest(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN)
