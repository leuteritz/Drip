import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ScorePoint } from "../../api/client";
import {
  AXIS_TICK,
  CHART_COLORS,
  CHART_MARGIN,
  CURSOR_PROPS,
  DATE_AXIS_PROPS,
  fmtThousands,
  GRID_PROPS,
  Y_AXIS_WIDTH,
} from "../../lib/chart";
import { fmtEur, formatDayMonth } from "../../lib/format";
import { ChartTooltipCard } from "../charts/PurchaseDrop";
import { Card, CardHeader, Note, RangePills } from "../ui";

/**
 * The score read daily instead of weekly, against the price it was read from.
 *
 * Everywhere else the score appears only on the days Drip happened to buy —
 * 52 disconnected dots a year. Taken every day it becomes a shape, and the
 * question it answers is whether the multiplier moves with the market or just
 * jitters: bars should stand tall through the troughs of the price line and
 * fall away at its peaks.
 */
export default function ScoreHistory({
  data,
  days,
  onDays,
}: {
  data: ScorePoint[] | null;
  days: number;
  onDays: (v: number) => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader title="The score over time">
        <RangePills
          options={[
            { label: "1y", value: 365 },
            { label: "2y", value: 730 },
            { label: "3y", value: 1095 },
          ]}
          value={days}
          onChange={onDays}
        />
      </CardHeader>

      {!data ? (
        <div className="h-64 animate-pulse rounded-xl bg-sand-soft/70" />
      ) : (
        <>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={CHART_MARGIN}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis {...DATE_AXIS_PROPS} />
                <YAxis
                  yAxisId="price"
                  width={Y_AXIS_WIDTH}
                  tick={AXIS_TICK}
                  tickFormatter={fmtThousands}
                  axisLine={false}
                  tickLine={false}
                  domain={["dataMin", "dataMax"]}
                />
                <YAxis
                  yAxisId="score"
                  orientation="right"
                  width={40}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  domain={[-6, 10]}
                />
                <ReferenceLine
                  yAxisId="score"
                  y={0}
                  stroke={CHART_COLORS.sand}
                  strokeWidth={1}
                />
                <Tooltip cursor={CURSOR_PROPS} content={<ScoreTooltip />} />
                <Bar
                  yAxisId="score"
                  dataKey="score"
                  isAnimationActive={false}
                  opacity={0.75}
                >
                  {data.map((point) => (
                    <Cell key={point.date} fill={tierColor(point.multiplier)} />
                  ))}
                </Bar>
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="close"
                  stroke={CHART_COLORS.ink}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <Note>
            Bars are the daily score on the right axis, coloured by the multiplier
            they trigger &mdash; teal buys more than the base amount, rose buys less,
            sand is exactly the base. The dark line is the BTC price on the left axis.
            Read it as a sanity check on the machinery: if the teal clusters do not
            sit in the price&apos;s dips, the score is not reading what it claims to.
          </Note>
        </>
      )}
    </Card>
  );
}

/** Teal above the base amount, rose below, sand exactly at it. */
function tierColor(multiplier: number): string {
  if (multiplier > 1) return CHART_COLORS.teal;
  if (multiplier < 1) return CHART_COLORS.rose;
  return CHART_COLORS.sand;
}

function ScoreTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ScorePoint }[];
}) {
  const row = active && payload?.length ? payload[0].payload : null;
  if (!row) return null;
  return (
    <ChartTooltipCard>
      <div className="font-bold text-ink">{formatDayMonth(row.date)}</div>
      <div className="mt-1 text-ink-soft">{fmtEur(row.close, 0)}</div>
      <div className="text-ink">
        score {row.score > 0 ? "+" : ""}
        {row.score} &rarr; {row.multiplier}&times; the base amount
      </div>
    </ChartTooltipCard>
  );
}
