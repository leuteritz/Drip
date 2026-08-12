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
import { Card, CardHeader, Loading, Note, Stat, StatRow } from "../ui";

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
      <CardHeader
        title="What you paid, on average"
        info={
          <>
            <p>
              Your average price is compared against what the market itself averaged
              over the same days &mdash; the price someone would have paid by
              spreading the identical money evenly across every single day. Beating
              it is what &ldquo;bought well&rdquo; can honestly mean, and it stays a
              real answer even in a year when the price fell.
            </p>
            <p className="mt-2">
              Your average is what you actually got for your money, so the exchange
              fee is already inside it &mdash; the part of each buy that became
              Coinbase&apos;s rather than bitcoin pushes the price per coin up.
              That is why it is worth seeing next to the average rather than
              buried in the gap below the market. Only buys Drip could read back
              off the order know what they were charged, so an older history has
              nothing to add up here.
            </p>
            <p className="mt-2">
              The chart says the same thing per buy, in sats per euro: how much
              bitcoin each euro bought that day. It is simply the price upside down,
              so the tallest bars are the cheapest buys.
            </p>
            <p className="mt-2">
              The bars sit evenly apart whatever the gap between the buys was, so read
              them as a sequence rather than a timeline. The dashed line is your
              stack&apos;s overall rate, weighted by what each buy cost &mdash; a
              &euro;10 buy does not count the same as a &euro;100 one.
            </p>
          </>
        }
      />

      {/* "No buys yet" is a claim, and it cannot be made until the answer is
          actually in — while it is out this is a wait, not an empty stack. */}
      {!holdings ? (
        <div className="flex h-40 items-center justify-center rounded-xl bg-sand-soft/40">
          <Loading
            compact
            what="Working out what you paid"
            why="Every buy against the market's own average over the same days."
          />
        </div>
      ) : !basis || basis.purchase_count === 0 ? (
        <p className="py-8 text-center text-sm text-ink-soft">
          No buys counted yet — run a test buy or import your history.
        </p>
      ) : (
        <>
          {/* Five tiles, which `StatRow` reads as 3+2. The fee is the reason
              that matters: a wrapping row used to stretch the last tile across
              the whole card, which made it the loudest figure on a card about
              what a coin cost. */}
          <StatRow className="mb-3">
            <Stat
              label="You paid on average"
              hint={`${basis.purchase_count} buys over ${basis.days} days`}
            >
              {fmtEur(basis.avg_price_eur, 0)}
            </Stat>
            <Stat
              label="The market averaged"
              hint="over the same days, buying evenly"
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
            {/* Only the buys that reported a fill know what they cost in fees,
                so this stays away entirely until one of them has — a zero here
                would read as "nothing was charged" rather than "not recorded". */}
            {basis.fees_from > 0 && (
              <Stat
                label="Coinbase took"
                hint={`${basis.fees_pct.toFixed(2)}% of ${basis.fees_from} ${
                  basis.fees_from === 1 ? "buy" : "buys"
                }`}
              >
                {fmtEur(basis.fees_eur)}
              </Stat>
            )}
          </StatRow>

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
            One bar per buy: how much bitcoin that euro bought. Bars above the dashed
            line are the buys that pulled your average down.
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
      <div className={better ? "text-kelp" : "text-ink-soft"}>
        {fmtSats(row.satsPerEur)} per euro
      </div>
    </ChartTooltipCard>
  );
}
