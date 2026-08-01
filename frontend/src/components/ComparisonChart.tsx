import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComparisonPoint, Purchase } from "../api/client";
import {
  AXIS_TICK,
  BREAK_EVEN,
  CHART_COLORS,
  CHART_MARGIN,
  CURSOR_PROPS,
  DATE_AXIS_PROPS,
  GRID_PROPS,
  SERIES,
  SYNC_ID,
  Y_AXIS_WIDTH,
} from "../lib/chart";
import { fmtEur, fmtEurSigned, formatDayMonth } from "../lib/format";
import { ChartTooltipCard } from "./charts/PurchaseDrop";
import PriceStrip from "./charts/PriceStrip";

type EnrichedPoint = ComparisonPoint & {
  bot_profit: number;
  dca_profit: number;
  gainBand: [number, number];
  lossBand: [number, number];
  purchase?: Purchase;
  purchaseY?: number;
};

// Stable default so useMemo doesn't re-run for callers without purchases.
const NO_PURCHASES: Purchase[] = [];

/**
 * The overview chart: two stacked plots that share one date axis.
 *
 * Top is euros of profit — how far Drip is above or below the money it put in,
 * and the same for plain DCA — so one y-scale explains every mark on it and
 * the two lines are actually comparable (see SERIES). Bottom is the BTC price
 * with the buys pinned onto it. They are linked by `syncId`, so one hover
 * reads out both.
 *
 * It fills its parent: give it a container with a height.
 */
export default function ComparisonChart({
  data,
  purchases = NO_PURCHASES,
}: {
  data: ComparisonPoint[];
  purchases?: Purchase[];
}) {
  // Range bands between Drip's profit and break-even: teal above the zero
  // line, rose below it. Each band collapses onto zero when it doesn't apply,
  // so crossovers stay smooth. Buys are pinned onto the BTC price line (last
  // buy per day wins).
  const enriched = useMemo<EnrichedPoint[]>(() => {
    const byDay = new Map<string, Purchase>();
    for (const p of purchases) byDay.set(p.timestamp.slice(0, 10), p);
    return data.map((p) => {
      const purchase = byDay.get(p.date);
      const botProfit = p.bot_value - p.bot_invested;
      return {
        ...p,
        bot_profit: botProfit,
        dca_profit: p.dca_value - p.dca_invested,
        gainBand: [0, Math.max(botProfit, 0)],
        lossBand: [Math.min(botProfit, 0), 0],
        purchase,
        purchaseY: purchase ? p.price : undefined,
      };
    });
  }, [data, purchases]);

  return (
    <div className="flex h-full w-full flex-col">
      <ChartLegend />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={enriched} margin={CHART_MARGIN} syncId={SYNC_ID}>
            <CartesianGrid {...GRID_PROPS} />
            {/* Hidden: the strip below owns the one date axis of the pair. */}
            <XAxis {...DATE_AXIS_PROPS} hide />
            <YAxis
              domain={["auto", "auto"]}
              tick={AXIS_TICK}
              tickFormatter={(v: number) => fmtEurSigned(v, 0)}
              axisLine={false}
              tickLine={false}
              width={Y_AXIS_WIDTH}
            />
            <Tooltip content={<ComparisonTooltip />} cursor={CURSOR_PROPS} />
            <Area
              dataKey="gainBand"
              name="Profit"
              stroke="none"
              fill={CHART_COLORS.teal}
              fillOpacity={0.18}
              tooltipType="none"
              isAnimationActive={false}
              activeDot={false}
            />
            <Area
              dataKey="lossBand"
              name="Loss"
              stroke="none"
              fill={CHART_COLORS.rose}
              fillOpacity={0.14}
              tooltipType="none"
              isAnimationActive={false}
              activeDot={false}
            />
            <ReferenceLine
              y={0}
              stroke={BREAK_EVEN.color}
              strokeWidth={BREAK_EVEN.width}
              strokeDasharray={BREAK_EVEN.dash}
            />
            {/* Written out one by one, and in this order: Recharts only sees
                <Line> as its own child (a wrapper component renders nothing),
                and the last one drawn sits on top. */}
            <Line {...lineProps(SERIES.dca)} />
            <Line {...lineProps(SERIES.drip)} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <StripCaption />
      <div className="h-[6.5rem] shrink-0 md:h-[7.5rem]">
        <PriceStrip data={enriched} />
      </div>
    </div>
  );
}

