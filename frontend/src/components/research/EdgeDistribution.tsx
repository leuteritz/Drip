import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RollingWindows } from "../../api/client";
import {
  AXIS_TICK,
  CHART_COLORS,
  CHART_MARGIN,
  CURSOR_PROPS,
  DATE_AXIS_PROPS,
  GRID_PROPS,
  Y_AXIS_WIDTH,
} from "../../lib/chart";
import { formatDayMonth, fmtPct, fmtPp, WEEKDAYS } from "../../lib/format";
import { ChartTooltipCard } from "../charts/PurchaseDrop";
import { Card, CardHeader, Note, RangePills, Stat } from "../ui";

/**
 * One backtest is one path and proves nothing. This runs the same backtest from
 * every start date a week apart and plots each result as its own bar, so the
 * answer is a distribution: how often the multiplier helped, by how much, and
 * how badly it went in its worst stretch.
 *
 * Measured in percentage points of return for the same reason the attribution
 * card is — see the comment there.
 */
export default function EdgeDistribution({
  data,
  windowDays,
  onWindowDays,
}: {
  data: RollingWindows | null;
  windowDays: number;
  onWindowDays: (v: number) => void;
}) {
  const windows = data?.windows ?? [];

  return (
    <Card className="flex flex-col">
      <CardHeader title="How often it worked">
        <RangePills
          options={[
            { label: "6m windows", value: 180 },
            { label: "1y windows", value: 365 },
            { label: "2y windows", value: 730 },
          ]}
          value={windowDays}
          onChange={onWindowDays}
        />
      </CardHeader>

      {!data ? (
        <div className="h-64 animate-pulse rounded-xl bg-sand-soft/70" />
      ) : windows.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-soft">
          Not enough candle history for a {windowDays}-day window yet.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <Stat
              label="Windows Drip won"
              tone={data.win_rate >= 50 ? "up" : "down"}
              hint={`${data.wins} of ${data.count}`}
            >
              {data.win_rate.toFixed(0)}%
            </Stat>
            <Stat
              label="Median edge"
              tone={data.median_pp >= 0 ? "up" : "down"}
              hint={`middle 80%: ${fmtPp(data.p10_pp)} to ${fmtPp(data.p90_pp)}`}
            >
              {fmtPp(data.median_pp)}
            </Stat>
            <Stat label="Worst window" tone={data.worst_pp >= 0 ? "up" : "down"}>
              {fmtPp(data.worst_pp)}
            </Stat>
            <Stat label="Best window" tone={data.best_pp >= 0 ? "up" : "down"}>
              {fmtPp(data.best_pp)}
            </Stat>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={windows} margin={CHART_MARGIN}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis {...DATE_AXIS_PROPS} dataKey="start" />
                <YAxis
                  width={Y_AXIS_WIDTH}
                  tick={AXIS_TICK}
                  tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)}pp`}
                  axisLine={false}
                  tickLine={false}
                />
                <ReferenceLine y={0} stroke={CHART_COLORS.ink} strokeWidth={1} />
                <Tooltip
                  cursor={CURSOR_PROPS}
                  content={<WindowTooltip weekday={data.weekday} />}
                />
                <Bar dataKey="edge_pp" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  {windows.map((w) => (
                    <Cell
                      key={w.start}
                      fill={w.edge_pp >= 0 ? CHART_COLORS.teal : CHART_COLORS.rose}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <Note>
            Every bar is a complete {windowDays}-day backtest that started on that
            date and bought every {WEEKDAYS[data.weekday]}, measured against plain
            DCA over the same window. The windows overlap by design &mdash; they step
            one week at a time &mdash; so neighbouring bars share most of their
            buys and this is not {data.count} independent trials. What it does show
            honestly is whether the edge survives a bad entry point, or only exists
            because one particular start date happened to work.
          </Note>
        </>
      )}
    </Card>
  );
}

function WindowTooltip({
  active,
  payload,
  weekday,
}: {
  active?: boolean;
  payload?: { payload: RollingWindows["windows"][number] }[];
  weekday: number;
}) {
  const row = active && payload?.length ? payload[0].payload : null;
  if (!row) return null;
  return (
    <ChartTooltipCard>
      <div className="font-bold text-ink">
        {formatDayMonth(row.start)} &rarr; {formatDayMonth(row.end)}
      </div>
      <div className="mt-1 text-ink-soft">
        Drip {fmtPct(row.bot_pct)} · plain DCA {fmtPct(row.dca_pct)}
      </div>
      <div className={row.edge_pp >= 0 ? "text-teal" : "text-rose"}>
        {fmtPp(row.edge_pp)} buying every {WEEKDAYS[weekday]}
      </div>
    </ChartTooltipCard>
  );
}
