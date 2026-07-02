import { useCallback, useEffect, useState, type ReactNode } from "react";
import PlayIcon from "~icons/ph/play-fill";
import TrendUpIcon from "~icons/ph/trend-up";
import TrendDownIcon from "~icons/ph/trend-down";
import {
  api,
  fmtBtc,
  fmtEur,
  fmtPct,
  WEEKDAYS,
  type BotSettings,
  type Candle,
  type ComparisonPoint,
  type Indicators,
  type Performance,
  type Purchase,
  type RunResult,
} from "../api/client";
import ComparisonChart from "../components/ComparisonChart";
import PriceChart from "../components/PriceChart";
import { HeaderPill } from "../components/SiteHeader";
import { Card, CardTitle, Spinner, Toggle } from "../components/ui";

const RANGES = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

type ChartView = "price" | "strategy";

export default function Overview({
  settings,
  indicators,
  purchases,
  onPurchasesChanged,
}: {
  settings: BotSettings | null;
  indicators: Indicators | null;
  purchases: Purchase[];
  onPurchasesChanged: () => void;
}) {
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [comparison, setComparison] = useState<ComparisonPoint[]>([]);
  const [compLoaded, setCompLoaded] = useState(false);
  const [rangeDays, setRangeDays] = useState(90);
  const [includeDryRun, setIncludeDryRun] = useState(true);
  const [chartView, setChartView] = useState<ChartView>("price");
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPerf = useCallback((dry: boolean) => {
    api.getPerformance(dry).then(setPerformance).catch((e) => setError(String(e)));
  }, []);

  const loadComparison = useCallback((dry: boolean) => {
    api
      .getComparison(dry)
      .then((c) => {
        setComparison(c);
        setCompLoaded(true);
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    loadPerf(true);
  }, [loadPerf]);

  useEffect(() => {
    api.getCandles(rangeDays).then(setCandles).catch((e) => setError(String(e)));
  }, [rangeDays]);

  // The strategy series is only fetched once the user opens that view.
  useEffect(() => {
    if (chartView === "strategy") loadComparison(includeDryRun);
  }, [chartView, includeDryRun, loadComparison]);

  const toggleDryRunStats = (v: boolean) => {
    setIncludeDryRun(v);
    loadPerf(v);
  };

  const runAnalysis = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await api.runNow(true); // manual runs are always dry runs
      setRunResult(result);
      onPurchasesChanged();
      loadPerf(includeDryRun);
      if (chartView === "strategy") loadComparison(includeDryRun);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  const profitable = (performance?.profit_eur ?? 0) >= 0;
  const strategySeries = comparison.slice(-rangeDays);

  return (
    <section id="overview" className="scroll-mt-20">
      {/* Reservoir hero on the gradient */}
      <div className="hero-gradient relative overflow-hidden px-6 pt-6 pb-14 md:px-10 md:pb-16">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6 text-cream">
          {/* Reservoir + the four key metrics, side by side */}
          <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
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

            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              <HeroStat
                label="BTC price"
                value={performance ? fmtEur(performance.current_price, 0) : "—"}
                sub="Coinbase (live)"
              />
              <HeroStat
                label="Invested"
                value={performance ? fmtEur(performance.invested_eur) : "—"}
                sub={performance ? `${performance.purchase_count} buys` : undefined}
              />
              <HeroStat
                label="Bitcoin stack"
                value={performance ? fmtBtc(performance.btc_total) : "—"}
                sub="BTC"
              />
              <HeroStat
                label="350-day avg"
                value={indicators ? fmtEur(indicators.ma_350, 0) : "—"}
                sub={indicators ? `price ${fmtPct(indicators.ma_distance_pct)}` : undefined}
              />
              <HeroStat
                label="RSI"
                value={indicators ? String(Math.round(indicators.rsi)) : "—"}
                sub={
                  indicators
                    ? indicators.rsi < 30
                      ? "Oversold"
                      : indicators.rsi > 70
                        ? "Overbought"
                        : "Neutral"
                    : undefined
                }
              />
              <HeroStat
                label="Fear & Greed"
                value={indicators ? String(indicators.fear_greed) : "—"}
                sub={indicators?.fng_classification}
              />
              <HeroStat
                label="Score"
                value={indicators ? `${indicators.score}/${indicators.score_max}` : "—"}
                sub={indicators ? `x${indicators.multiplier}` : undefined}
              />
              <HeroStat
                label="Schedule"
                value={
                  settings
                    ? `${WEEKDAYS[settings.schedule_weekday]}s, ${settings.schedule_time}`
                    : "—"
                }
              />
              <HeroStat
                label="Next buy"
                value={
                  settings && indicators
                    ? fmtEur(settings.base_amount_eur * indicators.multiplier)
                    : "—"
                }
                sub={settings ? `base ${fmtEur(settings.base_amount_eur)}` : undefined}
              />
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

        {/* Rolling waterline */}
        <svg
          viewBox="0 0 1080 46"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -bottom-px h-[54px] w-full"
        >
          <g className="animate-wave">
            <path
              d="M-120 32 q30 -11 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 V70 H-120 Z"
              fill="rgba(241,255,250,.55)"
            />
          </g>
          <g className="animate-wave-fast">
            <path
              d="M-120 28 q30 -14 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 V70 H-120 Z"
              fill="#f1fffa"
            />
          </g>
        </svg>
      </div>

      {/* Body: tiles + chart/read-out */}
      <div className="flex flex-col gap-4 px-4 py-5 md:px-6 md:py-6">
        {error && (
          <Card className="border-rose/50">
            <div className="font-bold text-rose">{error}</div>
            <div className="mt-2 text-sm text-ink-soft">
              Is the backend running? <code className="text-ink">uvicorn app.main:app</code>
            </div>
          </Card>
        )}

        {/* Chart */}
        <Card className="flex min-h-[440px] flex-col">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              {chartView === "price"
                ? "Bitcoin price and buys"
                : "My strategy vs. the market"}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                <ViewPill on={chartView === "price"} onClick={() => setChartView("price")}>
                  Price &amp; buys
                </ViewPill>
                <ViewPill
                  on={chartView === "strategy"}
                  onClick={() => setChartView("strategy")}
                >
                  My strategy
                </ViewPill>
              </div>
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
          </div>
          <div className="min-h-0 flex-1">
            {chartView === "price" ? (
              candles.length ? (
                <PriceChart candles={candles} purchases={purchases} height="100%" />
              ) : (
                <Spinner />
              )
            ) : !compLoaded ? (
              <Spinner />
            ) : strategySeries.length > 1 ? (
              <ComparisonChart data={strategySeries} height="100%" />
            ) : (
              <p className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-soft">
                Not enough buys yet to chart your strategy. Run a test buy or import your
                history.
              </p>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

function ViewPill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-bold transition ${
        on ? "bg-teal text-cream" : "bg-sand-soft text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

// A key metric shown as a plain text column on the gradient hero (no background).
function HeroStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 text-cream">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-cream/70">
        {label}
      </span>
      <span className="font-display text-xl font-semibold leading-tight md:text-2xl">
        {value}
      </span>
      {sub && <span className="text-xs font-medium text-cream/70">{sub}</span>}
    </div>
  );
}
