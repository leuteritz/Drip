import { useCallback, useEffect, useState } from "react";
import FlaskIcon from "~icons/ph/flask";
import KeyIcon from "~icons/ph/key";
import LightningIcon from "~icons/ph/lightning-fill";
import PlayIcon from "~icons/ph/play-fill";
import ClockIcon from "~icons/ph/clock";
import DropSlashIcon from "~icons/ph/drop-slash";
import TrendUpIcon from "~icons/ph/trend-up";
import TrendDownIcon from "~icons/ph/trend-down";
import {
  api,
  fmtBtc,
  fmtEur,
  fmtPct,
  WEEKDAYS,
  type BotStatus,
  type Candle,
  type ComparisonPoint,
  type Indicators,
  type Performance,
  type Purchase,
  type RunResult,
} from "../api/client";
import ComparisonChart from "../components/ComparisonChart";
import { DripAnimation, ScoreDrops } from "../components/drops";
import Gauge from "../components/Gauge";
import PriceChart from "../components/PriceChart";
import { Badge, Card, CardTitle, Spinner, StatCard, Toggle } from "../components/ui";

const RANGES = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

export default function Dashboard() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [comparison, setComparison] = useState<ComparisonPoint[]>([]);
  const [rangeDays, setRangeDays] = useState(90);
  const [includeDryRun, setIncludeDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (dry: boolean) => {
    const [perf, comp] = await Promise.all([
      api.getPerformance(dry),
      api.getComparison(dry),
    ]);
    setPerformance(perf);
    setComparison(comp);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [st, purch] = await Promise.all([api.getStatus(), api.getPurchases()]);
        setStatus(st);
        setPurchases(purch);
        await loadStats(true);
        // Indicators last - the first call may fetch 350 days of candles
        setIndicators(await api.getIndicators());
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [loadStats]);

  useEffect(() => {
    api.getCandles(rangeDays).then(setCandles).catch((e) => setError(String(e)));
  }, [rangeDays]);

  const toggleDryRunStats = async (v: boolean) => {
    setIncludeDryRun(v);
    await loadStats(v);
  };

  const runAnalysis = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await api.runNow(true); // manual runs are always dry runs
      setRunResult(result);
      setPurchases(await api.getPurchases());
      await loadStats(includeDryRun);
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
    <div className="space-y-6">
      {/* Hero: the reservoir */}
      <Card className="relative overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-ink-soft">
              Your reservoir
            </div>
            {performance ? (
              <>
                <div className="mt-1 font-display text-6xl font-bold leading-none text-ink max-sm:text-5xl">
                  {fmtEur(performance.value_eur)}
                </div>
                <div
                  className={`mt-3 flex items-center gap-2 text-lg font-bold ${
                    profitable ? "text-teal" : "text-rose"
                  }`}
                >
                  {profitable ? <TrendUpIcon /> : <TrendDownIcon />}
                  {profitable ? "+" : ""}
                  {fmtEur(performance.profit_eur)} ({fmtPct(performance.profit_pct)})
                  <span className="text-sm font-medium text-ink-soft">
                    on {fmtEur(performance.invested_eur)} invested
                  </span>
                </div>
              </>
            ) : (
              <Spinner />
            )}
            {indicators && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <ScoreDrops multiplier={indicators.multiplier} />
                <Badge tone="teal">x{indicators.multiplier} buff active</Badge>
                <span className="text-sm text-ink-soft">{indicators.signal}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <DripAnimation />
            {status && (
              <div className="flex flex-col items-center gap-2 text-center">
                {status.paused && status.paused_until ? (
                  <Badge tone="rose">
                    <DropSlashIcon /> Faucet off until {formatDate(status.paused_until)}
                  </Badge>
                ) : status.next_run ? (
                  <Badge tone="water">
                    <ClockIcon /> Next buy {formatDateTime(status.next_run)}
                  </Badge>
                ) : null}
                <Badge tone={status.dry_run ? "neutral" : "rose"}>
                  {status.dry_run ? (
                    <>
                      <FlaskIcon /> Dry run
                    </>
                  ) : (
                    <>
                      <LightningIcon /> Live trading
                    </>
                  )}
                </Badge>
                {!status.has_credentials && (
                  <Badge tone="rose">
                    <KeyIcon /> No API keys - dry run only
                  </Badge>
                )}
                <button
                  onClick={runAnalysis}
                  disabled={running}
                  className="mt-1 flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream transition hover:bg-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-50"
                >
                  <PlayIcon />
                  {running ? "Analyzing..." : "Test a buy now"}
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {runResult?.analysis && (
        <Card className="border-water">
          <div className="flex flex-wrap items-center gap-3 font-bold text-teal">
            <ScoreDrops multiplier={runResult.analysis.multiplier} size="text-lg" />
            {runResult.analysis.signal} - score {runResult.analysis.score}/
            {runResult.analysis.score_max}, would buy{" "}
            {fmtEur(runResult.purchase?.amount_eur ?? 0)}
          </div>
          <ul className="mt-2 space-y-0.5 text-sm text-ink-soft">
            {runResult.analysis.factors.map((f) => (
              <li key={f}>- {f}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Stats row */}
      {performance && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">
              {profitable ? "The strategy is paying off" : "Currently under water"}
            </h2>
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              Include dry runs
              <Toggle checked={includeDryRun} onChange={toggleDryRunStats} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Invested"
              value={fmtEur(performance.invested_eur)}
              sub={`${performance.purchase_count} buys`}
            />
            <StatCard label="Bitcoin stack" value={fmtBtc(performance.btc_total)} />
            <StatCard
              label="Profit / loss"
              value={`${profitable ? "+" : ""}${fmtEur(performance.profit_eur)}`}
              sub={fmtPct(performance.profit_pct)}
              tone={profitable ? "up" : "down"}
            />
            <StatCard
              label="BTC price"
              value={fmtEur(performance.current_price, 0)}
              sub="Coinbase BTC-EUR"
            />
          </div>
        </>
      )}

      {/* Price chart */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <CardTitle>Bitcoin price and buys</CardTitle>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setRangeDays(r.days)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
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
        {candles.length ? (
          <PriceChart candles={candles} purchases={purchases} />
        ) : (
          <Spinner />
        )}
      </Card>

      {/* Live analysis */}
      <Card>
        <CardTitle>Live analysis - what would Drip do right now?</CardTitle>
        {indicators ? (
          <div className="grid grid-cols-2 items-center gap-6 md:grid-cols-4">
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
                350-day average
              </div>
              <div className="mt-1 font-display text-2xl font-semibold">
                {fmtEur(indicators.ma_350, 0)}
              </div>
              <div
                className={`text-sm font-bold ${
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
              <div className="text-sm text-ink-soft">
                score {indicators.score}/{indicators.score_max} - x{indicators.multiplier}{" "}
                on the base amount
              </div>
            </div>
          </div>
        ) : (
          <Spinner />
        )}
      </Card>

      {/* Strategy comparison */}
      <Card>
        <CardTitle>Drip strategy vs. plain DCA (portfolio value)</CardTitle>
        {comparison.length > 1 ? (
          <>
            <ComparisonChart data={comparison} />
            {performance && (
              <p className="mt-3 text-sm text-ink-soft">{strategyVerdict(performance)}</p>
            )}
          </>
        ) : (
          <p className="py-8 text-center text-sm text-ink-soft">
            Not enough buys for a comparison yet - the chart appears after the first few
            bot runs.
          </p>
        )}
      </Card>
    </div>
  );
}

function strategyVerdict(p: Performance): string {
  const diff = p.profit_pct - p.dca.profit_pct;
  if (Math.abs(diff) < 0.05) {
    return "The Drip strategy and plain DCA are currently neck and neck.";
  }
  if (diff > 0) {
    return `The Drip strategy is beating plain DCA by ${diff.toFixed(2)} percentage points (Drip ${p.profit_pct.toFixed(2)}% vs. DCA ${p.dca.profit_pct.toFixed(2)}%).`;
  }
  return `Plain DCA is currently ahead by ${Math.abs(diff).toFixed(2)} percentage points (Drip ${p.profit_pct.toFixed(2)}% vs. DCA ${p.dca.profit_pct.toFixed(2)}%).`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[(d.getDay() + 6) % 7]} ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
