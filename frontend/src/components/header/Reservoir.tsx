import TrendDownIcon from "~icons/ph/trend-down";
import TrendUpIcon from "~icons/ph/trend-up";
import type { Performance } from "../../api/client";
import { fmtEur, fmtPct } from "../../lib/format";
import { useStackAmount, useUnit } from "../../lib/units";
import { Loading } from "../ui";

/**
 * The centered headline: portfolio value, then one line under it.
 *
 * That line carries three things and no more — what the stack has made, what
 * that is as a percentage, and how much bitcoin it is. What was invested and
 * how many buys got there are the strategy card's job further down; up here
 * they were four extra numbers competing with the one number this screen is
 * about.
 *
 * The stack figure at the end is also the app's unit switch — you click the
 * number you want to read differently, and every other bitcoin amount on the
 * page follows it.
 */
export default function Reservoir({
  performance,
  onToggleUnit,
}: {
  performance: Performance | null;
  onToggleUnit: () => void;
}) {
  const stackAmount = useStackAmount();
  const unit = useUnit();
  const profitable = (performance?.profit_eur ?? 0) >= 0;
  // The cents are dimmed, so the value is split at its decimal separator.
  const value = performance ? fmtEur(performance.value_eur) : "";
  const dot = value.lastIndexOf(".");
  const valueMain = dot >= 0 ? value.slice(0, dot) : value;
  const valueCents = dot >= 0 ? value.slice(dot) : "";

  return (
    <div className="mt-8 text-center sm:mt-10 md:mt-14">
      <div className="text-2xs font-bold uppercase tracking-[0.28em] text-cream/75">
        Your reservoir
      </div>
      {performance ? (
        <>
          {/* Six figures of euro have to fit a 390px phone without breaking the
              line: below the `sm` step the headline is measured in vw rather
              than in type steps, so it shrinks with the glass instead of
              wrapping. It reaches the same size the step scale gives it just as
              the breakpoint takes over, so there is no jump at 640px. */}
          <div className="mt-3 font-display text-[clamp(2.4rem,11.5vw,4rem)] font-semibold leading-[0.88] tracking-tight text-cream drop-shadow-[0_2px_18px_rgba(0,0,0,0.28)] sm:text-7xl xl:text-8xl">
            {valueMain}
            <span className="text-cream/65">{valueCents}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-lg font-bold [text-shadow:0_1px_8px_rgba(0,0,0,0.25)] sm:mt-5 sm:gap-x-6 sm:text-xl md:text-2xl">
            <span
              className={`inline-flex items-center gap-2 ${profitable ? "text-kelp-pale" : "text-rose-pale"}`}
            >
              {profitable ? <TrendUpIcon /> : <TrendDownIcon />}
              {profitable ? "+" : ""}
              {fmtEur(performance.profit_eur)}
            </span>
            <span className="font-semibold text-cream/75">
              {fmtPct(performance.profit_pct)}
            </span>
            <button
              type="button"
              onClick={onToggleUnit}
              title={
                unit === "sats"
                  ? "Showing sats - click to read bitcoin amounts as BTC"
                  : "Showing BTC - click to read bitcoin amounts as sats"
              }
              /* The extra height is the tap target: on a phone this line is the
                 unit switch for the whole page, and a row of text is not one. */
              className="rounded px-1 py-1.5 font-semibold text-cream/70 underline decoration-cream/25 decoration-dotted underline-offset-[6px] transition hover:text-cream hover:decoration-cream/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream sm:py-0"
            >
              {stackAmount(performance.btc_total)}
            </button>
          </div>
        </>
      ) : (
        // The headline is the one figure the whole screen is about, so its
        // wait says what is being counted rather than pulsing a grey bar the
        // size of a number nobody can read yet.
        <div className="mt-6 min-h-[9.5rem]">
          <Loading
            on="water"
            what="Counting your reservoir"
            why="Every buy you have made, priced at what bitcoin costs right now."
            slow="Coinbase is taking its time with the price — the figures below arrive as soon as it answers."
          />
        </div>
      )}
    </div>
  );
}
