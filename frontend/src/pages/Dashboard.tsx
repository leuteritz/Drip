import { useCallback, useEffect, useMemo, useState } from "react";
import InfoIcon from "~icons/ph/info";
import TrendDownIcon from "~icons/ph/trend-down";
import TrendUpIcon from "~icons/ph/trend-up";
import {
  api,
  type Candle,
  type ComparisonPoint,
  type Holdings,
  type Outlook,
  type Purchase,
} from "../api/client";
import { fmtEur, fmtPct } from "../lib/format";
import ComparisonChart from "../components/ComparisonChart";
import PriceChart from "../components/PriceChart";
import CostBasisCard from "../components/stack/CostBasisCard";
import HoldingPeriods from "../components/stack/HoldingPeriods";
import OutlookCard from "../components/stack/Outlook";
import {
  Card,
  CardTitle,
  Loading,
  RangePills,
  Stat,
  Toggle,
} from "../components/ui";

const RANGES = [
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
  { label: "1y", value: 365 },
];

/**
 * The Overview body: what you have.
 *
 * One combined chart — the strategy comparison with the BTC price as a backdrop
 * and buys pinned onto the price line — then the two cards that describe the
 * stack itself rather than the strategy behind it: how well it was bought
 * (`CostBasisCard`) and how old it is (`HoldingPeriods`). Whether the strategy
 * is any good is a different question, and lives in the Research section.
 *
 * `OutlookCard` closes the section because it is the only part that faces
 * forwards: the page reads what happened, then what you hold, then where it is
 * going if nothing changes.
 *
 * The reservoir headline and its stats live in the hero header (SiteHeader);
 * the "include dry runs" filter is lifted to App (it drives both the header
 * stats and the strategy series), and is surfaced here next to the chart it
 * affects. It reaches the cost basis too — but never the holding periods, which
 * count real buys only.
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
  const [candlesLoaded, setCandlesLoaded] = useState(false);
  const [comparison, setComparison] = useState<ComparisonPoint[]>([]);
  const [compLoaded, setCompLoaded] = useState(false);
  const [holdings, setHoldings] = useState<Holdings | null>(null);
  const [outlook, setOutlook] = useState<Outlook | null>(null);
  const [rangeDays, setRangeDays] = useState(90);
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

  // Candles only back the price-only fallback shown before there are enough
  // buys to chart the strategy.
  useEffect(() => {
    setCandlesLoaded(false);
    api
      .getCandles(rangeDays)
      .then((c) => {
        setCandles(c);
        setCandlesLoaded(true);
      })
      .catch((e) => setError(String(e)));
  }, [rangeDays]);

  // Refreshed whenever the buy history changes (e.g. after a header test buy).
  useEffect(() => {
    loadComparison(includeDryRun);
    api.getHoldings(includeDryRun).then(setHoldings).catch((e) => setError(String(e)));
    api.getOutlook(includeDryRun).then(setOutlook).catch((e) => setError(String(e)));
  }, [includeDryRun, purchases, loadComparison]);

  const strategySeries = comparison.slice(-rangeDays);
  const latest = strategySeries.length
    ? strategySeries[strategySeries.length - 1]
    : null;
  const hasStrategy = strategySeries.length > 1;
  // Keep the drop markers consistent with the plotted series: when dry runs
  // are excluded from the comparison, hide their drops too.
  const markerPurchases = useMemo(
    () => (includeDryRun ? purchases : purchases.filter((p) => !p.dry_run)),
    [includeDryRun, purchases],
  );

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
            <CardTitle>My strategy vs. plain DCA</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-ink-soft">
                Include dry runs
                <Toggle checked={includeDryRun} onChange={onToggleDryRun} />
              </label>
              <RangePills options={RANGES} value={rangeDays} onChange={setRangeDays} />
            </div>
          </div>
          {hasStrategy && latest && <StrategyKpis latest={latest} />}
          <div className="h-[520px] md:h-[640px]">
            {!compLoaded || (!hasStrategy && !candlesLoaded) ? (
              <Loading
                what="Charting your strategy against plain DCA"
                why="Replaying every buy at the price of its day, and the same weeks bought at a flat amount."
                slow="Still going — on a cold cache the price history is fetched from Coinbase 300 days at a time. After that it is served from the Pi."
              />
            ) : hasStrategy ? (
              <ComparisonChart data={strategySeries} purchases={markerPurchases} />
            ) : candles.length ? (
              <PriceChart candles={candles} purchases={purchases} height="100%" />
            ) : (
              <p className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-soft">
                Not enough buys yet to chart your strategy. Run a test buy or import your
                history.
              </p>
            )}
          </div>
          {hasStrategy ? (
            <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-ink-soft">
              <InfoIcon className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                Both lines run the same schedule and the same base amount. The only
                difference is Drip&apos;s 0.5&times;&ndash;1.5&times; score multiplier: it
                buys more when the indicators say cheap, less when they say expensive.
                Each line is <strong className="font-semibold text-ink">profit</strong>{" "}
                &mdash; how far that side is above or below the money it paid in &mdash;
                because plain DCA puts in less, so its portfolio would be the smaller
                number either way. Measured this way the gap between the two lines is
                what the multiplier actually earned or cost you. The panel underneath
                shows the BTC price on its own scale, with every buy marked; hover
                anywhere to read both at the same day.
              </span>
            </p>
          ) : (
            compLoaded && (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-soft">
                <InfoIcon className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Showing the BTC price for now &mdash; once there are a couple of buys,
                  this chart compares your strategy against plain DCA.
                </span>
              </p>
            )
          )}
        </Card>

        {/* The stack itself, rather than the strategy behind it. */}
        <div className="grid gap-4 xl:grid-cols-2">
          <CostBasisCard
            holdings={holdings}
            purchases={purchases}
            includeDryRun={includeDryRun}
          />
          <HoldingPeriods data={holdings} />
        </div>

        {/* ...and the only one that faces the other way. */}
        <OutlookCard data={outlook} />
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
      <Stat label="Drip P&L" tone={up ? "up" : "down"}>
        <span className="inline-flex items-center gap-1.5">
          {up ? <TrendUpIcon aria-hidden="true" /> : <TrendDownIcon aria-hidden="true" />}
          {up ? "+" : ""}
          {fmtEur(botProfit)}
          <span className="text-sm font-normal opacity-80">({fmtPct(botPct)})</span>
        </span>
      </Stat>
      <Stat label="vs. plain DCA" tone={ahead ? "up" : "down"}>
        {ahead ? "+" : ""}
        {fmtEur(edge)}
        <span className="ml-1.5 text-sm font-normal opacity-80">
          {ahead ? "ahead" : "behind"}
        </span>
      </Stat>
      <Stat label="Invested">{fmtEur(latest.bot_invested)}</Stat>
    </div>
  );
}
