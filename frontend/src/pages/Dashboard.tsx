import { useMemo, useState } from "react";
import TrendDownIcon from "~icons/ph/trend-down";
import TrendUpIcon from "~icons/ph/trend-up";
import { api, type BotSettings, type ComparisonPoint, type Purchase } from "../api/client";
import { fmtEur, fmtPct } from "../lib/format";
import { useResource } from "../lib/resource";
import ComparisonChart from "../components/ComparisonChart";
import PriceChart from "../components/PriceChart";
import CostBasisCard from "../components/stack/CostBasisCard";
import CustodyCard from "../components/stack/Custody";
import HoldingPeriods from "../components/stack/HoldingPeriods";
import OutlookCard from "../components/stack/Outlook";
import PulseCard from "../components/stack/Pulse";
import WaterlineCard from "../components/stack/Waterline";
import YearsCard from "../components/stack/Years";
import FirstRun from "../components/stack/FirstRun";
import {
  Card,
  CardHeader,
  Failed,
  Loading,
  Note,
  RangePills,
  Stat,
  StatFacts,
  StatRow,
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
 * never did. Then the cards that describe the stack itself rather than the
 * strategy behind it: how well it was bought (`CostBasisCard`), how old it is
 * (`HoldingPeriods`), what holding it has actually felt like (`WaterlineCard`),
 * the same history read a year at a time (`YearsCard`) and where it is being
 * kept (`CustodyCard`). Whether the strategy is any good is a different
 * question, and lives in the Research section.
 *
 * `OutlookCard` closes the section because it is the only part that faces
 * forwards: the page reads what happened, then what you hold, then where that
 * is sitting, then where it is going if nothing changes.
 *
 * The reservoir headline and its stats live in the hero header (SiteHeader);
 * the "include dry runs" filter is lifted to App (it drives both the header
 * stats and the strategy series), and is surfaced here next to the chart it
 * affects. It reaches the cost basis too — but never the holding periods, which
 * count real buys only.
 */
export default function Overview({
  purchases,
  purchasesLoaded,
  settings,
  includeDryRun,
  running,
  onTestBuy,
  onToggleDryRun,
  onSaveSettings,
}: {
  purchases: Purchase[];
  /** The first fetch is still out — an empty history is not yet "no buys". */
  purchasesLoaded: boolean;
  settings: BotSettings | null;
  includeDryRun: boolean;
  running: boolean;
  onTestBuy: () => void;
  onToggleDryRun: (v: boolean) => void;
  onSaveSettings: (update: Partial<BotSettings>) => Promise<void>;
}) {
  const [rangeDays, setRangeDays] = useState(90);

  // Seven independent loads, each answered where it is read. They used to share
  // one `error` string and one alert card at the top of the section, which meant
  // a single dead endpoint left its card spinning for ever while taking the
  // section's heading down with it.
  //
  // Refreshed whenever the buy history changes (e.g. after a header test buy).
  const comparison = useResource(
    () => api.getComparison(includeDryRun),
    [includeDryRun, purchases],
  );
  const holdings = useResource(
    () => api.getHoldings(includeDryRun),
    [includeDryRun, purchases],
  );
  const outlook = useResource(
    () => api.getOutlook(includeDryRun),
    [includeDryRun, purchases],
  );
  // Cut from the same series the chart above plots, so it follows the same
  // filter — a card showing days the chart does not would be worse than none.
  const waterline = useResource(
    () => api.getWaterline(includeDryRun),
    [includeDryRun, purchases],
  );
  // Neither the record of which periods got a buy nor where the stack is kept
  // takes a dry-run filter — one counts every run the bot made, the other only
  // ever counts real bitcoin — so both refresh on the history alone. Custody
  // also follows the threshold, since that is what decides whether it nudges.
  const pulse = useResource(() => api.getPulse(), [purchases]);
  const custody = useResource(
    () => api.getCustody(),
    [purchases, settings?.custody_threshold_eur],
  );
  const years = useResource(
    () => api.getYears(includeDryRun),
    [includeDryRun, purchases],
  );
  // Candles only back the price-only fallback shown before there are enough
  // buys to chart the strategy.
  const candles = useResource(() => api.getCandles(rangeDays), [rangeDays]);

  const strategySeries = (comparison.data ?? []).slice(-rangeDays);
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

  // Nothing bought yet: one card that says what to do, instead of six cards
  // each saying a different version of "nothing yet". It replaces the *whole*
  // body, chart included — the chart is this section's `lead`, and the moment
  // there are two of those neither of them leads.
  if (purchasesLoaded && purchases.length === 0) {
    return (
      <section id="overview" className="scroll-mt-20">
        <div className="pad-safe-x mx-auto flex w-full max-w-shell flex-col gap-3 px-3 py-5 sm:gap-4 sm:px-4 md:px-6 md:py-6">
          <FirstRun running={running} onTestBuy={onTestBuy} />
        </div>
      </section>
    );
  }

  return (
    <section id="overview" className="scroll-mt-20">
      <div className="pad-safe-x mx-auto flex w-full max-w-shell flex-col gap-3 px-3 py-5 sm:gap-4 sm:px-4 md:px-6 md:py-6">
        {/* The section's one `lead`: the comparison is the thesis of the whole
            app, and it used to sit in the same box as the five cards that
            answer smaller questions. On the page ground it reads as the page
            talking. There must not be a second one here. */}
        <Card tone="lead" className="flex flex-col">
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
            {comparison.error ? (
              <Failed
                what="Could not chart your strategy against plain DCA"
                why={comparison.error}
                onRetry={comparison.retry}
              />
            ) : !comparison.data ||
              (!hasStrategy && !candles.data && !candles.error) ? (
              <Loading
                what="Charting your strategy against plain DCA"
                why="Replaying every buy at the price of its day, and the same weeks bought at a flat amount."
                slow="Still going — on a cold cache the price history is fetched from Coinbase 300 days at a time. After that it is served from the Pi."
              />
            ) : hasStrategy ? (
              <ComparisonChart data={strategySeries} purchases={markerPurchases} />
            ) : candles.data?.length ? (
              <PriceChart candles={candles.data} purchases={purchases} height="100%" />
            ) : candles.error ? (
              /* The comparison answered and had too little to draw, so the price
                 was the fallback — and that failed too. Say which one broke. */
              <Failed
                what="Could not fetch the price history"
                why={candles.error}
                onRetry={candles.retry}
              />
            ) : (
              <p className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-soft">
                Not enough buys yet to chart your strategy. Run a test buy or import your
                history.
              </p>
            )}
          </div>
          {/* No `Note` on the strategy view any more: the shaded band between
              the two lines *is* the sentence that used to sit here, and a
              caption restating a graphic is the caption to delete. The
              fallback keeps one, because a price chart standing in for the
              comparison does need saying. */}
          {!hasStrategy && comparison.data && candles.data?.length ? (
            <Note>
              Showing the BTC price for now &mdash; the comparison starts once there
              are a couple of buys.
            </Note>
          ) : null}
        </Card>

        {/* Whether the bot showed up at all — the one card about the machine
            rather than about the money, and the reason it sits this high. */}
        <PulseCard
          data={pulse.data}
          error={pulse.error}
          onRetry={pulse.retry}
          settings={settings}
          onSaveSettings={onSaveSettings}
        />

        {/* The stack itself, rather than the strategy behind it. Two pairs on
            a wide window, and the first is deliberately unequal — a chart and
            five figures want more room than three figures do.

            The pairs split at `lg` (a flat 1024px), and that is measured rather
            than picked. `max-w-shell` is 78rem and the root sits at its 13px
            floor across this whole stretch, so the body is 1014px wide at 1024
            *and* at 1279 — exactly what it is at 1280. The window grows; the
            measure does not. Splitting only at `xl` therefore left a quarter of
            the desktop range showing one column of full-width cards for no
            reason the layout could give: at 1024 a 7/5 split gives ~45rem and
            ~32.1rem, and the narrow one is *wider* there than the 31.9rem it
            has always had at 1280.

            A media query's `rem` is the browser's flat 16px, not the root the
            page scales with, so these steps do not move with the type. The card
            widths inside them do — which is why everything within a card is a
            container query instead. Re-measure with `tools/pair.js` before
            moving either span. */}
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-12">
          <div className="*:h-full lg:col-span-7">
            <CostBasisCard
              holdings={holdings.data}
              error={holdings.error}
              onRetry={holdings.retry}
              purchases={purchases}
              includeDryRun={includeDryRun}
            />
          </div>
          <div className="*:h-full lg:col-span-5">
            <HoldingPeriods
              data={holdings.data}
              error={holdings.error}
              onRetry={holdings.retry}
            />
          </div>
        </div>

        {/* What holding it has actually felt like. Every card above is an
            average over the buys that landed, and an average is exactly what
            hides the stretches that make people stop. */}
        <WaterlineCard
          data={waterline.data}
          error={waterline.error}
          onRetry={waterline.retry}
        />

        {/* The same history read a year at a time. It sits here rather than at
            the end because it looks *back*, and `Outlook` closes the section on
            the one card that faces forwards. Full width like the waterline: a
            row per year is a wide object, and it joins no measured pair. */}
        <YearsCard data={years.data} error={years.error} onRetry={years.retry} />

        {/* Where the result of all that is sitting, and where it is going if
            nothing changes — the one that looks back at custody beside the one
            that faces forwards. */}
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-12">
          <div className="*:h-full lg:col-span-6">
            <CustodyCard
              data={custody.data}
              error={custody.error}
              onRetry={custody.retry}
              settings={settings}
              onSaveSettings={onSaveSettings}
            />
          </div>
          <div className="*:h-full lg:col-span-6">
            <OutlookCard
              data={outlook.data}
              error={outlook.error}
              onRetry={outlook.retry}
            />
          </div>
        </div>
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
    <>
      {/* The one card allowed two leads, and the reason that exception exists:
          this card *is* a comparison, so the profit and the edge are the same
          question asked twice. What was paid in is context and goes below. */}
      <StatRow>
        <Stat
          label="Your profit"
          tone={up ? "up" : "down"}
          hint="what you hold, minus what you paid in"
        >
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
      </StatRow>
      <StatFacts
        className="mb-3 mt-3"
        items={[{ label: "paid in", value: fmtEur(latest.bot_invested) }]}
      />
    </>
  );
}
