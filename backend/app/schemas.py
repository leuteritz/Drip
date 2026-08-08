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
    catch_up: Optional[bool] = None


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
    # Each indicator's own share of the score, keyed "fng" / "rsi" / "ma" — the
    # same isolation `research` uses, so the header can say why the amount is
    # what it is without restating a threshold.
    points: dict[str, int]
    factors: list[str]
    current_price: float
    fear_greed: int
    fng_classification: str
    rsi: float
    ma_350: float
    ma_distance_pct: float
    multiplier: float
    signal: str
    # The signal colour as an int, the same one the Discord embed uses.
    color: int


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
    # Coinbase's share of the same euros. Only the buys that reported a fill
    # can be summed, so `fees_from` says how many of the counted buys that was
    # — an install whose history predates the fill being read has 0 of them,
    # which is not the same as having paid nothing.
    fees_eur: float = 0.0
    fees_pct: float = 0.0
    fees_from: int = 0


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


class MilestoneOutlook(BaseModel):
    """The next round number of sats. `available` is false once the ladder runs
    out, or before there is any stack to measure against it."""

    available: bool
    target_sats: Optional[float] = None
    remaining_sats: Optional[float] = None
    progress_pct: Optional[float] = None
    weeks_away: Optional[int] = None
    eta: Optional[str] = None


class StreakOutlook(BaseModel):
    weeks: int
    total_weeks: int


class OutlookResponse(BaseModel):
    """The forward-looking card: the recent rate carried forward.

    `year_sats` prices a year of future buys at today's price, which is the one
    number nobody has — it is an order of magnitude, and the card says so.
    """

    sats: float
    invested_eur: float
    current_price: float
    rate_weeks: int
    per_week_eur: float
    per_week_sats: float
    year_eur: float
    year_sats: float
    milestone: MilestoneOutlook
    streak: StreakOutlook


class PulseWeek(BaseModel):
    """One calendar week of the record. `state` is one of landed / failed /
    missed / paused — a failed order still means the machine woke up, which is
    why it is not the same as silence, and a paused week means the silence was
    asked for."""

    start: str
    expected: str
    state: str
    buys: int
    eur: float
    sats: float


class PulseGap(BaseModel):
    """A week nothing was bought, priced at one base-amount buy on the day the
    schedule would have bought. `price_eur` is 0 when no close was cached near
    enough to that day to price it honestly."""

    week_start: str
    expected: str
    price_eur: float
    eur: float
    sats: float


class PulseCost(BaseModel):
    """What the gaps add up to, in both units the app speaks."""

    eur: float
    sats: float


class PulseOverdue(BaseModel):
    """`since` is the last moment the schedule said to buy — null on an install
    with no history at all, which is the one case where there is no slot worth
    naming and nothing can be overdue."""

    since: Optional[str]
    days: int
    paused: bool
    overdue: bool


class PulseResponse(BaseModel):
    """Did the drip actually drip, week by week.

    Counts every run, test or live: the question is whether the bot woke up,
    not whether it spent money. `weeks_checked` starts at the first buy — Drip
    cannot have missed a week it did not exist for.

    `weeks_judged` is `weeks_checked` minus the weeks that were deliberately
    paused, and it is what `coverage_pct` is a share of: a week nobody wanted is
    not a week the bot got wrong, so it leaves the figure alone instead of
    dragging it down.
    """

    as_of: str
    window_weeks: int
    weeks_checked: int
    weeks_judged: int
    landed: int
    failed: int
    missed: int
    paused: int
    coverage_pct: float
    base_amount_eur: float
    first_buy: Optional[str]
    weeks: list[PulseWeek]
    gaps: list[PulseGap]
    gap_cost: PulseCost
    overdue: PulseOverdue


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
    # What the exchange charged, and whether it said so at all. `filled` false
    # means the row's bitcoin was worked out from the amount and the price
    # rather than read off the order — every dry run and every imported row —
    # and a fee of 0 there means unknown, not free.
    fee_eur: float = 0.0
    filled: bool = False
    # What asked for the buy: "schedule", "manual", "catchup" — or empty, which
    # is a row from before this was recorded and means unknown, not scheduled.
    origin: str = ""


class ReceiptScoring(BaseModel):
    """How the stored readings became the multiplier on the row.

    `points_total` is those readings scored the way `score_indicators` scores
    today; `score` is what the row recorded at the time. They part company on an
    imported history and after any change to a threshold, so both are sent and
    the dialog says which is which rather than showing a sum that does not add
    up.
    """

    score: int
    score_max: int
    points: dict[str, int]
    points_total: int
    multiplier: float
    signal: str
    fear_greed: int
    rsi: float
    ma_350: float
    ma_distance_pct: float


class ReceiptOutcome(BaseModel):
    """What the buy is worth now, and the multiplier's share of that.

    `extra_*` is what the score added on top of the base amount — negative below
    1.0x, where it held money back — and `multiplier_eur` is what that decision
    has been worth since, in euros.
    """

    current_price: float
    value_eur: float
    gain_eur: float
    gain_pct: float
    base_eur: float
    extra_eur: float
    extra_btc: float
    multiplier_eur: float


class ReceiptStanding(BaseModel):
    """Whether the buy caught a good price, against the days around it.

    `vs_market_pct` is positive when it went in below what the market averaged
    over that window. `days_covered` is how much of the window had prices at
    all — a buy from this week has no days after it.
    """

    window_days: int
    days_covered: int
    market_avg_eur: float
    vs_market_pct: float


class ReceiptResponse(BaseModel):
    """One buy, answered on its own terms.

    `standing` and `free_at` are absent on anything that is not real bitcoin — a
    dry run and a failed order have no place among the buys and no holding age.
    """

    id: int
    timestamp: datetime
    origin: str
    status: str
    order_id: str
    dry_run: bool
    failed: bool
    real: bool
    filled: bool
    amount_eur: float
    btc_amount: float
    price_eur: float
    fee_eur: float
    scoring: ReceiptScoring
    outcome: ReceiptOutcome
    standing: Optional[ReceiptStanding] = None
    free_at: Optional[str] = None
    free_in_days: int = 0


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
