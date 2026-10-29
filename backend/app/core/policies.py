"""Small, independently testable booking rules."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from app.config import settings


def validate_booking_window(start, end, now=None):
    now = now or datetime.now(timezone.utc)
    if start <= now or end <= start:
        raise HTTPException(422, "Choose a future start and an end after the start.")
    if end - start > timedelta(hours=settings.MAX_BOOKING_HOURS):
        raise HTTPException(
            422, f"Bookings may last at most {settings.MAX_BOOKING_HOURS} hours."
        )
    if start > now + timedelta(days=settings.ADVANCE_BOOKING_DAYS):
        raise HTTPException(
            422, f"Book at most {settings.ADVANCE_BOOKING_DAYS} days ahead."
        )
    local_start, local_end = start.astimezone(ZoneInfo("Asia/Kolkata")), end.astimezone(
        ZoneInfo("Asia/Kolkata")
    )
    opening = local_start.replace(
        hour=settings.OPENING_HOUR, minute=0, second=0, microsecond=0
    )
    closing = local_start.replace(
        hour=0, minute=0, second=0, microsecond=0
    ) + timedelta(hours=settings.CLOSING_HOUR)
    if local_start < opening or local_end > closing:
        raise HTTPException(
            422, "Choose a time within campus opening hours on one day."
        )


def check_cancellation_deadline(start, now=None):
    now = now or datetime.now(timezone.utc)
    if start - now < timedelta(hours=settings.CANCELLATION_HOURS):
        raise HTTPException(
            409,
            f"Cancellation closes {settings.CANCELLATION_HOURS} hours before the event.",
        )
