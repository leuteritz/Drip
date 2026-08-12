import type { ReactNode } from "react";
import type { Purchase } from "../../api/client";
import { CHART_COLORS, DROP_PATH } from "../../lib/chart";
import { fmtEur } from "../../lib/format";

/**
 * A buy drawn as a little drop on the price line, shared by both charts.
 * Passed to Recharts as `shape={<PurchaseDrop />}`, which clones it with the
 * point's coordinates and payload.
 *
 * With `sized`, the drop scales with the score multiplier (0.5x small …
 * 1.5x big) and dry runs are drawn semi-transparent, so dip-buying is visible
 * at a glance; without it every buy is the same plain drop.
 */
export function PurchaseDrop({ sized = false, ...props }: any) {
  const { cx, cy, payload } = props;
  const purchase: Purchase | undefined = payload?.purchase;
  // The !purchase check is the one that skips the (many) non-buy rows, where
  // Recharts may pass NaN coordinates rather than null — keep it.
  if (!purchase || cx == null || cy == null) return null;

  const scale = sized ? 0.7 + 0.6 * (purchase.multiplier - 0.5) : 1;
  return (
    <g
      transform={`translate(${cx - 6 * scale} ${cy - 14 * scale}) scale(${scale})`}
      opacity={sized && purchase.dry_run ? 0.5 : 1}
    >
      <path
        d={DROP_PATH}
        fill={CHART_COLORS.rose}
        stroke={CHART_COLORS.paper}
        strokeWidth="1.2"
      />
    </g>
  );
}

/** The shared "this day had a buy" footer inside both chart tooltips. */
export function PurchaseTooltipRow({ purchase }: { purchase: Purchase }) {
  return (
    <div className="mt-1 border-t border-sand pt-1 text-rose">
      <div className="font-bold">
        {purchase.dry_run ? "Dry run" : "Buy"}: {fmtEur(purchase.amount_eur)}
      </div>
      <div className="text-ink-soft">
        Score {purchase.score} at x{purchase.multiplier}
      </div>
    </div>
  );
}

/** The frame both chart tooltips sit in. */
export function ChartTooltipCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-paper px-3 py-2 text-xs shadow-card">
      {children}
    </div>
  );
}
