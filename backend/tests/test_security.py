from datetime import timedelta
import jwt
import pytest
from fastapi import HTTPException


def test_password_hash_never_contains_plaintext(database):
    from app.core.security import hash_password, verify_password

    hashed = hash_password("StrongPassword42")
    assert hashed != "StrongPassword42"
    assert verify_password("StrongPassword42", hashed)
    assert not verify_password("wrong", hashed)
    assert not verify_password("wrong", "invalid hash")


def test_bcrypt_byte_limit_including_unicode(database):
    from app.core.security import hash_password

    with pytest.raises(HTTPException) as exc:
        hash_password("é" * 40)
    assert exc.value.status_code == 422


def test_jwt_subject_signature_and_expiry(database):
    from app.core.security import create_access_token, decode_access_token

    token = create_access_token(123)
    assert decode_access_token(token)["sub"] == "123"
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(
            create_access_token(123, expires_delta=timedelta(seconds=-1))
        )
    with pytest.raises(jwt.InvalidSignatureError):
        jwt.decode(
            token,
            "different-signing-key-that-is-at-least-32-bytes",
            algorithms=["HS256"],
        )


def test_auth_throttling_fails_closed_without_redis(client, monkeypatch):
    monkeypatch.setattr("app.core.cache.settings.REDIS_URL", "")
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "applicant@coep.ac.in", "password": "TestPassword42"},
    )
    assert response.status_code == 503


def test_otp_is_not_stored_in_plaintext(client, database, monkeypatch):
    from app.repositories.otp_repo import save_otp, verify_and_consume_otp
    import psycopg2

    save_otp("test@coep.ac.in", "123456", {"full_name": "Test"})
    with psycopg2.connect(database) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT otp_code,payload FROM email_otps WHERE email='test@coep.ac.in'"
            )
            code, payload = cur.fetchone()
            assert code != "123456"
            assert "123456" not in str(payload)
    assert verify_and_consume_otp("test@coep.ac.in", "wrong!") is None
    assert verify_and_consume_otp("test@coep.ac.in", "123456")["full_name"] == "Test"
    assert verify_and_consume_otp("test@coep.ac.in", "123456") is None
