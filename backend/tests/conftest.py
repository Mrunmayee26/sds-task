"""Tests start their own disposable PostgreSQL, never the Supabase database."""
import os
import sys
from pathlib import Path

import pgserver
import psycopg2
import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


@pytest.fixture(scope="session")
def database(tmp_path_factory):
    server = pgserver.get_server(tmp_path_factory.mktemp("venueflow-postgres"), cleanup_mode="stop")
    database_url = server.get_uri()
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
    yield database_url
    close_db_pool()
    server.cleanup()


@pytest.fixture
def client(database):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.security import hash_password
    with psycopg2.connect(database) as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE organizational_units, buildings, users, approval_groups, group_members, venues, venue_additional_approvals, applications, booking_slots, application_approvals, approval_events, email_otps RESTART IDENTITY CASCADE")
            cur.execute((BACKEND / "tests/fixtures/catalog.sql").read_text())
            password_hash = hash_password("TestPassword42")
            for name, role in [("Applicant", "applicant"), ("Reviewer", "approver"), ("Other", "applicant"), ("Second", "faculty")]:
                cur.execute("INSERT INTO users (full_name, email, user_type, password_hash) VALUES (%s, %s, %s, %s)",
                            (name, name.lower() + "@coep.ac.in", role, password_hash))
            cur.execute("INSERT INTO group_members (access_id, user_id, member_role, can_approve) VALUES (1, 2, 'Reviewer', TRUE), (1, 4, 'Reviewer', TRUE)")
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def headers():
    from app.core.security import create_access_token
    return lambda user_id: {"Authorization": "Bearer " + create_access_token(user_id)}


@pytest.fixture
def booking():
    from datetime import datetime, timedelta, timezone
    start = (datetime.now(timezone.utc) + timedelta(days=7)).replace(hour=9, minute=0, second=0, microsecond=0)
    return {"venue_id": 1, "purpose": "Python workshop", "description": "Learn the basics",
            "application_type": "Workshop", "expected_attendance": 30,
            "start_time": start.isoformat(), "end_time": (start + timedelta(hours=1)).isoformat()}
