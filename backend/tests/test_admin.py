from datetime import datetime, timedelta, timezone
import hashlib
import psycopg2
import pytest

BASE = "/api/v1"


def create(client, headers, booking, user=1):
    response = client.post(BASE + "/bookings", json=booking, headers=headers(user))
    assert response.status_code == 201, response.text
    return response.json()["application_id"]


def test_admin_access_and_disabled_sessions(client, headers):
    assert client.get(BASE + "/admin/users", headers=headers(1)).status_code == 403
    assert client.get(BASE + "/admin/users").status_code == 401
    assert len(client.get(BASE + "/admin/users", headers=headers(5)).json()) == 5
    assert (
        client.patch(
            BASE + "/admin/users/5", json={"is_active": False}, headers=headers(5)
        ).status_code
        == 409
    )
    token = headers(1)
    assert (
        client.patch(
            BASE + "/admin/users/1", json={"is_active": False}, headers=headers(5)
        ).status_code
        == 200
    )
    assert client.get(BASE + "/auth/me", headers=token).status_code == 403
    client.patch(BASE + "/admin/users/1", json={"is_active": True}, headers=headers(5))
    assert client.get(BASE + "/auth/me", headers=token).status_code == 401
    login = client.post(
        BASE + "/auth/login",
        json={"email": "applicant@coep.ac.in", "password": "TestPassword42"},
    )
    assert login.status_code == 200
    assert (
        client.get(
            BASE + "/auth/me",
            headers={"Authorization": "Bearer " + login.json()["access_token"]},
        ).status_code
        == 200
    )
    assert len(client.get(BASE + "/admin/audit", headers=headers(5)).json()) == 2


def test_admin_login_cannot_be_self_selected(client):
    payload = {
        "email": "applicant@coep.ac.in",
        "password": "TestPassword42",
        "role": "admin",
    }
    assert client.post(BASE + "/auth/login", json=payload).status_code == 403
    payload["email"] = "admin@coep.ac.in"
    assert client.post(BASE + "/auth/login", json=payload).status_code == 200


def test_reviewer_request_decision_and_revocation(client, headers):
    response = client.post(
        BASE + "/approver-requests",
        json={"access_id": 1, "reason": "I am the new department reviewer."},
        headers=headers(3),
    )
    assert response.status_code == 201, response.text
    request_id = response.json()["request_id"]
    assert (
        client.post(
            BASE + "/approver-requests",
            json={"access_id": 1, "reason": "Duplicate access request."},
            headers=headers(3),
        ).status_code
        == 409
    )
    assert (
        client.patch(
            f"{BASE}/admin/approver-requests/{request_id}",
            json={"status": "approved"},
            headers=headers(3),
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"{BASE}/admin/approver-requests/{request_id}",
            json={"status": "approved"},
            headers=headers(5),
        ).status_code
        == 200
    )
    assert client.get(BASE + "/auth/me", headers=headers(3)).json()["approval_groups"][
        0
    ]["can_approve"]
    assert (
        client.patch(
            f"{BASE}/admin/approver-requests/{request_id}",
            json={"status": "approved"},
            headers=headers(5),
        ).status_code
        == 409
    )
    assert (
        client.patch(
            BASE + "/admin/users/3/groups/1",
            json={"can_approve": False},
            headers=headers(5),
        ).status_code
        == 200
    )
    assert (
        client.get(BASE + "/auth/me", headers=headers(3)).json()["approval_groups"]
        == []
    )


def test_blackout_blocks_submission_and_approval(client, headers, booking):
    booking_id = create(client, headers, booking)
    body = {
        "venue_id": 1,
        "start_time": booking["start_time"],
        "end_time": booking["end_time"],
        "reason": "Maintenance",
    }
    block = client.post(BASE + "/admin/blackouts", json=body, headers=headers(5))
    assert block.status_code == 201, block.text
    assert (
        client.post(BASE + "/bookings", json=booking, headers=headers(3)).status_code
        == 409
    )
    assert (
        client.patch(
            f"{BASE}/bookings/{booking_id}/status",
            json={"status": "approved"},
            headers=headers(2),
        ).status_code
        == 409
    )
    times = {k: booking[k] for k in ("start_time", "end_time")}
    assert client.get(BASE + "/venues/1/availability", params=times).json()["blocked"]
    assert client.get(BASE + "/venues", params=times).json() == []
    assert (
        client.delete(
            f"{BASE}/admin/blackouts/{block.json()['blackout_id']}", headers=headers(5)
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"{BASE}/bookings/{booking_id}/status",
            json={"status": "approved"},
            headers=headers(2),
        ).status_code
        == 200
    )
    assert (
        client.post(
            BASE + "/admin/blackouts", json=body, headers=headers(5)
        ).status_code
        == 409
    )


