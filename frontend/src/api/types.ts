// Response shapes of the backend API.
//
// These mirror the pydantic models in `backend/app/schemas.py`, which are wired
// into the routers via `response_model=`. Nothing generates them - when you
// change a schema on the backend, change it here too.

export interface BotSettings {
  id: number;
  base_amount_eur: number;
  schedule_weekday: number;
  schedule_time: string;
  dry_run: boolean;
  paused_until: string | null;
  discord_enabled: boolean;
}

export interface BotStatus {
  dry_run: boolean;
  paused: boolean;
  paused_until: string | null;
  next_run: string | null;
  has_credentials: boolean;
  discord_configured: boolean;
}

/** One switchable section of the weekly report. The catalogue — which blocks
 *  exist, their order and their wording — comes from the backend, so the dialog
 *  never has its own copy of it. */
export interface DigestBlock {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface DigestSettings {
  enabled: boolean;
  /** 0 = Monday … 6 = Sunday, same convention as the buy schedule. */
  weekday: number;
  send_time: string;
  next_run: string | null;
  discord_configured: boolean;
  blocks: DigestBlock[];
}

/** A partial edit; `blocks` is merged into the stored selection server-side. */
export interface DigestUpdate {
  enabled?: boolean;
  weekday?: number;
  send_time?: string;
  blocks?: Record<string, boolean>;
}

export interface DigestField {
  /** The block this field belongs to — how the preview filters. */
  key: string;
  name: string;
  value: string;
  inline: boolean;
}

/** The rendered report, every block included. Built by the same backend code
 *  that builds the real message, so the preview cannot drift from Discord. */
export interface DigestPreview {
  title: string;
  description: string;
  /** Discord embed colour as an integer, from the palette in strategy.py. */
  color: number;
  fields: DigestField[];
}

export interface Purchase {
  id: number;
  timestamp: string;
  price_eur: number;
  amount_eur: number;
  btc_amount: number;
  fear_greed: number;
  rsi: number;
  ma_350: number;
  score: number;
  multiplier: number;
  order_id: string;
  status: string;
  dry_run: boolean;
}

/** Purchase.order_id sentinel for a buy that failed (see backend/app/constants.py). */
export const ORDER_ID_ERROR = "ERROR";

export interface Indicators {
  score: number;
  score_max: number;
  /** Each indicator's own share of the score — the three always sum to it. */
  points: { fng: number; rsi: number; ma: number };
  factors: string[];
  current_price: number;
  fear_greed: number;
  fng_classification: string;
  rsi: number;
  ma_350: number;
  ma_distance_pct: number;
  multiplier: number;
  signal: string;
}

/** The next round number of sats. Absent fields mean `available` is false. */
export interface MilestoneOutlook {
  available: boolean;
  target_sats: number | null;
  remaining_sats: number | null;
  progress_pct: number | null;
  weeks_away: number | null;
  eta: string | null;
}

/** The recent stacking rate carried forward — the one card that looks ahead. */
export interface Outlook {
  sats: number;
  invested_eur: number;
  current_price: number;
  /** How many weeks the per-week rate averages over. */
  rate_weeks: number;
  per_week_eur: number;
  per_week_sats: number;
  year_eur: number;
  /** A year of buys at *today's* price — an order of magnitude, not a forecast. */
  year_sats: number;
  milestone: MilestoneOutlook;
  streak: { weeks: number; total_weeks: number };
}

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PerformanceSide {
  invested_eur: number;
  btc_total: number;
  value_eur: number;
  profit_eur: number;
  profit_pct: number;
}

export interface Performance extends PerformanceSide {
  current_price: number;
  purchase_count: number;
  dca: PerformanceSide;
  include_dry_run: boolean;
}

export interface ComparisonPoint {
  date: string;
  price: number;
  bot_value: number;
  bot_invested: number;
  dca_value: number;
  dca_invested: number;
}

export interface AccountBalance {
  configured: boolean;
  eur_available: number | null;
  btc_available: number | null;
  error: string | null;
}

export interface RunResult {
  skipped: boolean;
  reason?: string | null;
  purchase?: Purchase | null;
  analysis?: Indicators | null;
  error?: string | null;
}

export interface SimulationSummary {
  days: number;
  purchase_count: number;
  current_price: number;
  start_date: string;
  end_date: string;
  weekday: number;
  base_amount_eur: number;
  bot: PerformanceSide;
  dca: PerformanceSide;
}

export interface SimulationResult {
  summary: SimulationSummary;
  series: ComparisonPoint[];
}

/** One indicator's Shapley share of the edge over plain DCA. */
export interface AttributionShare {
  key: string;
  label: string;
  eur: number;
  pp: number;
}

export interface Attribution {
  days: number;
  start_date: string;
  end_date: string;
  purchase_count: number;
  base_amount_eur: number;
  weekday: number;
  current_price: number;
  baseline_eur: number;
  baseline_pp: number;
  total_eur: number;
  total_pp: number;
  contributions: AttributionShare[];
  bot: PerformanceSide;
  dca: PerformanceSide;
}

export interface ForwardStats {
  n: number;
  mean_pct: number;
  median_pct: number;
  win_rate: number;
}

export interface ForwardBucket {
  multiplier: number;
  signal: string;
  score_min: number;
  score_max: number;
  /** Keyed by horizon in days, as a string — JSON has no integer keys. */
  by_horizon: Record<string, ForwardStats>;
}

export interface ForwardReturns {
  days: number;
  horizons: number[];
  sample_size: number;
  baseline: Record<string, ForwardStats>;
  buckets: ForwardBucket[];
}

export interface RollingWindow {
  start: string;
  end: string;
  edge_pp: number;
  edge_eur: number;
  bot_pct: number;
  dca_pct: number;
}

export interface RollingWindows {
  window_days: number;
  weekday: number;
  count: number;
  wins: number;
  win_rate: number;
  median_pp: number;
  p10_pp: number;
  p90_pp: number;
  best_pp: number;
  worst_pp: number;
  windows: RollingWindow[];
}

export interface GridSpread {
  /** Exponent applied to every multiplier; 1 is what the bot does today. */
  value: number;
  min_multiplier: number;
  max_multiplier: number;
}

export interface GridCell {
  weekday: number;
  spread: number;
  edge_pp: number;
  edge_eur: number;
  purchase_count: number;
}

export interface StrategyGrid {
  days: number;
  current_weekday: number;
  current_spread: number;
  spreads: GridSpread[];
  cells: GridCell[];
}

export interface ScorePoint {
  date: string;
  close: number;
  score: number;
  multiplier: number;
}

export interface ChartEvent {
  date: string;
  /** "halving" | "high" | "low" — drives the marker's colour and label. */
  kind: string;
  label: string;
  price: number;
}

export interface SignalQuintile {
  quintile: number;
  from_value: number;
  to_value: number;
  n: number;
  median_pct: number;
}

export interface SignalScreenRow {
  key: string;
  label: string;
  in_score: boolean;
  current: number;
  current_quintile: number;
  quintiles: SignalQuintile[];
  /** Cheapest fifth minus most expensive fifth. Positive means it works. */
  spread_pct: number;
}

export interface CandidateSignals {
  days: number;
  horizon: number;
  quintiles: number;
  sample_size: number;
  baseline_median_pct: number;
  signals: SignalScreenRow[];
}

export interface ScoringVariant {
  key: string;
  label: string;
  description: string;
  windows: number;
  win_rate: number;
  median_pp: number;
  worst_pp: number;
  best_pp: number;
  invested_eur: number;
}

export interface ScoringVariants {
  window_days: number;
  weekday: number;
  dca_invested_eur: number;
  variants: ScoringVariant[];
}

export interface CostBasis {
  purchase_count: number;
  btc_total: number;
  invested_eur: number;
  avg_price_eur: number;
  /** The market's own time-weighted average price over the same days. */
  market_twap_eur: number;
  /** Positive means the average euro went in below that market average. */
  advantage_pct: number;
  best_price_eur: number;
  worst_price_eur: number;
  first_buy: string | null;
  days: number;
}

export interface HoldingBucket {
  lots: number;
  btc: number;
  cost_eur: number;
  value_eur: number;
  gain_eur: number;
}

export interface RipeningMonth extends HoldingBucket {
  month: string;
}

export interface Holdings {
  as_of: string;
  current_price: number;
  include_dry_run: boolean;
  cost_basis: CostBasis;
  free: HoldingBucket;
  locked: HoldingBucket;
  next_free_date: string | null;
  next_free_in_days: number;
  timeline: RipeningMonth[];
  /** Failed buys, which every other figure on the dashboard leaves out. */
  excluded: { count: number; btc: number; eur: number };
}

/** Where a secret in effect actually came from. */
export type CredentialSource = "dashboard" | "env" | "none";

/** One editable secret. Label, hint and placeholder arrive from the backend
 *  (`credentials.FIELDS`), so the dialog renders whatever the install offers
 *  rather than keeping a second copy of the list. `masked` is all that is ever
 *  sent about a stored value — the value itself never leaves the Pi. */
export interface CredentialField {
  key: "coinbase_api_key" | "coinbase_api_secret" | "discord_webhook_url";
  /** "coinbase" | "discord" — which tile the field belongs under. */
  group: string;
  label: string;
  hint: string;
  placeholder: string;
  multiline: boolean;
  configured: boolean;
  source: CredentialSource;
  masked: string;
}

export interface SchedulerJob {
  id: string;
  label: string;
  next_run: string | null;
}

/** Read-only answer to "is my bot actually running?". */
export interface SystemInfo {
  now: string;
  timezone: string;
  uptime_seconds: number;
  python_version: string;
  scheduler_running: boolean;
  jobs: SchedulerJob[];
  database_bytes: number;
  purchase_count: number;
  candle_count: number;
  candle_from: string | null;
  candle_to: string | null;
  research_cache_age_seconds: number | null;
}

export interface SetupInfo {
  credentials: CredentialField[];
  system: SystemInfo;
}

/** A partial edit of the stored secrets. An empty string clears a field, which
 *  hands it back to whatever `backend/.env` provides. */
export type CredentialsUpdate = Partial<
  Record<CredentialField["key"], string>
>;

export interface CoinbaseTest {
  ok: boolean;
  detail: string;
  eur_available: number | null;
  btc_available: number | null;
}

export interface Maintenance {
  ok: boolean;
  detail: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  errors: { line: number; message: string }[];
}
