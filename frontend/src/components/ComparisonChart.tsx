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
import {
  CHART_COLORS,
  CHART_MARGIN,
  DATE_AXIS_PROPS,
  GRID_PROPS,
  fmtThousands,
} from "../lib/chart";
import { fmtEur } from "../lib/format";
import {
  ChartTooltipCard,
  PurchaseDrop,
  PurchaseTooltipRow,
} from "./charts/PurchaseDrop";

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
      <ComposedChart data={enriched} margin={CHART_MARGIN}>
        <defs>
          <linearGradient id="comboWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.water} stopOpacity={0.25} />
            <stop offset="100%" stopColor={CHART_COLORS.water} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...DATE_AXIS_PROPS} />
        <YAxis
          yAxisId="portfolio"
          domain={["auto", "auto"]}
          tick={{ fill: CHART_COLORS.inkSoft, fontSize: 11 }}
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
          tick={{ fill: CHART_COLORS.water, fontSize: 11 }}
          tickFormatter={fmtThousands}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<ComparisonTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value: string) => (
            <span style={{ color: CHART_COLORS.ink }}>{value}</span>
          )}
        />
        <Area
          yAxisId="btc"
          type="monotone"
          dataKey="price"
          name="BTC price"
          stroke={CHART_COLORS.water}
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
          fill={CHART_COLORS.teal}
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
          fill={CHART_COLORS.rose}
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
          stroke={CHART_COLORS.teal}
          strokeWidth={3}
          dot={false}
        />
        <Line
          yAxisId="portfolio"
          type="monotone"
          dataKey="dca_value"
          name="Plain DCA"
          stroke={CHART_COLORS.rose}
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
        />
        <Line
          yAxisId="portfolio"
          type="monotone"
          dataKey="bot_invested"
          name="Invested (Drip)"
          stroke={CHART_COLORS.water}
          strokeWidth={1.5}
          strokeDasharray="2 5"
          dot={false}
        />
        <Scatter
          yAxisId="btc"
          dataKey="purchaseY"
          shape={<PurchaseDrop sized />}
          legendType="none"
          tooltipType="none"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ComparisonTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const point: EnrichedPoint =
    payload.find((p: any) => p.dataKey === "bot_value")?.payload ?? payload[0].payload;
  const botProfit = point.bot_value - point.bot_invested;
  const dcaProfit = point.dca_value - point.dca_invested;
  const edge = botProfit - dcaProfit;

  const signed = (v: number) => `${v >= 0 ? "+" : ""}${fmtEur(v)}`;
  const tone = (v: number) => (v >= 0 ? "text-teal" : "text-rose");

  return (
    <ChartTooltipCard>
      <div className="font-bold text-ink">{label}</div>
      <div className="text-ink-soft">BTC {fmtEur(point.price, 0)}</div>
      <div className="mt-1 space-y-0.5">
        <div className="text-teal">
          Drip: {fmtEur(point.bot_value)}{" "}
          <span className={tone(botProfit)}>({signed(botProfit)})</span>
        </div>
        <div className="text-rose">
          DCA: {fmtEur(point.dca_value)}{" "}
          <span className={tone(dcaProfit)}>({signed(dcaProfit)})</span>
        </div>
        <div className="border-t border-sand pt-0.5 text-ink-soft">
          vs. DCA: <span className={tone(edge)}>{signed(edge)}</span>
        </div>
      </div>
      {point.purchase && <PurchaseTooltipRow purchase={point.purchase} />}
    </ChartTooltipCard>
  );
}
