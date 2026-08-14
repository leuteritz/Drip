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
//
// **The three stations are one width.** They used to be 5 / 3 / 4 of twelve,
// which was the content's own shape rather than the band's: a wide field of
// pills, a narrow column with a hairline in a lot of air, and a ladder. Equal
// thirds is the harder and better constraint, because it makes the *content*
// answer for itself — which is what gave station 2 the graphic it should always
// have had and station 3 its staircase.
//
// All three now end in a rail, the way every read-out in the hero does
// (`header/Readouts.tsx`'s `TRACK` / `NOTCH` / `LadderRail`). That is the whole
// of the band's grammar: a distance, drawn, with the point where it turns from
// dear to cheap marked on it.
import type { ReactNode } from "react";
import { ScoreDrops } from "./drops";
import { fmtPoints, toneFor } from "./scoring";
import {
  INDICATOR_RULES,
  LADDER,
  SCORE_MAX,
  SCORE_MIN,
} from "../lib/scoringRules";

/** Where 0 falls on a scale running from -6 to +9. Not the middle. */
const ZERO_PCT = (100 * -SCORE_MIN) / (SCORE_MAX - SCORE_MIN);

/**
 * What one indicator can be worth, and where 0 falls on *its* scale.
 *
 * The two land on the same 40%, and that is not a coincidence worth leaving
 * unsaid: three spans of -2..+3 add up to -6..+9, so a scale three times as
 * long turns from dear to cheap at the same place. It is what lets station 2
 * stack the three over the sum and have every notch fall on one line — the
 * addition drawn rather than asserted. Both are computed rather than written
 * down, so a threshold moving in `strategy.py` moves the picture with it.
 */
const PART_MIN = -2;
const PART_MAX = 3;
const PART_ZERO_PCT = (100 * -PART_MIN) / (PART_MAX - PART_MIN);

/** The widest the spout opens — what the rungs' fills are measured against. */
const TOP_RUNG = Math.max(...LADDER.map((rung) => rung.multiplier));

/** One line of plain words under a station's title. */
const LINE = "text-sm leading-relaxed text-ink-soft";

/**
 * The operator column, so all four of station 2's rails start on one edge —
 * and `RAIL_INDENT`, the same edge said in padding, for the one row that has no
 * operator to hold it there. `items-end` is what keeps a `+` beside its rail
 * rather than beside the label above it, which is why the sum's figures sit
 * outside the grid: left in it, they would drag the `=` down to their own foot.
 */
