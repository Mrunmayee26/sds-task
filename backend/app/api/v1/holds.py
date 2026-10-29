"""Five-minute advisory drafting notices. Other users' identities stay private."""

import json
import redis
from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_current_user
from app.core.cache import get_redis, limit_attempts
from app.models.booking import TimeRange
from app.repositories.venue_repo import get_venue
from app.core.policies import validate_booking_window
from pydantic import Field

router = APIRouter()


class Hold(TimeRange):
    venue_id: int = Field(gt=0)


@router.post("/booking-holds")
def draft(data: Hold, user=Depends(get_current_user)):
    limit_attempts("holds", str(user.user_id), 120, 3600)
    get_venue(data.venue_id)
    validate_booking_window(data.start_time, data.end_time)
    client = get_redis(required=True)
    start, end = data.start_time.timestamp(), data.end_time.timestamp()
    index = f"venueflow:holds:{data.venue_id}"
    key = f"{index}:{user.user_id}"
    try:
        others = client.eval(
            """
            local now=tonumber(redis.call('TIME')[1])
            redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',now)
            local count=0
            for _,k in ipairs(redis.call('ZRANGE',KEYS[1],0,-1)) do
                if k~=KEYS[2] then
                    local v=redis.call('GET',k)
                    if v then
                        local slot=cjson.decode(v)
                        if slot[1]<tonumber(ARGV[2]) and slot[2]>tonumber(ARGV[1]) then count=count+1 end
                    end
                end
            end
            redis.call('SET',KEYS[2],ARGV[3],'EX',300)
            redis.call('ZADD',KEYS[1],now+300,KEYS[2])
            redis.call('EXPIRE',KEYS[1],300)
            return count
        """,
            2,
            index,
            key,
            start,
            end,
            json.dumps([start, end]),
        )
    except redis.RedisError as exc:
        raise HTTPException(
            503,
            "Draft notices are temporarily unavailable; your booking is not reserved.",
        ) from exc
    return {
        "other_drafts": others,
        "expires_in": 300,
        "message": (
            "Someone else is trying to book an overlapping time slot."
            if others
            else "No other overlapping drafts detected."
        ),
    }


def release_holds(user_id):
    client = get_redis()
    if not client:
        return
    try:
        for key in client.scan_iter(f"venueflow:holds:*:{user_id}"):
            client.delete(key)
    except redis.RedisError:
        pass


@router.delete("/booking-holds/{venue_id}")
def release(venue_id: int, user=Depends(get_current_user)):
    client = get_redis(required=True)
    index = f"venueflow:holds:{venue_id}"
    key = f"{index}:{user.user_id}"
    try:
        with client.pipeline() as transaction:
            transaction.delete(key)
            transaction.zrem(index, key)
            transaction.execute()
    except redis.RedisError as exc:
        raise HTTPException(503, "Draft notice service unavailable") from exc
    return {"released": True}
