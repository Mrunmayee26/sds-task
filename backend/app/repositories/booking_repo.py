"""Booking rules and SQL, kept together so each write uses one transaction."""

from datetime import datetime, timezone, timedelta
from app.config import settings
from fastapi import HTTPException
from app.db.session import get_db_cursor
from app.repositories.venue_repo import (
    lock_venue,
    has_conflict,
    is_blocked,
    confirmed_conflict,
    has_confirmed_conflict,
    get_conflicting_booking,
)
from app.core.policies import check_cancellation_deadline, validate_booking_window

TWO_LEVEL_TYPES = {
    "classroom",
    "lab",
    "computer_lab",
    "drawing_hall",
    "workshop",
}

# Membership is checked in the database, including people who have left a group.
MEMBER_CHECK = """
    SELECT 1 FROM group_members gm
    JOIN approval_groups ag ON ag.access_id = gm.access_id
    WHERE gm.access_id = aa.access_id AND gm.user_id = %s
      AND gm.can_approve AND gm.left_at IS NULL AND ag.is_active
"""


def notify(cur, user_id, message, booking_id):
    cur.execute(
        "INSERT INTO user_notifications(user_id,message,application_id) VALUES(%s,%s,%s)",
        (user_id, message, booking_id),
    )


def enforce_guardrail(cur, booking_id: int, action: str = "Cancellation"):
    """1-Day Revoke Guardrail: Blocks cancellations/revocations <= 24 hours before the event."""
    cur.execute(
        """
        SELECT MIN(start_time) AS earliest_start FROM booking_slots
        WHERE application_id = %s AND slot_status != 'cancelled'
    """,
        (booking_id,),
    )
    row = cur.fetchone()
    if row and row["earliest_start"]:
        if row["earliest_start"] - datetime.now(timezone.utc) <= timedelta(days=1):
            raise HTTPException(
                409,
                f"{action} is blocked 1 day or less before the event (1-day guardrail)",
            )


def find_confirmed_conflict(
    cur, venue_id: int, start_time, end_time, exclude_id: int = 0
):
    """Find any conflicting confirmed booking slot for the venue and time window."""
    cur.execute(
        """
        SELECT s.application_id, a.purpose, u.full_name AS applicant_name
        FROM booking_slots s
        JOIN applications a ON a.application_id = s.application_id
        LEFT JOIN users u ON u.user_id = a.applicant_user_id
        WHERE s.venue_id = %s AND s.slot_status = 'confirmed'
          AND s.start_time < %s AND s.end_time > %s AND s.application_id <> %s
        LIMIT 1
    """,
        (venue_id, end_time, start_time, exclude_id),
    )
    return cur.fetchone()


def release_slots(cur, booking_id: int):
    """Cancel all active booking slots for an application."""
    cur.execute(
        """
        UPDATE booking_slots SET slot_status = 'cancelled', cancelled_at = NOW()
        WHERE application_id = %s
    """,
        (booking_id,),
    )


