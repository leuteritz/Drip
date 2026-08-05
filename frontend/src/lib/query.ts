// A pocket-sized query language for the buy history.
//
// Everything the table shows can be asked for in one line: bare words match the
// date and the status ("august", "monday", "error"), date specs pick out a year,
// a month or a day ("2026", "2026-08", "since:2026-01", "30d"), and `field op
// value` tokens filter the numbers ("fg<30", "price>60000", "x1.5"). Tokens are
// ANDed, so "dry fg<30" reads as "dry runs made in fear" and "july price>60000"
// as "every July I paid over sixty thousand".
//
// Kept out of the component on purpose: the parser is pure, so the search bar
// stays about the input and the table stays about rows. It is also what the
// command palette searches with, which is the reason there is exactly one of
// it — a second grammar in the palette would be a second thing to learn.
import { ORDER_ID_ERROR, type Purchase } from "../api/client";
import { formatTimestamp, WEEKDAYS } from "./format";

type Predicate = (p: Purchase) => boolean;

/** The numeric columns, under the names a user would actually type. */
const NUMERIC: Record<string, (p: Purchase) => number> = {
  fg: (p) => p.fear_greed,
  fng: (p) => p.fear_greed,
  rsi: (p) => p.rsi,
  score: (p) => p.score,
  x: (p) => p.multiplier,
  amount: (p) => p.amount_eur,
  eur: (p) => p.amount_eur,
  price: (p) => p.price_eur,
  btc: (p) => p.btc_amount,
  sats: (p) => Math.round(p.btc_amount * 100_000_000),
};

const isReal = (p: Purchase) => !p.dry_run && p.order_id !== ORDER_ID_ERROR;
const isDry = (p: Purchase) => p.dry_run && p.order_id !== ORDER_ID_ERROR;
const isError = (p: Purchase) => p.order_id === ORDER_ID_ERROR;

/** Words that stand for a whole status on their own. */
const STATUS: Record<string, Predicate> = {
  bought: isReal,
  real: isReal,
  live: isReal,
  dry: isDry,
  test: isDry,
  error: isError,
  failed: isError,
};

const TOKEN = /^([a-z]+)(>=|<=|>|<|=)?(\d+(?:[.,]\d+)?)$/;

/** "2026", "2026-08", "2026-8-4" — a year, a month or a day. */
const DATE_SPEC = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/;

/** "30d", "12w", "6m", "2y" — everything since that long ago. */
const RELATIVE = /^(\d+)([dwmy])$/;

/**
 * "since:2026-01" / "before:2026-07" — one open end, so two of them compose.
 *
 * Four words, each meaning exactly what it says at whatever precision was
 * written: `since`/`from` include the period named, `until`/`to` include it at
 * the other end, and `after`/`before` exclude it. So `since:2026-01 until:2026-06`
 * is January through June, and `before:2026-07` stops at the end of June.
 */
const RANGE = /^(since|after|from|until|before|to):(.+)$/;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** Month and weekday names, long and short, to the index they stand for. */
function nameIndex(names: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  names.forEach((name, i) => {
    map[name] = i;
    map[name.slice(0, 3)] = i;
  });
  return map;
}

const MONTH_INDEX = nameIndex(MONTHS);
/** JS weeks start on Sunday; WEEKDAYS starts on Monday, hence the shift below. */
const WEEKDAY_INDEX = nameIndex(WEEKDAYS.map((d) => d.toLowerCase()));

const time = (p: Purchase) => new Date(p.timestamp).getTime();

/**
 * A date spec as the half-open range of instants it covers.
 *
 * The width comes from how much was written: a year is a year, a month is a
 * month, a day is a day. That is what makes "2026-08" a month filter rather
 * than a substring that could just as well hit an order id.
 */
function specRange(spec: string): [number, number] | null {
  const m = DATE_SPEC.exec(spec);
  if (!m) return null;

  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) - 1 : null;
  const day = m[3] ? Number(m[3]) : null;
  if (month !== null && (month < 0 || month > 11)) return null;
  if (day !== null && (day < 1 || day > 31)) return null;

  const start = new Date(year, month ?? 0, day ?? 1);
  const end = new Date(start);
  if (day !== null) end.setDate(end.getDate() + 1);
  else if (month !== null) end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);

  return [start.getTime(), end.getTime()];
}

/** "30d" / "6m" — the instant that long before now. */
function relativeStart(count: number, unit: string): number {
  const d = new Date();
  if (unit === "d") d.setDate(d.getDate() - count);
  else if (unit === "w") d.setDate(d.getDate() - count * 7);
  else if (unit === "m") d.setMonth(d.getMonth() - count);
  else d.setFullYear(d.getFullYear() - count);
  return d.getTime();
}

/** Equality is fuzzy on purpose: "rsi=47" should find an RSI of 46.9. */
function equals(actual: number, target: number): boolean {
  const tolerance = Number.isInteger(target) ? 0.5 : 0.005;
  return Math.abs(actual - target) < tolerance;
}

function compare(actual: number, op: string, target: number): boolean {
  switch (op) {
    case ">":
      return actual > target;
    case "<":
      return actual < target;
    case ">=":
      return actual >= target;
    case "<=":
      return actual <= target;
    default:
      return equals(actual, target);
  }
}

