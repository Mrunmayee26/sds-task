from datetime import datetime, timedelta, timezone
import pytest
from fastapi import HTTPException


def test_cancellation_boundary(database):
    from app.core.policies import check_cancellation_deadline

    now = datetime.now(timezone.utc)
    check_cancellation_deadline(now + timedelta(hours=8), now)
    with pytest.raises(HTTPException) as exc:
        check_cancellation_deadline(now + timedelta(hours=8, microseconds=-1), now)
    assert exc.value.status_code == 409


def test_booking_duration_and_advance_limits(database):
    from app.core.policies import validate_booking_window

    now = datetime.now(timezone.utc)
    start = (now + timedelta(days=2)).replace(hour=5, minute=0)
    validate_booking_window(start, start + timedelta(hours=1), now)
    with pytest.raises(HTTPException):
        validate_booking_window(start, start + timedelta(hours=13), now)
    with pytest.raises(HTTPException):
        validate_booking_window(
            start + timedelta(days=181), start + timedelta(days=181, hours=1), now
        )
