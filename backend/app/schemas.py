"""Pydantic request/response schemas."""
from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class SettingsUpdate(BaseModel):
    base_amount_eur: Optional[float] = Field(default=None, gt=0, le=100_000)
    schedule_weekday: Optional[int] = Field(default=None, ge=0, le=6)
    schedule_time: Optional[str] = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    dry_run: Optional[bool] = None
    paused_until: Optional[date] = None
    discord_enabled: Optional[bool] = None


class PauseRequest(BaseModel):
    days: int = Field(gt=0, le=365)


class RunRequest(BaseModel):
    dry_run: Optional[bool] = None  # None = use the stored setting


class ManualBuyRequest(BaseModel):
    amount_eur: float = Field(ge=1, le=10_000)  # Coinbase min order ~1 EUR
    dry_run: Optional[bool] = None  # None = use the stored setting
