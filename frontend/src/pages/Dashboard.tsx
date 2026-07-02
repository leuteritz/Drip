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
import { DripAnimation, ScoreDrops } from "../components/drops";
import Gauge from "../components/Gauge";
import PriceChart from "../components/PriceChart";
import SimulationModal from "../components/SimulationModal";
import { Badge, Card, CardTitle, Spinner, Toggle } from "../components/ui";

const RANGES = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

export default function Dashboard() {
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

  if (error) {
    return (
      <Card className="border-rose/50">
        <div className="font-bold text-rose">{error}</div>
        <div className="mt-2 text-sm text-ink-soft">
          Is the backend running? <code className="text-ink">uvicorn app.main:app</code>
        </div>
      </Card>
    );
  }

  const profitable = (performance?.profit_eur ?? 0) >= 0;

  return (
    <>
      <div className="max-md:space-y-4 md:grid md:h-[calc(100dvh-3rem)] md:grid-cols-12 md:grid-rows-6 md:gap-4 md:overflow-hidden">
        {/* Hero: the reservoir */}
        <Card className="relative flex flex-col overflow-hidden md:col-span-5 md:row-span-3">
          <div className="flex flex-1 flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-ink-soft">
                Your reservoir
              </div>
              {performance ? (
                <>
                  <div className="mt-1 font-display text-5xl font-bold leading-none text-ink max-sm:text-4xl">
                    {fmtEur(performance.value_eur)}
                  </div>
                  <div
                    className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-bold ${
                      profitable ? "text-teal" : "text-rose"
                    }`}
                  >
                    {profitable ? <TrendUpIcon /> : <TrendDownIcon />}
                    {profitable ? "+" : ""}
                    {fmtEur(performance.profit_eur)} ({fmtPct(performance.profit_pct)})
                    <span className="text-xs font-medium text-ink-soft">
                      on {fmtEur(performance.invested_eur)}
                    </span>
                  </div>
                </>
              ) : (
                <Spinner />
              )}
              {indicators && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <ScoreDrops multiplier={indicators.multiplier} />
                  <Badge tone="teal">x{indicators.multiplier} buff</Badge>
                  <span className="text-xs text-ink-soft">{indicators.signal}</span>
                </div>
              )}
              <label className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
                Include dry runs
                <Toggle checked={includeDryRun} onChange={toggleDryRunStats} />
              </label>
              {runResult?.analysis && (
                <div className="mt-3 rounded-xl border-2 border-water bg-water-soft px-3 py-2 text-xs font-bold text-teal">
                  {runResult.analysis.signal} - score {runResult.analysis.score}/
                  {runResult.analysis.score_max}, would buy{" "}
                  {fmtEur(runResult.purchase?.amount_eur ?? 0)}
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-2">
              <DripAnimation />
              {status && (
                <div className="flex flex-col items-center gap-1.5 text-center">
                  {status.paused && status.paused_until ? (
                    <Badge tone="rose">
                      <DropSlashIcon /> Off until {formatDate(status.paused_until)}
                    </Badge>
                  ) : status.next_run ? (
                    <Badge tone="water">
                      <ClockIcon /> Next {formatDateTime(status.next_run)}
                    </Badge>
                  ) : null}
                  <Badge tone={status.dry_run ? "neutral" : "rose"}>
                    {status.dry_run ? (
                      <>
                        <FlaskIcon /> Dry run
                      </>
                    ) : (
                      <>
                        <LightningIcon /> Live
                      </>
                    )}
                  </Badge>
                  {!status.has_credentials && (
                    <Badge tone="rose">
                      <KeyIcon /> No API keys
                    </Badge>
                  )}
                  <button
                    onClick={runAnalysis}
                    disabled={running}
                    className="mt-1 flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-bold text-cream transition hover:bg-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-50"
                  >
                    <PlayIcon />
                    {running ? "Testing..." : "Test a buy (no charge)"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* BTC price */}
        <Card className="flex flex-col justify-center md:col-span-3 md:row-span-2">
          <CardTitle>BTC price</CardTitle>
          {performance ? (
            <>
              <div className="font-display text-4xl font-bold leading-none text-ink max-sm:text-3xl">
                {fmtEur(performance.current_price, 0)}
              </div>
              <div className="mt-2 text-xs text-ink-soft">Coinbase BTC-EUR (live)</div>
            </>
          ) : (
            <Spinner />
          )}
        </Card>

        {/* Config + simulate */}
        <Card className="flex flex-col justify-between md:col-span-4 md:row-span-2">
          <div>
            <CardTitle>Your plan</CardTitle>
            {settings ? (
              <>
                <div className="font-display text-3xl font-bold leading-none text-ink">
                  {WEEKDAYS[settings.schedule_weekday]}s
                </div>
                <div className="mt-1 text-sm text-ink-soft">
                  at <b className="text-ink">{settings.schedule_time}</b> · base{" "}
                  <b className="text-ink">{fmtEur(settings.base_amount_eur)}</b>
                  {indicators && (
                    <>
                      {" "}
                      → next ≈{" "}
                      <b className="text-teal">
                        {fmtEur(settings.base_amount_eur * indicators.multiplier)}
                      </b>
                    </>
                  )}
                </div>
              </>
            ) : (
              <Spinner />
            )}
          </div>
          <button
            onClick={() => setShowSim(true)}
            className="mt-3 flex items-center justify-center gap-2 rounded-full bg-teal px-4 py-2.5 text-sm font-bold text-cream transition hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            <ChartLineIcon /> Simulate backtest
          </button>
        </Card>

        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-4 md:col-span-7 md:col-start-6 md:row-span-1 md:row-start-3">
          <MiniStat
            label="Invested"
            value={performance ? fmtEur(performance.invested_eur) : "-"}
            sub={performance ? `${performance.purchase_count} buys` : undefined}
          />
          <MiniStat
            label="Bitcoin stack"
            value={performance ? fmtBtc(performance.btc_total) : "-"}
          />
          <MiniStat
            label="Profit / loss"
            value={
              performance
                ? `${profitable ? "+" : ""}${fmtEur(performance.profit_eur)}`
                : "-"
            }
            sub={performance ? fmtPct(performance.profit_pct) : undefined}
            tone={profitable ? "up" : "down"}
          />
        </div>

        {/* Price chart */}
        <Card className="flex min-h-0 flex-col md:col-span-7 md:row-span-3 md:row-start-4">
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
          <div className="h-64 min-h-0 md:h-auto md:flex-1">
            {candles.length ? (
              <PriceChart candles={candles} purchases={purchases} height="100%" />
            ) : (
              <Spinner />
            )}
          </div>
        </Card>

        {/* Live analysis */}
        <Card className="flex min-h-0 flex-col md:col-span-5 md:row-span-3 md:row-start-4">
          <CardTitle>What would Drip do right now?</CardTitle>
          {indicators ? (
            <div className="grid flex-1 grid-cols-2 items-center gap-2">
              <Gauge
                value={indicators.rsi}
                label="RSI (14)"
                sublabel={
                  indicators.rsi < 30
                    ? "Oversold"
                    : indicators.rsi > 70
                      ? "Overbought"
                      : "Neutral"
                }
                zones={[
                  { to: 30, color: "#45818c" },
                  { to: 45, color: "#93b7be" },
                  { to: 70, color: "#d5c7bc" },
                  { to: 100, color: "#785964" },
                ]}
              />
              <Gauge
                value={indicators.fear_greed}
                label="Fear & Greed"
                sublabel={indicators.fng_classification}
                zones={[
                  { to: 25, color: "#45818c" },
                  { to: 45, color: "#93b7be" },
                  { to: 55, color: "#d5c7bc" },
                  { to: 100, color: "#785964" },
                ]}
              />
              <div className="text-center">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">
                  350-day avg
                </div>
                <div className="mt-1 font-display text-xl font-semibold">
                  {fmtEur(indicators.ma_350, 0)}
                </div>
                <div
                  className={`text-xs font-bold ${
                    indicators.ma_distance_pct < 0 ? "text-teal" : "text-ink-soft"
                  }`}
                >
                  price {fmtPct(indicators.ma_distance_pct)}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">
                  Buy strength
                </div>
                <ScoreDrops multiplier={indicators.multiplier} />
                <div className="text-xs text-ink-soft">
                  score {indicators.score}/{indicators.score_max}
                </div>
              </div>
            </div>
          ) : (
            <Spinner />
          )}
        </Card>
      </div>

      {showSim && settings && (
        <SimulationModal settings={settings} onClose={() => setShowSim(false)} />
      )}
    </>
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
      <span className={`font-display text-xl font-semibold ${valueColor}`}>{value}</span>
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
