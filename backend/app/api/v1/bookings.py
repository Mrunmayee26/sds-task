from datetime import datetime, timezone, timedelta
from typing import Literal
from fastapi import APIRouter, BackgroundTasks, Depends, Query
from app.core.dependencies import get_current_user
from app.core.email import send_status_update_email
from app.models.auth import UserProfile
from app.models.booking import BookingCreate, BookingDecision, BookingRevoke, BookingReassign
from app.repositories import booking_repo
from pydantic import AwareDatetime
from app.db.session import get_db_cursor

router = APIRouter()
IST = timezone(timedelta(hours=5, minutes=30))


def format_booking_time_slot(slots: list) -> str:
    """Format slot list into clean human-readable IST string: '28 Oct 2026, 10:00 AM – 01:00 PM IST'"""
    if not slots:
        return "To be scheduled"

    def _to_ist(val):
        if not val:
            return None
        if isinstance(val, str):
            try:
                val = datetime.fromisoformat(val.replace("Z", "+00:00"))
            except Exception:
                return val
        if isinstance(val, datetime):
            if val.tzinfo is None:
                val = val.replace(tzinfo=timezone.utc)
            return val.astimezone(IST)
        return val

    start_val = _to_ist(slots[0].get("start_time"))
    end_val = _to_ist(slots[-1].get("end_time"))

    if isinstance(start_val, datetime) and isinstance(end_val, datetime):
        if start_val.date() == end_val.date():
            return f"{start_val.strftime('%d %b %Y, %I:%M %p')} – {end_val.strftime('%I:%M %p')} IST"
        return f"{start_val.strftime('%d %b %Y, %I:%M %p')} – {end_val.strftime('%d %b %Y, %I:%M %p')} IST"
    return f"{slots[0].get('start_time')} – {slots[-1].get('end_time')}"


def queue_status_notification(
    background_tasks: BackgroundTasks,
    booking: dict,
    status: str,
    remarks: str | None = None,
):
    """Queue background email delivery to applicant if recipient email is available."""
    if not booking or not booking.get("applicant_email"):
        return

    time_str = format_booking_time_slot(booking.get("slots", []))
    background_tasks.add_task(
        send_status_update_email,
        to_email=booking["applicant_email"],
        user_name=booking.get("applicant_name", ""),
        application_id=booking["application_id"],
        venue_name=booking.get("venue_name", "Campus Venue"),
        purpose=booking.get("purpose", "Campus Event"),
        status=status,
        time_slot_str=time_str,
        remarks=remarks,
    )


@router.post("", status_code=201)
def create_booking(
    data: BookingCreate,
    background_tasks: BackgroundTasks,
    user: UserProfile = Depends(get_current_user),
):
    booking = booking_repo.create_booking(data, user.user_id)
    from .holds import release_holds

    release_holds(user.user_id)
    queue_status_notification(background_tasks, booking, "submitted")
    return booking


@router.get("")
def list_bookings(
    scope: Literal["mine", "review"] = "mine",
    status: Literal[
        "submitted", "approved", "rejected", "cancelled", "needs_reassignment"
    ]
    | None = None,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: UserProfile = Depends(get_current_user),
    search: str = "",
    start_time: AwareDatetime | None = None,
    end_time: AwareDatetime | None = None,
):
    from fastapi import HTTPException

    if (start_time is None) != (end_time is None) or (
        start_time and end_time <= start_time
    ):
        raise HTTPException(422, "Supply a valid start and end time together.")
    return booking_repo.list_bookings(
        user.user_id, scope, status, limit, offset, search, start_time, end_time
    )


@router.get("/summary")
def summary(
    scope: Literal["mine", "review"] = "mine",
    user: UserProfile = Depends(get_current_user),
):
    condition = "a.applicant_user_id=%s"
    if scope == "review":
        condition = (
            "EXISTS(SELECT 1 FROM application_approvals aa WHERE aa.application_id=a.application_id AND EXISTS("
            + booking_repo.MEMBER_CHECK
            + "))"
        )
    with get_db_cursor(commit=False) as cur:
        cur.execute(
            """SELECT COUNT(*) AS total,COUNT(*) FILTER(WHERE a.status='submitted') AS pending,
            COUNT(*) FILTER(WHERE a.status='approved') AS approved,
            COUNT(*) FILTER(WHERE a.status='approved' AND EXISTS(SELECT 1 FROM booking_slots s WHERE s.application_id=a.application_id AND s.start_time>NOW())) AS upcoming
            FROM applications a WHERE """
            + condition,
            (user.user_id,),
        )
        return cur.fetchone()


@router.get("/{booking_id}")
def booking_details(booking_id: int, user: UserProfile = Depends(get_current_user)):
    return booking_repo.get_booking(
        booking_id, user.user_id, getattr(user, "user_type", None) == "admin"
    )


@router.post("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    background_tasks: BackgroundTasks,
    user: UserProfile = Depends(get_current_user),
):
    booking = booking_repo.cancel_booking(
        booking_id, user.user_id, getattr(user, "user_type", None) == "admin"
    )
    queue_status_notification(background_tasks, booking, "cancelled")
    return booking


@router.patch("/{booking_id}/status")
def booking_status(
    booking_id: int,
    data: BookingDecision,
    background_tasks: BackgroundTasks,
    user: UserProfile = Depends(get_current_user),
):
    booking = booking_repo.decide_booking(booking_id, user.user_id, data)
    queue_status_notification(
        background_tasks,
        booking,
        booking.get("status", data.status),
        remarks=data.remarks,
    )
    return booking


@router.post("/{booking_id}/revoke")
def revoke_booking(
    booking_id: int,
    data: BookingRevoke,
    background_tasks: BackgroundTasks,
    user: UserProfile = Depends(get_current_user),
):
    booking = booking_repo.revoke_booking(booking_id, user.user_id, data)
    queue_status_notification(
        background_tasks,
        booking,
        "needs_reassignment",
        remarks=f"Revocation by approver: {data.remarks}",
    )
    return booking


@router.post("/{booking_id}/reassign")
def reassign_booking(
    booking_id: int,
    data: BookingReassign,
    background_tasks: BackgroundTasks,
    user: UserProfile = Depends(get_current_user),
):
    booking = booking_repo.reassign_booking(booking_id, user.user_id, data)
    queue_status_notification(
        background_tasks,
        booking,
        "submitted",
        remarks=f"Reassigned to new venue/timing: {data.remarks}",
    )
    return booking
