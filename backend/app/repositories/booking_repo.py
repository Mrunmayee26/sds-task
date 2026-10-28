"""Booking rules and SQL, kept together so each write uses one transaction."""
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from app.db.session import get_db_cursor
from app.repositories.venue_repo import lock_venue, has_confirmed_conflict, get_conflicting_booking

TWO_LEVEL_TYPES = {
    "classroom",
    "lab",
    "computer_lab",
    "drawing_hall",
    "workshop",
}


# ------------------------------------------------------------------------------
# Helpers: Guardrails & Conflicts
# ------------------------------------------------------------------------------

def enforce_guardrail(cur, booking_id: int, action: str = "Cancellation"):
    """1-Day Revoke Guardrail: Blocks cancellations/revocations <= 24 hours before the event."""
    cur.execute("""
        SELECT MIN(start_time) AS earliest_start FROM booking_slots
        WHERE application_id = %s AND slot_status != 'cancelled'
    """, (booking_id,))
    row = cur.fetchone()
    if row and row["earliest_start"]:
        if row["earliest_start"] - datetime.now(timezone.utc) <= timedelta(days=1):
            raise HTTPException(409, f"{action} is blocked 1 day or less before the event (1-day guardrail)")


def find_confirmed_conflict(cur, venue_id: int, start_time, end_time, exclude_id: int = 0):
    """Find any conflicting confirmed booking slot for the venue and time window."""
    cur.execute("""
        SELECT s.application_id, a.purpose, u.full_name AS applicant_name
        FROM booking_slots s
        JOIN applications a ON a.application_id = s.application_id
        LEFT JOIN users u ON u.user_id = a.applicant_user_id
        WHERE s.venue_id = %s AND s.slot_status = 'confirmed'
          AND s.start_time < %s AND s.end_time > %s AND s.application_id <> %s
        LIMIT 1
    """, (venue_id, end_time, start_time, exclude_id))
    return cur.fetchone()


def release_slots(cur, booking_id: int):
    """Cancel all active booking slots for an application."""
    cur.execute("""
        UPDATE booking_slots SET slot_status = 'cancelled', cancelled_at = NOW()
        WHERE application_id = %s
    """, (booking_id,))


# ------------------------------------------------------------------------------
# Helpers: Approval Pipeline Construction & Maintenance
# ------------------------------------------------------------------------------

def build_approval_pipeline(cur, venue: dict, user_id: int, selected_faculty_advisor_id: int | None = None):
    """
    Constructs the multi-level approval pipeline:
    - Level 1: Faculty Advisor (chosen by applicant)
    - Level 2: Department HOD / Managing Committee (venue['access_id'])
    - Level 3: University Dean (for large spaces / venues not in TWO_LEVEL_TYPES)
    """
    cur.execute("SELECT * FROM approval_groups WHERE group_name = 'Faculty Advisors Committee' AND is_active")
    advisor_group = cur.fetchone()

    cur.execute("SELECT * FROM approval_groups WHERE group_name = 'Dean of Student Affairs Office' AND is_active")
    dean_group = cur.fetchone()

    steps = []
    advisor_id = selected_faculty_advisor_id

    if advisor_group:
        # Level 1: Faculty Advisor
        if advisor_id is not None:
            cur.execute("""
                SELECT 1 FROM group_members gm
                JOIN users u ON u.user_id = gm.user_id
                WHERE gm.access_id = %s AND gm.user_id = %s
                  AND gm.can_approve AND gm.left_at IS NULL AND u.is_active
            """, (advisor_group["access_id"], advisor_id))
            if not cur.fetchone():
                raise HTTPException(422, "Selected Faculty Advisor is invalid or inactive")
        else:
            cur.execute("""
                SELECT gm.user_id FROM group_members gm
                JOIN users u ON u.user_id = gm.user_id
                WHERE gm.access_id = %s AND gm.can_approve AND gm.left_at IS NULL AND u.is_active
                ORDER BY gm.user_id LIMIT 1
            """, (advisor_group["access_id"],))
            row = cur.fetchone()
            advisor_id = row["user_id"] if row else None

        steps.append({"access_id": advisor_group["access_id"], "step": 1, "required": 1})

        # Level 2: Department HOD
        cur.execute("""
            SELECT COUNT(*) AS total FROM group_members gm JOIN users u ON u.user_id = gm.user_id
            WHERE gm.access_id = %s AND gm.can_approve AND gm.left_at IS NULL AND u.is_active
              AND gm.user_id <> %s
        """, (venue["access_id"], user_id))
        if cur.fetchone()["total"] < 1:
            raise HTTPException(409, "Venue has insufficient assigned approvers; contact the administrator")
        steps.append({"access_id": venue["access_id"], "step": 2, "required": 1})

        # Level 3: University Dean (for seminar halls and large venues)
        if venue.get("venue_type") not in TWO_LEVEL_TYPES and dean_group:
            cur.execute("""
                SELECT COUNT(*) AS total FROM group_members gm JOIN users u ON u.user_id = gm.user_id
                WHERE gm.access_id = %s AND gm.can_approve AND gm.left_at IS NULL AND u.is_active
                  AND gm.user_id <> %s
            """, (dean_group["access_id"], user_id))
            if cur.fetchone()["total"] < 1:
                raise HTTPException(409, "Dean's office has insufficient assigned approvers; contact the administrator")
            steps.append({"access_id": dean_group["access_id"], "step": 3, "required": 1})
    else:
        # Fallback for minimal test environments without seed groups
        cur.execute("""
            SELECT ag.*, 0 AS approval_step FROM approval_groups ag WHERE access_id = %s
            UNION ALL
            SELECT ag.*, va.approval_step FROM venue_additional_approvals va
            JOIN approval_groups ag ON ag.access_id = va.access_id
            WHERE va.venue_id = %s AND va.access_id <> %s
            ORDER BY approval_step, access_id
        """, (venue["access_id"], venue["venue_id"], venue["access_id"]))
        groups = cur.fetchall()
        for g in groups:
            steps.append({
                "access_id": g["access_id"],
                "step": g["approval_step"] + 1,
                "required": g["minimum_approvals"] if g["approval_mode"] != "all" else 1,
            })
        advisor_id = None

    return steps, advisor_id


