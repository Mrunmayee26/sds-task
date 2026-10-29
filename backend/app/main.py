import sys
import logging
import time
import uuid
from pathlib import Path
from contextlib import asynccontextmanager

# Ensure backend root is always on sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

# pyrefly: ignore[missing-import]
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg2 import OperationalError, InterfaceError
from psycopg2.pool import PoolError
from app.config import settings
from app.db.session import init_db_pool, close_db_pool, test_db_connection
from app.api.v1 import api_router
from app.core.cache import get_redis, limit_attempts, record_request
from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool

logger = logging.getLogger("venueflow.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail clearly if the database is unavailable. Schema setup is explicit.
    init_db_pool()
    try:
        yield
    finally:
        close_db_pool()


app = FastAPI(
    title="COEP VenueFlow API",
    description="Backend API for COEP Campus Venue Booking and Multi-Level Approvals",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(api_router, prefix="/api/v1")


@app.middleware("http")
async def request_log(request, call_next):
    request_id = uuid.uuid4().hex
    start = time.monotonic()
    try:
        if request.url.path.startswith("/api/v1/auth/"):
            # Use the socket peer, never trust arbitrary forwarded headers.
            await run_in_threadpool(
                limit_attempts,
                "auth-ip",
                request.client.host if request.client else "unknown",
                100,
                900,
            )
        response = await call_next(request)
    except HTTPException as exc:
        response = JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=exc.headers,
        )
    except Exception:
        logger.exception(
            "request_failed id=%s method=%s path=%s",
            request_id,
            request.method,
            request.url.path,
        )
        response = JSONResponse(
            status_code=500,
            content={
                "detail": "Unexpected server error. Contact support with the request ID."
            },
        )
    response.headers["X-Request-ID"] = request_id
    await run_in_threadpool(
        record_request, response.status_code, time.monotonic() - start
    )
    logger.info(
        "request id=%s method=%s path=%s status=%s duration_ms=%.1f",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        (time.monotonic() - start) * 1000,
    )
    return response


@app.exception_handler(OperationalError)
@app.exception_handler(InterfaceError)
@app.exception_handler(PoolError)
async def database_unavailable(request, exc):
    return JSONResponse(
        status_code=503,
        content={"detail": "Database unavailable. Please try again later."},
    )


@app.get("/")
def root():
    return {
        "service": "COEP VenueFlow API",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    try:
        db_health = test_db_connection()
        redis_status = "unconfigured"
        try:
            client = get_redis()
            if client:
                client.ping()
                redis_status = "connected"
        except Exception:
            redis_status = "unavailable"
        if redis_status != "connected":
            return JSONResponse(
                status_code=503,
                content={
                    "status": "degraded",
                    "database": "connected",
                    "redis": redis_status,
                },
            )
        return {"status": "healthy", "database": db_health, "redis": redis_status}
    except Exception:
        return JSONResponse(
            status_code=503, content={"status": "degraded", "database": "unavailable"}
        )
