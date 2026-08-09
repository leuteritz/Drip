// How often the drip drips, in words.
//
// The arithmetic lives in `backend/app/cadence.py` and only there — which period
// a day falls in, when inside one the buy is due, how many of them make a year.
// This side owns nothing but the vocabulary: the label on a button, the word
// around a count, the way a schedule reads on a chip.
//
// It is a hand-kept mirror of that module's `CADENCES`, the same contract
// `api/types.ts` has with `schemas.py`. Four entries is not worth an endpoint —
// but the *keys* are the API's, so adding one means adding it there first.
//
// `unit` / `units` are what a number is counted in ("22 fortnights in a row"),
// and `every` is how a schedule reads out loud ("every second Thursday").

import type { CadenceKey } from "../api/types";

export interface Cadence {
  key: CadenceKey;
  /** The option in the editor. */
  label: string;
  /** One line under it, saying what it does. */
  note: string;
  unit: string;
  units: string;
  /** Whether the weekday means anything — daily is the one that has no day. */
  hasWeekday: boolean;
}

export const CADENCES: Cadence[] = [
  {
    key: "daily",
    label: "Daily",
    note: "A buy every day, at the same time.",
    unit: "day",
    units: "days",
    hasWeekday: false,
  },
  {
    key: "weekly",
    label: "Weekly",
    note: "One buy a week, on the day you pick.",
    unit: "week",
    units: "weeks",
    hasWeekday: true,
  },
  {
    key: "biweekly",
    label: "Fortnightly",
    note: "One buy every two weeks, on the day you pick.",
    unit: "fortnight",
    units: "fortnights",
    hasWeekday: true,
  },
  {
    key: "monthly",
    label: "Monthly",
    note: "One buy a month, on the first such weekday.",
    unit: "month",
    units: "months",
    hasWeekday: true,
  },
];

const BY_KEY = new Map(CADENCES.map((c) => [c.key, c]));

/** The cadence for a stored value, falling back to weekly.
 *
 *  Never throws on an unknown word, matching `cadence.get` on the backend: a
 *  value this build does not recognise came from a later Drip, and the honest
 *  reading of it is the schedule every install had before cadences existed —
 *  not a blank card on the page you would use to fix it. */
export function cadenceOf(key: string | null | undefined): Cadence {
  return BY_KEY.get((key ?? "") as CadenceKey) ?? BY_KEY.get("weekly")!;
}

/** How long one period lasts, in milliseconds.
 *
 *  Nominal, and only ever used to fill the pipe under the spout as the wait runs
 *  down — a month is 30.44 days here and the bar being a day out at the end of
 *  February is not a thing anybody can see. Never use it for arithmetic that
 *  lands on a date: `backend/app/cadence.py` steps real calendar months for that.
 */
export function periodMs(key: string | null | undefined): number {
  const days = { daily: 1, weekly: 7, biweekly: 14, monthly: 30.44 };
  return days[cadenceOf(key).key] * 24 * 60 * 60 * 1000;
}

/** "3 weeks" / "1 fortnight" — a count with the right word after it. */
export function countPeriods(n: number, key: string | null | undefined): string {
  const cadence = cadenceOf(key);
  return `${n} ${n === 1 ? cadence.unit : cadence.units}`;
}

/** How the schedule reads on the spout's chip: short, and true at a glance.
 *
 *  Daily drops the weekday because it has none; monthly says which one of the
 *  month it is, since "Thu 09:00" on a monthly drip would read as this Thursday.
 *  Fortnightly cannot say *which* fortnight in three words and does not try —
 *  the countdown beside it answers that. */
export function scheduleChip(
  key: string | null | undefined,
  weekdayShort: string,
  time: string,
): string {
  switch (cadenceOf(key).key) {
    case "daily":
      return `Daily ${time}`;
    case "biweekly":
      return `${weekdayShort} ${time} · 2wk`;
    case "monthly":
      return `1st ${weekdayShort} ${time}`;
    default:
      return `${weekdayShort} ${time}`;
  }
}
