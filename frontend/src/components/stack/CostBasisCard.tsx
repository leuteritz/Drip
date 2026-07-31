import { useMemo } from "react";
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
import type { Holdings, Purchase } from "../../api/client";
import {
  AXIS_TICK,
  CHART_COLORS,
  CHART_MARGIN,
  CURSOR_PROPS,
  DATE_AXIS_PROPS,
  GRID_PROPS,
  Y_AXIS_WIDTH,
} from "../../lib/chart";
import { fmtEur, fmtPct, fmtSats, formatDayMonth } from "../../lib/format";
import { buildSatsSeries, type SatsPoint } from "../../lib/stack";
import { ChartTooltipCard } from "../charts/PurchaseDrop";
import { Card, CardHeader, Note, Stat } from "../ui";

/**
 * How well the drip actually bought, which is not the same question as whether
 * the price went up.
 *
 * The yardstick is the market's own time-weighted average price over the same
 * days: someone who spread the identical money evenly across every day would
 * have paid exactly that, so beating it is what "bought well" can honestly
 * mean. It stays a real answer in a market that fell, where profit does not.
 *
 * Underneath, the same thing per buy and in the unit that survives a small
 * stack: sats per euro. It is the reciprocal of the price, so the bars are
 * tallest where the buying was cheapest — the shape a saver actually wants to
 * see, and the one the price chart shows upside down.
 */
export default function CostBasisCard({
  holdings,
  purchases,
  includeDryRun,
}: {
  holdings: Holdings | null;
  purchases: Purchase[];
  includeDryRun: boolean;
}) {
  const sats = useMemo(
    () => buildSatsSeries(purchases, includeDryRun),
    [purchases, includeDryRun],
  );
  const basis = holdings?.cost_basis;
  const ahead = (basis?.advantage_pct ?? 0) >= 0;

  return (
    <Card className="flex flex-col">
      <CardHeader title="Your cost basis" />

      {!basis || basis.purchase_count === 0 ? (
        <p className="py-8 text-center text-sm text-ink-soft">
          No buys counted yet — run a test buy or import your history.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <Stat
              label="Your average entry"
              hint={`${basis.purchase_count} buys over ${basis.days} days`}
            >
              {fmtEur(basis.avg_price_eur, 0)}
            </Stat>
            <Stat
              label="Market average, same days"
              hint="what buying evenly would have paid"
            >
              {fmtEur(basis.market_twap_eur, 0)}
            </Stat>
            <Stat
              label={ahead ? "You bought below it" : "You bought above it"}
              tone={ahead ? "up" : "down"}
            >
              {fmtPct(basis.advantage_pct)}
            </Stat>
            <Stat
              label="Sats per euro"
              hint={`best ${fmtSats(sats.best?.satsPerEur ?? 0)} · worst ${fmtSats(
                sats.worst?.satsPerEur ?? 0,
              )}`}
            >
              {fmtSats(sats.averageSatsPerEur)}
            </Stat>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sats.points} margin={CHART_MARGIN}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis {...DATE_AXIS_PROPS} />
                <YAxis
                  width={Y_AXIS_WIDTH}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => Math.round(v).toLocaleString("en-IE")}
                />
                <ReferenceLine
                  y={sats.averageSatsPerEur}
                  stroke={CHART_COLORS.ink}
                  strokeDasharray="6 4"
                  strokeWidth={1}
                />
                <Tooltip
                  cursor={CURSOR_PROPS}
                  content={<SatsTooltip average={sats.averageSatsPerEur} />}
                />
                <Bar dataKey="satsPerEur" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {sats.points.map((point) => (
                    <Cell
                      key={point.date}
                      fill={
                        point.satsPerEur >= sats.averageSatsPerEur
                          ? CHART_COLORS.teal
                          : CHART_COLORS.water
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <Note>
            One bar per buy, measured in sats per euro &mdash; taller is cheaper. The
            bars sit evenly apart whatever the gap between the buys was, so read
            them as a sequence, not a timeline.
            The dashed line is your stack&apos;s overall rate, weighted by what each
            buy cost rather than counting a &euro;10 buy the same as a &euro;100 one,
            which makes it exactly the reciprocal of your average entry above. Bars
            over the line are the buys that pulled your cost basis down.
          </Note>
        </>
      )}
    </Card>
  );
}

function SatsTooltip({
  active,
  payload,
  average,
}: {
  active?: boolean;
  payload?: { payload: SatsPoint }[];
  average: number;
}) {
  const row = active && payload?.length ? payload[0].payload : null;
  if (!row) return null;
  const better = row.satsPerEur >= average;
  return (
    <ChartTooltipCard>
      <div className="font-bold text-ink">{formatDayMonth(row.date)}</div>
      <div className="mt-1 text-ink-soft">
        {fmtEur(row.amountEur)} at {fmtEur(row.priceEur, 0)}
        {row.dryRun && " · dry run"}
      </div>
      <div className={better ? "text-teal" : "text-ink-soft"}>
        {fmtSats(row.satsPerEur)} per euro
      </div>
    </ChartTooltipCard>
  );
}
