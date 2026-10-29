import hashlib
import secrets
import hmac
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit, urlunsplit, urlencode
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from app.config import settings
from app.db.session import get_db_cursor
from app.core.cache import limit_attempts
from app.core.security import hash_password
from app.core.email import send_message

router = APIRouter()


class Forgot(BaseModel):
    email: EmailStr


class Reset(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=6, max_length=72)


class VerifyRecoveryOtp(Forgot):
    otp: str = Field(pattern=r"^\d{6}$")


def recovery_otp_hash(email, code):
    return hmac.new(
        settings.JWT_SECRET_KEY.encode(),
        f"password-recovery:{email}:{code}".encode(),
        hashlib.sha256,
    ).hexdigest()


@router.post("/request-password-otp")
async def request_password_otp(data: Forgot):
    email = str(data.email).lower()
    limit_attempts("password-reset", email, 3, 3600)
    if not settings.SMTP_ENABLED:
        raise HTTPException(503, "Password recovery email is not configured.")
    code = f"{secrets.randbelow(1000000):06d}"
    digest = recovery_otp_hash(email, code)
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT user_id FROM users WHERE lower(email)=%s AND is_active FOR UPDATE",
            (email,),
        )
        user = cur.fetchone()
        if user:
            cur.execute(
                "UPDATE password_resets SET used_at=NOW() WHERE user_id=%s AND used_at IS NULL",
                (user["user_id"],),
            )
            cur.execute(
                """INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES(%s,%s,%s)
                ON CONFLICT(token_hash) DO UPDATE SET used_at=NULL,expires_at=EXCLUDED.expires_at""",
                (
                    user["user_id"],
                    digest,
                    datetime.now(timezone.utc) + timedelta(minutes=10),
                ),
            )
    if user:
        delivered = await send_message(
            email,
            "Your VenueFlow password recovery code",
            f"Your password recovery code is: {code}\nEnter this code in VenueFlow to verify your email and choose a new password. It expires in 10 minutes. Do not share it.",
        )
        if not delivered:
            with get_db_cursor() as cur:
                cur.execute(
                    "DELETE FROM password_resets WHERE token_hash=%s", (digest,)
                )
            raise HTTPException(
                503,
                "Recovery email could not be delivered. Please try again later or contact the administrator.",
            )
    return {
        "message": "If an active account exists, a six-digit code has been sent. Check your inbox and spam folder."
    }


@router.post("/verify-password-otp")
def verify_password_otp(data: VerifyRecoveryOtp):
    email = str(data.email).lower()
    limit_attempts("password-reset-otp", email, 5, 600)
    digest = recovery_otp_hash(email, data.otp)
    token = secrets.token_urlsafe(32)
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT user_id FROM users WHERE lower(email)=%s AND is_active FOR UPDATE",
            (email,),
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(400, "Invalid or expired code. Request a new code.")
        cur.execute(
            """SELECT reset_id FROM password_resets WHERE user_id=%s AND token_hash=%s
            AND used_at IS NULL AND expires_at>NOW() FOR UPDATE""",
            (user["user_id"], digest),
        )
        if not cur.fetchone():
            raise HTTPException(400, "Invalid or expired code. Request a new code.")
        # Consuming every outstanding code prevents verification replay.
        cur.execute(
            "UPDATE password_resets SET used_at=NOW() WHERE user_id=%s AND used_at IS NULL",
            (user["user_id"],),
        )
        cur.execute(
            "INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES(%s,%s,%s)",
            (
                user["user_id"],
                hashlib.sha256(token.encode()).hexdigest(),
                datetime.now(timezone.utc) + timedelta(minutes=10),
            ),
        )
    return {"token": token, "message": "Email verified. Choose a new password."}


def recovery_url(token):
    """Use the configured public frontend, never an untrusted request Host header."""
    try:
        frontend = urlsplit(settings.FRONTEND_URL.strip())
        frontend.port  # Validate malformed ports as well as the host.
    except ValueError as error:
        raise HTTPException(
            503, "Password recovery website URL is not configured correctly."
        ) from error
    if (
        frontend.scheme not in ("http", "https")
        or not frontend.hostname
        or frontend.username
        or frontend.password
        or frontend.query
        or frontend.fragment
    ):
        raise HTTPException(
            503, "Password recovery website URL is not configured correctly."
        )
    return urlunsplit(
        (
            frontend.scheme,
            frontend.netloc,
            frontend.path.rstrip("/") + "/reset-password",
            urlencode({"token": token}),
            "",
        )
    )


@router.post("/forgot-password")
async def forgot(data: Forgot):
    email = str(data.email).lower()
    limit_attempts("password-reset", email, 3, 3600)
    if not settings.SMTP_ENABLED:
        raise HTTPException(503, "Password recovery email is not configured.")
    token = secrets.token_urlsafe(32)
    link = recovery_url(token)
    digest = hashlib.sha256(token.encode()).hexdigest()
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT user_id FROM users WHERE lower(email)=%s AND is_active", (email,)
        )
        user = cur.fetchone()
        if user:
            cur.execute(
                """INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES(%s,%s,%s)""",
                (
                    user["user_id"],
                    digest,
                    datetime.now(timezone.utc) + timedelta(minutes=30),
                ),
            )
    if user:
        delivered = await send_message(
            email,
            "Reset your VenueFlow password",
            f"Open {link}\nThis single-use link expires in 30 minutes.",
        )
        if not delivered:
            # A failed delivery must not leave a usable token or claim success.
            with get_db_cursor() as cur:
                cur.execute(
                    "DELETE FROM password_resets WHERE token_hash=%s", (digest,)
                )
            raise HTTPException(
                503,
                "Recovery email could not be delivered. Please try again later or contact the administrator.",
            )
    return {"message": "If an active account exists, a recovery email will be sent."}


@router.post("/reset-password")
def reset(data: Reset):
    limit_attempts(
        "reset-token", hashlib.sha256(data.token.encode()).hexdigest(), 5, 1800
    )
    password = hash_password(data.password)
    with get_db_cursor() as cur:
        # Serialize all resets for this user before locking an individual token,
        # so two different reset links cannot deadlock while invalidating each other.
        digest = hashlib.sha256(data.token.encode()).hexdigest()
        cur.execute(
            "SELECT user_id FROM password_resets WHERE token_hash=%s", (digest,)
        )
        target = cur.fetchone()
        if not target:
            raise HTTPException(400, "Invalid or expired reset link.")
        cur.execute(
            "SELECT is_active FROM users WHERE user_id=%s FOR UPDATE",
            (target["user_id"],),
        )
        if not cur.fetchone()["is_active"]:
            raise HTTPException(400, "Invalid or expired reset link.")
        cur.execute(
            """SELECT * FROM password_resets WHERE token_hash=%s AND used_at IS NULL AND expires_at>NOW() FOR UPDATE""",
            (hashlib.sha256(data.token.encode()).hexdigest(),),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(400, "Invalid or expired reset link.")
        cur.execute(
            "UPDATE users SET password_hash=%s,session_version=session_version+1 WHERE user_id=%s AND is_active",
            (password, row["user_id"]),
        )
        cur.execute(
            "UPDATE password_resets SET used_at=NOW() WHERE user_id=%s",
            (row["user_id"],),
        )
    return {"message": "Password updated. Sign in again."}
