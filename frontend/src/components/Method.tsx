// What Drip does before a buy — the one thing the dashboard never said.
//
// The Overview used to open on "My strategy vs. plain DCA", which is the answer
// to a question the page never asks: the three readings, the points they are
// worth and the five rungs they add up to existed in the README and nowhere in
// the app. The hero above says what the market reads *today*; this says what the
// machine *does*, every time.
//
// Two decisions hold it together:
//
//   - **It is not a card.** The comparison chart is this section's one `lead`
//     (`ui.tsx`), and the moment there are two of those neither leads. So this
//     is the section's opening statement on the page ground itself — which also
//     gives Overview the `h2` it was the only section to lack.
//   - **It carries no live figure at all.** Every number here is a rule, so
//     there is nothing to fetch, nothing to wait for and nothing that can be
//     out of date. A reading beside each indicator would be the third copy of
//     the hero's four instruments, and it would give the page's first block a
//     loading state.
//
// The rules come from `lib/scoringRules.ts`, the hand-kept mirror of
// `backend/app/strategy.py`; the point pills and the drops are the same
// vocabulary `components/scoring.tsx` and `components/drops.tsx` already speak,
// so the ladder here and the ladder under the next buy are visibly one ladder.
import type { ReactNode } from "react";
import { ScoreDrops } from "./drops";
import { fmtPoints, toneFor } from "./scoring";
import {
  INDICATOR_RULES,
  LADDER,
  SCORE_MAX,
  SCORE_MIN,
} from "../lib/scoringRules";

/** Where 0 falls on a scale running from -4 to +8. Not the middle. */
const ZERO_PCT = (100 * -SCORE_MIN) / (SCORE_MAX - SCORE_MIN);

/** One line of plain words under a station's title. */
const LINE = "text-sm leading-relaxed text-ink-soft";

/** "1.5" / "1.0" / "0.5" — the ladder reads in one dialect, like the README. */
const fmtRung = (multiplier: number) =>
  multiplier.toFixed(2).replace(/0$/, "");

export default function Method() {
  return (
    <div className="flex flex-col gap-5 pb-1 sm:gap-6 sm:pb-2">
      <header>
        <h2 className="font-display text-[clamp(1.6rem,6.2vw,2.5rem)] font-bold leading-[1.08] text-ink">
          Drip always buys.{" "}
          <span className="text-ink-soft">The score only sets how much.</span>
        </h2>
        <p className={`mt-2 max-w-prose sm:text-base ${LINE}`}>
          There is no call to make and no drip to sit out. Three numbers are read off
          the market before every buy, added up, and the spout opens wider or narrower.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <Station n={1} title="Read the market" className="lg:col-span-5">
          <p className={LINE}>
            Two say how the mood looks, one says how far bitcoin has drifted from its
            own year. Each can add up to three points and take away two, so cheap and
            fearful opens the spout and dear and greedy closes it.
          </p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {INDICATOR_RULES.map((indicator) => (
              <li key={indicator.key}>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-bold text-ink">{indicator.label}</span>
                  <span className="text-2xs text-ink-soft">{indicator.what}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {indicator.rules.map((rule) => (
                    <span
                      key={rule.when}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-2xs ${toneFor(rule.points)}`}
                    >
                      {rule.when}
                      <b className="font-display text-xs font-semibold">
                        {fmtPoints(rule.points)}
                      </b>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Station>

        <Station n={2} title="Add up the points" className="lg:col-span-3">
          <p className={LINE}>
            The three are added up, and that sum is the score. Most drips land
            between the ends of it.
          </p>
          {/* Rose to teal, the score's own two colours — the `-soft` tints are
              background fills and go near-black at night, so a scale drawn in
              them is a scale nobody can see. And the scale is lopsided and says
              so: zero sits a third of the way along, because there are more
              points to earn from a cheap market than to lose to a dear one. */}
          <div className="mt-4">
            <div
              aria-hidden="true"
              className="relative h-2.5 rounded-full"
              style={{
                backgroundImage:
                  "linear-gradient(to right, var(--color-rose), var(--color-sand) " +
                  `${ZERO_PCT}%, var(--color-teal))`,
              }}
            >
              <span
                className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-shell"
                style={{ left: `${ZERO_PCT}%` }}
              />
            </div>
            <div className="relative mt-2 h-9">
              <Tick at={0} figure={fmtPoints(SCORE_MIN)} word="all dear" align="left" />
              <Tick at={ZERO_PCT} figure="0" />
              <Tick
                at={100}
                figure={fmtPoints(SCORE_MAX)}
                word="all cheap"
                align="right"
              />
            </div>
          </div>
        </Station>

        <Station n={3} title="Open the spout" className="lg:col-span-4">
          <p className={LINE}>
            The score picks one of five rungs. The lowest still buys — half the base
            amount, never nothing.
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {LADDER.map((rung) => (
              <li
                key={rung.multiplier}
                className="flex items-center gap-3 rounded-lg bg-sand-soft/60 px-2.5 py-1.5"
              >
                <span className="w-[5.25rem] shrink-0 text-xs text-ink-soft">
                  {rung.band}
                </span>
                <ScoreDrops multiplier={rung.multiplier} size="text-[0.7rem]" />
                <span className="ml-auto font-display text-sm font-semibold text-ink">
                  &times;{fmtRung(rung.multiplier)}
                </span>
              </li>
            ))}
          </ul>
        </Station>
      </div>

      <p className={`max-w-prose ${LINE}`}>
        The base amount and the rhythm are yours; the score only sizes what lands, and
        a paused Drip lands nothing. Whether the scoring is worth anything is a
        different question, tested further down in Research.
      </p>
    </div>
  );
}

/** One end (or the middle) of the score scale: the figure and what it means. */
function Tick({
  at,
  figure,
  word,
  align = "center",
}: {
  at: number;
  figure: string;
  word?: string;
  align?: "left" | "center" | "right";
}) {
  const shift =
    align === "left" ? "" : align === "right" ? "-translate-x-full" : "-translate-x-1/2";
  return (
    <span
      className={`absolute top-0 flex flex-col whitespace-nowrap ${align === "right" ? "items-end" : align === "left" ? "items-start" : "items-center"} ${shift}`}
      style={{ left: `${at}%` }}
    >
      <span className="font-display text-sm font-semibold text-ink">{figure}</span>
      {word && <span className="text-2xs text-ink-soft">{word}</span>}
    </span>
  );
}

/**
 * One station on the rail: a numbered node, a title, and whatever the step has
 * to say.
 *
 * The rail is the app's own grammar rather than a flow chart's — a hairline with
 * nodes on it, the way every read-out in the hero ends in one. It runs sideways
 * between the columns on a desk (a segment in each grid gap, so it never strikes
 * through a title) and turns into the content's own left-hand spine on a phone,
 * where the three steps stack.
 */
function Station({
  n,
  title,
  className = "",
  children,
}: {
  n: number;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`relative ${className}`}>
      {n > 1 && (
        <span
          aria-hidden="true"
          className="absolute right-full top-3.5 hidden h-px w-6 bg-sand lg:block"
        />
      )}
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-shell font-display text-sm font-bold text-teal ring-1 ring-sand"
        >
          {n}
        </span>
        <h3 className="font-display text-lg font-semibold leading-tight text-ink">
          {title}
        </h3>
      </div>
      <div className="ml-3.5 border-l border-sand pl-[1.375rem] pt-2 lg:ml-0 lg:border-l-0 lg:pl-0 lg:pt-3">
        {children}
      </div>
    </div>
  );
}