def test_priority_replacement(client, headers, booking):
    first = create(client, headers, booking)
    assert (
        client.patch(
            f"{BASE}/bookings/{first}/status",
            json={"status": "approved"},
            headers=headers(2),
        ).status_code
        == 200
    )
    second = create(client, headers, booking, 3)
    path = f"{BASE}/bookings/{second}/status"
    assert (
        client.patch(path, json={"status": "approved"}, headers=headers(2)).status_code
        == 409
    )
    assert (
        client.patch(
            path,
            json={
                "status": "approved",
                "replace_conflicts": True,
                "remarks": "University priority",
            },
            headers=headers(2),
        ).status_code
        == 200
    )
    assert (
        client.get(f"{BASE}/bookings/{first}", headers=headers(1)).json()["status"]
        == "cancelled"
    )
    assert client.get(BASE + "/admin/bookings", headers=headers(5)).status_code == 200
    assert (
        client.get(f"{BASE}/bookings/{second}", headers=headers(5)).status_code == 200
    )


@pytest.mark.parametrize("actor", [1, 2, 5])
def test_eight_hour_cancellation_for_every_actor(
    client, database, headers, booking, actor
):
    booking_id = create(client, headers, booking)
    with psycopg2.connect(database) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE booking_slots SET start_time=NOW()+INTERVAL '7 hours',end_time=NOW()+INTERVAL '8 hours' WHERE application_id=%s",
                (booking_id,),
            )
    assert (
        client.post(
            f"{BASE}/bookings/{booking_id}/cancel", headers=headers(actor)
        ).status_code
        == 409
    )


def test_reviewer_cancellation_before_deadline(client, headers, booking):
    booking_id = create(client, headers, booking)
    assert (
        client.post(
            f"{BASE}/bookings/{booking_id}/cancel", headers=headers(2)
        ).status_code
        == 200
    )


def test_redis_hold_overlap_privacy_and_ttl(client, headers, booking, cache):
    body = {key: booking[key] for key in ("venue_id", "start_time", "end_time")}
    first = client.post(BASE + "/booking-holds", json=body, headers=headers(1))
    assert first.status_code == 200, first.text
    assert first.json()["other_drafts"] == 0
    assert (
        client.post(BASE + "/booking-holds", json=body, headers=headers(1)).json()[
            "other_drafts"
        ]
        == 0
    )
    second = client.post(BASE + "/booking-holds", json=body, headers=headers(3))
    assert second.json()["other_drafts"] == 1
    assert "Applicant" not in second.text
    assert 295 <= cache.ttl("venueflow:holds:1:1") <= 300
    create(client, headers, booking)
    assert not cache.exists("venueflow:holds:1:1")


def test_rate_limit_cannot_be_bypassed_by_workers(client):
    for _ in range(10):
        assert (
            client.post(
                BASE + "/auth/login",
                json={"email": "applicant@coep.ac.in", "password": "wrong"},
            ).status_code
            == 401
        )
    assert (
        client.post(
            BASE + "/auth/login",
            json={"email": "applicant@coep.ac.in", "password": "wrong"},
        ).status_code
        == 429
    )


def test_password_recovery_revokes_tokens_and_is_single_use(
    client, headers, monkeypatch
):
    messages = []

    async def capture(email, subject, body):
        messages.append(body)
        return True

    monkeypatch.setattr("app.api.v1.account.send_message", capture)
    monkeypatch.setattr("app.api.v1.account.settings.SMTP_ENABLED", True)
    old_token = headers(1)
    assert (
        client.post(
            BASE + "/auth/forgot-password", json={"email": "applicant@coep.ac.in"}
        ).status_code
        == 200
    )
    token = messages[0].split("token=")[1].split()[0]
    body = {"token": token, "password": "NewPassword42"}
    assert client.post(BASE + "/auth/reset-password", json=body).status_code == 200
    assert client.post(BASE + "/auth/reset-password", json=body).status_code == 400
    assert client.get(BASE + "/auth/me", headers=old_token).status_code == 401
    assert (
        client.post(
            BASE + "/auth/login",
            json={"email": "applicant@coep.ac.in", "password": "NewPassword42"},
        ).status_code
        == 200
    )


