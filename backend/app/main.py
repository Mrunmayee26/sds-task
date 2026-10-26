import sys
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
from app.repositories.user_repo import ensure_default_accounts
from app.api.v1 import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail clearly if the database is unavailable. Schema setup is explicit.
    init_db_pool()
    if settings.SEED_DEMO_ACCOUNTS:
        ensure_default_accounts()
    try:
        yield
    finally:
        close_db_pool()

app = FastAPI(
    title="COEP VenueFlow API",
    description="Backend API for COEP Campus Venue Booking and Multi-Level Approvals",
    version="1.0.0",
    lifespan=lifespan
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


@app.exception_handler(OperationalError)
@app.exception_handler(InterfaceError)
@app.exception_handler(PoolError)
async def database_unavailable(request, exc):
    return JSONResponse(status_code=503, content={"detail": "Database unavailable. Please try again later."})

@app.get("/")
def root():
    return {
        "service": "COEP VenueFlow API",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    try:
        db_health = test_db_connection()
        return {
            "status": "healthy",
            "database": db_health
        }
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "unavailable"})
