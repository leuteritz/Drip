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
import { Card, CardHeader, Loading, Note, RangePills, Stat, StatRow } from "../ui";

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
      <CardHeader
        title="How often it worked"
        info={
          <>
            <p>
              One backtest is one path and proves nothing, so this runs the same
              backtest again and again, each time starting a week later, and plots
              every result as its own bar. Each bar is a complete {windowDays}-day run
              that bought every {WEEKDAYS[data?.weekday ?? 0]} and is measured against
              plain DCA over exactly the same days.
            </p>
            <p className="mt-2">
              The runs overlap by design &mdash; they step one week at a time &mdash;
              so neighbouring bars share most of their buys and this is not{" "}
              {data?.count ?? 0} independent trials. What it does show honestly is
              whether the edge survives a bad starting point, or only existed because
              one particular start date happened to work.
            </p>
            <p className="mt-2">
              Measured in percentage points of return (pp): profit per euro put in,
              which is the only fair scale when the two sides deliberately invest
              different amounts.
            </p>
          </>
        }
      >
        <RangePills
          options={[
            { label: "6m runs", value: 180 },
            { label: "1y runs", value: 365 },
            { label: "2y runs", value: 730 },
          ]}
          value={windowDays}
          onChange={onWindowDays}
        />
      </CardHeader>

      {!data ? (
        <div className="flex h-64 items-center justify-center rounded-xl bg-sand-soft/40">
          <Loading compact what="Rolling the test window across the years" />
        </div>
      ) : windows.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-soft">
          Not enough price history for a {windowDays}-day run yet.
        </p>
      ) : (
        <>
          <StatRow className="mb-3">
            <Stat
              label="Runs Drip won"
              tone={data.win_rate >= 50 ? "up" : "down"}
              hint={`${data.wins} of ${data.count}`}
            >
              {data.win_rate.toFixed(0)}%
            </Stat>
            <Stat
              label="Typical run"
              tone={data.median_pp >= 0 ? "up" : "down"}
              hint={`most land between ${fmtPp(data.p10_pp)} and ${fmtPp(data.p90_pp)}`}
            >
              {fmtPp(data.median_pp)}
            </Stat>
            <Stat label="Worst run" tone={data.worst_pp >= 0 ? "up" : "down"}>
              {fmtPp(data.worst_pp)}
            </Stat>
            <Stat label="Best run" tone={data.best_pp >= 0 ? "up" : "down"}>
              {fmtPp(data.best_pp)}
            </Stat>
          </StatRow>

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
                      fill={w.edge_pp >= 0 ? CHART_COLORS.kelp : CHART_COLORS.rose}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <Note>
            Each bar is a {windowDays}-day test run that started on that date. Above
            the line Drip beat plain DCA, below it plain DCA won.
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
      <div className={row.edge_pp >= 0 ? "text-kelp" : "text-rose"}>
        {fmtPp(row.edge_pp)} buying every {WEEKDAYS[weekday]}
      </div>
    </ChartTooltipCard>
  );
}
