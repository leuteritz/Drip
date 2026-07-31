// Sats arithmetic for the stack view.
//
// Kept out of the component for the same reason `query.ts` is: it is the one
// place that decides which buys count, and it has to agree with the backend's
// `analytics.relevant_purchases` — failed buys out, dry runs by the same toggle
// the rest of the overview uses. A component filtering rows on its own is how
// two numbers on one page start disagreeing.

import { ORDER_ID_ERROR, type Purchase } from "../api/types";

export const SATS_PER_BTC = 100_000_000;

export interface SatsPoint {
  date: string;
  /** Sats bought with one euro at that buy — the whole point of the series. */
  satsPerEur: number;
  sats: number;
  cumulative: number;
  priceEur: number;
  amountEur: number;
  dryRun: boolean;
}

export interface SatsSummary {
  points: SatsPoint[];
  totalSats: number;
  /** Sats per euro across the whole stack, i.e. the inverse of the average
   *  entry price — not the mean of the per-buy rates, which would weight a
   *  small buy the same as a large one. */
  averageSatsPerEur: number;
  best: SatsPoint | null;
  worst: SatsPoint | null;
}

export function buildSatsSeries(
  purchases: Purchase[],
  includeDryRun: boolean,
): SatsSummary {
  const counted = purchases
    .filter((p) => p.order_id !== ORDER_ID_ERROR)
    .filter((p) => includeDryRun || !p.dry_run)
    .filter((p) => p.amount_eur > 0 && p.btc_amount > 0)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  let cumulative = 0;
  let totalEur = 0;
  const points: SatsPoint[] = counted.map((p) => {
    const sats = p.btc_amount * SATS_PER_BTC;
    cumulative += sats;
    totalEur += p.amount_eur;
    return {
      date: p.timestamp.slice(0, 10),
      satsPerEur: sats / p.amount_eur,
      sats,
      cumulative,
      priceEur: p.price_eur,
      amountEur: p.amount_eur,
      dryRun: p.dry_run,
    };
  });

  const byRate = [...points].sort((a, b) => a.satsPerEur - b.satsPerEur);
  return {
    points,
    totalSats: cumulative,
    averageSatsPerEur: totalEur > 0 ? cumulative / totalEur : 0,
    best: byRate.length ? byRate[byRate.length - 1] : null,
    worst: byRate.length ? byRate[0] : null,
  };
}
