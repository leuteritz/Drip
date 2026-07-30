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

export interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  errors: { line: number; message: string }[];
}
