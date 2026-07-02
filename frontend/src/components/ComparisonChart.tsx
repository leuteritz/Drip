import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComparisonPoint } from "../api/client";
import { fmtEur } from "../api/client";

export default function ComparisonChart({ data }: { data: ComparisonPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
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
          tickFormatter={(v: number) => fmtEur(v, 0)}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip content={<ComparisonTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value: string) => <span className="text-slate-300">{value}</span>}
        />
        <Line
          type="monotone"
          dataKey="bot_value"
          name="Bot-Strategie"
          stroke="#f7931a"
          strokeWidth={2.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="dca_value"
          name="Einfaches DCA"
          stroke="#818cf8"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="bot_invested"
          name="Investiert (Bot)"
          stroke="#475569"
          strokeWidth={1.5}
          strokeDasharray="2 4"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ComparisonTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const point: ComparisonPoint = payload[0].payload;
  const botProfit = point.bot_value - point.bot_invested;
  const dcaProfit = point.dca_value - point.dca_invested;
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs shadow-xl">
      <div className="font-semibold text-slate-200">{label}</div>
      <div className="mt-1 space-y-0.5">
        <div className="text-btc">
          Bot: {fmtEur(point.bot_value)}{" "}
          <span className={botProfit >= 0 ? "text-up" : "text-down"}>
            ({botProfit >= 0 ? "+" : ""}
            {fmtEur(botProfit)})
          </span>
        </div>
        <div className="text-indigo-300">
          DCA: {fmtEur(point.dca_value)}{" "}
          <span className={dcaProfit >= 0 ? "text-up" : "text-down"}>
            ({dcaProfit >= 0 ? "+" : ""}
            {fmtEur(dcaProfit)})
          </span>
        </div>
      </div>
    </div>
  );
}
