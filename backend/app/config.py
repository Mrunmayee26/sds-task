from pathlib import Path
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application runtime settings and environment configurations."""

    # Database Configuration
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/postgres"
    DB_MIN_CONNECTIONS: int = 1
    DB_MAX_CONNECTIONS: int = 10
    REDIS_URL: str = ""
    ALLOWED_EMAIL_DOMAINS: str = "coep.ac.in"
    FRONTEND_URL: str = "http://localhost:5173"
    CANCELLATION_HOURS: int = Field(default=8, ge=0)
    MAX_BOOKING_HOURS: int = Field(default=12, gt=0, le=168)
    ADVANCE_BOOKING_DAYS: int = Field(default=180, gt=0)
    OPENING_HOUR: int = Field(default=0, ge=0, le=23)
    CLOSING_HOUR: int = Field(default=24, ge=1, le=24)
    APPROVAL_REMINDER_HOURS: int = Field(default=24, gt=0)

    # JWT Authentication
    JWT_SECRET_KEY: str = Field(min_length=32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # SMTP Email Configuration
    SMTP_ENABLED: bool = False
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@coep.ac.in"
    SMTP_FROM_NAME: str = "COEP VenueFlow"
    SMTP_USE_TLS: bool = True

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [
            origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()
        ]


settings = Settings()