type Series = (typeof SERIES)[keyof typeof SERIES];

/** Spread onto a <Line>, so the compared lines can't drift from the legend. */
const lineProps = (s: Series) => ({
  type: "monotone" as const,
  dataKey: s.key,
  name: s.label,
  stroke: s.color,
  strokeWidth: s.width,
  strokeDasharray: s.dash,
  dot: false,
  activeDot: { r: 4, strokeWidth: 2, stroke: CHART_COLORS.paper },
});

/**
 * Hand-rolled rather than Recharts' <Legend>: the swatches are the real line
 * styles, and the break-even line and the two shaded areas get an entry too —
 * they carry as much meaning as the lines and Recharts won't list them.
 */
function ChartLegend() {
  return (
    <ul className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-ink">
      {[SERIES.drip, SERIES.dca, BREAK_EVEN].map((s) => (
        <li key={s.label} className="flex items-center gap-1.5">
          <svg width="22" height="10" aria-hidden="true" className="shrink-0">
            <line
              x1="1"
              y1="5"
              x2="21"
              y2="5"
              stroke={s.color}
              strokeWidth={s.width}
              strokeDasharray={s.dash}
              strokeLinecap="round"
            />
          </svg>
          {s.label}
        </li>
      ))}
      <li className="flex items-center gap-1.5 text-ink-soft">
        <span className="h-3 w-3 shrink-0 rounded-[3px] bg-teal/20 ring-1 ring-teal/40" />
        Drip in profit
      </li>
      <li className="flex items-center gap-1.5 text-ink-soft">
        <span className="h-3 w-3 shrink-0 rounded-[3px] bg-rose/15 ring-1 ring-rose/40" />
        at a loss
      </li>
    </ul>
  );
}

/** The divider that tells you the plot below is a different scale entirely. */
function StripCaption() {
  return (
    <div className="mt-3 mb-1 flex items-center gap-2 text-xs text-ink-soft">
      <span className="font-bold uppercase tracking-[0.14em]">BTC price</span>
      <span className="h-px flex-1 bg-sand" />
      <span className="inline-flex items-center gap-1.5">
        <svg width="10" height="14" viewBox="0 0 12 14" aria-hidden="true">
          <path
            d="M6 0 C4.2 3.2 2 5.4 2 8 a4 4 0 0 0 8 0 c0-2.6-2.2-4.8-4-8Z"
            fill={CHART_COLORS.rose}
          />
        </svg>
        a buy &mdash; bigger drop, bigger buy
      </span>
    </div>
  );
}

function ComparisonTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point: EnrichedPoint =
    payload.find((p: any) => p.dataKey === SERIES.drip.key)?.payload ?? payload[0].payload;
  const edge = point.bot_profit - point.dca_profit;
  const tone = (v: number) => (v >= 0 ? "text-teal" : "text-rose");

  // The point's own date, not Recharts' `label`: this chart hides its x-axis.
  return (
    <ChartTooltipCard>
      <div className="mb-1.5 font-bold text-ink">{formatDayMonth(point.date)}</div>
      <table className="border-separate border-spacing-x-2 border-spacing-y-0.5">
        <tbody>
          <TooltipRow
            series={SERIES.drip}
            profit={point.bot_profit}
            invested={point.bot_invested}
          />
          <TooltipRow
            series={SERIES.dca}
            profit={point.dca_profit}
            invested={point.dca_invested}
          />
        </tbody>
      </table>
      <div className="mt-1.5 border-t border-sand pt-1 text-ink-soft">
        Drip is <span className={tone(edge)}>{fmtEurSigned(edge)}</span>{" "}
        {edge >= 0 ? "ahead of" : "behind"} plain DCA
      </div>
    </ChartTooltipCard>
  );
}

/** One side of the comparison: its profit, and the stake that produced it. */
function TooltipRow({
  series,
  profit,
  invested,
}: {
  series: Series;
  profit: number;
  invested: number;
}) {
  return (
    <tr>
      <td>
        <span
          className="inline-block h-2.5 w-2.5 rounded-full align-middle"
          style={{ background: series.color }}
          aria-hidden="true"
        />
      </td>
      <td className="text-ink-soft">{series.label}</td>
      <td
        className={`text-right font-bold ${profit >= 0 ? "text-teal" : "text-rose"}`}
      >
        {fmtEurSigned(profit)}
      </td>
      <td className="text-right text-ink-soft">on {fmtEur(invested, 0)}</td>
    </tr>
  );
}
