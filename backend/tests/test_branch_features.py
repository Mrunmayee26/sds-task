"""Regression checks for features brought in from the other GitHub branches."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
import psycopg2
import pytest

BASE = "/api/v1"


def save(client, headers, booking):
    response = client.post(BASE + "/bookings", headers=headers(1), json=booking)
    assert response.status_code == 201, response.text
    return response.json()


def decide(client, headers, booking_id, user):
    return client.patch(
        f"{BASE}/bookings/{booking_id}/status",
        headers=headers(user),
        json={"status": "approved"},
    )


def sql(database, statement, params=()):
    with psycopg2.connect(database) as conn:
        with conn.cursor() as cur:
            cur.execute(statement, params)


def campus_groups(database, venue_type="classroom"):
    sql(
        database,
        """INSERT INTO approval_groups(access_id,group_name,unit_id) VALUES
        (2,'Faculty Advisors Committee',1),(3,'Dean of Student Affairs Office',1);
        INSERT INTO group_members(access_id,user_id,member_role,can_approve) VALUES
        (2,4,'Faculty Advisor',TRUE),(2,3,'Faculty Advisor',TRUE),(3,5,'Dean',TRUE);""",
    )
    sql(database, "UPDATE venues SET venue_type=%s WHERE venue_id=1", (venue_type,))


def test_profile_editing_cannot_change_permissions(client, headers):
    assert client.get(BASE + "/auth/departments").json()[0]["unit_id"] == 1
    path = BASE + "/auth/profile"
    response = client.put(
        path,
        headers=headers(1),
        json={"full_name": "  New Applicant  ", "home_unit_id": 1},
    )
    assert response.status_code == 200, response.text
    assert response.json()["full_name"] == "New Applicant"
    assert response.json()["unit_name"] == "Test Administration"
    assert (
        client.get(BASE + "/auth/me", headers=headers(1)).json()["full_name"]
        == "New Applicant"
    )
    for payload in [
        {"full_name": "  "},
        {"full_name": "New Name", "home_unit_id": 999},
        {"full_name": "New Name", "user_type": "admin"},
        {"full_name": "New Name", "is_active": False},
    ]:
        assert client.put(path, headers=headers(1), json=payload).status_code == 422
    assert client.put(path, json={"full_name": "New Name"}).status_code == 401
    assert (
        client.get(BASE + "/auth/me", headers=headers(1)).json()["user_type"]
        == "applicant"
    )


def test_verified_reviewer_signup_needs_admin_permission(
    client, headers, database, monkeypatch
):
    from app.config import settings
    from app.repositories.user_repo import get_user_by_email

    codes = []

    async def send(email, code, name):
        codes.append(code)
        return True

    monkeypatch.setattr(settings, "SMTP_ENABLED", True)
    monkeypatch.setattr("app.api.v1.auth.send_otp_email", send)
    email = "new.reviewer@coep.ac.in"
    response = client.post(
        BASE + "/auth/register",
        json={
            "full_name": "New Reviewer",
            "email": email,
            "password": "TestPassword42",
            "role": "approver",
            "home_unit_id": 1,
            "designation": "Department reviewer",
        },
    )
    assert response.status_code == 200, response.text
    response = client.post(
        BASE + "/auth/verify-otp", json={"email": email, "otp": codes[0]}
    )
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "pending_admin_approval"
    assert not response.json()["access_token"]
    account = get_user_by_email(email)
    assert account["user_type"] == "applicant" and account["is_active"]
    login = {"email": email, "password": "TestPassword42", "role": "approver"}
    assert client.post(BASE + "/auth/login", json=login).status_code == 403
    requests = client.get(BASE + "/admin/approver-requests", headers=headers(5)).json()
    pending = next(r for r in requests if r["user_id"] == account["user_id"])
    assert (
        client.patch(
            f"{BASE}/admin/approver-requests/{pending['request_id']}",
            headers=headers(5),
            json={"status": "approved"},
        ).status_code
        == 200
    )
    assert client.post(BASE + "/auth/login", json=login).status_code == 200


@pytest.mark.parametrize("venue_type,stages", [("classroom", 2), ("seminar_hall", 3)])
def test_selected_advisor_and_sequential_campus_approvals(
    client, headers, booking, database, venue_type, stages
):
    campus_groups(database, venue_type)
    assert {
        r["user_id"]
        for r in client.get(BASE + "/auth/faculty-advisors", headers=headers(1)).json()
    } == {3, 4}
    assert (
        client.post(BASE + "/bookings", headers=headers(1), json=booking).status_code
        == 422
    )
    saved = save(client, headers, {**booking, "faculty_advisor_id": 4})
    booking_id = saved["application_id"]
    assert len(saved["approvals"]) == stages
    assert saved["faculty_advisor_name"] == "Second"
    sql(
        database,
        "UPDATE applications SET submitted_at=NOW()-INTERVAL '26 hours' WHERE application_id=%s",
        (booking_id,),
    )
    from worker import reminders

    reminders()
    assert (
        client.get(f"{BASE}/bookings/{booking_id}", headers=headers(3)).status_code
        == 403
    )
    assert client.get(BASE + "/bookings?scope=review", headers=headers(3)).json() == []
    assert decide(client, headers, booking_id, 3).status_code == 403
    assert decide(client, headers, booking_id, 2).status_code == 409
    assert decide(client, headers, booking_id, 4).json()["status"] == "submitted"
    saved = decide(client, headers, booking_id, 2).json()
    if stages == 3:
        assert saved["status"] == "submitted"
        saved = decide(client, headers, booking_id, 5).json()
    assert saved["status"] == "approved"
    # Only the chosen advisor is notified, including after reminders are generated.
    with psycopg2.connect(database) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM user_notifications WHERE user_id=3 AND application_id=%s",
                (booking_id,),
            )
            assert cur.fetchone()[0] == 0
            cur.execute(
                "SELECT COUNT(*) FROM user_notifications WHERE user_id=4 AND application_id=%s AND message LIKE 'Reminder:%%'",
                (booking_id,),
            )
            assert cur.fetchone()[0] == 1


def test_advisor_stage_keeps_all_member_and_additional_group_rules(
    client, headers, booking, database
):
    campus_groups(database)
    sql(
        database,
        """UPDATE approval_groups SET approval_mode='all' WHERE access_id=1;
        INSERT INTO venue_additional_approvals(venue_id,access_id,approval_step) VALUES(1,3,1);""",
    )
    saved = save(client, headers, {**booking, "faculty_advisor_id": 3})
    assert [a["required_approvals"] for a in saved["approvals"]] == [1, 2, 1]
    booking_id = saved["application_id"]
    assert decide(client, headers, booking_id, 3).json()["status"] == "submitted"
    assert decide(client, headers, booking_id, 2).json()["status"] == "submitted"
    assert decide(client, headers, booking_id, 5).status_code == 409
    assert decide(client, headers, booking_id, 4).json()["status"] == "submitted"
    assert decide(client, headers, booking_id, 5).json()["status"] == "approved"


def test_inactive_or_self_advisor_cannot_bypass_pipeline(
    client, headers, booking, database
):
    campus_groups(database)
    sql(
        database,
        "INSERT INTO group_members(access_id,user_id,member_role,can_approve) VALUES(2,1,'Faculty Advisor',TRUE)",
    )
    for advisor_id in (1, 2):
        assert (
            client.post(
                BASE + "/bookings",
                headers=headers(1),
                json={**booking, "faculty_advisor_id": advisor_id},
            ).status_code
            == 422
        )
    sql(database, "UPDATE group_members SET left_at=NOW() WHERE access_id=2")
    assert client.get(BASE + "/auth/faculty-advisors", headers=headers(1)).json() == []
    assert (
        client.post(
            BASE + "/bookings",
            headers=headers(1),
            json={**booking, "faculty_advisor_id": 4},
        ).status_code
        == 422
    )
    sql(database, "UPDATE approval_groups SET is_active=FALSE WHERE access_id=2")
    assert (
        client.post(BASE + "/bookings", headers=headers(1), json=booking).status_code
        == 409
    )


def test_revoke_reassign_keeps_old_votes_and_restarts_approval(
    client, headers, booking, database
):
    saved = save(client, headers, booking)
    booking_id = saved["application_id"]
    path = f"{BASE}/bookings/{booking_id}"
    assert decide(client, headers, booking_id, 2).json()["status"] == "approved"
    for user in (1, 3):
        assert (
            client.post(
                path + "/revoke",
                headers=headers(user),
                json={"remarks": "Venue needed"},
            ).status_code
            == 403
        )
    response = client.post(
        path + "/revoke", headers=headers(2), json={"remarks": "Maintenance required"}
    )
    assert response.status_code == 200, response.text
    revoked = response.json()
    assert revoked["status"] == "needs_reassignment"
    assert revoked["slots"][0]["slot_status"] == "cancelled"
    assert len(revoked["events"]) == 1
    assert revoked["workflow_events"][0]["details"] == "Maintenance required"
    reassignment = {k: booking[k] for k in ("venue_id", "start_time", "end_time")}
    assert (
        client.post(
            path + "/reassign", headers=headers(1), json=reassignment
        ).status_code
        == 422
    )
    for field in ("start_time", "end_time"):
        reassignment[field] = (
            datetime.fromisoformat(booking[field]) + timedelta(days=1)
        ).isoformat()
    assert (
        client.post(
            path + "/reassign", headers=headers(3), json=reassignment
        ).status_code
        == 403
    )
    response = client.post(path + "/reassign", headers=headers(1), json=reassignment)
    assert response.status_code == 200, response.text
    replacement = response.json()
    assert replacement["application_id"] != booking_id
    assert replacement["status"] == "submitted" and replacement["events"] == []
    assert replacement["description"].count("Expected attendance:") == 1
    assert replacement["approvals"][0]["approval_count"] == 0
    original = client.get(path, headers=headers(1)).json()
    assert original["status"] == "cancelled"
    assert len(original["events"]) == 1 and len(original["approvals"]) == 1
    assert original["workflow_events"][-1]["action"] == "reassign_booking"
    assert (
        client.post(
            path + "/reassign", headers=headers(1), json=reassignment
        ).status_code
        == 409
    )


def test_reassignment_cannot_bypass_capacity_or_blackouts(
    client, headers, booking, database
):
    saved = save(client, headers, booking)
    booking_id = saved["application_id"]
    path = f"{BASE}/bookings/{booking_id}"
    decide(client, headers, booking_id, 2)
    assert (
        client.post(
            path + "/revoke", headers=headers(2), json={"remarks": "Change needed"}
        ).status_code
        == 200
    )
    data = {k: booking[k] for k in ("venue_id", "start_time", "end_time")}
    for field in ("start_time", "end_time"):
        data[field] = (
            datetime.fromisoformat(data[field]) + timedelta(days=1)
        ).isoformat()
    sql(database, "UPDATE venues SET capacity=10 WHERE venue_id=1")
    assert (
        client.post(path + "/reassign", headers=headers(1), json=data).status_code
        == 422
    )
    sql(database, "UPDATE venues SET capacity=60 WHERE venue_id=1")
    blackout = client.post(
        BASE + "/admin/blackouts",
        headers=headers(5),
        json={**data, "reason": "Maintenance"},
    )
    assert blackout.status_code == 201, blackout.text
    assert (
        client.post(path + "/reassign", headers=headers(1), json=data).status_code
        == 409
    )
    assert client.get(path, headers=headers(1)).json()["status"] == "needs_reassignment"


def test_revocation_obeys_eight_hour_cutoff(client, headers, booking, database):
    saved = save(client, headers, booking)
    booking_id = saved["application_id"]
    decide(client, headers, booking_id, 2)
    sql(
        database,
        "UPDATE booking_slots SET start_time=NOW()+INTERVAL '7 hours',end_time=NOW()+INTERVAL '8 hours' WHERE application_id=%s",
        (booking_id,),
    )
    response = client.post(
        f"{BASE}/bookings/{booking_id}/revoke",
        headers=headers(2),
        json={"remarks": "Too late"},
    )
    assert response.status_code == 409, response.text
    assert (
        client.get(f"{BASE}/bookings/{booking_id}", headers=headers(1)).json()["status"]
        == "approved"
    )


def test_concurrent_reassignments_create_only_one_replacement(client, headers, booking):
    saved = save(client, headers, booking)
    booking_id = saved["application_id"]
    path = f"{BASE}/bookings/{booking_id}"
    decide(client, headers, booking_id, 2)
    client.post(path + "/revoke", headers=headers(2), json={"remarks": "Change needed"})
    data = {k: booking[k] for k in ("venue_id", "start_time", "end_time")}
    for field in ("start_time", "end_time"):
        data[field] = (
            datetime.fromisoformat(data[field]) + timedelta(days=1)
        ).isoformat()

    def reassign(_):
        return client.post(
            path + "/reassign", headers=headers(1), json=data
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = list(pool.map(reassign, range(2)))
    assert sorted(codes) == [200, 409]