def reset_pipeline_for_reassignment(cur, booking_id: int, pipeline_steps: list):
    """Deletes previous approvals cleanly and recreates the fresh pipeline for the reassigned venue."""
    cur.execute("""
        DELETE FROM approval_events
        WHERE approval_id IN (SELECT approval_id FROM application_approvals WHERE application_id = %s)
    """, (booking_id,))
    cur.execute("DELETE FROM application_approvals WHERE application_id = %s", (booking_id,))
    for step in pipeline_steps:
        cur.execute("""
            INSERT INTO application_approvals (application_id, access_id, approval_step, required_approvals)
            VALUES (%s, %s, %s, %s)
        """, (booking_id, step["access_id"], step["step"], step["required"]))


# ------------------------------------------------------------------------------
# Booking Read & Query Operations
# ------------------------------------------------------------------------------

def read_booking(cur, booking_id: int):
    cur.execute("""
        SELECT a.*, v.venue_name, v.venue_type, u.full_name AS applicant_name, u.email AS applicant_email,
               fa.full_name AS faculty_advisor_name, fa.email AS faculty_advisor_email
        FROM applications a
        JOIN venues v ON v.venue_id = a.venue_id
        JOIN users u ON u.user_id = a.applicant_user_id
        LEFT JOIN users fa ON fa.user_id = a.faculty_advisor_id
        WHERE a.application_id = %s
    """, (booking_id,))
    booking = cur.fetchone()
    if not booking:
        raise HTTPException(404, "Booking not found")

    cur.execute("SELECT * FROM booking_slots WHERE application_id = %s ORDER BY slot_id, start_time", (booking_id,))
    booking["slots"] = cur.fetchall()

    cur.execute("""
        SELECT aa.*, ag.group_name FROM application_approvals aa
        JOIN approval_groups ag ON ag.access_id = aa.access_id
        WHERE aa.application_id = %s ORDER BY aa.approval_step, aa.approval_id
    """, (booking_id,))
    booking["approvals"] = cur.fetchall()

    cur.execute("""
        SELECT e.*, u.full_name AS actor_name, ag.group_name FROM approval_events e
        LEFT JOIN approval_groups ag ON ag.access_id = e.access_id
        LEFT JOIN users u ON u.user_id = e.actor_user_id
        LEFT JOIN application_approvals aa ON aa.approval_id = e.approval_id
        WHERE aa.application_id = %s
        ORDER BY e.event_id
    """, (booking_id,))
    booking["events"] = cur.fetchall()

    # Identify any overlapping confirmed bookings (for approver priority reviews)
    cur.execute("""
        SELECT s.application_id, a.purpose, u.full_name AS applicant_name,
               s.start_time, s.end_time
        FROM booking_slots bs
        JOIN booking_slots s ON s.venue_id = bs.venue_id AND s.application_id <> bs.application_id
        JOIN applications a ON a.application_id = s.application_id
        LEFT JOIN users u ON u.user_id = a.applicant_user_id
        WHERE bs.application_id = %s AND bs.slot_status != 'cancelled'
          AND s.slot_status = 'confirmed'
          AND s.start_time < bs.end_time AND s.end_time > bs.start_time
        ORDER BY s.start_time
    """, (booking_id,))
    booking["conflicts"] = cur.fetchall()

    return booking


