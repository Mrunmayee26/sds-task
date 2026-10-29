"""Password recovery delivery and deployed-link regression tests."""

import asyncio
from urllib.parse import urlsplit, parse_qs

import psycopg2
import pytest

PATH = "/api/v1/auth/forgot-password"


def test_failed_delivery_reports_error_and_removes_token(client, database, monkeypatch):
    async def fail(*args):
        return False

    monkeypatch.setattr("app.api.v1.account.settings.SMTP_ENABLED", True)
    monkeypatch.setattr("app.api.v1.account.send_message", fail)
    response = client.post(PATH, json={"email": "applicant@coep.ac.in"})
    assert response.status_code == 503
    assert "could not be delivered" in response.json()["detail"]
    with psycopg2.connect(database) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM password_resets")
            assert cur.fetchone()[0] == 0


def test_reset_link_uses_public_frontend_and_valid_token(client, monkeypatch):
    messages = []

    async def capture(email, subject, body):
        messages.append(body)
        return True

    monkeypatch.setattr("app.api.v1.account.settings.SMTP_ENABLED", True)
    monkeypatch.setattr(
        "app.api.v1.account.settings.FRONTEND_URL", " https://venues.example.edu/ "
    )
    monkeypatch.setattr("app.api.v1.account.send_message", capture)
    response = client.post(PATH, json={"email": "APPLICANT@coep.ac.in"})
    assert response.status_code == 200, response.text
    link = urlsplit(messages[0].split()[1])
    assert link.scheme == "https" and link.netloc == "venues.example.edu"
    assert link.path == "/reset-password"
    token = parse_qs(link.query)["token"][0]
    assert (
        client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "password": "RecoveredPassword42"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": "applicant@coep.ac.in", "password": "RecoveredPassword42"},
        ).status_code
        == 200
    )


@pytest.mark.parametrize(
    "frontend",
    [
        "",
        "venues.example.edu",
        "https://venues.example.edu/?x=1",
        "https://venues.example.edu/#/",
        "https://user:pass@venues.example.edu",
        "https://[invalid",
        "https://venues.example.edu:invalid",
    ],
)
def test_invalid_frontend_cannot_generate_broken_recovery_link(
    client, monkeypatch, frontend
):
    monkeypatch.setattr("app.api.v1.account.settings.SMTP_ENABLED", True)
    monkeypatch.setattr("app.api.v1.account.settings.FRONTEND_URL", frontend)
    response = client.post(PATH, json={"email": "applicant@coep.ac.in"})
    assert response.status_code == 503
    assert "website URL" in response.json()["detail"]


def test_unknown_account_keeps_generic_response(client, monkeypatch):
    async def unexpected(*args):
        pytest.fail("Unknown account must not receive email")

    monkeypatch.setattr("app.api.v1.account.settings.SMTP_ENABLED", True)
    monkeypatch.setattr("app.api.v1.account.send_message", unexpected)
    assert client.post(PATH, json={"email": "unknown@coep.ac.in"}).status_code == 200


@pytest.mark.parametrize(
    "port,use_tls,start_tls", [(465, True, False), (587, False, True)]
)
def test_recovery_email_supports_smtp_tls_modes(
    database, monkeypatch, port, use_tls, start_tls
):
    from app.core.email import send_message

    calls = []

    async def capture(message, **options):
        calls.append(options)

    monkeypatch.setattr("app.core.email.settings.SMTP_ENABLED", True)
    monkeypatch.setattr("app.core.email.settings.SMTP_PORT", port)
    monkeypatch.setattr("app.core.email.settings.SMTP_USE_TLS", True)
    monkeypatch.setattr("app.core.email.aiosmtplib.send", capture)
    assert asyncio.run(
        send_message("test@coep.ac.in", "Reset password", "Recovery link")
    )
    assert calls[0]["use_tls"] == use_tls
    assert calls[0]["start_tls"] == start_tls
