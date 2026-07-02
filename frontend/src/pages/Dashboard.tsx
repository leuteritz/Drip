import { useCallback, useEffect, useState } from "react";
import FlaskIcon from "~icons/ph/flask";
import KeyIcon from "~icons/ph/key";
import LightningIcon from "~icons/ph/lightning-fill";
import PlayIcon from "~icons/ph/play-fill";
import ClockIcon from "~icons/ph/clock";
import DropSlashIcon from "~icons/ph/drop-slash";
import TrendUpIcon from "~icons/ph/trend-up";
import TrendDownIcon from "~icons/ph/trend-down";
import ChartLineIcon from "~icons/ph/chart-line-up";
import {
  api,
  fmtBtc,
  fmtEur,
  fmtPct,
  WEEKDAYS,
  type BotSettings,
  type BotStatus,
  type Candle,
  type Indicators,
  type Performance,
  type Purchase,
  type RunResult,
} from "../api/client";
import { ScoreDrops } from "../components/drops";
import PriceChart from "../components/PriceChart";
import SimulationModal from "../components/SimulationModal";
import TabHeader, { type Page } from "../components/TabHeader";
import { Card, CardTitle, Spinner, Toggle } from "../components/ui";
import type { ReactNode } from "react";

const RANGES = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

export default function Dashboard({
  active,
  onNavigate,
}: {
  active: Page;
  onNavigate: (p: Page) => void;
}) {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [rangeDays, setRangeDays] = useState(90);
  const [includeDryRun, setIncludeDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [showSim, setShowSim] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPerf = useCallback(async (dry: boolean) => {
    setPerformance(await api.getPerformance(dry));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [st, set, purch] = await Promise.all([
          api.getStatus(),
          api.getSettings(),
          api.getPurchases(),
        ]);
        setStatus(st);
        setSettings(set);
        setPurchases(purch);
        await loadPerf(true);
        // Indicators last - the first call may fetch 350 days of candles
        setIndicators(await api.getIndicators());
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [loadPerf]);

  useEffect(() => {
    api.getCandles(rangeDays).then(setCandles).catch((e) => setError(String(e)));
  }, [rangeDays]);

  const toggleDryRunStats = async (v: boolean) => {
    setIncludeDryRun(v);
    await loadPerf(v);
  };

  const runAnalysis = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await api.runNow(true); // manual runs are always dry runs
      setRunResult(result);
      setPurchases(await api.getPurchases());
      await loadPerf(includeDryRun);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  const profitable = (performance?.profit_eur ?? 0) >= 0;

  const statusPills = status && (
    <>
      {status.paused && status.paused_until ? (
        <HeaderPill>
          <DropSlashIcon /> Off until {formatDate(status.paused_until)}
        </HeaderPill>
      ) : status.next_run ? (
        <HeaderPill>
          <ClockIcon /> Next {formatDateTime(status.next_run)}
        </HeaderPill>
      ) : null}
      <HeaderPill>
        {status.dry_run ? (
          <>
            <FlaskIcon /> Dry run
          </>
        ) : (
          <>
            <LightningIcon /> Live
          </>
        )}
      </HeaderPill>
      {!status.has_credentials && (
        <HeaderPill>
          <KeyIcon /> No API keys
        </HeaderPill>
      )}
    </>
  );

  return (
    <div className="flex h-full flex-col">
      <TabHeader active={active} onNavigate={onNavigate} right={statusPills}>
        {/* Hero: the reservoir */}
        <div className="flex flex-wrap items-end justify-between gap-4 text-cream">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-cream/85">
              Your reservoir
            </div>
            {performance ? (
              <>
                <div className="mt-1 font-display text-5xl font-bold leading-none md:text-6xl">
                  {fmtEur(performance.value_eur)}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-base font-bold">
                  <span className="inline-flex items-center gap-1.5">
                    {profitable ? <TrendUpIcon /> : <TrendDownIcon />}
                    {profitable ? "+" : ""}
                    {fmtEur(performance.profit_eur)} ({fmtPct(performance.profit_pct)})
                  </span>
                  <span className="text-xs font-medium text-cream/80">
                    on {fmtEur(performance.invested_eur)}
                  </span>
                </div>
              </>
            ) : (
              <div className="mt-2 h-16 w-40 animate-pulse rounded-xl bg-cream/20" />
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {indicators && (
                <HeaderPill>
                  x{indicators.multiplier} &middot; {indicators.signal}
                </HeaderPill>
              )}
              <label className="flex items-center gap-2 text-xs font-medium text-cream/85">
                Include dry runs
                <Toggle checked={includeDryRun} onChange={toggleDryRunStats} />
              </label>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              onClick={runAnalysis}
              disabled={running}
              className="flex items-center gap-2 rounded-full bg-cream px-4 py-2.5 text-sm font-bold text-teal shadow-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream disabled:opacity-60"
            >
              <PlayIcon />
              {running ? "Testing..." : "Test a buy (no charge)"}
            </button>
            {runResult?.analysis && (
              <div className="rounded-xl bg-cream/20 px-3 py-1.5 text-right text-xs font-bold text-cream">
                {runResult.analysis.signal} &middot; would buy{" "}
                {fmtEur(runResult.purchase?.amount_eur ?? 0)}
              </div>
            )}
          </div>
        </div>
      </TabHeader>

      {/* Body: fixed height, never scrolls */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 md:gap-4 md:p-6">
        {error ? (
          <Card className="border-rose/50">
            <div className="font-bold text-rose">{error}</div>
            <div className="mt-2 text-sm text-ink-soft">
              Is the backend running? <code className="text-ink">uvicorn app.main:app</code>
            </div>
          </Card>
        ) : (
          <>
            {/* Stat tiles */}
            <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              <MiniStat
                label="BTC price"
                value={performance ? fmtEur(performance.current_price, 0) : "-"}
                sub="Coinbase (live)"
              />
              <MiniStat
                label="Invested"
                value={performance ? fmtEur(performance.invested_eur) : "-"}
                sub={performance ? `${performance.purchase_count} buys` : undefined}
              />
              <MiniStat
                label="Bitcoin stack"
                value={performance ? fmtBtc(performance.btc_total) : "-"}
                sub="BTC"
              />
              <MiniStat
                label="350-day avg"
                value={indicators ? fmtEur(indicators.ma_350, 0) : "-"}
                sub={indicators ? `price ${fmtPct(indicators.ma_distance_pct)}` : undefined}
                tone={indicators && indicators.ma_distance_pct < 0 ? "up" : undefined}
              />
            </div>

            {/* Chart + read-out */}
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
              <Card className="flex min-h-0 flex-col md:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <CardTitle>Bitcoin price and buys</CardTitle>
                  <div className="flex gap-1">
                    {RANGES.map((r) => (
                      <button
                        key={r.days}
                        onClick={() => setRangeDays(r.days)}
                        className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                          rangeDays === r.days
                            ? "bg-ink text-cream"
                            : "bg-sand-soft text-ink-soft hover:text-ink"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="min-h-0 flex-1">
                  {candles.length ? (
                    <PriceChart candles={candles} purchases={purchases} height="100%" />
                  ) : (
                    <Spinner />
                  )}
                </div>
              </Card>

              <Card className="flex min-h-0 flex-col gap-3 overflow-hidden">
                <div>
                  <CardTitle>What Drip sees</CardTitle>
                  {indicators ? (
                    <div className="space-y-3">
                      <IndicatorBar
                        label={`RSI ${Math.round(indicators.rsi)}`}
                        pct={indicators.rsi}
                        note={
                          indicators.rsi < 30
                            ? "Oversold"
                            : indicators.rsi > 70
                              ? "Overbought"
                              : "Neutral"
                        }
                      />
                      <IndicatorBar
                        label={`F&G ${indicators.fear_greed}`}
                        pct={indicators.fear_greed}
                        note={indicators.fng_classification}
                      />
                      <div className="flex items-center gap-2 pt-1">
                        <ScoreDrops multiplier={indicators.multiplier} size="text-base" />
                        <span className="text-xs text-ink-soft">
                          score {indicators.score}/{indicators.score_max}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <Spinner />
                  )}
                </div>

                <div className="mt-auto border-t border-sand-soft pt-3">
                  <CardTitle>Your plan</CardTitle>
                  {settings ? (
                    <div className="font-display text-lg font-semibold text-ink">
                      {WEEKDAYS[settings.schedule_weekday]}s, {settings.schedule_time}
                    </div>
                  ) : (
                    <div className="h-6" />
                  )}
                  {settings && (
                    <div className="text-xs text-ink-soft">
                      base <b className="text-ink">{fmtEur(settings.base_amount_eur)}</b>
                      {indicators && (
                        <>
                          {" "}
                          &rarr; next &asymp;{" "}
                          <b className="text-teal">
                            {fmtEur(settings.base_amount_eur * indicators.multiplier)}
                          </b>
                        </>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => setShowSim(true)}
                    className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full bg-teal px-4 py-2 text-sm font-bold text-cream transition hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                  >
                    <ChartLineIcon /> Simulate backtest
                  </button>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>

      {showSim && settings && (
        <SimulationModal settings={settings} onClose={() => setShowSim(false)} />
      )}
    </div>
  );
}

function HeaderPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/20 px-3 py-1.5 text-xs font-bold text-cream">
      {children}
    </span>
  );
}

function IndicatorBar({
  label,
  pct,
  note,
}: {
  label: string;
  pct: number;
  note: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-bold text-ink">{label}</span>
        <span className="text-ink-soft">{note}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-sand-soft">
        <div
          className="h-full rounded-full"
          style={{
            width: `${clamped}%`,
            background: "linear-gradient(90deg,#93b7be,#45818c)",
          }}
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down";
}) {
  const valueColor =
    tone === "up" ? "text-teal" : tone === "down" ? "text-rose" : "text-ink";
  return (
    <Card className="flex flex-col justify-center gap-0.5 !p-4">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </span>
      <span className={`font-display text-2xl font-semibold ${valueColor} max-sm:text-xl`}>
        {value}
      </span>
      {sub && <span className="text-xs text-ink-soft">{sub}</span>}
    </Card>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[(d.getDay() + 6) % 7].slice(0, 3)} ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
