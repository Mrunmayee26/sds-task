import sys
from pathlib import Path
from contextlib import asynccontextmanager

# Ensure backend root is always on sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db.session import init_db_pool, close_db_pool, test_db_connection

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize connection pool
    try:
        init_db_pool()
    except Exception as e:
        print(f"Warning: Could not connect to DB on startup: {e}")
    yield
    # Shutdown: close connection pool
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
    except Exception as e:
        return {
            "status": "degraded",
            "database_error": str(e)
        }
