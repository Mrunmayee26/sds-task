"""Redis contains short-lived hints, never the authoritative booking decision."""

import hashlib
import json
import logging
from datetime import datetime, timezone
from functools import lru_cache
import redis
from fastapi import HTTPException
from app.config import settings

logger = logging.getLogger("venueflow.cache")


@lru_cache
def client_for_url(url):
    return redis.Redis.from_url(
        url, decode_responses=True, socket_connect_timeout=2, socket_timeout=2
    )


def get_redis(required=False):
    if not settings.REDIS_URL:
        if required:
            raise HTTPException(
                503, "Redis is not configured. Contact the administrator."
            )
        return None
    return client_for_url(settings.REDIS_URL)


def limit_attempts(category, identity, limit, seconds):
    # Auth protections fail closed when Redis is unavailable, across all workers.
    client = get_redis(required=True)
    key = (
        "venueflow:rate:"
        + category
        + ":"
        + hashlib.sha256(identity.encode()).hexdigest()
    )
    try:
        count = client.eval(
            """
            local n = redis.call('INCR', KEYS[1])
            if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
            return n
        """,
            1,
            key,
            seconds,
        )
    except redis.RedisError as exc:
        raise HTTPException(
            503, "Account protection service unavailable. Try again later."
        ) from exc
    if count > limit:
        raise HTTPException(
            429,
            "Too many attempts. Please try again later.",
            headers={"Retry-After": str(seconds)},
        )


def cached_catalog(key, load):
    client = get_redis()
    if client:
        try:
            value = client.get(key)
            if value:
                return json.loads(value)
        except redis.RedisError:
            logger.warning("Catalog cache unavailable")
    value = load()
    if client:
        try:
            client.set(key, json.dumps(value), ex=60)
        except redis.RedisError:
            logger.warning("Catalog cache write unavailable")
    return value


def invalidate_catalog():
    client = get_redis()
    if client:
        try:
            # A versioned namespace avoids scanning keys and races during invalidation.
            client.incr("venueflow:catalog-version")
        except redis.RedisError:
            logger.warning(
                "Catalog invalidation unavailable; cache expires in 60 seconds"
            )


def metrics_key():
    return "venueflow:metrics:" + datetime.now(timezone.utc).date().isoformat()


def record_request(status, duration):
    client = get_redis()
    if not client:
        return
    try:
        key = metrics_key()
        with client.pipeline() as transaction:
            transaction.hincrby(key, "requests", 1)
            transaction.hincrby(key, "errors", int(status >= 500))
            transaction.hincrby(key, "total_ms", int(duration * 1000))
            transaction.expire(key, 172800)
            transaction.execute()
    except redis.RedisError:
        pass
