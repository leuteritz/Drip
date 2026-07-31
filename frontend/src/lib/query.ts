// A pocket-sized query language for the buy history.
//
// Everything the table shows can be asked for in one line: bare words match the
// date and the status ("aug", "2026-08", "error"), while `field op value` tokens
// filter the numbers ("fg<30", "x1.5", "amount>=25"). Tokens are ANDed, so
// "dry fg<30" reads as "dry runs made in fear".
//
// Kept out of the component on purpose: the parser is pure, so the search bar
// stays about the input and the table stays about rows.
import { ORDER_ID_ERROR, type Purchase } from "../api/client";
import { formatTimestamp } from "./format";

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

function tokenPredicate(token: string): Predicate {
  const status = STATUS[token];
  if (status) return status;

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
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return () => true;
  const predicates = tokens.map(tokenPredicate);
  return (p) => predicates.every((match) => match(p));
}

/** The one-click shortcuts under the field — each is just a canned token. */
export const QUERY_CHIPS: { label: string; token: string }[] = [
  { label: "Real buys", token: "bought" },
  { label: "Dry runs", token: "dry" },
  { label: "Errors", token: "error" },
  { label: "Bought in fear", token: "fg<30" },
  { label: "Full drops", token: "x1.5" },
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
