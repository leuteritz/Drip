// Typed client for the backend API

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

export interface RunResult {
  skipped: boolean;
  reason?: string;
  purchase?: Purchase;
  analysis?: Indicators;
  error?: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`API error ${resp.status}: ${body}`);
  }
  return resp.json() as Promise<T>;
}

export const api = {
  getSettings: () => request<BotSettings>("/api/settings"),
  updateSettings: (update: Partial<BotSettings>) =>
    request<BotSettings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(update),
    }),
  pause: (days: number) =>
    request<BotSettings>("/api/settings/pause", {
      method: "POST",
      body: JSON.stringify({ days }),
    }),
  resume: () => request<BotSettings>("/api/settings/resume", { method: "POST" }),
  getStatus: () => request<BotStatus>("/api/bot/status"),
  runNow: (dryRun: boolean | null) =>
    request<RunResult>("/api/bot/run", {
      method: "POST",
      body: JSON.stringify({ dry_run: dryRun }),
    }),
  getPurchases: () => request<Purchase[]>("/api/purchases"),
  getIndicators: () => request<Indicators>("/api/market/indicators"),
  getCandles: (days: number) => request<Candle[]>(`/api/market/candles?days=${days}`),
  getPerformance: (includeDryRun: boolean) =>
    request<Performance>(`/api/stats/performance?include_dry_run=${includeDryRun}`),
  getComparison: (includeDryRun: boolean) =>
    request<ComparisonPoint[]>(`/api/stats/comparison?include_dry_run=${includeDryRun}`),
};

export const fmtEur = (v: number, digits = 2) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 2 ? 2 : digits,
  }).format(v);

export const fmtBtc = (v: number) => `${v.toFixed(8)} BTC`;

export const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
