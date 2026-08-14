// The only place that talks to the backend. Response shapes live in ./types,
// display formatting in ../lib/format.

import type {
  AccountBalance,
  Attribution,
  AuthState,
  BotSettings,
  BotStatus,
  Candle,
  CandidateSignals,
  ChartEvent,
  CoinbaseTest,
  ComparisonPoint,
  CredentialsUpdate,
  Custody,
  DigestPreview,
  DigestSettings,
  DigestUpdate,
  ForwardReturns,
  Holdings,
  ImportResult,
  Indicators,
  Maintenance,
  Outlook,
  Performance,
  Preflight,
  Pulse,
  Purchase,
  Receipt,
  RollingWindows,
  SettingsUpdate,
  RunResult,
  ScorePoint,
  ScoringVariants,
  SetupInfo,
  SimulationResult,
  StrategyGrid,
  Waterline,
  Years,
} from "./types";

export type * from "./types";
export { ORDER_ID_ERROR } from "./types";

/** Pulls FastAPI's `detail` out of an error body so users see the message,
 *  not the raw JSON envelope. */
function describeError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.detail === "string") return parsed.detail;
  } catch {
    // not JSON - fall through to the raw body
  }
  return body ? `API error ${status}: ${body}` : `API error ${status}`;
}

/**
 * What to do when the backend says "sign in".
 *
 * This is the only place in the app that can see a 401 at all — it is the only
 * place that talks to the backend — so a session that dies mid-visit (thirty
 * days on, or because the password was changed on another device) puts the lock
 * screen back up instead of firing `ErrorToast` nine times. `App` registers it.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // `credentials` defaults to "same-origin", which is exactly what the session
  // cookie needs — stated here so nobody "fixes" it by adding an option.
  const resp = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!resp.ok) {
    if (resp.status === 401) onUnauthorized?.();
    throw new Error(describeError(resp.status, await resp.text()));
  }
  return resp.json() as Promise<T>;
}

export const api = {
  /** Whether there is a lock, and whether this browser is past it. Open. */
  getAuth: () => request<AuthState>("/api/auth"),
  login: (password: string, stay: boolean) =>
    request<AuthState>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password, stay }),
    }),
  logout: () => request<AuthState>("/api/auth/logout", { method: "POST" }),
  /** An empty `next` removes the lock — asked twice before it is sent. */
  setPassword: (current: string, next: string) =>
    request<AuthState>("/api/auth/password", {
      method: "PUT",
      body: JSON.stringify({ current, new: next }),
    }),

  getSettings: () => request<BotSettings>("/api/settings"),
  updateSettings: (update: SettingsUpdate) =>
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
  // Whether the next drip would actually land. Under /api/bot rather than
  // /api/setup because it is about the next run, not about the install: one
  // asks what is configured, the other whether that survives Monday.
  getPreflight: () => request<Preflight>("/api/bot/preflight"),
  runNow: (dryRun: boolean | null) =>
    request<RunResult>("/api/bot/run", {
      method: "POST",
      body: JSON.stringify({ dry_run: dryRun }),
    }),
  getBalance: () => request<AccountBalance>("/api/account/balance"),
  // Manual buy with a fixed amount; dry_run stays null so the stored
  // setting decides — going live only happens via the LiveModeDialog flow.
  buyNow: (amountEur: number) =>
    request<RunResult>("/api/bot/buy", {
      method: "POST",
      body: JSON.stringify({ amount_eur: amountEur, dry_run: null }),
    }),
  getPurchases: () => request<Purchase[]>("/api/purchases"),
  // One buy on its own terms. Fetched when a row is opened rather than with the
  // history: it prices the stack against today and nothing on the table needs it.
  getReceipt: (id: number) => request<Receipt>(`/api/purchases/${id}/receipt`),
  getIndicators: () => request<Indicators>("/api/market/indicators"),
  getCandles: (days: number) => request<Candle[]>(`/api/market/candles?days=${days}`),
  getPerformance: (includeDryRun: boolean) =>
    request<Performance>(`/api/stats/performance?include_dry_run=${includeDryRun}`),
  getComparison: (includeDryRun: boolean) =>
    request<ComparisonPoint[]>(`/api/stats/comparison?include_dry_run=${includeDryRun}`),
  getSimulation: (days: number) =>
    request<SimulationResult>(`/api/simulate?days=${days}`),
  // Research is read-only and shares one cached scoring table on the backend,
  // so the first of these calls after a cold start is the slow one.
  getAttribution: (days: number) =>
    request<Attribution>(`/api/research/attribution?days=${days}`),
  getForwardReturns: (days: number) =>
    request<ForwardReturns>(`/api/research/forward-returns?days=${days}`),
  getRollingWindows: (windowDays: number) =>
    request<RollingWindows>(`/api/research/rolling?window_days=${windowDays}`),
  getStrategyGrid: (days: number) =>
    request<StrategyGrid>(`/api/research/grid?days=${days}`),
  getCandidateSignals: (days: number) =>
    request<CandidateSignals>(`/api/research/candidates?days=${days}`),
  getScoringVariants: (windowDays: number) =>
    request<ScoringVariants>(`/api/research/scoring-variants?window_days=${windowDays}`),
  getChartEvents: (days: number) =>
    request<ChartEvent[]>(`/api/research/events?days=${days}`),
  datasetUrl: (days: number) => `/api/research/dataset.csv?days=${days}`,
  // The weekly report: its settings, a full render of it, and sending it now.
  // The preview is the expensive one (it builds the whole report), so it is
  // fetched only when the dialog opens.
  getDigest: () => request<DigestSettings>("/api/digest"),
  updateDigest: (update: DigestUpdate) =>
    request<DigestSettings>("/api/digest", {
      method: "PUT",
      body: JSON.stringify(update),
    }),
  getDigestPreview: () => request<DigestPreview>("/api/digest/preview"),
  sendDigest: () =>
    request<{ sent: boolean; reason?: string }>("/api/digest/send", {
      method: "POST",
    }),
  getScoreHistory: (days: number) =>
    request<ScorePoint[]>(`/api/research/score-history?days=${days}`),
  getHoldings: (includeDryRun: boolean) =>
    request<Holdings>(`/api/stats/holdings?include_dry_run=${includeDryRun}`),
  getOutlook: (includeDryRun: boolean) =>
    request<Outlook>(`/api/stats/outlook?include_dry_run=${includeDryRun}`),
  getYears: (includeDryRun: boolean) =>
    request<Years>(`/api/stats/years?include_dry_run=${includeDryRun}`),
  // Takes the filter: it is cut from the same series the comparison chart
  // plots, and the two have to show the same days.
  getWaterline: (includeDryRun: boolean) =>
    request<Waterline>(`/api/stats/waterline?include_dry_run=${includeDryRun}`),
  // No dry-run flag on purpose: the pulse counts every run the bot made.
  getPulse: () => request<Pulse>("/api/stats/pulse"),
  // Nor here, for a stronger reason: a test run never bought bitcoin, so it
  // cannot be in anyone's custody.
  getCustody: () => request<Custody>("/api/stats/custody"),
  deletePurchase: (id: number) =>
    request<{ deleted: number }>(`/api/purchases/${id}`, { method: "DELETE" }),
  clearTestRuns: () =>
    request<{ deleted: number }>("/api/purchases/test-runs", { method: "DELETE" }),
  deleteAllPurchases: () =>
    request<{ deleted: number }>("/api/purchases", { method: "DELETE" }),
  exportUrl: "/api/purchases/export",
  /** One calendar year's acquisitions, for a tax return. Real buys only, and
   *  it computes no tax — see `backend/app/tax.py`. */
  taxUrl: (year: number) => `/api/purchases/tax.csv?year=${year}`,
  importPurchases: async (file: File, includeErrors: boolean): Promise<ImportResult> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("include_errors", String(includeErrors));
    // No Content-Type header: the browser sets the multipart boundary itself.
    const resp = await fetch("/api/purchases/import", { method: "POST", body: fd });
    if (!resp.ok) throw new Error(describeError(resp.status, await resp.text()));
    return resp.json() as Promise<ImportResult>;
  },
  // Setup: what is configured and how the install is doing, in one call.
  // Secrets go in but never come back — the response only ever carries a mask.
  getSetup: () => request<SetupInfo>("/api/setup"),
  saveCredentials: (update: CredentialsUpdate) =>
    request<SetupInfo>("/api/setup/credentials", {
      method: "PUT",
      body: JSON.stringify(update),
    }),
  testCoinbase: () =>
    request<CoinbaseTest>("/api/setup/coinbase/test", { method: "POST" }),
  clearCandleCache: () =>
    request<Maintenance>("/api/setup/cache/candles", { method: "DELETE" }),
  clearResearchCache: () =>
    request<Maintenance>("/api/setup/cache/research", { method: "DELETE" }),
  backupUrl: "/api/setup/backup",
  // The other half of the backup, and the only destructive call in the app that
  // is not about the purchase history: it replaces the whole database. Refusals
  // come back as 400 with a sentence, so `describeError` is what the dialog
  // shows — the backend is the only thing that knows why a file was no good.
  restoreBackup: async (file: File): Promise<Maintenance> => {
    const fd = new FormData();
    fd.append("file", file);
    const resp = await fetch("/api/setup/restore", { method: "POST", body: fd });
    if (!resp.ok) throw new Error(describeError(resp.status, await resp.text()));
    return resp.json() as Promise<Maintenance>;
  },
  testNotification: () =>
    request<{ sent: boolean; reason?: string }>("/api/bot/test-notification", {
      method: "POST",
    }),
};