def build_approval_pipeline(
    cur, venue: dict, user_id: int, selected_faculty_advisor_id: int | None = None
):
    """
    Constructs the multi-level approval pipeline:
    - Level 1: Faculty Advisor (chosen by applicant)
    - Level 2: Department HOD / Managing Committee (venue['access_id'])
    - Level 3: University Dean (for large spaces / venues not in TWO_LEVEL_TYPES)
    """
    cur.execute(
        "SELECT * FROM approval_groups WHERE group_name = 'Faculty Advisors Committee' AND is_active"
    )
    advisor_group = cur.fetchone()

    cur.execute(
        "SELECT * FROM approval_groups WHERE group_name = 'Dean of Student Affairs Office' AND is_active"
    )
    dean_group = cur.fetchone()

    steps = []
    advisor_id = selected_faculty_advisor_id

    if advisor_group:
        # Level 1: Faculty Advisor
        if advisor_id is not None:
            cur.execute(
                """
                SELECT 1 FROM group_members gm
                JOIN users u ON u.user_id = gm.user_id
                WHERE gm.access_id = %s AND gm.user_id = %s
                  AND gm.can_approve AND gm.left_at IS NULL AND u.is_active
            """,
                (advisor_group["access_id"], advisor_id),
            )
            if not cur.fetchone():
                raise HTTPException(
                    422, "Selected Faculty Advisor is invalid or inactive"
                )
        else:
            cur.execute(
                """
                SELECT gm.user_id FROM group_members gm
                JOIN users u ON u.user_id = gm.user_id
                WHERE gm.access_id = %s AND gm.can_approve AND gm.left_at IS NULL AND u.is_active
                ORDER BY gm.user_id LIMIT 1
            """,
                (advisor_group["access_id"],),
            )
            row = cur.fetchone()
            advisor_id = row["user_id"] if row else None

        steps.append(
            {"access_id": advisor_group["access_id"], "step": 1, "required": 1}
        )

        # Level 2: Department HOD
        cur.execute(
            """
            SELECT COUNT(*) AS total FROM group_members gm JOIN users u ON u.user_id = gm.user_id
            WHERE gm.access_id = %s AND gm.can_approve AND gm.left_at IS NULL AND u.is_active
              AND gm.user_id <> %s
        """,
            (venue["access_id"], user_id),
        )
        if cur.fetchone()["total"] < 1:
            raise HTTPException(
                409,
                "Venue has insufficient assigned approvers; contact the administrator",
            )
        steps.append({"access_id": venue["access_id"], "step": 2, "required": 1})

        # Level 3: University Dean (for seminar halls and large venues)
        if venue.get("venue_type") not in TWO_LEVEL_TYPES and dean_group:
            cur.execute(
                """
                SELECT COUNT(*) AS total FROM group_members gm JOIN users u ON u.user_id = gm.user_id
                WHERE gm.access_id = %s AND gm.can_approve AND gm.left_at IS NULL AND u.is_active
                  AND gm.user_id <> %s
            """,
                (dean_group["access_id"], user_id),
            )
            if cur.fetchone()["total"] >= 1:
                steps.append(
                    {"access_id": dean_group["access_id"], "step": 3, "required": 1}
                )
    else:
        # Single-level fallback if specialized groups don't exist
        steps.append({"access_id": venue["access_id"], "step": 1, "required": 1})

    return steps, advisor_id


def insert_approval_pipeline(cur, application_id: int, pipeline: list):
    for step_item in pipeline:
        cur.execute(
            """
            INSERT INTO application_approvals (application_id, access_id, approval_step, required_approvals, status)
            VALUES (%s, %s, %s, %s, 'pending')
        """,
            (
                application_id,
                step_item["access_id"],
                step_item["step"],
                step_item["required"],
            ),
        )


def reset_approval_pipeline(cur, application_id: int, pipeline: list):
    """Purge previous approval stages and events, and insert clean pipeline stages."""
    cur.execute(
        """
        DELETE FROM approval_events WHERE approval_id IN (
            SELECT approval_id FROM application_approvals WHERE application_id = %s
        )
    """,
        (application_id,),
    )
    cur.execute(
        "DELETE FROM application_approvals WHERE application_id = %s",
        (application_id,),
    )
    insert_approval_pipeline(cur, application_id, pipeline)


def read_booking(cur, booking_id):
    cur.execute(
        """
        SELECT a.*, v.venue_name, u.full_name AS applicant_name, u.email AS applicant_email
        FROM applications a JOIN venues v ON v.venue_id = a.venue_id
        JOIN users u ON u.user_id = a.applicant_user_id
        WHERE a.application_id = %s
    """,
        (booking_id,),
    )
    booking = cur.fetchone()
    if not booking:
        raise HTTPException(404, "Booking not found")
    cur.execute(
        "SELECT * FROM booking_slots WHERE application_id = %s ORDER BY start_time",
        (booking_id,),
    )
    booking["slots"] = cur.fetchall()
    active_starts = [
        slot["start_time"]
        for slot in booking["slots"]
        if slot.get("slot_status") != "cancelled"
    ]
    starts = (
        active_starts
        if active_starts
        else [slot["start_time"] for slot in booking["slots"]]
    )
    booking["cancellation_deadline"] = (
        min(starts) - timedelta(hours=settings.CANCELLATION_HOURS) if starts else None
    )
    booking["can_cancel"] = bool(
        starts
        and booking["status"] in ("submitted", "approved")
        and datetime.now(timezone.utc) <= booking["cancellation_deadline"]
    )
    cur.execute(
        """
        SELECT aa.*, ag.group_name FROM application_approvals aa
        JOIN approval_groups ag ON ag.access_id = aa.access_id
        WHERE aa.application_id = %s ORDER BY aa.approval_step, aa.approval_id
    """,
        (booking_id,),
    )
    booking["approvals"] = cur.fetchall()
    cur.execute(
        """
        SELECT e.* FROM approval_events e
        JOIN application_approvals aa ON aa.approval_id = e.approval_id
        WHERE aa.application_id = %s ORDER BY e.event_id
    """,
        (booking_id,),
    )
    booking["events"] = cur.fetchall()
    return booking


