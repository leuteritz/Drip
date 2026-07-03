import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComparisonPoint, Purchase } from "../api/client";
import { fmtEur } from "../api/client";

type EnrichedPoint = ComparisonPoint & {
  gainBand: [number, number];
  lossBand: [number, number];
  purchase?: Purchase;
  purchaseY?: number;
};

// Stable default so useMemo doesn't re-run for callers without purchases.
const NO_PURCHASES: Purchase[] = [];

export default function ComparisonChart({
  data,
  purchases = NO_PURCHASES,
  height = 300,
}: {
  data: ComparisonPoint[];
  purchases?: Purchase[];
  height?: number | string;
}) {
  // Range bands between the bot's value and what it invested: teal where the
  // strategy is in profit, rose where it is under water. Each band collapses
  // onto the invested line when it doesn't apply, so crossovers stay smooth.
  // Buys are pinned onto the BTC price line (last buy per day wins).
  const enriched = useMemo<EnrichedPoint[]>(() => {
    const byDay = new Map<string, Purchase>();
    for (const p of purchases) byDay.set(p.timestamp.slice(0, 10), p);
    return data.map((p) => {
      const purchase = byDay.get(p.date);
      return {
        ...p,
        gainBand: [p.bot_invested, Math.max(p.bot_value, p.bot_invested)],
        lossBand: [Math.min(p.bot_value, p.bot_invested), p.bot_invested],
        purchase,
        purchaseY: purchase ? p.price : undefined,
      };
    });
  }, [data, purchases]);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={enriched} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="comboWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#93b7be" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#93b7be" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#d5c7bc" strokeDasharray="3 5" vertical={false} opacity={0.6} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#6f6f6f", fontSize: 11 }}
          tickFormatter={(d: string) => d.slice(5)}
          axisLine={{ stroke: "#d5c7bc" }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          yAxisId="portfolio"
          domain={["auto", "auto"]}
          tick={{ fill: "#6f6f6f", fontSize: 11 }}
          tickFormatter={(v: number) => fmtEur(v, 0)}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        {/* Squashed domain keeps the price backdrop in the lower two thirds so
            it doesn't fight the strategy lines for attention. */}
        <YAxis
          yAxisId="btc"
          orientation="right"
          domain={[(min: number) => min * 0.97, (max: number) => max * 1.45]}
          tick={{ fill: "#93b7be", fontSize: 11 }}
          tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<ComparisonTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value: string) => <span style={{ color: "#454545" }}>{value}</span>}
        />
        <Area
          yAxisId="btc"
          type="monotone"
          dataKey="price"
          name="BTC price"
          stroke="#93b7be"
          strokeWidth={1.5}
          fill="url(#comboWater)"
          dot={false}
          tooltipType="none"
          activeDot={false}
        />
        <Area
          yAxisId="portfolio"
          dataKey="gainBand"
          name="Profit"
          stroke="none"
          fill="#45818c"
          fillOpacity={0.18}
          legendType="none"
          tooltipType="none"
          isAnimationActive={false}
          activeDot={false}
        />
        <Area
          yAxisId="portfolio"
          dataKey="lossBand"
          name="Loss"
          stroke="none"
          fill="#785964"
          fillOpacity={0.12}
          legendType="none"
          tooltipType="none"
          isAnimationActive={false}
          activeDot={false}
        />
        <Line
          yAxisId="portfolio"
          type="monotone"
          dataKey="bot_value"
          name="Drip strategy"
          stroke="#45818c"
          strokeWidth={3}
          dot={false}
        />
        <Line
          yAxisId="portfolio"
          type="monotone"
          dataKey="dca_value"
          name="Plain DCA"
          stroke="#785964"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
        />
        <Line
          yAxisId="portfolio"
          type="monotone"
          dataKey="bot_invested"
          name="Invested (Drip)"
          stroke="#93b7be"
          strokeWidth={1.5}
          strokeDasharray="2 5"
          dot={false}
        />
        <Scatter
          yAxisId="btc"
          dataKey="purchaseY"
          shape={<PurchaseDrop />}
          legendType="none"
          tooltipType="none"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Buys are drawn as little drops on the price line; the drop scales with the
// score multiplier (0.5x small ... 1.5x big), so dip-buying is visible at a
// glance. Dry runs are semi-transparent.
function PurchaseDrop(props: any) {
  const { cx, cy, payload } = props;
  const purchase: Purchase | undefined = payload?.purchase;
  // The !purchase check is the one that skips the (many) non-buy rows, where
  // Recharts may pass NaN coordinates rather than null — keep it.
  if (!purchase || cx == null || cy == null) return null;
  const s = 0.7 + 0.6 * (purchase.multiplier - 0.5);
  return (
    <g
      transform={`translate(${cx - 6 * s} ${cy - 14 * s}) scale(${s})`}
      opacity={purchase.dry_run ? 0.5 : 1}
    >
      <path
        d="M6 0 C4.2 3.2 2 5.4 2 8 a4 4 0 0 0 8 0 c0-2.6-2.2-4.8-4-8Z"
        fill="#785964"
        stroke="#fbfffd"
        strokeWidth="1.2"
      />
    </g>
  );
}

function ComparisonTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const point: EnrichedPoint =
    payload.find((p: any) => p.dataKey === "bot_value")?.payload ?? payload[0].payload;
  const botProfit = point.bot_value - point.bot_invested;
  const dcaProfit = point.dca_value - point.dca_invested;
  const edge = botProfit - dcaProfit;
  return (
    <div className="rounded-xl border-2 border-sand bg-paper px-3 py-2 text-xs shadow-puff">
      <div className="font-bold text-ink">{label}</div>
      <div className="text-ink-soft">BTC {fmtEur(point.price, 0)}</div>
      <div className="mt-1 space-y-0.5">
        <div className="text-teal">
          Drip: {fmtEur(point.bot_value)}{" "}
          <span className={botProfit >= 0 ? "text-teal" : "text-rose"}>
            ({botProfit >= 0 ? "+" : ""}
            {fmtEur(botProfit)})
          </span>
        </div>
        <div className="text-rose">
          DCA: {fmtEur(point.dca_value)}{" "}
          <span className={dcaProfit >= 0 ? "text-teal" : "text-rose"}>
            ({dcaProfit >= 0 ? "+" : ""}
            {fmtEur(dcaProfit)})
          </span>
        </div>
        <div className="border-t border-sand pt-0.5 text-ink-soft">
          vs. DCA:{" "}
          <span className={edge >= 0 ? "text-teal" : "text-rose"}>
            {edge >= 0 ? "+" : ""}
            {fmtEur(edge)}
          </span>
        </div>
      </div>
      {point.purchase && (
        <div className="mt-1 border-t border-sand pt-1 text-rose">
          <div className="font-bold">
            {point.purchase.dry_run ? "Dry run" : "Buy"}: {fmtEur(point.purchase.amount_eur)}
          </div>
          <div className="text-ink-soft">
            Score {point.purchase.score} at x{point.purchase.multiplier}
          </div>
        </div>
      )}
    </div>
  );
}
