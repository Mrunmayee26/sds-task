"""
Authentication endpoints for registration, OTP email verification, login, and user profile.
"""
import secrets
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from app.config import settings
from app.models.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserProfile,
    ApprovalGroupBrief,
    RegisterInitResponse,
    VerifyOtpRequest,
    ResendOtpRequest,
)
from app.repositories.user_repo import (
    get_user_by_email,
    get_user_approval_groups,
    create_user,
    assign_user_to_group,
)
from app.repositories.otp_repo import (
    save_otp,
    verify_and_consume_otp,
    get_latest_pending_payload,
)
from app.core.security import hash_password, verify_password, create_access_token
from app.core.email import send_otp_email
from app.core.dependencies import get_current_user

router = APIRouter()

def generate_otp() -> str:
    """Generate a secure 6-digit numeric OTP."""
    return f"{secrets.randbelow(900000) + 100000:06d}"

@router.post("/register", response_model=RegisterInitResponse, status_code=status.HTTP_200_OK)
def register_user(payload: UserRegisterRequest, background_tasks: BackgroundTasks):
    """
    Initiates account registration by generating a 6-digit OTP and dispatching an email verification.
    The user record is formally created in the database only after OTP confirmation.
    """
    normalized_email = payload.email.strip().lower()
    
    # Check if user already exists
    existing = get_user_by_email(normalized_email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    # Hash password and prepare staged payload
    hashed_pwd = hash_password(payload.password)
    full_name = payload.get_full_name()
    user_type = payload.role.strip().lower() if payload.role else "applicant"

    staged_payload = {
        "full_name": full_name,
        "email": normalized_email,
        "password_hash": hashed_pwd,
        "user_type": user_type,
        "home_unit_id": payload.home_unit_id,
        "identifier": payload.identifier,
    }

    # Generate 6-digit OTP and save in staging table
    otp_code = generate_otp()
    save_otp(normalized_email, otp_code, staged_payload, expires_in_minutes=10)

    # Dispatch email asynchronously in background
    background_tasks.add_task(send_otp_email, normalized_email, otp_code, full_name)

    return RegisterInitResponse(
        status="otp_sent",
        message=f"A 6-digit verification code has been sent to {normalized_email}.",
        email=normalized_email,
    )

@router.post("/verify-otp", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def verify_registration_otp(payload: VerifyOtpRequest):
    """
    Verifies the 6-digit OTP. On success, creates the permanent user record in Supabase and issues a JWT token.
    """
    normalized_email = payload.email.strip().lower()
    staged_data = verify_and_consume_otp(normalized_email, payload.otp.strip())

    if not staged_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code. Please check your code or request a new one.",
        )

    # Prevent race condition if user was registered in between
    existing = get_user_by_email(normalized_email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This account has already been registered and verified.",
        )

    # Permanently insert user into Supabase users table
    created = create_user(
        full_name=staged_data["full_name"],
        email=normalized_email,
        password_hash=staged_data["password_hash"],
        user_type=staged_data.get("user_type", "applicant"),
        home_unit_id=staged_data.get("home_unit_id"),
    )

    user_id = created["user_id"]
    user_type = created["user_type"]

    # If approver, assign to default academic review group
    if user_type == "approver":
        assign_user_to_group(user_id, access_id=1, member_role="Approver", can_approve=True)

    groups_data = get_user_approval_groups(user_id)
    groups = [
        ApprovalGroupBrief(
            access_id=g["access_id"],
            group_name=g["group_name"],
            member_role=g["member_role"],
            can_approve=g["can_approve"]
        ) for g in groups_data
    ]

    profile = UserProfile(
        user_id=user_id,
        full_name=created["full_name"],
        email=created["email"],
        user_type=created["user_type"],
        home_unit_id=created["home_unit_id"],
        unit_name=None,
        is_active=created["is_active"],
        approval_groups=groups,
    )

    token = create_access_token(
        subject=user_id,
        claims={"email": normalized_email, "role": user_type}
    )

    return TokenResponse(access_token=token, token_type="bearer", user=profile)

@router.post("/resend-otp", response_model=RegisterInitResponse)
def resend_otp(payload: ResendOtpRequest, background_tasks: BackgroundTasks):
    """
    Resends a fresh 6-digit OTP for a pending registration.
    """
    normalized_email = payload.email.strip().lower()
    pending = get_latest_pending_payload(normalized_email)

    if not pending:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending registration found for this email. Please register again.",
        )

    new_otp = generate_otp()
    save_otp(normalized_email, new_otp, pending, expires_in_minutes=10)

    user_name = pending.get("full_name", "")
    background_tasks.add_task(send_otp_email, normalized_email, new_otp, user_name)

    return RegisterInitResponse(
        status="otp_sent",
        message=f"A fresh verification code has been sent to {normalized_email}.",
        email=normalized_email,
    )

@router.post("/login", response_model=TokenResponse)
def login_user(payload: UserLoginRequest):
    """
    Validates user credentials against database hash and returns signed JWT token.
    """
    normalized_email = payload.email.strip().lower()
    user = get_user_by_email(normalized_email)
    
    if not user or not user.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Verify password with bcrypt
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact the administrator.",
        )

    # Role validation if specified by login UI
    requested_role = (payload.role or "").strip().lower()
    groups_data = get_user_approval_groups(user["user_id"])
    has_approval_rights = user["user_type"] == "approver" or any(g["can_approve"] for g in groups_data)

    if requested_role == "approver" and not has_approval_rights:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account does not have approver privileges.",
        )

    groups = [
        ApprovalGroupBrief(
            access_id=g["access_id"],
            group_name=g["group_name"],
            member_role=g["member_role"],
            can_approve=g["can_approve"]
        ) for g in groups_data
    ]

    profile = UserProfile(
        user_id=user["user_id"],
        full_name=user["full_name"],
        email=user["email"],
        user_type=user["user_type"],
        home_unit_id=user["home_unit_id"],
        unit_name=user.get("unit_name"),
        is_active=user["is_active"],
        approval_groups=groups,
    )

    token = create_access_token(
        subject=user["user_id"],
        claims={"email": user["email"], "role": user["user_type"]}
    )

    return TokenResponse(access_token=token, token_type="bearer", user=profile)

@router.get("/me", response_model=UserProfile)
def get_my_profile(current_user: UserProfile = Depends(get_current_user)):
    """
    Retrieves the currently authenticated user's profile and active approval groups.
    """
    return current_user
