import {
  Area,
  ComposedChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Purchase } from "../../api/client";
import {
  AXIS_TICK,
  CHART_COLORS,
  CHART_MARGIN,
  CURSOR_PROPS,
  DATE_AXIS_PROPS,
  SYNC_ID,
  Y_AXIS_WIDTH,
  fmtThousands,
} from "../../lib/chart";
import { fmtEur, formatDayMonth } from "../../lib/format";
import { ChartTooltipCard, PurchaseDrop, PurchaseTooltipRow } from "./PurchaseDrop";

export interface PricePoint {
  date: string;
  price: number;
  purchase?: Purchase;
  purchaseY?: number;
}

/**
 * The lower half of the overview: BTC price with a drop for every buy, and the
 * only date axis of the pair.
 *
 * This used to be a second y-axis inside the strategy chart, which meant one
 * plot carried two scales and six series at once. Splitting it out is what
 * keeps the euro chart above readable — so it must stay aligned with it: same
 * left/right margin, same axis width, same syncId.
 */
export default function PriceStrip({ data }: { data: PricePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        margin={{ ...CHART_MARGIN, top: 18 }}
        syncId={SYNC_ID}
      >
        <defs>
          <linearGradient id="stripWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.water} stopOpacity={0.4} />
            <stop offset="100%" stopColor={CHART_COLORS.water} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <XAxis {...DATE_AXIS_PROPS} />
        {/* Headroom at the top so the drops sitting on the line stay inside. */}
        <YAxis
          domain={[(min: number) => min * 0.96, (max: number) => max * 1.12]}
          tick={AXIS_TICK}
          tickFormatter={fmtThousands}
          tickCount={3}
          axisLine={false}
          tickLine={false}
          width={Y_AXIS_WIDTH}
        />
        <Tooltip content={<PriceStripTooltip />} cursor={CURSOR_PROPS} />
        <Area
          type="monotone"
          dataKey="price"
          name="BTC price"
          stroke={CHART_COLORS.water}
          strokeWidth={2}
          fill="url(#stripWater)"
          dot={false}
          activeDot={false}
        />
        <Scatter dataKey="purchaseY" shape={<PurchaseDrop sized />} tooltipType="none" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Deliberately price-only: the euros live in the chart above. */
function PriceStripTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point: PricePoint = payload[0].payload;
  return (
    <ChartTooltipCard>
      <div className="font-bold text-ink">{formatDayMonth(point.date)}</div>
      <div className="text-ink-soft">
        BTC <span className="font-bold text-ink">{fmtEur(point.price, 0)}</span>
      </div>
      {point.purchase && <PurchaseTooltipRow purchase={point.purchase} />}
    </ChartTooltipCard>
  );
}
