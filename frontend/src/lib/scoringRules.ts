// The scoring *rules* — the thresholds themselves, in words.
//
// A hand-kept mirror of `backend/app/strategy.py`: its `FNG_*` / `RSI_*`
// constants, the three blocks of `score_indicators` and the ladder in
// `determine_purchase_strategy`. The same contract `api/types.ts` has with
// `schemas.py` and `lib/cadence.ts` with `cadence.py` — a new threshold starts
// on the backend and is copied here by hand, deliberately, in one place.
//
// This is not a second source of truth for the *points*. Every point a real
// reading earned still comes from the backend (`strategy.indicator_points`),
// which is why `components/scoring.tsx` states no threshold at all. What lives
// here is the rule a reading is judged by, which nothing on the wire carries
// and which used to exist only in the README — so `Method.tsx` is the one thing
// that reads it, plus the RSI wording below, which was the one place a
// threshold had already been written down twice.
export type Rule = {
  /** The condition, as a reader would say it. */
  when: string;
  points: number;
};

/**
 * One entry per indicator, in the order `score_indicators` adds them, with the
 * labels `components/scoring.tsx` uses — one name per indicator, everywhere.
 *
 * The zero rules are listed too, unlike in the README: a table that jumps from
 * "under 45" to "55 or more" leaves the reader to guess what happens in
 * between, and the answer (nothing) is the most common case of the three.
 */
export const INDICATOR_RULES: {
  key: "fng" | "rsi" | "ma";
  label: string;
  /** What this indicator is, for somebody who has never met it. */
  what: string;
  rules: Rule[];
}[] = [
  {
    key: "fng",
    label: "Fear & Greed",
    what: "the market's mood, 0 to 100",
    rules: [
      { when: "under 25", points: 3 },
      { when: "under 45", points: 2 },
      { when: "under 55", points: 0 },
      { when: "55 or more", points: -2 },
    ],
  },
  {
    key: "rsi",
    label: "RSI, 14 days",
    what: "how hard the last two weeks ran",
    rules: [
      { when: "under 30", points: 3 },
      { when: "under 45", points: 1 },
      { when: "up to 70", points: 0 },
      { when: "over 70", points: -2 },
    ],
  },
  {
    key: "ma",
    label: "Price vs. 350-day average",
    what: "how far it sits from its own year",
    rules: [
      { when: "more than 25% below", points: 3 },
      { when: "more than 10% below", points: 2 },
      { when: "below it", points: 1 },
      { when: "up to 30% above", points: 0 },
      { when: "up to 60% above", points: -1 },
      { when: "further above", points: -2 },
    ],
  },
];

/** The RSI's own words, and the only thresholds said twice — hence one table. */
export const RSI_STRONG = 30;
export const RSI_SLIGHT = 45;
export const RSI_OVERBOUGHT = 70;

/**
 * The moving average's steps, as a percentage distance — `strategy.MA_*_PCT`.
 * `components/scoring.tsx` reads them to put a word beside the reading, the way
 * the three RSI figures above are read: the *points* still arrive scored from
 * the backend, only the wording is decided here.
 */
export const MA_FAR_BELOW = -25;
export const MA_BELOW = -10;
export const MA_ABOVE = 30;
export const MA_FAR_ABOVE = 60;

/**
 * Score to multiplier, strongest rung first — `determine_purchase_strategy`
 * read from the top down.
 */
export const LADDER: { band: string; multiplier: number }[] = [
  { band: "5 or more", multiplier: 1.5 },
  { band: "3 to 4", multiplier: 1.25 },
  { band: "1 to 2", multiplier: 1.0 },
  { band: "-1 to 0", multiplier: 0.75 },
  { band: "below -1", multiplier: 0.5 },
];

/** Everything dear at once: F&G -2, RSI -2, price far above its average -2. */
export const SCORE_MIN = -6;
/** Everything cheap at once — `strategy.SCORE_MAX`, and what the hero counts to. */
export const SCORE_MAX = 9;