def lock_booking(cur, booking_id: int):
    cur.execute(
        "SELECT * FROM applications WHERE application_id = %s FOR UPDATE",
        (booking_id,),
    )
    booking = cur.fetchone()
    if not booking:
        raise HTTPException(404, "Booking not found")
    venue = lock_venue(cur, booking["venue_id"])
    return booking, venue


def can_review(cur, booking_id, user_id):
    cur.execute(
        "SELECT 1 FROM application_approvals aa WHERE aa.application_id = %s AND EXISTS ("
        + MEMBER_CHECK
        + ")",
        (booking_id, user_id),
    )
    return cur.fetchone() is not None


def get_booking(booking_id, user_id, admin=False):
    with get_db_cursor(commit=False) as cur:
        booking = read_booking(cur, booking_id)
        if (
            not admin
            and booking["applicant_user_id"] != user_id
            and not can_review(cur, booking_id, user_id)
        ):
            raise HTTPException(403, "You cannot view this booking")
        return booking


def list_bookings(
    user_id, scope, status, limit, offset, search="", start=None, end=None
):
    with get_db_cursor(commit=False) as cur:
        condition = "a.applicant_user_id = %s"
        if scope == "review":
            condition = (
                "EXISTS (SELECT 1 FROM application_approvals aa WHERE aa.application_id = a.application_id AND EXISTS ("
                + MEMBER_CHECK
                + "))"
            )
        params = [user_id]
        if status:
            condition += " AND a.status = %s"
            params.append(status)
        if search:
            condition += " AND (a.purpose ILIKE %s OR v.venue_name ILIKE %s OR u.full_name ILIKE %s)"
            params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
        if start:
            condition += " AND EXISTS (SELECT 1 FROM booking_slots s WHERE s.application_id = a.application_id AND s.end_time > %s AND s.start_time < %s)"
            params.extend([start, end])

        cur.execute(
            """
            SELECT a.*, v.venue_name, u.full_name AS applicant_name,
                COALESCE(
                    (SELECT MIN(start_time) FROM booking_slots s WHERE s.application_id = a.application_id AND s.slot_status != 'cancelled'),
                    (SELECT MIN(start_time) FROM booking_slots s WHERE s.application_id = a.application_id)
                ) AS start_time,
                COALESCE(
                    (SELECT MAX(end_time) FROM booking_slots s WHERE s.application_id = a.application_id AND s.slot_status != 'cancelled'),
                    (SELECT MAX(end_time) FROM booking_slots s WHERE s.application_id = a.application_id)
                ) AS end_time
            FROM applications a
            JOIN venues v ON v.venue_id = a.venue_id
            JOIN users u ON u.user_id = a.applicant_user_id
            WHERE """
            + condition
            + " ORDER BY a.created_at DESC LIMIT %s OFFSET %s",
            (*params, limit, offset),
        )
        return cur.fetchall()


