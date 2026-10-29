from typing import Literal
from fastapi import APIRouter, Depends, Query
from app.core.dependencies import get_current_user
from app.models.auth import UserProfile
from app.models.booking import BookingCreate, BookingDecision
from app.repositories import booking_repo
from pydantic import AwareDatetime
from app.db.session import get_db_cursor

router = APIRouter()


@router.post("", status_code=201)
def create_booking(data: BookingCreate, user: UserProfile = Depends(get_current_user)):
    result = booking_repo.create_booking(data, user.user_id)
    from .holds import release_holds

    release_holds(user.user_id)
    return result


@router.get("")
def list_bookings(
    scope: Literal["mine", "review"] = "mine",
    status: Literal["submitted", "approved", "rejected", "cancelled"] | None = None,
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
    return booking_repo.get_booking(booking_id, user.user_id, user.user_type == "admin")


@router.post("/{booking_id}/cancel")
def cancel_booking(booking_id: int, user: UserProfile = Depends(get_current_user)):
    return booking_repo.cancel_booking(
        booking_id, user.user_id, user.user_type == "admin"
    )


@router.patch("/{booking_id}/status")
def booking_status(
    booking_id: int,
    data: BookingDecision,
    user: UserProfile = Depends(get_current_user),
):
    return booking_repo.decide_booking(booking_id, user.user_id, data)
