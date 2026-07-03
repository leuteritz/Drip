import { useCallback, useEffect, useState, type ReactNode } from "react";
import InfoIcon from "~icons/ph/info";
import TrendDownIcon from "~icons/ph/trend-down";
import TrendUpIcon from "~icons/ph/trend-up";
import {
  api,
  fmtEur,
  fmtPct,
  type Candle,
  type ComparisonPoint,
  type Purchase,
} from "../api/client";
import ComparisonChart from "../components/ComparisonChart";
import PriceChart from "../components/PriceChart";
import { Card, CardTitle, Spinner, Toggle } from "../components/ui";

const RANGES = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

type ChartView = "price" | "strategy";

/**
 * The Overview body: the price / strategy chart. The reservoir headline and its
 * stats now live in the hero header (SiteHeader); the "include dry runs" filter
 * is lifted to App (it drives both the header stats and the strategy series),
 * and is surfaced here next to the chart it affects.
 */
export default function Overview({
  purchases,
  includeDryRun,
  onToggleDryRun,
}: {
  purchases: Purchase[];
  includeDryRun: boolean;
  onToggleDryRun: (v: boolean) => void;
}) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [comparison, setComparison] = useState<ComparisonPoint[]>([]);
  const [compLoaded, setCompLoaded] = useState(false);
  const [rangeDays, setRangeDays] = useState(90);
  const [chartView, setChartView] = useState<ChartView>("price");
  const [error, setError] = useState<string | null>(null);

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
    api.getCandles(rangeDays).then(setCandles).catch((e) => setError(String(e)));
  }, [rangeDays]);

  // The strategy series is only fetched once the user opens that view, and is
  // refreshed whenever the buy history changes (e.g. after a header test buy).
  useEffect(() => {
    if (chartView === "strategy") loadComparison(includeDryRun);
  }, [chartView, includeDryRun, purchases, loadComparison]);

  const strategySeries = comparison.slice(-rangeDays);
  const latest = strategySeries.length
    ? strategySeries[strategySeries.length - 1]
    : null;

  return (
    <section id="overview" className="scroll-mt-20">
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
        <Card className="flex flex-col">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              {chartView === "price"
                ? "Bitcoin price and buys"
                : "My strategy vs. plain DCA"}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-ink-soft">
                Include dry runs
                <Toggle checked={includeDryRun} onChange={onToggleDryRun} />
              </label>
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
          {chartView === "strategy" && strategySeries.length > 1 && latest && (
            <StrategyKpis latest={latest} />
          )}
          <div className="h-[380px] md:h-[440px]">
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
          {chartView === "strategy" && strategySeries.length > 1 && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-soft">
              <InfoIcon className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-ink">Plain DCA</strong> is the same
                schedule and base amount, but without Drip&apos;s 0.5&times;&ndash;1.5&times;
                score multiplier &mdash; the multiplier is the only difference between the
                two lines. Shaded areas show where your strategy is in profit (teal) or at
                a loss (rose) versus what you invested &mdash; not versus DCA.
              </span>
            </p>
          )}
        </Card>
      </div>
    </section>
  );
}

/**
 * At-a-glance verdict for the strategy view, derived from the latest point of
 * the comparison series so it always matches what the chart shows.
 */
function StrategyKpis({ latest }: { latest: ComparisonPoint }) {
  const botProfit = latest.bot_value - latest.bot_invested;
  const botPct = latest.bot_invested > 0 ? (botProfit / latest.bot_invested) * 100 : 0;
  const edge = botProfit - (latest.dca_value - latest.dca_invested);
  const up = botProfit >= 0;
  const ahead = edge >= 0;
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <Kpi label="Drip P&L" tone={up ? "up" : "down"}>
        <span className="inline-flex items-center gap-1.5">
          {up ? <TrendUpIcon aria-hidden="true" /> : <TrendDownIcon aria-hidden="true" />}
          {up ? "+" : ""}
          {fmtEur(botProfit)}
          <span className="text-sm font-normal opacity-80">({fmtPct(botPct)})</span>
        </span>
      </Kpi>
      <Kpi label="vs. plain DCA" tone={ahead ? "up" : "down"}>
        {ahead ? "+" : ""}
        {fmtEur(edge)}
        <span className="ml-1.5 text-sm font-normal opacity-80">
          {ahead ? "ahead" : "behind"}
        </span>
      </Kpi>
      <Kpi label="Invested" tone="plain">
        {fmtEur(latest.bot_invested)}
      </Kpi>
    </div>
  );
}

function Kpi({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "up" | "down" | "plain";
  children: ReactNode;
}) {
  const toneClass =
    tone === "up" ? "text-teal" : tone === "down" ? "text-rose" : "text-ink";
  return (
    <dl className="min-w-[130px] flex-1 rounded-xl bg-sand-soft/60 px-4 py-2.5">
      <dt className="text-xs font-medium text-ink-soft">{label}</dt>
      <dd className={`font-display text-xl font-semibold ${toneClass}`}>{children}</dd>
    </dl>
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
