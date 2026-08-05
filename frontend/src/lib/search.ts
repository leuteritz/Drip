// What the command palette finds in the buy history.
//
// It is the same grammar the history's own search bar speaks (lib/query.ts) —
// this only decides what a *result set* is worth saying about itself, which is
// the one thing a list of rows cannot say: how many, how much, over what span,
// and at what price on average.
//
// The averages are deliberately the set's own cost basis (euros over bitcoin)
// rather than a mean of the prices printed on each row. A mean of prices would
// weigh a €50 buy the same as a €600 one and quietly answer a question nobody
// asked; euros over bitcoin is what the matched buys actually cost.

import { ORDER_ID_ERROR, type Purchase } from "../api/client";
import { buildFilter } from "./query";

/** How many rows the palette lists before it defers to the history table. */
export const RESULT_LIMIT = 6;

export interface MatchSummary {
  /** Buys that went through — errors are listed but never summed. */
  count: number;
  eur: number;
  btc: number;
  /** Euros over bitcoin: what the matched set actually cost per coin. */
  avgPrice: number;
  /** "Jul 2026", "Mar – Jul 2026" — the ground the matches cover. */
  span: string;
  /** Failed orders among the matches, which the sums above leave out. */
  failed: number;
}

export interface BuyMatches {
  /** Newest first, capped at RESULT_LIMIT. */
  rows: Purchase[];
  /** Everything that matched, including what `rows` had to leave off. */
  total: number;
  summary: MatchSummary | null;
}

const monthYear = (d: Date) =>
  d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

/** The span two dates cover, at the coarsest precision that still says it. */
function spanLabel(from: Date, to: Date): string {
  const sameMonth =
    from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
  if (sameMonth) {
    return from.getDate() === to.getDate()
      ? from.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : monthYear(from);
  }
  if (from.getFullYear() === to.getFullYear()) {
    return `${from.toLocaleDateString("en-GB", { month: "short" })} – ${monthYear(to)}`;
  }
  return `${monthYear(from)} – ${monthYear(to)}`;
}

/**
 * Every buy the query matches, newest first, with the answer above them.
 *
 * An empty query matches nothing here rather than everything: the palette opens
 * on a blank field, and a list of every buy ever made is not what "open the
 * palette" was asking for.
 */
export function searchPurchases(purchases: Purchase[], query: string): BuyMatches {
  if (!query.trim()) return { rows: [], total: 0, summary: null };

  const matched = purchases
    .filter(buildFilter(query))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (matched.length === 0) return { rows: [], total: 0, summary: null };

  const ok = matched.filter((p) => p.order_id !== ORDER_ID_ERROR);
  const eur = ok.reduce((s, p) => s + p.amount_eur, 0);
  const btc = ok.reduce((s, p) => s + p.btc_amount, 0);
  // `matched` is newest first, so the span runs from its last row to its first.
  const from = new Date(matched[matched.length - 1].timestamp);
  const to = new Date(matched[0].timestamp);

  return {
    rows: matched.slice(0, RESULT_LIMIT),
    total: matched.length,
    summary: {
      count: ok.length,
      eur,
      btc,
      avgPrice: btc > 0 ? eur / btc : 0,
      span: spanLabel(from, to),
      failed: matched.length - ok.length,
    },
  };
}
