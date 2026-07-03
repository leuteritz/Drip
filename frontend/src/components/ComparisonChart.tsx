import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComparisonPoint } from "../api/client";
import { fmtEur } from "../api/client";

export default function ComparisonChart({
  data,
  height = 300,
}: {
  data: ComparisonPoint[];
  height?: number | string;
}) {
  // Range bands between the bot's value and what it invested: teal where the
  // strategy is in profit, rose where it is under water. Each band collapses
  // onto the invested line when it doesn't apply, so crossovers stay smooth.
  const enriched = useMemo(
    () =>
      data.map((p) => ({
        ...p,
        gainBand: [p.bot_invested, Math.max(p.bot_value, p.bot_invested)],
        lossBand: [Math.min(p.bot_value, p.bot_invested), p.bot_invested],
      })),
    [data],
  );
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={enriched} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
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
          tickFormatter={(v: number) => fmtEur(v, 0)}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip content={<ComparisonTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value: string) => <span style={{ color: "#454545" }}>{value}</span>}
        />
        <Area
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
          type="monotone"
          dataKey="bot_value"
          name="Drip strategy"
          stroke="#45818c"
          strokeWidth={3}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="dca_value"
          name="Plain DCA"
          stroke="#785964"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="bot_invested"
          name="Invested (Drip)"
          stroke="#93b7be"
          strokeWidth={1.5}
          strokeDasharray="2 5"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ComparisonTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const point: ComparisonPoint =
    payload.find((p: any) => p.dataKey === "bot_value")?.payload ?? payload[0].payload;
  const botProfit = point.bot_value - point.bot_invested;
  const dcaProfit = point.dca_value - point.dca_invested;
  const edge = botProfit - dcaProfit;
  return (
    <div className="rounded-xl border-2 border-sand bg-paper px-3 py-2 text-xs shadow-puff">
      <div className="font-bold text-ink">{label}</div>
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
    </div>
  );
}
