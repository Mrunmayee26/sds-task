from typing import Literal
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, ConfigDict
from app.models.booking import TimeRange
from app.core.dependencies import get_current_user, require_role
from app.repositories import admin_repo
from app.db.session import get_db_cursor
from app.core.cache import invalidate_catalog
from app.config import settings

router = APIRouter()
admin = Depends(require_role(["admin"]))


class RequestAccess(BaseModel):
    access_id: int = Field(gt=0)
    reason: str = Field(min_length=10, max_length=2000)
    model_config = ConfigDict(str_strip_whitespace=True)


class Review(BaseModel):
    status: Literal["approved", "rejected"]
    remarks: str = Field(default="", max_length=2000)


class Active(BaseModel):
    is_active: bool


class Permission(BaseModel):
    can_approve: bool


class Blackout(TimeRange):
    venue_id: int = Field(gt=0)
    reason: str = Field(min_length=3, max_length=2000)


class VenueUpdate(BaseModel):
    venue_name: str = Field(min_length=1, max_length=150)
    capacity: int | None = Field(default=None, gt=0)
    is_active: bool
    location_description: str = Field(default="", max_length=2000)
    amenities: list[str] = Field(default_factory=list, max_length=30)
    model_config = ConfigDict(str_strip_whitespace=True)


@router.get("/groups")
def groups(user=Depends(get_current_user)):
    return admin_repo.groups()


@router.post("/approver-requests", status_code=201)
def request_access(data: RequestAccess, user=Depends(get_current_user)):
    return admin_repo.request_approver(user.user_id, data.access_id, data.reason)


@router.get("/approver-requests")
def own_requests(user=Depends(get_current_user)):
    return admin_repo.requests(user.user_id)


@router.get("/admin/summary")
def summary(user=admin):
    return admin_repo.summary()


@router.get("/admin/users")
def users(
    search: str = "",
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=admin,
):
    return admin_repo.users(limit, offset, search)


@router.patch("/admin/users/{user_id}")
def active(user_id: int, data: Active, user=admin):
    return admin_repo.set_active(user_id, data.is_active, user.user_id)


@router.patch("/admin/users/{user_id}/groups/{access_id}")
def permission(user_id: int, access_id: int, data: Permission, user=admin):
    return admin_repo.memberships(user_id, access_id, data.can_approve, user.user_id)


@router.get("/admin/users/{user_id}/groups")
def memberships(user_id: int, user=admin):
    with get_db_cursor(commit=False) as cur:
        cur.execute(
            """SELECT gm.*,g.group_name FROM group_members gm JOIN approval_groups g USING(access_id)
                       WHERE gm.user_id=%s ORDER BY g.group_name""",
            (user_id,),
        )
        return cur.fetchall()


@router.get("/admin/approver-requests")
def requests(user=admin):
    return admin_repo.requests()


@router.patch("/admin/approver-requests/{request_id}")
def review(request_id: int, data: Review, user=admin):
    return admin_repo.review_request(
        request_id, data.status == "approved", data.remarks, user.user_id
    )


@router.get("/admin/blackouts")
def blackouts(user=admin):
    return admin_repo.list_blackouts()


@router.post("/admin/blackouts", status_code=201)
def blackout(data: Blackout, user=admin):
    return admin_repo.create_blackout(data, user.user_id)


@router.delete("/admin/blackouts/{blackout_id}")
def remove(blackout_id: int, user=admin):
    return admin_repo.remove_blackout(blackout_id, user.user_id)


@router.get("/admin/venues")
def venues(user=admin):
    with get_db_cursor(commit=False) as cur:
        cur.execute("SELECT * FROM venues ORDER BY venue_name")
        return cur.fetchall()


@router.patch("/admin/venues/{venue_id}")
def venue_update(venue_id: int, data: VenueUpdate, user=admin):
    from app.repositories.venue_repo import lock_venue

    with get_db_cursor() as cur:
        lock_venue(cur, venue_id)
        cur.execute(
            """UPDATE venues SET venue_name=%s,capacity=%s,is_active=%s,location_description=%s,amenities=%s
                       WHERE venue_id=%s RETURNING *""",
            (
                data.venue_name,
                data.capacity,
                data.is_active,
                data.location_description,
                data.amenities,
                venue_id,
            ),
        )
        result = cur.fetchone()
        admin_repo.audit(cur, user.user_id, "update_venue", venue_id)
    invalidate_catalog()
    return result


@router.get("/admin/audit")
def audit(
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0), user=admin
):
    with get_db_cursor(commit=False) as cur:
        cur.execute(
            """SELECT e.*,u.full_name FROM admin_events e JOIN users u ON u.user_id=e.actor_user_id
                       ORDER BY e.created_at DESC LIMIT %s OFFSET %s""",
            (limit, offset),
        )
        return cur.fetchall()


@router.get("/admin/bookings")
def all_bookings(
    limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0), user=admin
):
    with get_db_cursor(commit=False) as cur:
        cur.execute(
            """SELECT a.*,v.venue_name,u.full_name AS applicant_name,
            (SELECT MIN(start_time) FROM booking_slots s WHERE s.application_id=a.application_id) AS start_time,
            (SELECT MAX(end_time) FROM booking_slots s WHERE s.application_id=a.application_id) AS end_time
            FROM applications a JOIN venues v USING(venue_id) JOIN users u ON u.user_id=a.applicant_user_id
            ORDER BY a.created_at DESC LIMIT %s OFFSET %s""",
            (limit, offset),
        )
        return cur.fetchall()


@router.get("/admin/operations")
def operations(user=admin):
    from app.core.cache import get_redis, metrics_key
    import redis

    metrics = {}
    worker_running = False
    cache_status = "unconfigured"
    try:
        client = get_redis()
        if client:
            client.ping()
            metrics = client.hgetall(metrics_key())
            cache_status = "connected"
            worker_running = bool(client.exists("venueflow:worker-heartbeat"))
    except redis.RedisError:
        cache_status = "unavailable"
    with get_db_cursor(commit=False) as cur:
        cur.execute(
            """SELECT COUNT(*) FILTER(WHERE email_sent_at IS NULL) AS queued_emails,
            COUNT(*) FILTER(WHERE email_sent_at IS NULL AND email_attempts>=5) AS failed_emails
            FROM user_notifications"""
        )
        queue = cur.fetchone()
    return {
        "redis": cache_status,
        "requests_today": int(metrics.get("requests", 0)),
        "server_errors_today": int(metrics.get("errors", 0)),
        "average_response_ms": int(metrics.get("total_ms", 0))
        // max(1, int(metrics.get("requests", 0))),
        "smtp_enabled": settings.SMTP_ENABLED,
        "worker_running": worker_running,
        **queue,
    }
