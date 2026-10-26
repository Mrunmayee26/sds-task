from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

import psycopg2
import pytest

BASE = "/api/v1"


def create(client, headers, booking, user=1):
    response = client.post(BASE + "/bookings", json=booking, headers=headers(user))
    assert response.status_code == 201, response.text
    return response.json()["application_id"]


def test_catalog_and_availability(client, headers, booking):
    assert client.get(BASE + "/venues").json()[0]["capacity"] == 60
    assert client.get(BASE + "/venues?search=missing").json() == []
    assert client.get(BASE + "/venues?min_capacity=100").json() == []
    assert client.get(BASE + "/venues?venue_type=classroom").status_code == 200
    assert client.get(BASE + "/venues/999").status_code == 404
    times = {key: booking[key] for key in ("start_time", "end_time")}
    assert client.get(BASE + "/venues/1/availability", params=times).json()["available"]
    create(client, headers, booking)
    assert not client.get(BASE + "/venues/1/availability", params=times).json()["available"]
    times["end_time"] = times["start_time"]
    assert client.get(BASE + "/venues/1/availability", params=times).status_code == 422


def test_booking_lifecycle_and_privacy(client, headers, booking):
    booking_id = create(client, headers, booking)
    path = f"{BASE}/bookings/{booking_id}"
    assert client.get(path).status_code == 401
    assert client.get(path, headers=headers(3)).status_code == 403
    assert client.get(BASE + "/bookings", headers=headers(3)).json() == []
    assert len(client.get(BASE + "/bookings?scope=review", headers=headers(2)).json()) == 1
    assert client.patch(path + "/status", json={"status": "approved"}, headers=headers(3)).status_code == 403
    approved = client.patch(path + "/status", json={"status": "approved", "remarks": "OK"}, headers=headers(2))
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"
    assert approved.json()["slots"][0]["slot_status"] == "confirmed"
    assert len(approved.json()["events"]) == 1
    assert client.patch(path + "/status", json={"status": "rejected"}, headers=headers(2)).status_code == 409
    assert client.post(path + "/cancel", json={}, headers=headers(3)).status_code == 403
    cancelled = client.post(path + "/cancel", json={"reason": "Event moved"}, headers=headers(1))
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["cancellation_reason"] == "Event moved"
    assert cancelled.json()["slots"][0]["slot_status"] == "cancelled"
    create(client, headers, booking)


def test_conflicts_and_adjacent_slots(client, headers, booking):
    create(client, headers, booking)
    assert client.post(BASE + "/bookings", json=booking, headers=headers(3)).status_code == 409
    adjacent = {**booking, "start_time": booking["end_time"],
                "end_time": (datetime.fromisoformat(booking["end_time"]) + timedelta(hours=1)).isoformat()}
    create(client, headers, adjacent)


@pytest.mark.parametrize("change", [
    {"purpose": "   "}, {"expected_attendance": 0}, {"expected_attendance": 61},
    {"start_time": "2020-01-01T09:00:00+05:30"}, {"venue_id": 0},
    {"start_time": "2030-01-01T09:00:00"}, {"end_time": "2020-01-01T10:00:00Z"},
    {"applicant_user_id": 3},
])
def test_invalid_requests(client, headers, booking, change):
    response = client.post(BASE + "/bookings", json={**booking, **change}, headers=headers(1))
    assert response.status_code == 422, response.text
    assert client.get(BASE + "/bookings", headers=headers(1)).json() == []


def test_rejection_releases_slot(client, headers, booking):
    booking_id = create(client, headers, booking)
    rejected = client.patch(f"{BASE}/bookings/{booking_id}/status", json={"status": "rejected", "remarks": "Unavailable"}, headers=headers(2))
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["slots"][0]["slot_status"] == "cancelled"
    create(client, headers, booking)


def test_concurrent_requests_allow_only_one_booking(client, headers, booking):
    def submit(user):
        return client.post(BASE + "/bookings", json=booking, headers=headers(user)).status_code
    with ThreadPoolExecutor(max_workers=2) as executor:
        assert sorted(executor.map(submit, [1, 3])) == [201, 409]
    assert len(client.get(BASE + "/bookings?scope=review", headers=headers(2)).json()) == 1


