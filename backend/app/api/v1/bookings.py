from typing import Literal
from fastapi import APIRouter, Depends, Query
from app.core.dependencies import get_current_user
from app.models.auth import UserProfile
from app.models.booking import BookingCreate, BookingDecision, BookingCancel
from app.repositories import booking_repo

router = APIRouter()


@router.post("", status_code=201)
def create_booking(data: BookingCreate, user: UserProfile = Depends(get_current_user)):
    return booking_repo.create_booking(data, user.user_id)


@router.get("")
def list_bookings(scope: Literal["mine", "review"] = "mine",
                  status: Literal["submitted", "approved", "rejected", "cancelled"] | None = None,
                  limit: int = Query(100, ge=1, le=200), offset: int = Query(0, ge=0),
                  user: UserProfile = Depends(get_current_user)):
    return booking_repo.list_bookings(user.user_id, scope, status, limit, offset)


@router.get("/{booking_id}")
def booking_details(booking_id: int, user: UserProfile = Depends(get_current_user)):
    return booking_repo.get_booking(booking_id, user.user_id)


@router.post("/{booking_id}/cancel")
def cancel_booking(booking_id: int, data: BookingCancel, user: UserProfile = Depends(get_current_user)):
    return booking_repo.cancel_booking(booking_id, user.user_id, data.reason)


@router.patch("/{booking_id}/status")
def booking_status(booking_id: int, data: BookingDecision, user: UserProfile = Depends(get_current_user)):
    return booking_repo.decide_booking(booking_id, user.user_id, data)
