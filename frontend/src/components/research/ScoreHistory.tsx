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
import type { ChartEvent, ScorePoint } from "../../api/client";
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
import { Card, CardHeader, Loading, Note, RangePills } from "../ui";

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
  events,
  days,
  onDays,
}: {
  data: ScorePoint[] | null;
  events: ChartEvent[] | null;
  days: number;
  onDays: (v: number) => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="The score over time"
        info={
          <>
            <p>
              Everywhere else the score only appears on the days Drip happened to buy
              &mdash; 52 disconnected dots a year. Read every day it becomes a shape,
              and the question is whether the multiplier really moves with the market
              or just jitters.
            </p>
            <p className="mt-2">
              The bars are the daily score, on the right-hand axis, coloured by the
              size of buy they trigger: teal is more than the base amount, rose is
              less, sand is exactly the base. The dark line is the BTC price on the
              left-hand axis.
            </p>
            <p className="mt-2">
              The dashed markers are the only facts here rather than readings &mdash;
              a halving, and the highest and lowest price this window contains.
            </p>
          </>
        }
      >
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
        <div className="flex h-64 items-center justify-center rounded-xl bg-sand-soft/40">
          <Loading compact counter={false} what="Re-scoring every day in the window" />
        </div>
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
                {(events ?? []).map((event) => (
                  <ReferenceLine
                    key={`${event.kind}-${event.date}`}
                    yAxisId="price"
                    x={event.date}
                    stroke={CHART_COLORS.inkSoft}
                    strokeDasharray="4 4"
                    label={{
                      value: event.label,
                      position: "insideTopLeft",
                      fill: CHART_COLORS.inkSoft,
                      fontSize: 11,
                    }}
                  />
                ))}
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
            Teal bars buy more than the base amount, rose bars less. They should
            cluster in the dips of the price line &mdash; that is the whole idea.
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