def can_review(cur, booking_id: int, user_id: int):
    cur.execute("""
        SELECT 1 FROM application_approvals aa
        JOIN approval_groups ag ON ag.access_id = aa.access_id
        JOIN group_members gm ON gm.access_id = aa.access_id
        JOIN applications a ON a.application_id = aa.application_id
        WHERE aa.application_id = %s AND gm.user_id = %s
          AND gm.can_approve AND gm.left_at IS NULL AND ag.is_active
          AND (ag.group_name != 'Faculty Advisors Committee' OR a.faculty_advisor_id IS NULL OR a.faculty_advisor_id = %s)
    """, (booking_id, user_id, user_id))
    return cur.fetchone() is not None


def get_booking(booking_id: int, user_id: int):
    with get_db_cursor(commit=False) as cur:
        booking = read_booking(cur, booking_id)
        if booking["applicant_user_id"] != user_id and not can_review(cur, booking_id, user_id):
            raise HTTPException(403, "You cannot view this booking")
        return booking


def list_bookings(user_id: int, scope: str, status: str | None, limit: int, offset: int):
    with get_db_cursor(commit=False) as cur:
        if scope == "review":
            condition = """
                EXISTS (
                    SELECT 1 FROM application_approvals aa
                    JOIN approval_groups ag ON ag.access_id = aa.access_id
                    JOIN group_members gm ON gm.access_id = aa.access_id
                    WHERE aa.application_id = a.application_id
                      AND gm.user_id = %s AND gm.can_approve AND gm.left_at IS NULL AND ag.is_active
                      AND (ag.group_name != 'Faculty Advisors Committee' OR a.faculty_advisor_id IS NULL OR a.faculty_advisor_id = %s)
                )
            """
            params = [user_id, user_id]
        else:
            condition = "a.applicant_user_id = %s"
            params = [user_id]

        status_condition = ""
        if status:
            status_condition = "AND a.status = %s"
            params.append(status)

        cur.execute(f"""
            SELECT a.*, v.venue_name, v.venue_type, u.full_name AS applicant_name, u.email AS applicant_email,
                fa.full_name AS faculty_advisor_name,
                (SELECT MIN(start_time) FROM booking_slots s WHERE s.application_id = a.application_id AND s.slot_status != 'cancelled') AS start_time,
                (SELECT MAX(end_time) FROM booking_slots s WHERE s.application_id = a.application_id AND s.slot_status != 'cancelled') AS end_time
            FROM applications a
            JOIN venues v ON v.venue_id = a.venue_id
            JOIN users u ON u.user_id = a.applicant_user_id
            LEFT JOIN users fa ON fa.user_id = a.faculty_advisor_id
            WHERE {condition} {status_condition}
            ORDER BY a.created_at DESC, a.application_id DESC LIMIT %s OFFSET %s
        """, (*params, limit, offset))
        return cur.fetchall()


