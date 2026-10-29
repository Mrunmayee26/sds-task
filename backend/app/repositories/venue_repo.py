"""Small parameterized SQL queries for the existing campus catalog."""

from fastapi import HTTPException
from app.db.session import get_db_cursor

VENUE_SELECT = """
    SELECT v.*, b.building_name, u.unit_name,
           ag.group_name AS primary_approval_group
    FROM venues v
    LEFT JOIN buildings b ON b.building_id = v.building_id
    JOIN organizational_units u ON u.unit_id = v.managing_unit_id
    JOIN approval_groups ag ON ag.access_id = v.access_id
"""


def list_venues(
    search,
    venue_type,
    min_capacity,
    limit,
    offset,
    location="",
    amenity="",
    start=None,
    end=None,
):
    with get_db_cursor(commit=False) as cur:
        cur.execute(
            VENUE_SELECT + """
            WHERE v.is_active AND (%s = '' OR v.venue_name ILIKE %s)
              AND (%s IS NULL OR v.venue_type = %s)
              AND (%s IS NULL OR v.capacity >= %s)
              AND (%s='' OR COALESCE(b.building_name,'') ILIKE %s OR COALESCE(v.location_description,'') ILIKE %s)
              AND (%s='' OR %s=ANY(v.amenities))
              AND (%s::timestamptz IS NULL OR (
                NOT EXISTS(SELECT 1 FROM booking_slots s WHERE s.venue_id=v.venue_id AND s.slot_status='confirmed' AND s.start_time<%s AND s.end_time>%s)
                AND NOT EXISTS(SELECT 1 FROM venue_blackouts x WHERE x.venue_id=v.venue_id AND x.cancelled_at IS NULL AND x.start_time<%s AND x.end_time>%s)))
            ORDER BY v.venue_name, v.venue_id LIMIT %s OFFSET %s
        """,
            (
                search,
                f"%{search}%",
                venue_type,
                venue_type,
                min_capacity,
                min_capacity,
                location,
                f"%{location}%",
                f"%{location}%",
                amenity,
                amenity,
                start,
                end,
                start,
                end,
                start,
                limit,
                offset,
            ),
        )
        return cur.fetchall()


def get_venue(venue_id):
    with get_db_cursor(commit=False) as cur:
        cur.execute(
            VENUE_SELECT + " WHERE v.venue_id = %s AND v.is_active", (venue_id,)
        )
        venue = cur.fetchone()
        if not venue:
            raise HTTPException(404, "Venue not found")
        return venue


def lock_venue(cur, venue_id):
    # Every booking write locks the same venue row before checking availability.
    # A second request waits, then sees the first request's committed reservation.
    cur.execute("SELECT * FROM venues WHERE venue_id = %s FOR UPDATE", (venue_id,))
    venue = cur.fetchone()
    if not venue:
        raise HTTPException(404, "Venue not found")
    return venue


def has_conflict(cur, venue_id, start_time, end_time, exclude_id=0):
    cur.execute(
        """
        SELECT 1 FROM booking_slots
        WHERE venue_id = %s AND slot_status IN ('pending', 'confirmed')
          AND start_time < %s AND end_time > %s AND application_id <> %s
        LIMIT 1
    """,
        (venue_id, end_time, start_time, exclude_id),
    )
    return cur.fetchone() is not None


def is_blocked(cur, venue_id, start, end):
    cur.execute(
        """SELECT 1 FROM venue_blackouts WHERE venue_id=%s AND cancelled_at IS NULL
                   AND start_time<%s AND end_time>%s LIMIT 1""",
        (venue_id, end, start),
    )
    return cur.fetchone() is not None


def confirmed_conflict(cur, venue_id, start, end, exclude_id=0):
    cur.execute(
        """SELECT 1 FROM booking_slots WHERE venue_id=%s AND slot_status='confirmed'
                   AND start_time<%s AND end_time>%s AND application_id<>%s LIMIT 1""",
        (venue_id, end, start, exclude_id),
    )
    return cur.fetchone() is not None
