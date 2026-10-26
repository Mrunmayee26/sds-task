"""Request validation. All times must include a timezone, for example +05:30."""
from datetime import datetime, timezone
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator


class TimeRange(BaseModel):
    start_time: AwareDatetime
    end_time: AwareDatetime

    @model_validator(mode="after")
    def check_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        if self.start_time <= datetime.now(timezone.utc):
            raise ValueError("start_time must be in the future")
        return self


class BookingCreate(TimeRange):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    venue_id: int = Field(gt=0)
    purpose: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=5000)
    application_type: str = Field(default="Academic", min_length=1, max_length=40)
    expected_attendance: int = Field(gt=0)


class BookingDecision(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    status: Literal["approved", "rejected"]
    remarks: str = Field(default="", max_length=2000)


class BookingCancel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    reason: str = Field(default="Cancelled by applicant", min_length=1, max_length=2000)