/** Everything a bare word is matched against. */
function haystack(p: Purchase): string {
  const status = isError(p) ? "error failed" : p.dry_run ? "dry run test" : "bought real";
  return `${formatTimestamp(p.timestamp)} ${p.timestamp} ${status} ${p.order_id}`.toLowerCase();
}

/**
 * What kind of thing a token is, which is also whether it is *about the data*.
 *
 * The palette leans on this: a query carrying a date or a number was typed to
 * find buys, so the buys go above the commands. A query of plain words was
 * typed to find a command, so the commands stay on top.
 */
export type TokenKind = "status" | "date" | "number" | "word";

export function classifyToken(token: string): TokenKind {
  if (STATUS[token]) return "status";

  const range = RANGE.exec(token);
  if (range) return specRange(range[2]) ? "date" : "word";
  if (RELATIVE.test(token)) return "date";
  if (specRange(token)) return "date";
  if (token in MONTH_INDEX || token in WEEKDAY_INDEX) return "date";

  const match = TOKEN.exec(token);
  if (match && NUMERIC[match[1]]) return "number";

  return "word";
}

/** True once any token asks about the data rather than about a command. */
export function hasDataToken(query: string): boolean {
  return tokenise(query).some((t) => classifyToken(t) !== "word");
}

function tokenise(query: string): string[] {
  return query.toLowerCase().trim().split(/\s+/).filter(Boolean);
}

function tokenPredicate(token: string): Predicate {
  const status = STATUS[token];
  if (status) return status;

  // One end each, so two of them make a window and one on its own stays open
  // at the other end. Which edge of the named period is used is what separates
  // "since July" (from its first day) from "after July" (from the day it ends).
  const range = RANGE.exec(token);
  if (range) {
    const bounds = specRange(range[2]);
    if (bounds) {
      switch (range[1]) {
        case "since":
        case "from":
          return (p) => time(p) >= bounds[0];
        case "after":
          return (p) => time(p) >= bounds[1];
        case "before":
          return (p) => time(p) < bounds[0];
        default:
          return (p) => time(p) < bounds[1];
      }
    }
  }

  const relative = RELATIVE.exec(token);
  if (relative) {
    const start = relativeStart(Number(relative[1]), relative[2]);
    return (p) => time(p) >= start;
  }

  const spec = specRange(token);
  if (spec) return (p) => time(p) >= spec[0] && time(p) < spec[1];

  // A bare month or weekday name means that month, or that weekday, in *any*
  // year — "august" is every August, and "august 2026" narrows it, because the
  // year is its own token and the two are ANDed.
  const month = MONTH_INDEX[token];
  if (month !== undefined) return (p) => new Date(p.timestamp).getMonth() === month;

  const weekday = WEEKDAY_INDEX[token];
  if (weekday !== undefined)
    return (p) => (new Date(p.timestamp).getDay() + 6) % 7 === weekday;

  const match = TOKEN.exec(token);
  if (match) {
    const read = NUMERIC[match[1]];
    if (read) {
      const target = Number(match[3].replace(",", "."));
      const op = match[2] ?? "=";
      return (p) => compare(read(p), op, target);
    }
  }

  return (p) => haystack(p).includes(token);
}

/**
 * Compiles a query into a predicate. An empty query keeps everything, so the
 * caller can filter unconditionally.
 */
export function buildFilter(query: string): Predicate {
  const tokens = tokenise(query);
  if (tokens.length === 0) return () => true;
  const predicates = tokens.map(tokenPredicate);
  return (p) => predicates.every((match) => match(p));
}

/** The one-click shortcuts under the field — each is just a canned token. */
export const QUERY_CHIPS: { label: string; token: string }[] = [
  { label: "Real buys", token: "bought" },
  { label: "Dry runs", token: "dry" },
  { label: "Errors", token: "error" },
  { label: "Last 90 days", token: "90d" },
  { label: "Bought in fear", token: "fg<30" },
  { label: "Full drops", token: "x1.5" },
];

/**
 * What the language can do, in the order it is worth learning.
 *
 * Shown by the palette on an empty query, so the grammar is discovered by
 * using it rather than by being documented somewhere nobody looks.
 */
export const QUERY_EXAMPLES: { token: string; means: string }[] = [
  { token: "30d", means: "the last 30 days" },
  { token: "august", means: "every August" },
  { token: "2026-03", means: "March 2026" },
  { token: "since:2026-01", means: "on or after January" },
  { token: "price>60000", means: "paid over €60k" },
  { token: "fg<30", means: "bought in fear" },
  { token: "x1.5", means: "the full drops" },
];

/** Chips behave like filters, not like typing: clicking an active one removes it. */
export function toggleToken(query: string, token: string): string {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  const without = tokens.filter((t) => t.toLowerCase() !== token);
  return (without.length === tokens.length ? [...tokens, token] : without).join(" ");
}

export function hasToken(query: string, token: string): boolean {
  return query
    .trim()
    .split(/\s+/)
    .some((t) => t.toLowerCase() === token);
}
