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
import { fmtEur } from "../api/client";

interface Point {
  date: string;
  close: number;
  purchase?: Purchase;
  purchaseY?: number;
}

export default function PriceChart({
  candles,
  purchases,
}: {
  candles: Candle[];
  purchases: Purchase[];
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
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#93b7be" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#93b7be" stopOpacity={0.04} />
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
          domain={["auto", "auto"]}
          tick={{ fill: "#6f6f6f", fontSize: 11 }}
          tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<PriceTooltip />} />
        <Area
          type="monotone"
          dataKey="close"
          stroke="#45818c"
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

// Buys are drawn as little drops on the price line
function PurchaseDrop(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload?.purchase) return null;
  return (
    <g transform={`translate(${cx - 6} ${cy - 14})`}>
      <path
        d="M6 0 C4.2 3.2 2 5.4 2 8 a4 4 0 0 0 8 0 c0-2.6-2.2-4.8-4-8Z"
        fill="#785964"
        stroke="#fbfffd"
        strokeWidth="1.2"
      />
    </g>
  );
}

function PriceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point: Point = payload[0].payload;
  return (
    <div className="rounded-xl border-2 border-sand bg-paper px-3 py-2 text-xs shadow-puff">
      <div className="font-bold text-ink">{point.date}</div>
      <div className="text-teal">{fmtEur(point.close, 0)}</div>
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
