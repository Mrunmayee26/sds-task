"""
API v1 package router aggregator.
"""

from fastapi import APIRouter
from .auth import router as auth_router
from .venues import router as venues_router
from .bookings import router as bookings_router
from .admin import router as admin_router
from .account import router as account_router
from .holds import router as holds_router
from .notifications import router as notifications_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(venues_router, prefix="/venues", tags=["Venues"])
api_router.include_router(bookings_router, prefix="/bookings", tags=["Bookings"])
api_router.include_router(admin_router, tags=["Administration"])
api_router.include_router(account_router, prefix="/auth", tags=["Account recovery"])
api_router.include_router(holds_router, tags=["Draft notices"])
api_router.include_router(notifications_router, tags=["Notifications"])
