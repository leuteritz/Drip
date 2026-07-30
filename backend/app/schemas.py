"""Pydantic request/response schemas.

The response models mirror the interfaces in `frontend/src/api/types.ts`. They
are wired into the routers via `response_model=`, so a field renamed here fails
loudly (and shows up in /docs) instead of silently breaking the dashboard.
"""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# --- Requests ---------------------------------------------------------------

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


# --- Responses --------------------------------------------------------------

class BotStatusResponse(BaseModel):
    dry_run: bool
    paused: bool
    paused_until: Optional[date]
    next_run: Optional[str]
    has_credentials: bool
    discord_configured: bool


class IndicatorsResponse(BaseModel):
    """One scoring run - what the bot would do right now."""

    score: int
    score_max: int
    factors: list[str]
    current_price: float
    fear_greed: int
    fng_classification: str
    rsi: float
    ma_350: float
    ma_distance_pct: float
    multiplier: float
    signal: str


class CandleResponse(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class PerformanceSide(BaseModel):
    """Value/profit for one side of the bot-vs-DCA comparison."""

    invested_eur: float
    btc_total: float
    value_eur: float
    profit_eur: float
    profit_pct: float


class PerformanceResponse(PerformanceSide):
    current_price: float
    purchase_count: int
    dca: PerformanceSide
    include_dry_run: bool


class ComparisonPoint(BaseModel):
    date: str
    price: float
    bot_value: float
    bot_invested: float
    dca_value: float
    dca_invested: float


class SimulationSummary(BaseModel):
    days: int
    purchase_count: int
    current_price: float
    start_date: str
    end_date: str
    weekday: int
    base_amount_eur: float
    bot: PerformanceSide
    dca: PerformanceSide


class SimulationResponse(BaseModel):
    summary: SimulationSummary
    series: list[ComparisonPoint]


class PurchaseResponse(BaseModel):
    id: int
    timestamp: datetime
    price_eur: float
    amount_eur: float
    btc_amount: float
    fear_greed: int
    rsi: float
    ma_350: float
    score: int
    multiplier: float
    order_id: str
    status: str
    dry_run: bool


class RunResultResponse(BaseModel):
    """A manual/scheduled cycle: either skipped, or a recorded purchase."""

    skipped: bool
    reason: Optional[str] = None
    purchase: Optional[PurchaseResponse] = None
    analysis: Optional[IndicatorsResponse] = None
    error: Optional[str] = None


class BalanceResponse(BaseModel):
    """Always 200, so the dashboard degrades instead of erroring."""

    configured: bool
    eur_available: Optional[float]
    btc_available: Optional[float]
    error: Optional[str]


class ImportRowError(BaseModel):
    line: int
    message: str


class ImportResponse(BaseModel):
    imported: int
    skipped: int
    total: int
    errors: list[ImportRowError]


class DeleteResponse(BaseModel):
    deleted: int


class TestNotificationResponse(BaseModel):
    sent: bool
    reason: Optional[str] = None
