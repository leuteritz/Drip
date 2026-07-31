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


class DigestUpdate(BaseModel):
    """A partial edit of the weekly report. `blocks` is merged into the stored
    selection, so the frontend can send a single toggle."""

    enabled: Optional[bool] = None
    weekday: Optional[int] = Field(default=None, ge=0, le=6)
    send_time: Optional[str] = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    blocks: Optional[dict[str, bool]] = None


class CredentialsUpdate(BaseModel):
    """A partial edit of the stored secrets.

    Only the fields actually sent are written, and an empty string clears one -
    which hands it back to `backend/.env` if a value is configured there. The
    keys mirror `credentials.FIELDS`; anything else is rejected by the router.
    """

    coinbase_api_key: Optional[str] = Field(default=None, max_length=4000)
    coinbase_api_secret: Optional[str] = Field(default=None, max_length=8000)
    discord_webhook_url: Optional[str] = Field(default=None, max_length=2000)


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


class AttributionShare(BaseModel):
    """One indicator's Shapley share of the edge over plain DCA."""

    key: str
    label: str
    eur: float
    pp: float


class AttributionResponse(BaseModel):
    days: int
    start_date: str
    end_date: str
    purchase_count: int
    base_amount_eur: float
    weekday: int
    current_price: float
    baseline_eur: float
    baseline_pp: float
    total_eur: float
    total_pp: float
    contributions: list[AttributionShare]
    bot: PerformanceSide
    dca: PerformanceSide


class ForwardStats(BaseModel):
    n: int
    mean_pct: float
    median_pct: float
    win_rate: float


class ForwardBucket(BaseModel):
    multiplier: float
    signal: str
    score_min: int
    score_max: int
    by_horizon: dict[str, ForwardStats]


class ForwardReturnsResponse(BaseModel):
    days: int
    horizons: list[int]
    sample_size: int
    baseline: dict[str, ForwardStats]
    buckets: list[ForwardBucket]


class RollingWindow(BaseModel):
    start: str
    end: str
    edge_pp: float
    edge_eur: float
    bot_pct: float
    dca_pct: float


class RollingWindowsResponse(BaseModel):
    window_days: int
    weekday: int
    count: int
    wins: int
    win_rate: float
    median_pp: float
    p10_pp: float
    p90_pp: float
    best_pp: float
    worst_pp: float
    windows: list[RollingWindow]


class GridSpread(BaseModel):
    value: float
    min_multiplier: float
    max_multiplier: float


class GridCell(BaseModel):
    weekday: int
    spread: float
    edge_pp: float
    edge_eur: float
    purchase_count: int


class GridResponse(BaseModel):
    days: int
    current_weekday: int
    current_spread: float
    spreads: list[GridSpread]
    cells: list[GridCell]


class SignalQuintile(BaseModel):
    quintile: int
    from_value: float
    to_value: float
    n: int
    median_pct: float


class SignalScreen(BaseModel):
    key: str
    label: str
    in_score: bool
    current: float
    current_quintile: int
    quintiles: list[SignalQuintile]
    spread_pct: float


class CandidatesResponse(BaseModel):
    days: int
    horizon: int
    quintiles: int
    sample_size: int
    baseline_median_pct: float
    signals: list[SignalScreen]


class ScoringVariant(BaseModel):
    key: str
    label: str
    description: str
    windows: int
    win_rate: float
    median_pp: float
    worst_pp: float
    best_pp: float
    invested_eur: float


class ScoringVariantsResponse(BaseModel):
    window_days: int
    weekday: int
    dca_invested_eur: float
    variants: list[ScoringVariant]


class ChartEvent(BaseModel):
    date: str
    kind: str
    label: str
    price: float


class ScorePoint(BaseModel):
    date: str
    close: float
    score: int
    multiplier: float


class CostBasis(BaseModel):
    purchase_count: int
    btc_total: float
    invested_eur: float
    avg_price_eur: float
    market_twap_eur: float
    advantage_pct: float
    best_price_eur: float
    worst_price_eur: float
    first_buy: Optional[str]
    days: int


class HoldingBucket(BaseModel):
    lots: int
    btc: float
    cost_eur: float
    value_eur: float
    gain_eur: float


class RipeningMonth(HoldingBucket):
    month: str


class ExcludedBuys(BaseModel):
    """Failed buys, which every other figure leaves out."""

    count: int
    btc: float
    eur: float


class HoldingsResponse(BaseModel):
    as_of: str
    current_price: float
    include_dry_run: bool
    cost_basis: CostBasis
    free: HoldingBucket
    locked: HoldingBucket
    next_free_date: Optional[str]
    next_free_in_days: int
    timeline: list[RipeningMonth]
    excluded: ExcludedBuys


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


class DigestBlock(BaseModel):
    """One switchable section of the weekly report, as offered to the frontend.

    The catalogue is served rather than hard-coded in the client, so the block
    list, its order and its wording can only ever come from `digest.BLOCKS`.
    """

    key: str
    label: str
    description: str
    enabled: bool


class DigestSettingsResponse(BaseModel):
    enabled: bool
    weekday: int
    send_time: str
    next_run: Optional[str]
    discord_configured: bool
    blocks: list[DigestBlock]


class DigestField(BaseModel):
    """One field of the rendered embed, tagged with the block it came from."""

    key: str
    name: str
    value: str
    inline: bool


class DigestPreviewResponse(BaseModel):
    """The whole report, every block rendered. The client hides what is off."""

    title: str
    description: str
    color: int
    fields: list[DigestField]


class CredentialField(BaseModel):
    """One editable secret as the dashboard sees it.

    Carries its own label, hint and placeholder so the client renders whatever
    `credentials.FIELDS` offers instead of keeping a second copy of the list.
    `masked` is the only thing ever sent about a value - never the value.
    """

    key: str
    group: str
    label: str
    hint: str
    placeholder: str
    multiline: bool
    configured: bool
    source: str  # dashboard | env | none
    masked: str


class SchedulerJob(BaseModel):
    id: str
    label: str
    next_run: Optional[str]


class SystemInfo(BaseModel):
    """Read-only answer to "is my bot actually running?"."""

    now: str
    timezone: str
    uptime_seconds: int
    python_version: str
    scheduler_running: bool
    jobs: list[SchedulerJob]
    database_bytes: int
    purchase_count: int
    candle_count: int
    candle_from: Optional[str]
    candle_to: Optional[str]
    research_cache_age_seconds: Optional[int]


class SetupResponse(BaseModel):
    credentials: list[CredentialField]
    system: SystemInfo


class CoinbaseTestResponse(BaseModel):
    """Always 200: a rejected key is an answer, not a server error."""

    ok: bool
    detail: str
    eur_available: Optional[float] = None
    btc_available: Optional[float] = None


class MaintenanceResponse(BaseModel):
    ok: bool
    detail: str
