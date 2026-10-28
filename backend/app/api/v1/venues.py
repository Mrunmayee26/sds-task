from fastapi import APIRouter, Depends, Query
from fastapi.exceptions import RequestValidationError
from pydantic import AwareDatetime, ValidationError
from app.db.session import get_db_cursor
from app.models.booking import TimeRange
from app.repositories import venue_repo

router = APIRouter()


def requested_times(start_time: AwareDatetime, end_time: AwareDatetime):
    try:
        return TimeRange(start_time=start_time, end_time=end_time)
    except ValidationError as exc:
        raise RequestValidationError(exc.errors()) from exc


@router.get("")
def list_venues(search: str = Query("", max_length=150), venue_type: str | None = None,
                min_capacity: int | None = Query(None, gt=0), limit: int = Query(100, ge=1, le=200),
                offset: int = Query(0, ge=0)):
    return venue_repo.list_venues(search, venue_type, min_capacity, limit, offset)


@router.get("/{venue_id}")
def venue_details(venue_id: int):
    return venue_repo.get_venue(venue_id)


@router.get("/{venue_id}/availability")
def availability(venue_id: int, times: TimeRange = Depends(requested_times)):
    venue_repo.get_venue(venue_id)
    with get_db_cursor(commit=False) as cur:
        conflict = venue_repo.get_conflicting_booking(cur, venue_id, times.start_time, times.end_time)
        available = conflict is None
    return {
        "venue_id": venue_id,
        "available": available,
        "is_occupied": conflict is not None,
        "occupied_by_status": conflict["slot_status"] if conflict else None,
        "conflicting_booking_id": conflict["application_id"] if conflict else None,
        **times.model_dump(),
    }

