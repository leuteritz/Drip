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
          <linearGradient id="btcGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f7931a" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#f7931a" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#232a3b" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickFormatter={(d: string) => d.slice(5)}
          axisLine={{ stroke: "#232a3b" }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<PriceTooltip />} />
        <Area
          type="monotone"
          dataKey="close"
          stroke="#f7931a"
          strokeWidth={2}
          fill="url(#btcGradient)"
          dot={false}
          name="BTC-EUR"
        />
        <Scatter dataKey="purchaseY" fill="#22c55e" shape={<PurchaseDot />} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function PurchaseDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload?.purchase) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill="#22c55e" opacity={0.25} />
      <circle cx={cx} cy={cy} r={3.5} fill="#22c55e" stroke="#0b0e14" strokeWidth={1.5} />
    </g>
  );
}

function PriceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point: Point = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs shadow-xl">
      <div className="font-semibold text-slate-200">{point.date}</div>
      <div className="text-btc">{fmtEur(point.close, 0)}</div>
      {point.purchase && (
        <div className="mt-1 border-t border-line pt-1 text-up">
          <div className="font-semibold">
            {point.purchase.dry_run ? "🧪 Dry-Run" : "✅ Kauf"}: {fmtEur(point.purchase.amount_eur)}
          </div>
          <div className="text-slate-400">
            Score {point.purchase.score} · ×{point.purchase.multiplier}
          </div>
        </div>
      )}
    </div>
  );
}
