import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Candle, Purchase } from "../api/client";
import {
  AXIS_TICK,
  CHART_COLORS,
  CHART_MARGIN,
  CURSOR_PROPS,
  DATE_AXIS_PROPS,
  GRID_PROPS,
  Y_AXIS_WIDTH,
  fmtThousands,
} from "../lib/chart";
import { fmtEur, formatDayMonth } from "../lib/format";
import {
  ChartTooltipCard,
  PurchaseDrop,
  PurchaseTooltipRow,
} from "./charts/PurchaseDrop";

interface Point {
  date: string;
  close: number;
  purchase?: Purchase;
  purchaseY?: number;
}

/** Price-only fallback, shown until there are enough buys to chart a strategy. */
export default function PriceChart({
  candles,
  purchases,
  height = 340,
}: {
  candles: Candle[];
  purchases: Purchase[];
  height?: number | string;
}) {
  const byDay = new Map<string, Purchase>();
  for (const p of purchases) {
    byDay.set(p.timestamp.slice(0, 10), p);
  }

  const data: Point[] = candles.map((c) => {
    const purchase = byDay.get(c.date);
    return {
      date: c.date,
      close: c.close,
      purchase,
      purchaseY: purchase ? c.close : undefined,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={CHART_MARGIN}>
        <defs>
          <linearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.water} stopOpacity={0.45} />
            <stop offset="100%" stopColor={CHART_COLORS.water} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...DATE_AXIS_PROPS} />
        <YAxis
          domain={["auto", "auto"]}
          tick={AXIS_TICK}
          tickFormatter={fmtThousands}
          axisLine={false}
          tickLine={false}
          width={Y_AXIS_WIDTH}
        />
        <Tooltip content={<PriceTooltip />} cursor={CURSOR_PROPS} />
        <Area
          type="monotone"
          dataKey="close"
          stroke={CHART_COLORS.teal}
          strokeWidth={2.5}
          fill="url(#waterGradient)"
          dot={false}
          name="BTC-EUR"
        />
        <Scatter dataKey="purchaseY" shape={<PurchaseDrop />} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function PriceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point: Point = payload[0].payload;
  return (
    <ChartTooltipCard>
      <div className="font-bold text-ink">{formatDayMonth(point.date)}</div>
      <div className="text-teal">{fmtEur(point.close, 0)}</div>
      {point.purchase && <PurchaseTooltipRow purchase={point.purchase} />}
    </ChartTooltipCard>
  );
}
