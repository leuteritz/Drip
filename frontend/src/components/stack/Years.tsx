import { useEffect, useState } from "react";
import type { YearCohort, Years } from "../../api/client";
import { fmtEur, fmtPct } from "../../lib/format";
import { useStackAmount } from "../../lib/units";
import {
  Card,
  CardHeader,
  Failed,
  Loading,
  Note,
  Stat,
  StatFacts,
  StatRow,
  toneText,
} from "../ui";

/**
 * What each year bought, and what that year's money is worth now.
 *
 * Every other card here is all-time or a rolling window, which is the right way
 * to read a savings bot and is exactly what makes the fourth year of one
 * unreadable: 2022 stops existing as soon as the averages swallow it. A drip is
 * lived a year at a time, so the years get their own arithmetic.
 *
 * **The rows are the control.** Chips were the obvious alternative and do not
 * fit: `RangePills` is a `flex` with no wrap, so five year chips overflow a
 * 390px card, and a sideways scroll is not allowed here. A row per year is also
 * the better object — it can carry the bar, the money and the profit at once,
 * which is what makes the card scannable before anything is clicked.
 *
 * The lead figure is the *selected* year's profit, so the card answers about one
 * year at a time rather than showing a wall of five equal ones.
 */
export default function YearsCard({
  data,
  error,
  onRetry,
}: {
  data: Years | null;
  error?: string | null;
  onRetry?: () => void;
}) {
  const stackAmount = useStackAmount();
  const [picked, setPicked] = useState<number | null>(null);

  const years = data?.years ?? [];
  // Default to the newest year with buys, and follow the data if the filter
  // changes underneath (a year can disappear when dry runs are excluded).
  useEffect(() => {
    if (!years.length) return;
    setPicked((current) =>
      current != null && years.some((y) => y.year === current)
        ? current
        : years[years.length - 1].year,
    );
  }, [years]);

  const info = (
    <>
      <p>
        Each row is one calendar year of buys, valued at{" "}
        <strong className="font-semibold text-ink">today&apos;s price</strong>. The
        profit is what that year&apos;s money is worth now, minus what it cost.
      </p>
      <p className="mt-2">
        That is not an annual return, and the years are not a league table: a 2022
        cohort has had four years to work and this year&apos;s has had weeks. What it
        does show is what each year cost you and what it bought.
      </p>
      <p className="mt-2">
        &ldquo;Against the market&rdquo; holds that year&apos;s average price against
        the market&apos;s own average over the same days &mdash; the whole-stack
        comparison from the cost-basis card, asked one year at a time. A year still
        running is marked, because a part-year average against a part-year market is
        a comparison rather than a verdict.
      </p>
    </>
  );

  if (!data) {
    return (
      <Card className="flex flex-col">
        <CardHeader title="Year by year" />
        <div className="flex h-56 items-center justify-center">
          {error ? (
            <Failed
              what="Could not work out your years"
              why={error}
              onRetry={onRetry}
            />
          ) : (
            <Loading
              what="Adding up each year of buys"
              why="Every year's money against the market's own average over the same days."
            />
          )}
        </div>
      </Card>
    );
  }

  if (!years.length) {
    return (
      <Card className="flex flex-col">
        <CardHeader title="Year by year" info={info} />
        <p className="py-6 text-center text-sm text-ink-soft">
          No buys counted yet &mdash; this fills in as the drip runs.
        </p>
      </Card>
    );
  }

  const current = years.find((y) => y.year === picked) ?? years[years.length - 1];
  const most = Math.max(...years.map((y) => y.invested_eur), 0.01);
  const up = current.profit_eur >= 0;

  return (
    <Card className="flex flex-col">
      <CardHeader title="Year by year" info={info} />

      <StatRow>
        <Stat
          label={`What ${current.year} is worth now`}
          tone={up ? "up" : "down"}
          hint={
            current.complete
              ? `${current.buys} buys · valued at today's price`
              : `${current.buys} buys so far · ${current.year} is still running`
          }
        >
          {up ? "+" : ""}
          {fmtEur(current.profit_eur)}
          <span className="ml-1.5 text-sm font-normal opacity-80">
            ({fmtPct(current.profit_pct)})
          </span>
        </Stat>
      </StatRow>

      <StatFacts
        className="mt-3"
        items={[
          { label: "put in", value: fmtEur(current.invested_eur, 0) },
          { label: "stacked", value: stackAmount(current.btc_total) },
          { label: "paid on average", value: fmtEur(current.avg_price_eur, 0) },
          {
            label:
              current.advantage_pct >= 0
                ? "you bought below the market"
                : "you bought above the market",
            value: fmtPct(current.advantage_pct),
            tone: current.advantage_pct >= 0 ? "up" : "down",
          },
        ]}
      />

      <div className="mt-4 flex flex-col gap-1">
        {years.map((year) => (
          <YearRow
            key={year.year}
            year={year}
            most={most}
            selected={year.year === current.year}
            onPick={() => setPicked(year.year)}
          />
        ))}
      </div>

      <Note>
        Click a year to read it. Older years have simply had longer to work &mdash;
        this is what each one cost and what it bought, not a scoreboard.
      </Note>
    </Card>
  );
}

/**
 * One year as a row: the label, a bar of what went in, and what it did.
 *
 * A `<button>` rather than a click handler on a div, so a keyboard reaches it
 * and `aria-pressed` says which one is being read. The bar is what makes the
 * list scannable — years are not the same size, and a saver who raised the base
 * amount should be able to see that without reading a single number.
 */
function YearRow({
  year,
  most,
  selected,
  onPick,
}: {
  year: YearCohort;
  most: number;
  selected: boolean;
  onPick: () => void;
}) {
  const up = year.profit_eur >= 0;
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={`grid min-h-11 grid-cols-[3.25rem_1fr_auto] items-center gap-3 rounded-xl px-2 py-1.5 text-left transition @lg:grid-cols-[3.25rem_1fr_7rem_5.5rem] ${
        selected ? "bg-water-soft" : "hover:bg-sand-soft/60"
      }`}
    >
      <span className="font-display text-base font-semibold tabular-nums text-ink">
        {year.year}
      </span>

      {/* The bar is what went *in*, so the rows compare effort rather than
          outcome — an older year is worth more simply for being older. */}
      <span className="relative hidden h-5 rounded-lg bg-sand-soft/70 @lg:block">
        <span
          className="absolute inset-y-1 left-0 rounded-md"
          style={{
            width: `${Math.max((year.invested_eur / most) * 100, 2)}%`,
            background: "var(--color-water)",
          }}
        />
      </span>

      {/* On a phone this is the middle column and the bar is gone: three
          numbers and a bar do not fit 390px, and the numbers are the point. */}
      <span className="text-sm tabular-nums text-ink-soft @lg:text-right">
        {fmtEur(year.invested_eur, 0)}
        {!year.complete && (
          <span className="ml-1.5 text-2xs uppercase tracking-[0.1em] opacity-70">
            so far
          </span>
        )}
      </span>

      <span
        className={`text-right text-sm font-semibold tabular-nums ${toneText(
          up ? "up" : "down",
        )}`}
      >
        {fmtPct(year.profit_pct)}
      </span>
    </button>
  );
}
