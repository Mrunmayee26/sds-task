"""Booking rules and SQL, kept together so each write uses one transaction."""
from datetime import datetime, timezone
from fastapi import HTTPException
from app.db.session import get_db_cursor
from app.repositories.venue_repo import lock_venue, has_conflict

# Membership is checked in the database, including people who have left a group.
MEMBER_CHECK = """
    SELECT 1 FROM group_members gm
    JOIN approval_groups ag ON ag.access_id = gm.access_id
    WHERE gm.access_id = aa.access_id AND gm.user_id = %s
      AND gm.can_approve AND gm.left_at IS NULL AND ag.is_active
"""


def read_booking(cur, booking_id):
    cur.execute("""
        SELECT a.*, v.venue_name, u.full_name AS applicant_name
        FROM applications a JOIN venues v ON v.venue_id = a.venue_id
        JOIN users u ON u.user_id = a.applicant_user_id
        WHERE a.application_id = %s
    """, (booking_id,))
    booking = cur.fetchone()
    if not booking:
        raise HTTPException(404, "Booking not found")
    cur.execute("SELECT * FROM booking_slots WHERE application_id = %s ORDER BY start_time", (booking_id,))
    booking["slots"] = cur.fetchall()
    cur.execute("""
        SELECT aa.*, ag.group_name FROM application_approvals aa
        JOIN approval_groups ag ON ag.access_id = aa.access_id
        WHERE aa.application_id = %s ORDER BY aa.approval_step, aa.approval_id
    """, (booking_id,))
    booking["approvals"] = cur.fetchall()
    cur.execute("""
        SELECT e.* FROM approval_events e
        JOIN application_approvals aa ON aa.approval_id = e.approval_id
        WHERE aa.application_id = %s ORDER BY e.event_id
    """, (booking_id,))
    booking["events"] = cur.fetchall()
    return booking


def can_review(cur, booking_id, user_id):
    cur.execute("SELECT 1 FROM application_approvals aa WHERE aa.application_id = %s AND EXISTS ("
                + MEMBER_CHECK + ")", (booking_id, user_id))
    return cur.fetchone() is not None


def get_booking(booking_id, user_id):
    with get_db_cursor(commit=False) as cur:
        booking = read_booking(cur, booking_id)
        if booking["applicant_user_id"] != user_id and not can_review(cur, booking_id, user_id):
            raise HTTPException(403, "You cannot view this booking")
        return booking


def list_bookings(user_id, scope, status, limit, offset):
    with get_db_cursor(commit=False) as cur:
        condition = "a.applicant_user_id = %s"
        if scope == "review":
            condition = "EXISTS (SELECT 1 FROM application_approvals aa WHERE aa.application_id = a.application_id AND EXISTS (" + MEMBER_CHECK + "))"
        cur.execute("""
            SELECT a.*, v.venue_name,
                (SELECT MIN(start_time) FROM booking_slots s WHERE s.application_id = a.application_id) AS start_time,
                (SELECT MAX(end_time) FROM booking_slots s WHERE s.application_id = a.application_id) AS end_time
            FROM applications a JOIN venues v ON v.venue_id = a.venue_id
            WHERE """ + condition + """ AND (%s IS NULL OR a.status = %s)
            ORDER BY a.created_at DESC, a.application_id DESC LIMIT %s OFFSET %s
        """, (user_id, status, status, limit, offset))
        return cur.fetchall()


def create_booking(data, user_id):
    with get_db_cursor() as cur:
        venue = lock_venue(cur, data.venue_id)
        if not venue["is_active"]:
            raise HTTPException(409, "Venue is inactive")
        if venue["capacity"] is not None and data.expected_attendance > venue["capacity"]:
            raise HTTPException(422, "Expected attendance exceeds venue capacity")
        if has_conflict(cur, data.venue_id, data.start_time, data.end_time):
            raise HTTPException(409, "Venue is already reserved for this time")

        # Primary approval is first. Additional groups follow their configured order.
        cur.execute("""
            SELECT ag.*, 0 AS approval_step FROM approval_groups ag WHERE access_id = %s
            UNION ALL
            SELECT ag.*, va.approval_step FROM venue_additional_approvals va
            JOIN approval_groups ag ON ag.access_id = va.access_id
            WHERE va.venue_id = %s AND va.access_id <> %s
            ORDER BY approval_step, access_id
        """, (venue["access_id"], data.venue_id, venue["access_id"]))
        groups = cur.fetchall()
        if not groups or any(not g["is_active"] for g in groups):
            raise HTTPException(409, "Venue approval groups are not active")
        thresholds = []
        for group in groups:
            cur.execute("""
                SELECT COUNT(*) AS total FROM group_members gm JOIN users u ON u.user_id = gm.user_id
                WHERE gm.access_id = %s AND gm.can_approve AND gm.left_at IS NULL AND u.is_active
                  AND gm.user_id <> %s
            """, (group["access_id"], user_id))
            count = cur.fetchone()["total"]
            required = count if group["approval_mode"] == "all" else group["minimum_approvals"]
            if required < 1 or count < required:
                raise HTTPException(409, "Venue has insufficient assigned approvers; contact the administrator")
            thresholds.append(required)

        cur.execute("""
            INSERT INTO applications (applicant_user_id, venue_id, target_access_id,
                application_type, purpose, description, expected_attendance, status, submitted_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'submitted', NOW()) RETURNING application_id
        """, (user_id, data.venue_id, venue["access_id"], data.application_type,
              data.purpose, data.description, data.expected_attendance))
        booking_id = cur.fetchone()["application_id"]
        cur.execute("""
            INSERT INTO booking_slots (application_id, venue_id, start_time, end_time, slot_status)
            VALUES (%s, %s, %s, %s, 'pending')
        """, (booking_id, data.venue_id, data.start_time, data.end_time))
        for group, required in zip(groups, thresholds):
            cur.execute("""
                INSERT INTO application_approvals (application_id, access_id, approval_step, required_approvals)
                VALUES (%s, %s, %s, %s)
            """, (booking_id, group["access_id"], group["approval_step"] + 1, required))
        return read_booking(cur, booking_id)


