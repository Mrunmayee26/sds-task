"""Tests start their own disposable PostgreSQL, never the Supabase database."""

import os
import sys
from pathlib import Path

import pgserver
import psycopg2
import pytest
import fakeredis

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


@pytest.fixture(scope="session")
def database(tmp_path_factory):
    server = None
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        server = pgserver.get_server(
            tmp_path_factory.mktemp("venueflow-postgres"), cleanup_mode="stop"
        )
        database_url = server.get_uri()
    if server is None and "test" not in database_url.rsplit("/", 1)[-1]:
        raise RuntimeError("TEST_DATABASE_URL must name an isolated test database")
    # Real environment values take priority over .env; this is always a new local DB.
    os.environ["DATABASE_URL"] = database_url
    os.environ["JWT_SECRET_KEY"] = "local-test-secret-not-for-production-0123456789"
    os.environ["SMTP_ENABLED"] = "false"
    from app.config import settings
    from app.db.session import close_db_pool

    settings.DATABASE_URL = database_url
    with psycopg2.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute((BACKEND / "tests/fixtures/schema.sql").read_text())
            cur.execute((BACKEND / "sql/001_admin_workflow.sql").read_text())
    yield database_url
    close_db_pool()
    if server:
        server.cleanup()


@pytest.fixture(autouse=True)
def cache(database, monkeypatch):
    from app.core import cache as module
    import redis

    url = os.environ.get("TEST_REDIS_URL")
    connection = (
        redis.Redis.from_url(url, decode_responses=True)
        if url
        else fakeredis.FakeRedis(decode_responses=True)
    )
    connection.flushdb()
    monkeypatch.setattr(module.settings, "REDIS_URL", url or "redis://isolated-test/15")
    monkeypatch.setattr(module, "client_for_url", lambda url: connection)
    return connection


@pytest.fixture
def client(database):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.security import hash_password

    with psycopg2.connect(database) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "TRUNCATE organizational_units, buildings, users, approval_groups, group_members, venues, venue_additional_approvals, applications, booking_slots, application_approvals, approval_events, email_otps, approver_requests, venue_blackouts, user_notifications, password_resets, admin_events RESTART IDENTITY CASCADE"
            )
            cur.execute((BACKEND / "tests/fixtures/catalog.sql").read_text())
            password_hash = hash_password("TestPassword42")
            for name, role in [
                ("Applicant", "applicant"),
                ("Reviewer", "approver"),
                ("Other", "applicant"),
                ("Second", "faculty"),
                ("Admin", "admin"),
            ]:
                cur.execute(
                    "INSERT INTO users (full_name, email, user_type, password_hash) VALUES (%s, %s, %s, %s)",
                    (name, name.lower() + "@coep.ac.in", role, password_hash),
                )
            cur.execute(
                "INSERT INTO group_members (access_id, user_id, member_role, can_approve) VALUES (1, 2, 'Reviewer', TRUE), (1, 4, 'Reviewer', TRUE)"
            )
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def headers():
    from app.core.security import create_access_token

    return lambda user_id: {"Authorization": "Bearer " + create_access_token(user_id)}


@pytest.fixture
def booking():
    from datetime import datetime, timedelta, timezone

    start = (datetime.now(timezone.utc) + timedelta(days=7)).replace(
        hour=9, minute=0, second=0, microsecond=0
    )
    return {
        "venue_id": 1,
        "purpose": "Python workshop",
        "description": "Learn the basics",
        "application_type": "Workshop",
        "expected_attendance": 30,
        "start_time": start.isoformat(),
        "end_time": (start + timedelta(hours=1)).isoformat(),
    }