def create_booking(data, user_id: int):
    with get_db_cursor(commit=True) as cur:
        validate_booking_window(data.start_time, data.end_time)
        venue = lock_venue(cur, data.venue_id)
        if is_blocked(cur, data.venue_id, data.start_time, data.end_time):
            raise HTTPException(409, "Venue is blacked out for this time window")

        steps, assigned_advisor_id = build_approval_pipeline(
            cur, venue, user_id, getattr(data, "faculty_advisor_id", None)
        )

        cur.execute(
            """
            INSERT INTO applications (
                applicant_user_id, venue_id, purpose, description,
                application_type, expected_attendance, status, faculty_advisor_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'submitted', %s)
            RETURNING application_id
        """,
            (
                user_id,
                venue["venue_id"],
                data.purpose,
                data.description,
                data.application_type,
                data.expected_attendance,
                assigned_advisor_id,
            ),
        )
        booking_id = cur.fetchone()["application_id"]

        cur.execute(
            """
            INSERT INTO booking_slots (application_id, venue_id, start_time, end_time, slot_status)
            VALUES (%s, %s, %s, %s, 'pending')
        """,
            (booking_id, venue["venue_id"], data.start_time, data.end_time),
        )

        insert_approval_pipeline(cur, booking_id, steps)
        notify(
            cur,
            user_id,
            f"Booking #{booking_id} submitted for review",
            booking_id,
        )
        return read_booking(cur, booking_id)


def cancel_booking(booking_id: int, user_id: int, admin: bool = False):
    with get_db_cursor(commit=True) as cur:
        booking = read_booking(cur, booking_id)
        if not admin and booking["applicant_user_id"] != user_id:
            raise HTTPException(403, "You cannot cancel another user's booking")
        if not admin:
            enforce_guardrail(cur, booking_id, action="Cancellation")
            for slot in booking["slots"]:
                if slot.get("slot_status") != "cancelled":
                    check_cancellation_deadline(slot["start_time"])
        cur.execute(
            "UPDATE applications SET status = 'cancelled' WHERE application_id = %s",
            (booking_id,),
        )
        release_slots(cur, booking_id)
        notify(
            cur,
            booking["applicant_user_id"],
            f"Booking #{booking_id} cancelled",
            booking_id,
        )
        if admin:
            from app.repositories.admin_repo import audit

            audit(
                cur,
                user_id,
                "admin_cancel",
                booking_id,
                "Cancelled by administrator",
            )
        return read_booking(cur, booking_id)