def test_venue_update_invalidates_cache_and_filters(client, headers):
    client.get(BASE + "/venues")
    data = {
        "venue_name": "Renamed Hall",
        "capacity": 80,
        "is_active": True,
        "location_description": "West wing",
        "amenities": ["Projector"],
    }
    assert (
        client.patch(
            BASE + "/admin/venues/1", json=data, headers=headers(5)
        ).status_code
        == 200
    )
    assert (
        client.get(BASE + "/venues?location=West&amenity=Projector").json()[0][
            "venue_name"
        ]
        == "Renamed Hall"
    )
    assert client.get(BASE + "/venues?location=East").json() == []


def test_notifications_owned_and_summary_paginated(client, headers, booking):
    booking_id = create(client, headers, booking)
    assert (
        client.get(BASE + "/bookings/summary", headers=headers(1)).json()["pending"]
        == 1
    )
    assert (
        len(client.get(BASE + "/bookings?limit=1&offset=0", headers=headers(1)).json())
        == 1
    )
    assert (
        client.get(BASE + "/bookings?limit=1&offset=1", headers=headers(1)).json() == []
    )
    notifications = client.get(BASE + "/notifications", headers=headers(1)).json()
    assert notifications
    notification_id = notifications[0]["notification_id"]
    assert (
        client.post(
            f"{BASE}/notifications/{notification_id}/read", headers=headers(3)
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"{BASE}/notifications/{notification_id}/read", headers=headers(1)
        ).status_code
        == 200
    )


def test_reminders_do_not_duplicate(client, database, headers, booking):
    booking_id = create(client, headers, booking)
    with psycopg2.connect(database) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE applications SET submitted_at=NOW()-INTERVAL '2 days' WHERE application_id=%s",
                (booking_id,),
            )
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from worker import reminders

    reminders()
    reminders()
    rows = client.get(BASE + "/notifications", headers=headers(2)).json()
    assert len([row for row in rows if row["message"].startswith("Reminder:")]) == 1


def test_expired_and_nonoverlapping_holds_do_not_warn(client, headers, booking, cache):
    body = {key: booking[key] for key in ("venue_id", "start_time", "end_time")}
    client.post(BASE + "/booking-holds", json=body, headers=headers(1))
    adjacent = {
        **body,
        "start_time": body["end_time"],
        "end_time": (
            datetime.fromisoformat(body["end_time"]) + timedelta(hours=1)
        ).isoformat(),
    }
    assert (
        client.post(BASE + "/booking-holds", json=adjacent, headers=headers(3)).json()[
            "other_drafts"
        ]
        == 0
    )
    cache.expire("venueflow:holds:1:1", 0)
    assert (
        client.post(BASE + "/booking-holds", json=body, headers=headers(3)).json()[
            "other_drafts"
        ]
        == 0
    )


def test_priority_replacement_respects_deadline_and_rolls_back_vote(
    client, database, headers, booking
):
    first = create(client, headers, booking)
    client.patch(
        f"{BASE}/bookings/{first}/status",
        json={"status": "approved"},
        headers=headers(2),
    )
    second = create(client, headers, booking, 3)
    with psycopg2.connect(database) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE booking_slots SET start_time=NOW()+INTERVAL '7 hours',end_time=NOW()+INTERVAL '8 hours'"
            )
    assert (
        client.patch(
            f"{BASE}/bookings/{second}/status",
            json={"status": "approved", "replace_conflicts": True},
            headers=headers(2),
        ).status_code
        == 409
    )
    details = client.get(f"{BASE}/bookings/{second}", headers=headers(3)).json()
    assert details["status"] == "submitted"
    assert details["events"] == []
    assert (
        client.get(f"{BASE}/bookings/{first}", headers=headers(1)).json()["status"]
        == "approved"
    )


def test_setup_is_repeatable_and_preserves_records(client, database):
    from pathlib import Path

    sql = (
        Path(__file__).resolve().parents[1] / "sql/001_admin_workflow.sql"
    ).read_text()
    with psycopg2.connect(database) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            cur.execute(sql)
            cur.execute("SELECT COUNT(*) FROM users")
            assert cur.fetchone()[0] == 5


def test_operations_metrics_restricted_to_admin(client,headers):
    assert client.get(BASE+'/admin/operations',headers=headers(1)).status_code==403
    response=client.get(BASE+'/admin/operations',headers=headers(5))
    assert response.status_code==200,response.text
    assert response.json()['redis']=='connected'
    assert response.json()['requests_today']>=1
    assert response.json()['worker_running'] is False