def lock_booking(cur, booking_id: int):
    cur.execute("SELECT venue_id FROM applications WHERE application_id = %s", (booking_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Booking not found")
    venue = lock_venue(cur, row["venue_id"])
    cur.execute("SELECT * FROM applications WHERE application_id = %s FOR UPDATE", (booking_id,))
    return cur.fetchone(), venue


# ------------------------------------------------------------------------------
# Booking Lifecycle Writes
# ------------------------------------------------------------------------------

def create_booking(data, user_id: int):
    """
    Submits a new booking request.
    Note: Applicants can submit even if the venue already has an existing booking;
    approvers review conflicting requests and may revoke/reassign the lower-priority booking.
    """
    with get_db_cursor() as cur:
        venue = lock_venue(cur, data.venue_id)
        if not venue["is_active"]:
            raise HTTPException(409, "Venue is inactive")
        if venue["capacity"] is not None and data.expected_attendance > venue["capacity"]:
            raise HTTPException(422, "Expected attendance exceeds venue capacity")

        pipeline_steps, advisor_id = build_approval_pipeline(cur, venue, user_id, data.faculty_advisor_id)

        cur.execute("""
            INSERT INTO applications (applicant_user_id, venue_id, target_access_id,
                application_type, purpose, description, status, submitted_at, faculty_advisor_id)
            VALUES (%s, %s, %s, %s, %s, %s, 'submitted', NOW(), %s) RETURNING application_id
        """, (user_id, data.venue_id, venue["access_id"], data.application_type,
              data.purpose, f"Expected attendance: {data.expected_attendance}\n\n{data.description}",
              advisor_id))
        booking_id = cur.fetchone()["application_id"]

        cur.execute("""
            INSERT INTO booking_slots (application_id, venue_id, start_time, end_time, slot_status)
            VALUES (%s, %s, %s, %s, 'pending')
        """, (booking_id, data.venue_id, data.start_time, data.end_time))

        for step in pipeline_steps:
            cur.execute("""
                INSERT INTO application_approvals (application_id, access_id, approval_step, required_approvals)
                VALUES (%s, %s, %s, %s)
            """, (booking_id, step["access_id"], step["step"], step["required"]))

        return read_booking(cur, booking_id)


def cancel_booking(booking_id: int, user_id: int):
    """Cancels a booking request by the applicant (protected by 1-day guardrail)."""
    with get_db_cursor() as cur:
        booking, venue = lock_booking(cur, booking_id)
        if booking["applicant_user_id"] != user_id:
            raise HTTPException(403, "Only the applicant can cancel this booking")
        if booking["status"] not in ("submitted", "approved", "needs_reassignment"):
            raise HTTPException(409, "Only submitted, approved, or reassignment-pending bookings can be cancelled")

        enforce_guardrail(cur, booking_id, "Cancellation")

        cur.execute("UPDATE applications SET status = 'cancelled' WHERE application_id = %s", (booking_id,))
        release_slots(cur, booking_id)
        return read_booking(cur, booking_id)


def revoke_booking(booking_id: int, user_id: int, data):
    """
    Approver revokes an approved booking:
    - 1-Day Guardrail: blocked if <= 24 hours before event.
    - Releases slot and sets status to 'needs_reassignment'.
    - Logs approver revocation remarks in audit trail.
    """
    with get_db_cursor() as cur:
        booking, venue = lock_booking(cur, booking_id)
        if booking["applicant_user_id"] == user_id:
            raise HTTPException(403, "You cannot revoke your own booking; use cancel instead")
        if not can_review(cur, booking_id, user_id):
            raise HTTPException(403, "You are not an authorized approver for this booking")
        if booking["status"] != "approved":
            raise HTTPException(409, "Only approved bookings can be revoked by an approver")

        enforce_guardrail(cur, booking_id, "Revocation")

        release_slots(cur, booking_id)
        cur.execute("UPDATE applications SET status = 'needs_reassignment' WHERE application_id = %s", (booking_id,))

        cur.execute("""
            SELECT aa.approval_id, aa.access_id FROM application_approvals aa
            JOIN group_members gm ON gm.access_id = aa.access_id
            WHERE aa.application_id = %s AND gm.user_id = %s AND gm.can_approve AND gm.left_at IS NULL
            LIMIT 1
        """, (booking_id, user_id))
        appr = cur.fetchone()
        appr_id = appr["approval_id"] if appr else None
        access_id = appr["access_id"] if appr else venue["access_id"]

        cur.execute("""
            INSERT INTO approval_events (approval_id, access_id, actor_user_id, decision, remarks)
            VALUES (%s, %s, %s, FALSE, %s)
        """, (appr_id, access_id, user_id, f"REVOKED BY APPROVER: {data.remarks}"))

        return read_booking(cur, booking_id)


def reassign_booking(booking_id: int, user_id: int, data):
    """
    Dynamic Reassignment:
    - Enforces that applicant changes either venue or event timing.
    - Transitions status back to 'submitted' and restarts approval pipeline.
    """
    with get_db_cursor() as cur:
        booking, current_venue = lock_booking(cur, booking_id)
        if booking["applicant_user_id"] != user_id:
            raise HTTPException(403, "Only the applicant can reassign this booking")
        if booking["status"] != "needs_reassignment":
            raise HTTPException(409, "Only bookings requiring reassignment can be reassigned")

        cur.execute("""
            SELECT venue_id, start_time, end_time FROM booking_slots
            WHERE application_id = %s ORDER BY slot_id DESC LIMIT 1
        """, (booking_id,))
        prev_slot = cur.fetchone()

        venue_changed = (data.venue_id != booking["venue_id"])
        timing_changed = not prev_slot or (data.start_time != prev_slot["start_time"] or data.end_time != prev_slot["end_time"])

        if not venue_changed and not timing_changed:
            raise HTTPException(422, "Dynamic reassignment requires changing either the venue or the event timing")

        new_venue = lock_venue(cur, data.venue_id)
        if not new_venue["is_active"]:
            raise HTTPException(409, "Selected venue is inactive")

        pipeline_steps, advisor_id = build_approval_pipeline(cur, new_venue, user_id, booking.get("faculty_advisor_id"))

        # Clear previous slots before updating venue_id to satisfy composite FK (application_id, venue_id)
        cur.execute("DELETE FROM booking_slots WHERE application_id = %s", (booking_id,))

        cur.execute("""
            UPDATE applications
            SET venue_id = %s, target_access_id = %s, status = 'submitted', submitted_at = NOW()
            WHERE application_id = %s
        """, (data.venue_id, new_venue["access_id"], booking_id))

        cur.execute("""
            INSERT INTO booking_slots (application_id, venue_id, start_time, end_time, slot_status)
            VALUES (%s, %s, %s, %s, 'pending')
        """, (booking_id, data.venue_id, data.start_time, data.end_time))

        reset_pipeline_for_reassignment(cur, booking_id, pipeline_steps)

        if data.remarks:
            cur.execute("""
                UPDATE applications
                SET description = description || %s
                WHERE application_id = %s
            """, (f"\n\n[Reassignment note]: {data.remarks}", booking_id))

        return read_booking(cur, booking_id)


def decide_booking(booking_id: int, user_id: int, data):
    """
    Records an approver vote for the current pending approval stage.
    If approving final stage, verifies no conflicting confirmed booking exists.
    """
    with get_db_cursor() as cur:
        booking, venue = lock_booking(cur, booking_id)
        if booking["applicant_user_id"] == user_id:
            raise HTTPException(403, "You cannot review your own booking")
        if not can_review(cur, booking_id, user_id):
            raise HTTPException(403, "You are not an assigned approver")
        if booking["status"] != "submitted":
            raise HTTPException(409, "Only submitted bookings can be reviewed")

        cur.execute("SELECT * FROM booking_slots WHERE application_id = %s AND slot_status != 'cancelled'", (booking_id,))
        slots = cur.fetchall()
        if not venue["is_active"] or any(s["start_time"] <= datetime.now(timezone.utc) for s in slots):
            raise HTTPException(409, "Venue is inactive or booking has already started")

        cur.execute("""
            SELECT aa.*, ag.group_name FROM application_approvals aa
            JOIN approval_groups ag ON ag.access_id = aa.access_id
            WHERE aa.application_id = %s AND aa.status = 'pending'
            ORDER BY aa.approval_step, aa.approval_id
        """, (booking_id,))
        pending = cur.fetchall()
        if not pending:
            raise HTTPException(409, "No pending approval steps")

        current_step = pending[0]["approval_step"]
        selected = None
        for approval in pending:
            if approval["approval_step"] != current_step:
                break
            if approval["group_name"] == "Faculty Advisors Committee" and booking.get("faculty_advisor_id"):
                if booking["faculty_advisor_id"] != user_id:
                    continue
            cur.execute("""
                SELECT 1 FROM group_members gm
                JOIN approval_groups ag ON ag.access_id = gm.access_id
                WHERE gm.access_id = %s AND gm.user_id = %s
                  AND gm.can_approve AND gm.left_at IS NULL AND ag.is_active
            """, (approval["access_id"], user_id))
            if cur.fetchone():
                cur.execute("SELECT 1 FROM approval_events WHERE approval_id = %s AND actor_user_id = %s",
                            (approval["approval_id"], user_id))
                if not cur.fetchone():
                    selected = approval
                    break

        if selected is None:
            raise HTTPException(409, "Wait for your approval step, or you have already voted")

        approved = data.status == "approved"
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
                # Final approval: Ensure no conflicting confirmed booking occupies this window
                for s in slots:
                    conflict = find_confirmed_conflict(cur, venue["venue_id"], s["start_time"], s["end_time"], booking_id)
                    if conflict:
                        raise HTTPException(
                            409,
                            f"Venue is already reserved by confirmed Booking #{conflict['application_id']} ('{conflict['purpose']}'). "
                            "If this event is higher priority, revoke that booking first to trigger its reassignment, then approve this request."
                        )
                cur.execute("UPDATE applications SET status = 'approved' WHERE application_id = %s", (booking_id,))
                cur.execute("UPDATE booking_slots SET slot_status = 'confirmed', confirmed_at = NOW() WHERE application_id = %s AND slot_status != 'cancelled'", (booking_id,))

        return read_booking(cur, booking_id)