def decide_booking(booking_id: int, user_id: int, data):
    """
    Records an approver vote for the current pending approval stage.
    If approving final stage, verifies no conflicting confirmed booking exists
    or handles conflict replacement if requested.
    """
    with get_db_cursor(commit=True) as cur:
        booking, venue = lock_booking(cur, booking_id)
        if booking["applicant_user_id"] == user_id:
            raise HTTPException(403, "You cannot review your own booking")
        if not can_review(cur, booking_id, user_id):
            raise HTTPException(403, "You are not an assigned approver")
        if booking["status"] != "submitted":
            raise HTTPException(409, "Only submitted bookings can be reviewed")

        cur.execute(
            "SELECT * FROM booking_slots WHERE application_id = %s AND slot_status != 'cancelled'",
            (booking_id,),
        )
        slots = cur.fetchall()
        if not venue["is_active"] or any(
            s["start_time"] <= datetime.now(timezone.utc) for s in slots
        ):
            raise HTTPException(409, "Venue is inactive or booking has already started")

        cur.execute(
            """
            SELECT aa.*, ag.group_name FROM application_approvals aa
            JOIN approval_groups ag ON ag.access_id = aa.access_id
            WHERE aa.application_id = %s AND aa.status = 'pending'
            ORDER BY aa.approval_step, aa.approval_id
        """,
            (booking_id,),
        )
        pending = cur.fetchall()
        if not pending:
            raise HTTPException(409, "No pending approval steps")

        current_step = pending[0]["approval_step"]
        selected = None
        for approval in pending:
            if approval["approval_step"] != current_step:
                break
            if (
                approval["group_name"] == "Faculty Advisors Committee"
                and booking.get("faculty_advisor_id")
            ):
                if booking["faculty_advisor_id"] != user_id:
                    continue
            cur.execute(
                """
                SELECT 1 FROM group_members gm
                JOIN approval_groups ag ON ag.access_id = gm.access_id
                WHERE gm.access_id = %s AND gm.user_id = %s
                  AND gm.can_approve AND gm.left_at IS NULL AND ag.is_active
            """,
                (approval["access_id"], user_id),
            )
            if cur.fetchone():
                cur.execute(
                    "SELECT 1 FROM approval_events WHERE approval_id = %s AND actor_user_id = %s",
                    (approval["approval_id"], user_id),
                )
                if not cur.fetchone():
                    selected = approval
                    break

        if selected is None:
            raise HTTPException(
                409, "Wait for your approval step, or you have already voted"
            )

        approved = data.status == "approved"
        count = selected["approval_count"] + int(approved)
        step_status = (
            "rejected"
            if not approved
            else ("approved" if count >= selected["required_approvals"] else "pending")
        )

        cur.execute(
            """
            INSERT INTO approval_events (approval_id, access_id, actor_user_id, decision, remarks)
            VALUES (%s, %s, %s, %s, %s)
        """,
            (
                selected["approval_id"],
                selected["access_id"],
                user_id,
                approved,
                data.remarks,
            ),
        )

        cur.execute(
            """
            UPDATE application_approvals SET approval_count = %s, status = %s,
                last_action_by_user_id = %s, last_action_at = NOW(), remarks = %s WHERE approval_id = %s
        """,
            (count, step_status, user_id, data.remarks, selected["approval_id"]),
        )

        if not approved:
            cur.execute(
                "UPDATE applications SET status = 'rejected' WHERE application_id = %s",
                (booking_id,),
            )
            release_slots(cur, booking_id)
            notify(
                cur,
                booking["applicant_user_id"],
                f"Booking #{booking_id} rejected. {data.remarks}",
                booking_id,
            )
        else:
            cur.execute(
                "SELECT 1 FROM application_approvals WHERE application_id = %s AND status <> 'approved'",
                (booking_id,),
            )
            if not cur.fetchone():
                # Competing requests: only one confirmed booking in this time window
                for slot in slots:
                    cur.execute(
                        """
                        SELECT DISTINCT a.application_id, a.applicant_user_id, s.start_time, a.purpose
                        FROM applications a JOIN booking_slots s USING(application_id)
                        WHERE s.venue_id = %s AND s.slot_status = 'confirmed'
                          AND s.start_time < %s AND s.end_time > %s
                          AND a.application_id <> %s
                    """,
                        (
                            venue["venue_id"],
                            slot["end_time"],
                            slot["start_time"],
                            booking_id,
                        ),
                    )
                    conflicts = cur.fetchall()
                    replace_conflicts = getattr(data, "replace_conflicts", False)
                    if conflicts and not replace_conflicts:
                        raise HTTPException(
                            409,
                            f"Venue is already reserved by confirmed Booking #{conflicts[0]['application_id']} ('{conflicts[0].get('purpose', '')}'). "
                            "If this event is higher priority, revoke that booking first to trigger its reassignment, or explicitly choose replacement.",
                        )
                    for conflict in conflicts:
                        if not can_review(cur, conflict["application_id"], user_id):
                            raise HTTPException(
                                403,
                                "You cannot replace a booking outside your approval groups.",
                            )
                        check_cancellation_deadline(conflict["start_time"])
                        cur.execute(
                            "UPDATE applications SET status = 'cancelled' WHERE application_id = %s",
                            (conflict["application_id"],),
                        )
                        release_slots(cur, conflict["application_id"])
                        notify(
                            cur,
                            conflict["applicant_user_id"],
                            f"Booking #{conflict['application_id']} cancelled by reviewer priority decision. {data.remarks}",
                            conflict["application_id"],
                        )
                        from app.repositories.admin_repo import audit

                        audit(
                            cur,
                            user_id,
                            "replace_booking",
                            conflict["application_id"],
                            f"Replaced by #{booking_id}",
                        )

                cur.execute(
                    "UPDATE applications SET status = 'approved' WHERE application_id = %s",
                    (booking_id,),
                )
                cur.execute(
                    "UPDATE booking_slots SET slot_status = 'confirmed', confirmed_at = NOW() WHERE application_id = %s AND slot_status != 'cancelled'",
                    (booking_id,),
                )
                notify(
                    cur,
                    booking["applicant_user_id"],
                    f"Booking #{booking_id} approved. {data.remarks}",
                    booking_id,
                )
        return read_booking(cur, booking_id)


