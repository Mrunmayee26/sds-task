"""Booking rules and SQL, kept together so each write uses one transaction."""

from datetime import datetime, timezone, timedelta
from contextlib import nullcontext
import re
from app.config import settings
from fastapi import HTTPException
from app.db.session import get_db_cursor
from app.repositories.venue_repo import lock_venue, has_conflict
from app.repositories.venue_repo import is_blocked, confirmed_conflict
from app.core.policies import check_cancellation_deadline, validate_booking_window
from app.repositories.approval_pipeline import groups_for_booking

# Membership is checked in the database, including people who have left a group.
MEMBER_CHECK = """
    SELECT 1 FROM group_members gm
    JOIN approval_groups ag ON ag.access_id = gm.access_id
    WHERE gm.access_id = aa.access_id AND gm.user_id = %s
      AND gm.can_approve AND gm.left_at IS NULL AND ag.is_active
      AND (ag.group_name<>'Faculty Advisors Committee' OR (SELECT faculty_advisor_id FROM applications WHERE application_id=aa.application_id) IS NULL
        OR gm.user_id=(SELECT faculty_advisor_id FROM applications WHERE application_id=aa.application_id))
"""


def read_booking(cur, booking_id):
    cur.execute(
        """
        SELECT a.*, v.venue_name,v.venue_type,u.full_name AS applicant_name,fa.full_name AS faculty_advisor_name
        FROM applications a JOIN venues v ON v.venue_id = a.venue_id
        JOIN users u ON u.user_id = a.applicant_user_id
        LEFT JOIN users fa ON fa.user_id=a.faculty_advisor_id
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
    starts = [slot["start_time"] for slot in booking["slots"]]
    booking["cancellation_deadline"] = (
        min(starts) - timedelta(hours=settings.CANCELLATION_HOURS) if starts else None
    )
    booking["can_cancel"] = bool(
        starts
        and booking["status"] in ("submitted", "approved", "needs_reassignment")
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
    cur.execute(
        """SELECT DISTINCT s.application_id,s.start_time,s.end_time FROM booking_slots mine
        JOIN booking_slots s ON s.venue_id=mine.venue_id AND s.application_id<>mine.application_id
        WHERE mine.application_id=%s AND mine.slot_status<>'cancelled' AND s.slot_status='confirmed'
        AND s.start_time<mine.end_time AND s.end_time>mine.start_time""",
        (booking_id,),
    )
    booking["conflicts"] = cur.fetchall()
    cur.execute(
        """SELECT e.*,u.full_name AS actor_name FROM admin_events e JOIN users u ON u.user_id=e.actor_user_id
        WHERE e.target_id=%s AND e.action IN ('revoke_booking','reassign_booking','cancel_booking') ORDER BY e.event_id""",
        (booking_id,),
    )
    booking["workflow_events"] = cur.fetchall()
    return booking


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
        cur.execute(
            """
            SELECT a.*, v.venue_name, u.full_name AS applicant_name,
                (SELECT MIN(start_time) FROM booking_slots s WHERE s.application_id = a.application_id) AS start_time,
                (SELECT MAX(end_time) FROM booking_slots s WHERE s.application_id = a.application_id) AS end_time
            FROM applications a JOIN venues v ON v.venue_id = a.venue_id
            JOIN users u ON u.user_id = a.applicant_user_id
            WHERE """
            + condition
            + """ AND (%s IS NULL OR a.status = %s)
            AND (a.purpose ILIKE %s OR v.venue_name ILIKE %s OR u.full_name ILIKE %s)
            AND (%s::timestamptz IS NULL OR EXISTS(SELECT 1 FROM booking_slots s WHERE s.application_id=a.application_id AND s.start_time<%s AND s.end_time>%s))
            ORDER BY a.created_at DESC, a.application_id DESC LIMIT %s OFFSET %s
        """,
            (
                user_id,
                status,
                status,
                f"%{search}%",
                f"%{search}%",
                f"%{search}%",
                start,
                end,
                start,
                limit,
                offset,
            ),
        )
        return cur.fetchall()


def create_booking(data, user_id, cursor=None):
    validate_booking_window(data.start_time, data.end_time)
    with nullcontext(cursor) if cursor is not None else get_db_cursor() as cur:
        venue = lock_venue(cur, data.venue_id)
        if not venue["is_active"]:
            raise HTTPException(409, "Venue is inactive")
        if (
            venue["capacity"] is not None
            and data.expected_attendance > venue["capacity"]
        ):
            raise HTTPException(422, "Expected attendance exceeds venue capacity")
        if is_blocked(cur, data.venue_id, data.start_time, data.end_time):
            raise HTTPException(
                409, "The administrator has marked this venue unavailable."
            )

        groups = groups_for_booking(cur, venue, user_id, data.faculty_advisor_id)
        if not groups or any(not g["is_active"] for g in groups):
            raise HTTPException(409, "Venue approval groups are not active")
        thresholds = []
        for group in groups:
            cur.execute(
                """
                SELECT COUNT(*) AS total FROM group_members gm JOIN users u ON u.user_id = gm.user_id
                WHERE gm.access_id = %s AND gm.can_approve AND gm.left_at IS NULL AND u.is_active
                  AND gm.user_id <> %s
            """,
                (group["access_id"], user_id),
            )
            count = cur.fetchone()["total"]
            required = (
                count
                if group["approval_mode"].lower() == "all"
                else group["minimum_approvals"]
            )
            if group.get("selected_advisor"):
                required = 1
            if required < 1 or count < required:
                raise HTTPException(
                    409,
                    "Venue has insufficient assigned approvers; contact the administrator",
                )
            thresholds.append(required)

        cur.execute(
            """
            INSERT INTO applications (applicant_user_id, venue_id, target_access_id,
                application_type, purpose, description, status, submitted_at,faculty_advisor_id)
            VALUES (%s, %s, %s, %s, %s, %s, 'submitted', NOW(),%s) RETURNING application_id
        """,
            (
                user_id,
                data.venue_id,
                venue["access_id"],
                data.application_type,
                data.purpose,
                f"Expected attendance: {data.expected_attendance}\n\n{data.description}",
                data.faculty_advisor_id,
            ),
        )
        booking_id = cur.fetchone()["application_id"]
        cur.execute(
            """
            INSERT INTO booking_slots (application_id, venue_id, start_time, end_time, slot_status)
            VALUES (%s, %s, %s, %s, 'pending')
        """,
            (booking_id, data.venue_id, data.start_time, data.end_time),
        )
        for group, required in zip(groups, thresholds):
            cur.execute(
                """
                INSERT INTO application_approvals (application_id, access_id, approval_step, required_approvals)
                VALUES (%s, %s, %s, %s)
            """,
                (booking_id, group["access_id"], group["approval_step"] + 1, required),
            )
        notify(cur, user_id, f"Booking #{booking_id} submitted.", booking_id)
        cur.execute(
            """INSERT INTO user_notifications(user_id,message,application_id)
            SELECT DISTINCT gm.user_id,%s,%s FROM group_members gm JOIN users u USING(user_id)
            WHERE gm.access_id=ANY(%s) AND gm.can_approve AND gm.left_at IS NULL AND u.is_active AND gm.user_id<>%s
            AND NOT EXISTS(SELECT 1 FROM approval_groups ag JOIN applications a ON a.application_id=%s
                WHERE ag.access_id=gm.access_id AND ag.group_name='Faculty Advisors Committee'
                AND a.faculty_advisor_id IS NOT NULL AND a.faculty_advisor_id<>gm.user_id)""",
            (
                f"New booking #{booking_id} needs review.",
                booking_id,
                [g["access_id"] for g in groups],
                user_id,
                booking_id,
            ),
        )
        return read_booking(cur, booking_id)


def lock_booking(cur, booking_id):
    cur.execute(
        "SELECT venue_id FROM applications WHERE application_id = %s", (booking_id,)
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Booking not found")
    venue = lock_venue(cur, row["venue_id"])
    cur.execute(
        "SELECT * FROM applications WHERE application_id = %s FOR UPDATE", (booking_id,)
    )
    return cur.fetchone(), venue


def cancel_booking(booking_id, user_id, admin=False):
    with get_db_cursor() as cur:
        booking, venue = lock_booking(cur, booking_id)
        if (
            booking["applicant_user_id"] != user_id
            and not admin
            and not can_review(cur, booking_id, user_id)
        ):
            raise HTTPException(
                403,
                "Only the applicant or an assigned reviewer can cancel this booking",
            )
        if booking["status"] not in ("submitted", "approved", "needs_reassignment"):
            raise HTTPException(
                409, "Only submitted or approved bookings can be cancelled"
            )
        cur.execute(
            "SELECT MIN(start_time) AS start FROM booking_slots WHERE application_id=%s",
            (booking_id,),
        )
        check_cancellation_deadline(cur.fetchone()["start"])
        cur.execute(
            "UPDATE applications SET status = 'cancelled' WHERE application_id = %s",
            (booking_id,),
        )
        release_slots(cur, booking_id)
        notify(
            cur,
            booking["applicant_user_id"],
            f"Booking #{booking_id} cancelled.",
            booking_id,
        )
        from app.repositories.admin_repo import audit

        audit(cur, user_id, "cancel_booking", booking_id)
        return read_booking(cur, booking_id)


def release_slots(cur, booking_id):
    cur.execute(
        """UPDATE booking_slots SET slot_status = 'cancelled', cancelled_at = NOW()
                   WHERE application_id = %s""",
        (booking_id,),
    )


def decide_booking(booking_id, user_id, data):
    with get_db_cursor() as cur:
        booking, venue = lock_booking(cur, booking_id)
        if booking["applicant_user_id"] == user_id:
            raise HTTPException(403, "You cannot review your own booking")
        if not can_review(cur, booking_id, user_id):
            raise HTTPException(403, "You are not an assigned approver")
        if booking["status"] != "submitted":
            raise HTTPException(409, "Only submitted bookings can be reviewed")
        cur.execute(
            "SELECT * FROM booking_slots WHERE application_id = %s", (booking_id,)
        )
        slots = cur.fetchall()
        if not venue["is_active"] or any(
            s["start_time"] <= datetime.now(timezone.utc) for s in slots
        ):
            raise HTTPException(409, "Venue is inactive or booking has already started")
        cur.execute(
            """
            SELECT * FROM application_approvals WHERE application_id = %s AND status = 'pending'
            ORDER BY approval_step, approval_id
        """,
            (booking_id,),
        )
        pending = cur.fetchall()
        if not pending:
            raise HTTPException(409, "No pending approval steps")
        # Groups at the same step can act in either order; later steps must wait.
        current_step = pending[0]["approval_step"]
        selected = None
        for approval in pending:
            if approval["approval_step"] != current_step:
                break
            cur.execute(
                "SELECT 1 FROM application_approvals aa WHERE aa.approval_id = %s AND EXISTS ("
                + MEMBER_CHECK
                + ")",
                (approval["approval_id"], user_id),
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
        if approved and any(
            is_blocked(cur, venue["venue_id"], s["start_time"], s["end_time"])
            for s in slots
        ):
            raise HTTPException(409, "Venue is blocked by the administrator.")
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
                # Competing requests are allowed, but only one may be confirmed.
                for slot in slots:
                    cur.execute(
                        """SELECT DISTINCT a.application_id,a.applicant_user_id,s.start_time
                        FROM applications a JOIN booking_slots s USING(application_id)
                        WHERE s.venue_id=%s AND s.slot_status='confirmed' AND s.start_time<%s AND s.end_time>%s
                        AND a.application_id<>%s""",
                        (
                            venue["venue_id"],
                            slot["end_time"],
                            slot["start_time"],
                            booking_id,
                        ),
                    )
                    conflicts = cur.fetchall()
                    if conflicts and not data.replace_conflicts:
                        raise HTTPException(
                            409,
                            "Another booking is approved. Explicitly choose replacement to give this request priority.",
                        )
                    for conflict in conflicts:
                        if not can_review(cur, conflict["application_id"], user_id):
                            raise HTTPException(
                                403,
                                "You cannot replace a booking outside your approval groups.",
                            )
                        check_cancellation_deadline(conflict["start_time"])
                        cur.execute(
                            "UPDATE applications SET status='cancelled' WHERE application_id=%s",
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
                    "UPDATE booking_slots SET slot_status = 'confirmed', confirmed_at = NOW() WHERE application_id = %s",
                    (booking_id,),
                )
                notify(
                    cur,
                    booking["applicant_user_id"],
                    f"Booking #{booking_id} approved. {data.remarks}",
                    booking_id,
                )
        return read_booking(cur, booking_id)


def notify(cur, user_id, message, booking_id):
    cur.execute(
        "INSERT INTO user_notifications(user_id,message,application_id) VALUES(%s,%s,%s)",
        (user_id, message, booking_id),
    )


def revoke_booking(booking_id, user_id, data):
    from app.repositories.admin_repo import audit

    with get_db_cursor() as cur:
        booking, venue = lock_booking(cur, booking_id)
        if booking["applicant_user_id"] == user_id or not can_review(
            cur, booking_id, user_id
        ):
            raise HTTPException(
                403, "Only an assigned reviewer can revoke another applicant's booking."
            )
        if booking["status"] != "approved":
            raise HTTPException(409, "Only approved bookings can be revoked.")
        cur.execute(
            "SELECT MIN(start_time) AS start FROM booking_slots WHERE application_id=%s",
            (booking_id,),
        )
        check_cancellation_deadline(cur.fetchone()["start"])
        release_slots(cur, booking_id)
        cur.execute(
            "UPDATE applications SET status='needs_reassignment' WHERE application_id=%s",
            (booking_id,),
        )
        audit(cur, user_id, "revoke_booking", booking_id, data.remarks)
        notify(
            cur,
            booking["applicant_user_id"],
            f"Booking #{booking_id} revoked; choose a new venue or time. {data.remarks}",
            booking_id,
        )
        return read_booking(cur, booking_id)


def reassign_booking(booking_id, user_id, data):
    from app.models.booking import BookingCreate
    from app.repositories.admin_repo import audit

    with get_db_cursor() as cur:
        # Lock both venues in a stable order before application rows. This avoids
        # a deadlock when two applicants swap venues at the same moment.
        cur.execute(
            "SELECT venue_id FROM applications WHERE application_id=%s", (booking_id,)
        )
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(404, "Booking not found")
        for venue_id in sorted({existing["venue_id"], data.venue_id}):
            lock_venue(cur, venue_id)
        booking, venue = lock_booking(cur, booking_id)
        if booking["applicant_user_id"] != user_id:
            raise HTTPException(403, "Only the applicant can reassign this request.")
        if booking["status"] != "needs_reassignment":
            raise HTTPException(409, "This booking does not require reassignment.")
        cur.execute(
            "SELECT * FROM booking_slots WHERE application_id=%s ORDER BY slot_id DESC LIMIT 1",
            (booking_id,),
        )
        old_slot = cur.fetchone()
        if (
            old_slot
            and data.venue_id == old_slot["venue_id"]
            and data.start_time == old_slot["start_time"]
            and data.end_time == old_slot["end_time"]
        ):
            raise HTTPException(
                422, "Change the venue or the event timing to reassign this request."
            )
        description = booking.get("description") or ""
        attendance = re.match(r"Expected attendance: (\d+)\s*", description)
        count = data.expected_attendance or (int(attendance[1]) if attendance else None)
        if count is None:
            raise HTTPException(422, "Provide expected attendance for this request.")
        if attendance:
            description = description[attendance.end() :]
        replacement = BookingCreate(
            venue_id=data.venue_id,
            purpose=booking["purpose"],
            description=f"{description}\n\nReassigned from #{booking_id}. {data.remarks}",
            application_type=booking["application_type"],
            expected_attendance=count,
            faculty_advisor_id=booking.get("faculty_advisor_id"),
            start_time=data.start_time,
            end_time=data.end_time,
        )
        saved = create_booking(replacement, user_id, cursor=cur)
        cur.execute(
            "UPDATE applications SET status='cancelled' WHERE application_id=%s",
            (booking_id,),
        )
        audit(
            cur,
            user_id,
            "reassign_booking",
            booking_id,
            f"Replacement request #{saved['application_id']}. {data.remarks}",
        )
        notify(
            cur,
            user_id,
            f"Booking #{booking_id} replaced by new request #{saved['application_id']}; approval restarts.",
            booking_id,
        )
        saved["reassigned_from"] = booking_id
        return saved
