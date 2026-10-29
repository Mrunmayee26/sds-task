"""Administrator queries. Every state change writes an audit event."""

from fastapi import HTTPException
from app.db.session import get_db_cursor
from app.repositories.venue_repo import lock_venue
from app.core.cache import invalidate_catalog


def audit(cur, actor, action, target, details=""):
    cur.execute(
        "INSERT INTO admin_events(actor_user_id,action,target_id,details) VALUES(%s,%s,%s,%s)",
        (actor, action, target, details),
    )


def users(limit, offset, search):
    with get_db_cursor(commit=False) as cur:
        cur.execute(
            """SELECT user_id,full_name,email,user_type,is_active,created_at FROM users
                       WHERE full_name ILIKE %s OR email ILIKE %s ORDER BY user_id LIMIT %s OFFSET %s""",
            (f"%{search}%", f"%{search}%", limit, offset),
        )
        return cur.fetchall()


def set_active(user_id, active, actor):
    if user_id == actor:
        raise HTTPException(409, "You cannot disable your own account.")
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT user_type FROM users WHERE user_id=%s FOR UPDATE", (user_id,)
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(404, "User not found")
        if user["user_type"] == "admin":
            raise HTTPException(
                403, "Administrator accounts are maintained by the system owner."
            )
        cur.execute(
            "UPDATE users SET is_active=%s,session_version=session_version+1 WHERE user_id=%s",
            (active, user_id),
        )
        audit(cur, actor, "enable_user" if active else "disable_user", user_id)
    return {"user_id": user_id, "is_active": active}


def request_approver(user_id, access_id, reason):
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT 1 FROM approval_groups WHERE access_id=%s AND is_active",
            (access_id,),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Active approval group not found")
        cur.execute(
            """INSERT INTO approver_requests(user_id,access_id,reason) VALUES(%s,%s,%s)
                       ON CONFLICT(user_id,access_id) WHERE status='pending' DO NOTHING RETURNING *""",
            (user_id, access_id, reason),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(409, "A request for this group is already pending")
        return row


def requests(user_id=None):
    with get_db_cursor(commit=False) as cur:
        cur.execute(
            """SELECT r.*,u.full_name,u.email,g.group_name FROM approver_requests r
                       JOIN users u ON u.user_id=r.user_id JOIN approval_groups g ON g.access_id=r.access_id
                       WHERE (%s IS NULL OR r.user_id=%s) ORDER BY r.created_at DESC LIMIT 200""",
            (user_id, user_id),
        )
        return cur.fetchall()


def review_request(request_id, approved, remarks, actor):
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT * FROM approver_requests WHERE request_id=%s FOR UPDATE",
            (request_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Request not found")
        if row["status"] != "pending":
            raise HTTPException(409, "Request was already reviewed")
        cur.execute(
            "SELECT is_active FROM users WHERE user_id=%s FOR UPDATE", (row["user_id"],)
        )
        if not cur.fetchone()["is_active"]:
            raise HTTPException(409, "Enable this user before approving their request")
        if approved:
            cur.execute(
                "SELECT 1 FROM approval_groups WHERE access_id=%s AND is_active",
                (row["access_id"],),
            )
            if not cur.fetchone():
                raise HTTPException(409, "Approval group is inactive")
            cur.execute(
                """INSERT INTO group_members(access_id,user_id,member_role,can_approve)
                           VALUES(%s,%s,'Reviewer',TRUE) ON CONFLICT(access_id,user_id)
                           DO UPDATE SET can_approve=TRUE,left_at=NULL""",
                (row["access_id"], row["user_id"]),
            )
        cur.execute(
            """UPDATE approver_requests SET status=%s,reviewed_by=%s,remarks=%s,reviewed_at=NOW()
                       WHERE request_id=%s RETURNING *""",
            ("approved" if approved else "rejected", actor, remarks, request_id),
        )
        result = cur.fetchone()
        cur.execute(
            "INSERT INTO user_notifications(user_id,message) VALUES(%s,%s)",
            (
                row["user_id"],
                f"Your reviewer request was {result['status']}. {remarks}",
            ),
        )
        audit(cur, actor, "review_approver_request", request_id, result["status"])
        return result


def memberships(user_id, access_id, allowed, actor):
    with get_db_cursor() as cur:
        cur.execute(
            """UPDATE group_members SET can_approve=%s,left_at=CASE WHEN %s THEN NULL ELSE NOW() END
                       WHERE user_id=%s AND access_id=%s RETURNING user_id""",
            (allowed, allowed, user_id, access_id),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Membership not found")
        audit(
            cur,
            actor,
            "set_review_permission",
            user_id,
            f"Group {access_id}: {allowed}",
        )
    return {"updated": True}


def list_blackouts():
    with get_db_cursor(commit=False) as cur:
        cur.execute(
            """SELECT b.*,v.venue_name FROM venue_blackouts b JOIN venues v ON v.venue_id=b.venue_id
                       WHERE cancelled_at IS NULL ORDER BY start_time LIMIT 200"""
        )
        return cur.fetchall()


def create_blackout(data, actor):
    with get_db_cursor() as cur:
        lock_venue(cur, data.venue_id)
        cur.execute(
            """SELECT 1 FROM booking_slots WHERE venue_id=%s AND slot_status='confirmed'
                       AND start_time<%s AND end_time>%s""",
            (data.venue_id, data.end_time, data.start_time),
        )
        if cur.fetchone():
            raise HTTPException(
                409,
                "Cancel or reschedule the confirmed reservation first; the cancellation deadline still applies.",
            )
        cur.execute(
            """INSERT INTO venue_blackouts(venue_id,start_time,end_time,reason,created_by)
                       VALUES(%s,%s,%s,%s,%s) RETURNING *""",
            (data.venue_id, data.start_time, data.end_time, data.reason, actor),
        )
        result = cur.fetchone()
        audit(cur, actor, "create_blackout", result["blackout_id"], data.reason)
        return result


def remove_blackout(blackout_id, actor):
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT venue_id FROM venue_blackouts WHERE blackout_id=%s", (blackout_id,)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Blackout not found")
        lock_venue(cur, row["venue_id"])
        cur.execute(
            "UPDATE venue_blackouts SET cancelled_at=NOW() WHERE blackout_id=%s",
            (blackout_id,),
        )
        audit(cur, actor, "remove_blackout", blackout_id)
    return {"removed": True}


def groups():
    with get_db_cursor(commit=False) as cur:
        cur.execute(
            "SELECT access_id,group_name FROM approval_groups WHERE is_active ORDER BY group_name"
        )
        return cur.fetchall()


def summary():
    """Return headline counts for the admin dashboard."""
    with get_db_cursor(commit=False) as cur:
        cur.execute(
            """SELECT
                (SELECT COUNT(*) FROM users) AS users,
                (SELECT COUNT(*) FROM users WHERE user_type='approver' AND NOT is_active) AS pending_approvers,
                (SELECT COUNT(*) FROM approver_requests WHERE status='pending') AS pending_requests,
                (SELECT COUNT(*) FROM applications) AS bookings,
                (SELECT COUNT(*) FROM venues) AS venues"""
        )
        return cur.fetchone()
