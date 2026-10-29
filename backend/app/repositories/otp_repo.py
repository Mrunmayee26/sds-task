"""
Data access repository for email verification OTPs and pending registration staging.
"""

import json
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from app.db.session import get_db_cursor
from app.config import settings


def otp_digest(email, code):
    return hmac.new(
        settings.JWT_SECRET_KEY.encode(),
        f"{email.strip().lower()}:{code}".encode(),
        hashlib.sha256,
    ).hexdigest()


def save_otp(
    email: str, otp_code: str, payload: Dict[str, Any], expires_in_minutes: int = 10
) -> Dict[str, Any]:
    """Store an OTP and pending registration payload with an expiration timestamp."""
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)
    payload = {**payload, "otp_digest": otp_digest(email, otp_code)}

    # Invalidate previous unverified OTPs for this email
    invalidate_query = """
        UPDATE email_otps 
        SET is_verified = TRUE 
        WHERE LOWER(email) = LOWER(%s) AND is_verified = FALSE;
    """
    insert_query = """
        INSERT INTO email_otps (email, otp_code, payload, expires_at, is_verified)
        VALUES (%s, %s, %s, %s, FALSE)
        RETURNING id, email, otp_code, expires_at;
    """
    with get_db_cursor(commit=True) as cur:
        cur.execute(invalidate_query, (email.strip(),))
        cur.execute(
            insert_query,
            (email.strip().lower(), "******", json.dumps(payload), expires_at),
        )
        return dict(cur.fetchone())


def verify_and_consume_otp(email: str, otp_code: str) -> Optional[Dict[str, Any]]:
    """
    Check if the provided OTP matches an active, non-expired record.
    If valid, marks it verified and returns the stored registration payload.
    """
    query = """
        SELECT id, payload, expires_at, otp_code
        FROM email_otps
        WHERE LOWER(email) = LOWER(%s)
          AND is_verified = FALSE
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1 FOR UPDATE;
    """
    with get_db_cursor(commit=True) as cur:
        cur.execute(query, (email.strip(),))
        row = cur.fetchone()
        if not row:
            return None

        payload = row["payload"]
        payload = json.loads(payload) if isinstance(payload, str) else payload
        expected = payload.pop("otp_digest", None)
        valid = (
            hmac.compare_digest(expected, otp_digest(email, otp_code))
            if expected
            else hmac.compare_digest(row["otp_code"], otp_code)
        )
        if not valid:
            return None
        cur.execute(
            "UPDATE email_otps SET is_verified = TRUE WHERE id = %s;", (row["id"],)
        )
        return payload


def get_latest_pending_payload(email: str) -> Optional[Dict[str, Any]]:
    """Retrieve the most recent unverified registration payload for resending OTP."""
    query = """
        SELECT payload 
        FROM email_otps
        WHERE LOWER(email) = LOWER(%s)
          AND is_verified = FALSE
        ORDER BY created_at DESC
        LIMIT 1;
    """
    with get_db_cursor(commit=False) as cur:
        cur.execute(query, (email.strip(),))
        row = cur.fetchone()
        if not row:
            return None
        payload = row["payload"]
        return json.loads(payload) if isinstance(payload, str) else payload
