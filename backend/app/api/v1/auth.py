"""
Authentication endpoints for registration, OTP email verification, login, and user profile.
"""

import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from starlette.concurrency import run_in_threadpool
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
    UserProfileUpdate,
    UserDepartmentBrief,
)
from app.repositories.user_repo import (
    get_user_by_email,
    get_user_approval_groups,
    create_user,
    get_user_by_id,
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
from app.core.cache import limit_attempts
from app.db.session import get_db_cursor

router = APIRouter()


def generate_otp() -> str:
    """Generate a secure 6-digit numeric OTP."""
    return f"{secrets.randbelow(900000) + 100000:06d}"


@router.post(
    "/register", response_model=RegisterInitResponse, status_code=status.HTTP_200_OK
)
async def register_user(payload: UserRegisterRequest):
    """
    Initiates account registration by generating a 6-digit OTP and dispatching an email verification.
    The user record is formally created in the database only after OTP confirmation.
    """
    normalized_email = payload.email.strip().lower()
    limit_attempts("register", normalized_email, 5, 3600)
    domain = normalized_email.rsplit("@", 1)[-1]
    allowed_domains = {
        value.strip().lower()
        for value in settings.ALLOWED_EMAIL_DOMAINS.split(",")
        if value.strip()
    }
    if allowed_domains and domain not in allowed_domains:
        raise HTTPException(422, "Use an approved college email address.")
    requested_role = payload.role.strip().lower()
    if requested_role not in ("applicant", "approver"):
        raise HTTPException(403, "Public signup cannot create administrator accounts.")
    access_id = None
    if requested_role == "approver":
        if not payload.home_unit_id:
            raise HTTPException(403, "Select a department to request reviewer access.")
        access_id = await run_in_threadpool(
            get_approval_group_for_unit, payload.home_unit_id
        )
        if not access_id:
            raise HTTPException(
                422,
                "No active review group is assigned to this department. Contact the administrator.",
            )
    if not settings.SMTP_ENABLED:
        raise HTTPException(
            503,
            "Email verification is not configured. Contact the campus administrator to create an account.",
        )

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
    user_type = payload.role.strip().lower() if payload.role else "applicant"

    staged_payload = {
        "full_name": full_name,
        "email": normalized_email,
        "password_hash": hashed_pwd,
        "user_type": user_type,
        "home_unit_id": payload.home_unit_id,
        "identifier": payload.identifier,
        "requested_access_id": access_id,
        "designation": payload.designation,
    }

    # Generate 6-digit OTP and save in staging table
    otp_code = generate_otp()
    await run_in_threadpool(
        save_otp, normalized_email, otp_code, staged_payload, expires_in_minutes=10
    )

    if not await send_otp_email(normalized_email, otp_code, full_name):
        raise HTTPException(
            503, "Verification email could not be delivered. Please try again later."
        )

    return RegisterInitResponse(
        status="otp_sent",
        message=f"A 6-digit verification code has been sent to {normalized_email}.",
        email=normalized_email,
    )


@router.post(
    "/verify-otp", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
def verify_registration_otp(payload: VerifyOtpRequest):
    """
    Verifies the 6-digit OTP. On success, creates the permanent user record in Supabase and issues a JWT token.
    """
    normalized_email = payload.email.strip().lower()
    limit_attempts("otp", normalized_email, 5, 600)
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
        user_type="applicant",
        home_unit_id=staged_data.get("home_unit_id"),
    )

    user_id = created["user_id"]
    user_type = created["user_type"]
    if staged_data.get("user_type") == "approver":
        from app.repositories.admin_repo import request_approver

        request_approver(
            user_id,
            staged_data["requested_access_id"],
            f"Verified reviewer registration: {staged_data.get('designation') or 'Department reviewer'}",
        )
        return TokenResponse(
            status="pending_admin_approval",
            message="Email verified. Your reviewer access request is waiting for administrator approval.",
        )

    groups_data = get_user_approval_groups(user_id)
    groups = [
        ApprovalGroupBrief(
            access_id=g["access_id"],
            group_name=g["group_name"],
            member_role=g["member_role"],
            can_approve=g["can_approve"],
        )
        for g in groups_data
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
        subject=user_id, claims={"email": normalized_email, "role": user_type}
    )

    return TokenResponse(access_token=token, token_type="bearer", user=profile)


@router.post("/resend-otp", response_model=RegisterInitResponse)
async def resend_otp(payload: ResendOtpRequest):
    """
    Resends a fresh 6-digit OTP for a pending registration.
    """
    normalized_email = payload.email.strip().lower()
    limit_attempts("resend", normalized_email, 1, 60)
    if not settings.SMTP_ENABLED:
        raise HTTPException(
            503,
            "Email verification is not configured. Contact the campus administrator.",
        )
    pending = await run_in_threadpool(get_latest_pending_payload, normalized_email)

    if not pending:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending registration found for this email. Please register again.",
        )

    new_otp = generate_otp()
    await run_in_threadpool(
        save_otp, normalized_email, new_otp, pending, expires_in_minutes=10
    )

    user_name = pending.get("full_name", "")
    if not await send_otp_email(normalized_email, new_otp, user_name):
        raise HTTPException(
            503, "Verification email could not be delivered. Please try again later."
        )

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
    limit_attempts("login", normalized_email, 10, 900)
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
    if requested_role == "admin" and user["user_type"] != "admin":
        raise HTTPException(403, "Administrator access required.")
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
            can_approve=g["can_approve"],
        )
        for g in groups_data
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
        claims={
            "email": user["email"],
            "role": user["user_type"],
            "session_version": user["session_version"],
        },
    )

    return TokenResponse(access_token=token, token_type="bearer", user=profile)


@router.get("/me", response_model=UserProfile)
def get_my_profile(current_user: UserProfile = Depends(get_current_user)):
    """
    Retrieves the currently authenticated user's profile and active approval groups.
    """
    return current_user


@router.get("/departments", response_model=list[UserDepartmentBrief])
def departments():
    return get_all_organizational_units()


@router.get("/faculty-advisors")
def faculty_advisors(user=Depends(get_current_user)):
    return get_all_faculty_advisors()


@router.put("/profile", response_model=UserProfile)
def profile(payload: UserProfileUpdate, user=Depends(get_current_user)):
    if payload.home_unit_id is not None:
        with get_db_cursor(commit=False) as cur:
            cur.execute(
                "SELECT 1 FROM organizational_units WHERE unit_id=%s",
                (payload.home_unit_id,),
            )
            if not cur.fetchone():
                raise HTTPException(422, "Department not found")
    update_user_profile(user.user_id, payload.full_name, payload.home_unit_id)
    fresh = get_user_by_id(user.user_id)
    return UserProfile(
        **{**fresh, "approval_groups": get_user_approval_groups(user.user_id)}
    )
