// Response shapes of the backend API.
//
// These mirror the pydantic models in `backend/app/schemas.py`, which are wired
// into the routers via `response_model=`. Nothing generates them - when you
// change a schema on the backend, change it here too.

/** How often the drip drips. `lib/cadence.ts` holds the words for each. */
export type CadenceKey = "daily" | "weekly" | "biweekly" | "monthly";

export interface BotSettings {
  id: number;
  base_amount_eur: number;
  cadence: CadenceKey;
  /** Which day inside the period — ignored when the cadence is daily, and the
   *  *first* such weekday of the month when it is monthly. */
  schedule_weekday: number;
  schedule_time: string;
  dry_run: boolean;
  paused_until: string | null;
  discord_enabled: boolean;
  /** Buy a slot that went by while Drip was not running. Off unless asked for. */
  catch_up: boolean;
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
  /** What the exchange charged out of `amount_eur`. Zero unless `filled`. */
  fee_eur: number;
  /**
   * Whether the bitcoin and the price were read off the filled order rather
   * than worked out from the amount. False for every dry run, every imported
   * row, and a real buy whose fill could not be read — where a fee of zero
   * means "not known", not "nothing was charged".
   */
  filled: boolean;
  /**
   * What asked for the buy: `schedule`, `manual` or `catchup`. Empty means the
   * row predates Drip recording it, or came from a file that never carried it —
   * unknown, and never to be read as "scheduled". See `lib/origin.ts`.
   */
  origin: string;
}

/** How the readings stored on a buy became the multiplier beside them.
 *
 *  `points_total` is those readings scored the way the backend scores today;
 *  `score` is what the row recorded at the time. An imported history disagrees
 *  about that, and so does any buy made before a threshold changed. */
export interface ReceiptScoring {
  score: number;
  score_max: number;
  points: { fng: number; rsi: number; ma: number };
  points_total: number;
  multiplier: number;
  signal: string;
  fear_greed: number;
  rsi: number;
  ma_350: number;
  ma_distance_pct: number;
}

/** What the buy is worth now, and the multiplier's share of that.
 *
 *  `extra_eur` / `extra_btc` are what the score put in on top of the base
 *  amount — negative below 1.0x, where it held money back — and
 *  `multiplier_eur` is what that decision has been worth since. */
export interface ReceiptOutcome {
  current_price: number;
  value_eur: number;
  gain_eur: number;
  gain_pct: number;
  base_eur: number;
  extra_eur: number;
  extra_btc: number;
  multiplier_eur: number;
}

/** Whether the buy caught a good price, against the days around it rather than
 *  against the whole history — where a rising market makes every recent buy
 *  look expensive and every early one cheap, whatever the timing was worth.
 *  `vs_market_pct` is positive when it went in below that window's average. */
export interface ReceiptStanding {
  window_days: number;
  /** How much of the window had prices — a buy from this week has no days after it. */
  days_covered: number;
  market_avg_eur: number;
  vs_market_pct: number;
}

/** One buy, answered on its own terms — see `backend/app/receipt.py`.
 *
 *  `standing` and `free_at` are null on anything that is not real bitcoin: a
 *  dry run and a failed order have no rank among the buys and no holding age. */
export interface Receipt {
  id: number;
  timestamp: string;
  origin: string;
  status: string;
  order_id: string;
  dry_run: boolean;
  failed: boolean;
  real: boolean;
  filled: boolean;
  amount_eur: number;
  btc_amount: number;
  price_eur: number;
  fee_eur: number;
  scoring: ReceiptScoring;
  outcome: ReceiptOutcome;
  standing: ReceiptStanding | null;
  free_at: string | null;
  free_in_days: number;
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
  /** The signal's colour as an int — the same one the Discord embed uses. */
  color: number;
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
  /** Consecutive periods of the drip's own cadence with a buy in them — not
   *  weeks, since a monthly saver who never missed one was reporting 1. */
  streak: { periods: number; total_periods: number; cadence: CadenceKey };
}

/** One period of the bot's own record — a day, week, fortnight or month. */
export interface PulsePeriod {
  /** The first day of the period. */
  start: string;
  /** The day the schedule would have bought on — only read for a missed one. */
  expected: string;
  /** `landed` — a buy went through · `failed` — it tried and the order errored ·
   *  `missed` — nothing happened at all · `paused` — nothing was meant to. */
  state: "landed" | "failed" | "missed" | "paused";
  buys: number;
  eur: number;
  sats: number;
}

/** A period nothing was bought in, priced at one base-amount buy on its own
 *  day. `price_eur` is 0 when no close was cached near enough to price it. */
export interface PulseGap {
  period_start: string;
  expected: string;
  price_eur: number;
  eur: number;
  sats: number;
}

/** Did the drip actually drip. Counts every run, test or live — the question is
 *  whether the bot woke up, not whether it spent money, so no dry-run filter. */
export interface Pulse {
  as_of: string;
  /** What a period *is* here — the client puts the right word around a count. */
  cadence: CadenceKey;
  window_periods: number;
  periods_checked: number;
  /** `periods_checked` minus the paused ones — what `coverage_pct` is a share
   *  of. A period nobody wanted is not one the bot got wrong. */
  periods_judged: number;
  landed: number;
  failed: number;
  missed: number;
  /** Periods whose slot fell inside a pause you asked for. */
  paused: number;
  coverage_pct: number;
  base_amount_eur: number;
  first_buy: string | null;
  periods: PulsePeriod[];
  /** Most recent first. */
  gaps: PulseGap[];
  gap_cost: { eur: number; sats: number };
  /** The last scheduled buy never arrived. A paused bot is never overdue, and
   *  an install with no history has no slot to be late for (`since` is null). */
  overdue: { since: string | null; days: number; paused: boolean; overdue: boolean };
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
  /** Coinbase's share of the same euros, over the buys that reported a fill. */
  fees_eur: number;
  fees_pct: number;
  /** How many of the counted buys knew what they were charged. */
  fees_from: number;
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

/** How one preflight check came out. `unknown` is never folded into either of
 *  its neighbours: a balance that could not be fetched is not a healthy one and
 *  not an empty one, and saying so is what makes the rest credible. */
export type PreflightStatus = "pass" | "warn" | "fail" | "unknown";

/** One thing that has to hold before the next drip can land. `detail` arrives
 *  rendered from the backend — only it knows what went wrong. */
export interface PreflightCheck {
  key: string;
  label: string;
  status: PreflightStatus;
  detail: string;
}

/** Will the next buy go through — asked before it is due, not after.
 *
 *  `status` is the worst of the checks. `dry_run` changes what a failure
 *  *means*: no order is placed on a test run, so a missing key cannot stop it
 *  and the backend has already softened it to a warning. */
export interface Preflight {
  status: PreflightStatus;
  ready: boolean;
  dry_run: boolean;
  next_run: string | null;
  next_amount_eur: number;
  checks: PreflightCheck[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  errors: { line: number; message: string }[];
}
