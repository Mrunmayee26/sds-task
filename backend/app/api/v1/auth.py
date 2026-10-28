"""
Authentication endpoints for registration, OTP email verification, login, and user profile.
"""
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from starlette.concurrency import run_in_threadpool
from app.config import settings
from typing import List
from app.models.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserProfile,
    UserProfileUpdate,
    ApprovalGroupBrief,
    RegisterInitResponse,
    VerifyOtpRequest,
    ResendOtpRequest,
    UserDepartmentBrief,
)
from app.repositories.user_repo import (
    get_user_by_email,
    get_user_by_id,
    get_user_approval_groups,
    create_user,
    assign_user_to_group,
    get_all_organizational_units,
    get_approval_group_for_unit,
    update_user_profile,
    get_all_faculty_advisors,
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

@router.get("/departments", response_model=List[UserDepartmentBrief])
def list_departments():
    """Retrieve campus departments and academic units for approver registration."""
    units = get_all_organizational_units()
    return [UserDepartmentBrief(**u) for u in units]

@router.get("/faculty-advisors")
def list_faculty_advisors():
    """Retrieve list of active Faculty Advisors for multi-level approval selection."""
    return get_all_faculty_advisors()

@router.post("/register", response_model=RegisterInitResponse, status_code=status.HTTP_200_OK)
async def register_user(payload: UserRegisterRequest):
    """
    Initiates account registration by generating a 6-digit OTP and dispatching an email verification.
    The user record is formally created in the database only after OTP confirmation.
    """
    normalized_email = payload.email.strip().lower()
    user_type = payload.role.strip().lower() if payload.role else "applicant"
    if user_type not in ("applicant", "approver"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be either 'applicant' or 'approver'."
        )

    if not settings.SMTP_ENABLED:
        raise HTTPException(503, "Email verification is not configured. Contact the campus administrator to create an account.")
    
    # Check if user already exists
    existing = await run_in_threadpool(get_user_by_email, normalized_email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    # Hash password and prepare staged payload
    hashed_pwd = await run_in_threadpool(hash_password, payload.password)
    full_name = payload.get_full_name()

    staged_payload = {
        "full_name": full_name,
        "email": normalized_email,
        "password_hash": hashed_pwd,
        "user_type": user_type,
        "home_unit_id": payload.home_unit_id,
        "identifier": payload.identifier,
        "designation": payload.designation,
    }

    # Generate 6-digit OTP and save in staging table
    otp_code = generate_otp()
    await run_in_threadpool(save_otp, normalized_email, otp_code, staged_payload, expires_in_minutes=10)

    if not await send_otp_email(normalized_email, otp_code, full_name):
        raise HTTPException(503, "Verification email could not be delivered. Please try again later.")

    return RegisterInitResponse(
        status="otp_sent",
        message=f"A 6-digit verification code has been sent to {normalized_email}.",
        email=normalized_email,
    )

@router.post("/verify-otp", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def verify_registration_otp(payload: VerifyOtpRequest):
    """
    Verifies the 6-digit OTP.
    For applicants: creates active user record in Supabase and issues a JWT token.
    For approvers: creates user record with is_active=False pending admin verification.
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

    user_type = staged_data.get("user_type", "applicant")
    is_approver = user_type == "approver"
    # Approver accounts MUST be approved by an administrator before activation
    is_active = not is_approver

    # Permanently insert user into Supabase users table
    created = create_user(
        full_name=staged_data["full_name"],
        email=normalized_email,
        password_hash=staged_data["password_hash"],
        user_type=user_type,
        home_unit_id=staged_data.get("home_unit_id"),
        is_active=is_active,
    )

    user_id = created["user_id"]

    # If approver, map to their department's approval group
    if is_approver:
        unit_id = staged_data.get("home_unit_id")
        access_id = get_approval_group_for_unit(unit_id) if unit_id else None
        if not access_id:
            access_id = 1  # Default fallback to Registrar Office

        assign_user_to_group(
            user_id=user_id,
            access_id=access_id,
            member_role=staged_data.get("designation") or "Department Approver",
            can_approve=True
        )

        return TokenResponse(
            access_token="",
            token_type="bearer",
            user=None,
            status="pending_admin_approval",
            message="Your email has been verified! Your approver account has been submitted for administrator verification. You will be able to log in once approved by the campus administration."
        )

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

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=profile,
        status="verified",
        message="Account verified and created successfully."
    )

@router.post("/resend-otp", response_model=RegisterInitResponse)
async def resend_otp(payload: ResendOtpRequest):
    """
    Resends a fresh 6-digit OTP for a pending registration.
    """
    normalized_email = payload.email.strip().lower()
    if not settings.SMTP_ENABLED:
        raise HTTPException(503, "Email verification is not configured. Contact the campus administrator.")
    pending = await run_in_threadpool(get_latest_pending_payload, normalized_email)

    if not pending:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending registration found for this email. Please register again.",
        )

    new_otp = generate_otp()
    await run_in_threadpool(save_otp, normalized_email, new_otp, pending, expires_in_minutes=10)

    user_name = pending.get("full_name", "")
    if not await send_otp_email(normalized_email, new_otp, user_name):
        raise HTTPException(503, "Verification email could not be delivered. Please try again later.")

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
        if (user.get("user_type") or "").lower() == "approver":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your approver account is pending administrator verification. Please wait for an administrator to approve your account before signing in.",
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact the administrator.",
        )

    # Role validation if specified by login UI
    requested_role = (payload.role or "").strip().lower()
    groups_data = get_user_approval_groups(user["user_id"])
    has_approval_rights = any(g["can_approve"] for g in groups_data)

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

@router.put("/profile", response_model=UserProfile)
def update_profile(
    payload: UserProfileUpdate,
    current_user: UserProfile = Depends(get_current_user)
):
    """
    Updates the display name and home department of the currently logged-in user.
    """
    updated = update_user_profile(
        user_id=current_user.user_id,
        full_name=payload.full_name,
        home_unit_id=payload.home_unit_id,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found or update failed.",
        )

    fresh_user = get_user_by_id(current_user.user_id)
    if not fresh_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile could not be reloaded.",
        )

    groups_data = get_user_approval_groups(current_user.user_id)
    groups = [
        ApprovalGroupBrief(
            access_id=g["access_id"],
            group_name=g["group_name"],
            member_role=g["member_role"],
            can_approve=g["can_approve"]
        ) for g in groups_data
    ]

    return UserProfile(
        user_id=fresh_user["user_id"],
        full_name=fresh_user["full_name"],
        email=fresh_user["email"],
        user_type=fresh_user["user_type"],
        home_unit_id=fresh_user["home_unit_id"],
        unit_name=fresh_user.get("unit_name"),
        is_active=fresh_user["is_active"],
        approval_groups=groups,
    )