def revoke_booking(booking_id: int, user_id: int, data):
    """
    Approver Revocation:
    Enforces 1-Day Revoke Guardrail.
    Transitions status to 'needs_reassignment' and forces dynamic reassignment of venue/time.
    """
    with get_db_cursor(commit=True) as cur:
        booking, venue = lock_booking(cur, booking_id)
        if not can_review(cur, booking_id, user_id):
            raise HTTPException(
                403, "You are not an authorized approver for this booking"
            )
        if booking["status"] != "approved":
            raise HTTPException(409, "Only approved bookings can be revoked")

        enforce_guardrail(cur, booking_id, action="Revocation")

        cur.execute(
            "UPDATE applications SET status = 'needs_reassignment' WHERE application_id = %s",
            (booking_id,),
        )
        release_slots(cur, booking_id)

        cur.execute(
            """
            SELECT approval_id, access_id FROM application_approvals
            WHERE application_id = %s
            ORDER BY approval_step DESC LIMIT 1
        """,
            (booking_id,),
        )
        last_step = cur.fetchone()
        if last_step:
            cur.execute(
                """
                INSERT INTO approval_events (approval_id, access_id, actor_user_id, decision, remarks)
                VALUES (%s, %s, %s, false, %s)
            """,
                (
                    last_step["approval_id"],
                    last_step["access_id"],
                    user_id,
                    f"[REVOKED]: {data.remarks}",
                ),
            )

        notify(
            cur,
            booking["applicant_user_id"],
            f"Booking #{booking_id} was revoked by an approver: {data.remarks}. Dynamic reassignment is required.",
            booking_id,
        )
        return read_booking(cur, booking_id)


def reassign_booking(booking_id: int, user_id: int, data):
    """
    Dynamic Reassignment:
    Allows user (or approver) to update venue/timing for a booking in 'needs_reassignment'.
    Re-initiates the multi-level approval pipeline.
    """
    with get_db_cursor(commit=True) as cur:
        booking, _ = lock_booking(cur, booking_id)
        is_owner = booking["applicant_user_id"] == user_id
        is_approver = can_review(cur, booking_id, user_id)
        if not (is_owner or is_approver):
            raise HTTPException(403, "You cannot reassign this booking")
        if booking["status"] != "needs_reassignment":
            raise HTTPException(
                409, "Only bookings needing reassignment can be reassigned"
            )

        validate_booking_window(data.start_time, data.end_time)
        new_venue = lock_venue(cur, data.venue_id)
        if is_blocked(cur, data.venue_id, data.start_time, data.end_time):
            raise HTTPException(409, "Target venue is blacked out for this time window")

        steps, assigned_advisor_id = build_approval_pipeline(
            cur,
            new_venue,
            booking["applicant_user_id"],
            booking.get("faculty_advisor_id"),
        )

        cur.execute(
            """
            INSERT INTO booking_slots (application_id, venue_id, start_time, end_time, slot_status)
            VALUES (%s, %s, %s, %s, 'pending')
        """,
            (booking_id, new_venue["venue_id"], data.start_time, data.end_time),
        )

        reset_approval_pipeline(cur, booking_id, steps)

        cur.execute(
            """
            UPDATE applications
            SET venue_id = %s, status = 'submitted', updated_at = NOW(),
                faculty_advisor_id = %s,
                description = description || %s
            WHERE application_id = %s
        """,
            (
                new_venue["venue_id"],
                assigned_advisor_id,
                f"\n\n[Reassignment note]: {data.remarks}" if data.remarks else "",
                booking_id,
            ),
        )

        notify(
            cur,
            booking["applicant_user_id"],
            f"Booking #{booking_id} reassigned to {new_venue['venue_name']} and resubmitted for review.",
            booking_id,
        )
        return read_booking(cur, booking_id)