def lock_booking(cur, booking_id):
    cur.execute("SELECT venue_id FROM applications WHERE application_id = %s", (booking_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Booking not found")
    venue = lock_venue(cur, row["venue_id"])
    cur.execute("SELECT * FROM applications WHERE application_id = %s FOR UPDATE", (booking_id,))
    return cur.fetchone(), venue


def cancel_booking(booking_id, user_id, reason):
    with get_db_cursor() as cur:
        booking, venue = lock_booking(cur, booking_id)
        if booking["applicant_user_id"] != user_id:
            raise HTTPException(403, "Only the applicant can cancel this booking")
        if booking["status"] not in ("submitted", "approved"):
            raise HTTPException(409, "Only submitted or approved bookings can be cancelled")
        cur.execute("SELECT 1 FROM booking_slots WHERE application_id = %s AND start_time <= NOW()", (booking_id,))
        if cur.fetchone():
            raise HTTPException(409, "A booking that has started cannot be cancelled")
        cur.execute("UPDATE applications SET status = 'cancelled', cancellation_reason = %s WHERE application_id = %s", (reason, booking_id))
        release_slots(cur, booking_id)
        return read_booking(cur, booking_id)


def release_slots(cur, booking_id):
    cur.execute("""UPDATE booking_slots SET slot_status = 'cancelled', cancelled_at = NOW()
                   WHERE application_id = %s""", (booking_id,))


def decide_booking(booking_id, user_id, data):
    with get_db_cursor() as cur:
        booking, venue = lock_booking(cur, booking_id)
        if booking["applicant_user_id"] == user_id:
            raise HTTPException(403, "You cannot review your own booking")
        if not can_review(cur, booking_id, user_id):
            raise HTTPException(403, "You are not an assigned approver")
        if booking["status"] != "submitted":
            raise HTTPException(409, "Only submitted bookings can be reviewed")
        cur.execute("SELECT * FROM booking_slots WHERE application_id = %s", (booking_id,))
        slots = cur.fetchall()
        if not venue["is_active"] or any(s["start_time"] <= datetime.now(timezone.utc) for s in slots):
            raise HTTPException(409, "Venue is inactive or booking has already started")
        cur.execute("""
            SELECT * FROM application_approvals WHERE application_id = %s AND status = 'pending'
            ORDER BY approval_step, approval_id
        """, (booking_id,))
        pending = cur.fetchall()
        if not pending:
            raise HTTPException(409, "No pending approval steps")
        # Groups at the same step can act in either order; later steps must wait.
        current_step = pending[0]["approval_step"]
        selected = None
        for approval in pending:
            if approval["approval_step"] != current_step:
                break
            cur.execute("SELECT 1 FROM application_approvals aa WHERE aa.approval_id = %s AND EXISTS (" + MEMBER_CHECK + ")",
                        (approval["approval_id"], user_id))
            if cur.fetchone():
                cur.execute("SELECT 1 FROM approval_events WHERE approval_id = %s AND actor_user_id = %s",
                            (approval["approval_id"], user_id))
                if not cur.fetchone():
                    selected = approval
                    break
        if selected is None:
            raise HTTPException(409, "Wait for your approval step, or you have already voted")
        approved = data.status == "approved"
        if approved and any(has_conflict(cur, venue["venue_id"], s["start_time"], s["end_time"], booking_id) for s in slots):
            raise HTTPException(409, "Venue is already reserved for this time")
        count = selected["approval_count"] + int(approved)
        step_status = "rejected" if not approved else ("approved" if count >= selected["required_approvals"] else "pending")
        cur.execute("""
            INSERT INTO approval_events (approval_id, access_id, actor_user_id, decision, remarks)
            VALUES (%s, %s, %s, %s, %s)
        """, (selected["approval_id"], selected["access_id"], user_id, approved, data.remarks))
        cur.execute("""
            UPDATE application_approvals SET approval_count = %s, status = %s,
                last_action_by_user_id = %s, last_action_at = NOW(), remarks = %s WHERE approval_id = %s
        """, (count, step_status, user_id, data.remarks, selected["approval_id"]))
        if not approved:
            cur.execute("UPDATE applications SET status = 'rejected' WHERE application_id = %s", (booking_id,))
            release_slots(cur, booking_id)
        else:
            cur.execute("SELECT 1 FROM application_approvals WHERE application_id = %s AND status <> 'approved'", (booking_id,))
            if not cur.fetchone():
                cur.execute("UPDATE applications SET status = 'approved' WHERE application_id = %s", (booking_id,))
                cur.execute("UPDATE booking_slots SET slot_status = 'confirmed', confirmed_at = NOW() WHERE application_id = %s", (booking_id,))
        return read_booking(cur, booking_id)