def test_multistep_approval_and_duplicate_votes(client, database, headers, booking):
    with psycopg2.connect(database) as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE approval_groups SET approval_mode = 'all' WHERE access_id = 1")
            cur.execute("INSERT INTO approval_groups (group_name, unit_id) VALUES ('Second stage', 1)")
            cur.execute("INSERT INTO venue_additional_approvals VALUES (1, 2, 1)")
            cur.execute("INSERT INTO group_members (access_id, user_id, member_role, can_approve) VALUES (2, 3, 'Reviewer', TRUE)")
    booking_id = create(client, headers, booking)
    path = f"{BASE}/bookings/{booking_id}/status"
    vote = {"status": "approved"}
    assert client.patch(path, json=vote, headers=headers(3)).status_code == 409
    first = client.patch(path, json=vote, headers=headers(2))
    assert first.json()["status"] == "submitted"
    assert first.json()["approvals"][0]["approval_count"] == 1
    assert client.patch(path, json=vote, headers=headers(2)).status_code == 409
    assert client.patch(path, json=vote, headers=headers(4)).json()["status"] == "submitted"
    assert client.patch(path, json=vote, headers=headers(3)).json()["status"] == "approved"


def test_departed_members_and_inactive_venues(client, database, headers, booking):
    booking_id = create(client, headers, booking)
    with psycopg2.connect(database) as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE group_members SET left_at = NOW() WHERE user_id = 2")
            cur.execute("UPDATE venues SET is_active = FALSE WHERE venue_id = 1")
    assert client.get(f"{BASE}/bookings/{booking_id}", headers=headers(2)).status_code == 403
    assert client.get(BASE + "/venues").json() == []
    assert client.post(BASE + "/bookings", json=booking, headers=headers(3)).status_code == 409


def test_registration_cannot_grant_approval_rights(client):
    response = client.post(BASE + "/auth/register", json={"full_name": "Self Approver",
        "email": "self@coep.ac.in", "password": "Password42", "role": "approver"})
    assert response.status_code == 403


def test_login_and_current_user(client):
    login = client.post(BASE + "/auth/login", json={"email": "applicant@coep.ac.in", "password": "TestPassword42"})
    assert login.status_code == 200
    profile = client.get(BASE + "/auth/me", headers={"Authorization": "Bearer " + login.json()["access_token"]})
    assert profile.json()["user_id"] == 1
    assert client.post(BASE + "/auth/login", json={"email": "applicant@coep.ac.in", "password": "wrong"}).status_code == 401
    assert client.get(BASE + "/auth/me", headers={"Authorization": "Bearer invalid"}).status_code == 401


def test_email_registration_and_otp_reuse(client, monkeypatch):
    sent = []

    async def capture_email(email, code, name):
        sent.append(code)
        return True

    monkeypatch.setattr("app.api.v1.auth.send_otp_email", capture_email)
    account = {"email": "new@coep.ac.in", "password": "Password42", "full_name": "New Student"}
    assert client.post(BASE + "/auth/register", json=account).status_code == 200
    assert len(sent) == 1
    # Resend invalidates the old record; use the latest code.
    assert client.post(BASE + "/auth/resend-otp", json={"email": account["email"]}).status_code == 200
    invalid = client.post(BASE + "/auth/verify-otp", json={"email": account["email"], "otp": "000000"})
    assert invalid.status_code == 400
    verified = client.post(BASE + "/auth/verify-otp", json={"email": account["email"], "otp": sent[-1]})
    assert verified.status_code == 201, verified.text
    assert verified.json()["user"]["user_type"] == "applicant"
    assert verified.json()["user"]["approval_groups"] == []
    assert client.post(BASE + "/auth/verify-otp", json={"email": account["email"], "otp": sent[-1]}).status_code == 400
    assert client.post(BASE + "/auth/register", json=account).status_code == 409


def test_missing_reviewers_rolls_back_everything(client, database, headers, booking):
    with psycopg2.connect(database) as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE group_members SET can_approve = FALSE")
    assert client.post(BASE + "/bookings", json=booking, headers=headers(1)).status_code == 409
    with psycopg2.connect(database) as conn:
        with conn.cursor() as cur:
            for table in ["applications", "booking_slots", "application_approvals"]:
                cur.execute("SELECT COUNT(*) FROM " + table)
                assert cur.fetchone()[0] == 0


def test_health_and_database_errors_do_not_expose_credentials(client, monkeypatch):
    assert client.get("/health").json()["status"] == "healthy"

    def fail(*args, **kwargs):
        raise psycopg2.OperationalError("postgresql://private-password@private-host/db")

    monkeypatch.setattr("app.main.test_db_connection", fail)
    health = client.get("/health")
    assert health.status_code == 503
    assert "private-password" not in health.text
    monkeypatch.setattr("app.repositories.venue_repo.get_db_cursor", fail)
    failed = client.get(BASE + "/venues")
    assert failed.status_code == 503
    assert "private-password" not in failed.text