const SUM_ROW = "grid grid-cols-[0.9rem_1fr] items-end gap-2";
const RAIL_INDENT = "pl-[1.4rem]";
const OPERATOR =
  "font-display text-sm font-semibold leading-none text-ink-soft";

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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <Station n={1} title="Read the market">
          <p className={LINE}>
            Two say how the mood looks, one says how far bitcoin has drifted from its
            own year. Cheap and fearful opens the spout; dear and greedy closes it.
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

        <Station n={2} title="Add up the points">
          <p className={LINE}>
            Each of the three is worth three points at best and takes away two at
            worst. Added up, that is the score.
          </p>
          {/* The addition, drawn: three spans of the same length, then the one
              they make. Every notch falls on the same vertical line (see
              PART_ZERO_PCT), so the sum is read rather than claimed.

              Rose to teal, the score's own two colours — the `-soft` tints are
              background fills and go near-black at night, so a scale drawn in
              them is a scale nobody can see. And the scale is lopsided and says
              so: zero sits short of the middle, because there are more points to
              earn from a cheap market than to lose to a dear one. */}
          <div className="mt-4">
            <div className="relative">
              {/* The line the whole graphic rests on: one hairline down the
                  stack at the point every scale turns. It sits *behind* the
                  rails, so it shows in the gaps between them and each rail's
                  own notch reads as the same line passing through. */}
              {/* Anchored on both edges, and by `left` rather than by padding:
                  the mark inside reads its percentage off this box, so a padded
                  one would measure the indent as part of the scale. */}
              <span
                aria-hidden="true"
                className="absolute inset-y-1 left-[1.4rem] right-0"
              >
                <span
                  className="absolute inset-y-0 w-px -translate-x-1/2 bg-sand"
                  style={{ left: `${ZERO_PCT}%` }}
                />
              </span>
              <ul className="flex flex-col gap-2">
                {INDICATOR_RULES.map((indicator, i) => (
                  <li key={indicator.key} className={SUM_ROW}>
                    <span aria-hidden="true" className={OPERATOR}>
                      {i > 0 ? "+" : ""}
                    </span>
                    <div>
                      <span className="text-2xs text-ink-soft">{indicator.label}</span>
                      <Rail zeroPct={PART_ZERO_PCT} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className={`${SUM_ROW} mt-2.5 border-t border-sand pt-2.5`}>
                <span aria-hidden="true" className={OPERATOR}>
                  =
                </span>
                <div>
                  <span className="text-2xs font-bold text-ink">The score</span>
                  <Rail zeroPct={ZERO_PCT} sum />
                </div>
              </div>
            </div>
            <div className={RAIL_INDENT}>
              <div className="relative mt-2 h-9">
                <Tick
                  at={0}
                  figure={fmtPoints(SCORE_MIN)}
                  word="all dear"
                  align="left"
                />
                <Tick at={ZERO_PCT} figure="0" />
                <Tick
                  at={100}
                  figure={fmtPoints(SCORE_MAX)}
                  word="all cheap"
                  align="right"
                />
              </div>
            </div>
          </div>
        </Station>

        <Station n={3} title="Open the spout">
          <p className={LINE}>
            The score picks one of five rungs. The lowest still buys — half the base
            amount, never nothing.
          </p>
          {/* Each rung is filled to what it buys — a third of the row at 0.5x,
              all of it at 1.5x — so the five read as a spout opening rather
              than as five rows that happen to be sorted. It is a fill behind
              the row and not another column: `water-soft` is the tint a point
              *earned* already wears in `scoring.tsx`, and it is the one that
              survives the night, where the row's own bed is nearly the page. */}
          <ul className="mt-3 flex flex-col gap-1">
            {LADDER.map((rung) => (
              <li
                key={rung.multiplier}
                className="relative overflow-hidden rounded-lg bg-sand-soft/60"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 bg-water-soft"
                  style={{ width: `${(rung.multiplier / TOP_RUNG) * 100}%` }}
                />
                <div className="relative flex items-center gap-3 px-2.5 py-2">
                  <span className="w-[5.25rem] shrink-0 text-xs text-ink-soft">
                    {rung.band}
                  </span>
                  <ScoreDrops multiplier={rung.multiplier} size="text-[0.7rem]" />
                  <span className="ml-auto font-display text-sm font-semibold text-ink">
                    &times;{fmtRung(rung.multiplier)}
                  </span>
                </div>
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

/**
 * A span from dear to cheap, with the point where it turns marked on it.
 *
 * `sum` is the one the three add up to: thicker, at full strength, and the only
 * one carrying figures. The three above it are the same picture held back, so
 * the eye reads them as parts of the row under the line rather than as four
 * scales competing to be the answer. The notch sits outside the faded layer —
 * it is the alignment the whole graphic rests on and may not fade with it.
 */
function Rail({ zeroPct, sum = false }: { zeroPct: number; sum?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`relative mt-1 rounded-full ${sum ? "h-2.5" : "h-1.5"}`}
    >
      <span
        className={`absolute inset-0 rounded-full ${sum ? "" : "opacity-70"}`}
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-rose), var(--color-sand) " +
            `${zeroPct}%, var(--color-teal))`,
        }}
      />
      <span
        className={`absolute top-1/2 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-shell ${sum ? "h-4" : "h-3"}`}
        style={{ left: `${zeroPct}%` }}
      />
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
 *
 * It carries no width of its own: the three stations are equal thirds of the
 * band, and the connector's `w-6` is hand-matched to the grid's `lg:gap-6`, so
 * changing that gap breaks the rail.
 */
function Station({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
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
