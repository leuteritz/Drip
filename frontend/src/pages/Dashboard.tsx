import { useCallback, useEffect, useMemo, useState } from "react";
import TrendDownIcon from "~icons/ph/trend-down";
import TrendUpIcon from "~icons/ph/trend-up";
import {
  api,
  type Candle,
  type ComparisonPoint,
  type Holdings,
  type Outlook,
  type Pulse,
  type Purchase,
} from "../api/client";
import { fmtEur, fmtPct } from "../lib/format";
import ComparisonChart from "../components/ComparisonChart";
import PriceChart from "../components/PriceChart";
import CostBasisCard from "../components/stack/CostBasisCard";
import HoldingPeriods from "../components/stack/HoldingPeriods";
import OutlookCard from "../components/stack/Outlook";
import PulseCard from "../components/stack/Pulse";
import {
  Card,
  CardHeader,
  Loading,
  Note,
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
 * and buys pinned onto the price line — then `PulseCard`, which is about the
 * bot rather than the money: every figure above it is an average of the buys
 * that landed, and it is the only thing on the page that can tell you a week
 * never did. Then the two cards that describe the stack itself rather than the
 * strategy behind it: how well it was bought (`CostBasisCard`) and how old it
 * is (`HoldingPeriods`). Whether the strategy is any good is a different
 * question, and lives in the Research section.
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
  const [pulse, setPulse] = useState<Pulse | null>(null);
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

  // The record of which weeks got a buy takes no dry-run filter — it counts
  // every run the bot made — so it refreshes on the history alone.
  useEffect(() => {
    api.getPulse().then(setPulse).catch((e) => setError(String(e)));
  }, [purchases]);

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
      <div className="pad-safe-x flex flex-col gap-3 px-3 py-5 sm:gap-4 sm:px-4 md:px-6 md:py-6">
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
          <CardHeader
            title="My strategy vs. plain DCA"
            info={
              <>
                <p>
                  Both lines buy on the same day, for the same base amount. The only
                  difference is Drip&apos;s multiplier: it buys 0.5&times; to 1.5&times;
                  the base, depending on what the indicators say.
                </p>
                <p className="mt-2">
                  Each line is{" "}
                  <strong className="font-semibold text-ink">profit</strong> &mdash; how
                  far that side is above or below the money it paid in &mdash; and not
                  the value of the stack. Plain DCA pays in less, so its stack would be
                  the smaller number whatever happened; profit puts the two on the same
                  footing.
                </p>
                <p className="mt-2">
                  The panel underneath is the BTC price on its own scale, with every buy
                  marked. Hover anywhere to read both at the same day.
                </p>
              </>
            }
          >
            <label className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              Include dry runs
              <Toggle checked={includeDryRun} onChange={onToggleDryRun} />
            </label>
            <RangePills options={RANGES} value={rangeDays} onChange={setRangeDays} />
          </CardHeader>
          {hasStrategy && latest && <StrategyKpis latest={latest} />}
          <div className="h-[22rem] sm:h-[26rem] md:h-[32rem]">
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
            <Note>
              The gap between the two lines is what buying more on dips has been worth
              so far.
            </Note>
          ) : (
            compLoaded && (
              <Note>
                Showing the BTC price for now &mdash; the comparison starts once there
                are a couple of buys.
              </Note>
            )
          )}
        </Card>

        {/* Whether the bot showed up at all — the one card about the machine
            rather than about the money, and the reason it sits this high. */}
        <PulseCard data={pulse} />

        {/* The stack itself, rather than the strategy behind it. */}
        <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
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
      <Stat label="Your profit" tone={up ? "up" : "down"} hint="what you hold, minus what you paid in">
        <span className="inline-flex items-center gap-1.5">
          {up ? <TrendUpIcon aria-hidden="true" /> : <TrendDownIcon aria-hidden="true" />}
          {up ? "+" : ""}
          {fmtEur(botProfit)}
          <span className="text-sm font-normal opacity-80">({fmtPct(botPct)})</span>
        </span>
      </Stat>
      <Stat
        label="vs. plain DCA"
        tone={ahead ? "up" : "down"}
        hint="the multiplier's share of that"
      >
        {ahead ? "+" : ""}
        {fmtEur(edge)}
        <span className="ml-1.5 text-sm font-normal opacity-80">
          {ahead ? "ahead" : "behind"}
        </span>
      </Stat>
      <Stat label="Paid in" hint="every buy added up">
        {fmtEur(latest.bot_invested)}
      </Stat>
    </div>
  );
}
