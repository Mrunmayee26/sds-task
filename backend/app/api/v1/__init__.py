"""
API v1 package router aggregator.
"""
from fastapi import APIRouter
from .auth import router as auth_router
from .venues import router as venues_router
from .bookings import router as bookings_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(venues_router, prefix="/venues", tags=["Venues"])
api_router.include_router(bookings_router, prefix="/bookings", tags=["Bookings"])
