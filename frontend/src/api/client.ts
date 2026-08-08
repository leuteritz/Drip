// The only place that talks to the backend. Response shapes live in ./types,
// display formatting in ../lib/format.

import type {
  AccountBalance,
  Attribution,
  BotSettings,
  BotStatus,
  Candle,
  CandidateSignals,
  ChartEvent,
  CoinbaseTest,
  ComparisonPoint,
  CredentialsUpdate,
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
  Pulse,
  Purchase,
  Receipt,
  RollingWindows,
  RunResult,
  ScorePoint,
  ScoringVariants,
  SetupInfo,
  SimulationResult,
  StrategyGrid,
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!resp.ok) {
    throw new Error(describeError(resp.status, await resp.text()));
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
  // No dry-run flag on purpose: the pulse counts every run the bot made.
  getPulse: () => request<Pulse>("/api/stats/pulse"),
  deletePurchase: (id: number) =>
    request<{ deleted: number }>(`/api/purchases/${id}`, { method: "DELETE" }),
  clearTestRuns: () =>
    request<{ deleted: number }>("/api/purchases/test-runs", { method: "DELETE" }),
  deleteAllPurchases: () =>
    request<{ deleted: number }>("/api/purchases", { method: "DELETE" }),
  exportUrl: "/api/purchases/export",
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
  testNotification: () =>
    request<{ sent: boolean; reason?: string }>("/api/bot/test-notification", {
      method: "POST",
    }),
};
