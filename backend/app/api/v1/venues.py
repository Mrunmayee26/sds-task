from fastapi import APIRouter, Depends, Query
from fastapi.exceptions import RequestValidationError
from pydantic import AwareDatetime, ValidationError
from app.db.session import get_db_cursor
from app.models.booking import TimeRange
from app.repositories import venue_repo
from app.core.cache import get_redis, cached_catalog
from app.core.policies import validate_booking_window
import hashlib
import json
import redis

router = APIRouter()


def requested_times(start_time: AwareDatetime, end_time: AwareDatetime):
    try:
        return TimeRange(start_time=start_time, end_time=end_time)
    except ValidationError as exc:
        raise RequestValidationError(exc.errors()) from exc


@router.get("")
def list_venues(
    search: str = Query("", max_length=150),
    venue_type: str | None = None,
    min_capacity: int | None = Query(None, gt=0),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    location: str = "",
    amenity: str = "",
    start_time: AwareDatetime | None = None,
    end_time: AwareDatetime | None = None,
):
    if (start_time is None) != (end_time is None):
        from fastapi import HTTPException

        raise HTTPException(422, "Supply both start_time and end_time")
    if start_time:
        validate_booking_window(start_time, end_time)
    load = lambda: venue_repo.list_venues(
        search,
        venue_type,
        min_capacity,
        limit,
        offset,
        location,
        amenity,
        start_time,
        end_time,
    )
    # Never cache time availability: stale availability must not hide blackouts.
    if start_time:
        return load()
    version = 0
    client = get_redis()
    if client:
        try:
            version = client.get("venueflow:catalog-version") or 0
        except redis.RedisError:
            pass
    key = (
        "venueflow:catalog:"
        + str(version)
        + ":"
        + hashlib.sha256(
            json.dumps(
                [search, venue_type, min_capacity, limit, offset, location, amenity]
            ).encode()
        ).hexdigest()
    )
    return cached_catalog(key, load)


@router.get("/{venue_id}")
def venue_details(venue_id: int):
    return venue_repo.get_venue(venue_id)


@router.get("/{venue_id}/availability")
def availability(venue_id: int, times: TimeRange = Depends(requested_times)):
    venue_repo.get_venue(venue_id)
    with get_db_cursor(commit=False) as cur:
        conflict = venue_repo.get_conflicting_booking(
            cur, venue_id, times.start_time, times.end_time
        )
        blocked = venue_repo.is_blocked(cur, venue_id, times.start_time, times.end_time)
        competing = venue_repo.has_conflict(
            cur, venue_id, times.start_time, times.end_time
        )
        confirmed = venue_repo.confirmed_conflict(
            cur, venue_id, times.start_time, times.end_time
        )
    return {
        "venue_id": venue_id,
        "available": not blocked and not confirmed and conflict is None,
        "blocked": blocked,
        "competing_requests": competing,
        "can_request": not blocked,
        "is_occupied": conflict is not None,
        "occupied_by_status": conflict["slot_status"] if conflict else None,
        "conflicting_booking_id": conflict["application_id"] if conflict else None,
        **times.model_dump(),
    }
