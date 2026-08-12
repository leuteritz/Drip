import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import WavesIcon from "~icons/ph/waves";
import type { Waterline, WaterlineEpisode } from "../../api/client";
import {
  AXIS_TICK,
  CHART_COLORS,
  CHART_MARGIN,
  CURSOR_PROPS,
  DATE_AXIS_PROPS,
  Y_AXIS_WIDTH,
} from "../../lib/chart";
import {
  SATS_PER_BTC,
  fmtEur,
  formatDayMonthYear,
  formatMonthYear,
} from "../../lib/format";
import { useStackAmount } from "../../lib/units";
import { Card, CardHeader, Loading, Note, Stat, StatRow } from "../ui";

/**
 * How far under water the stack went, and what the drip bought down there.
 *
 * Every card above this one is an average over the buys that happened, which is
 * the right way to read a savings bot and is exactly what hides the only thing
 * that ever makes somebody stop: the stretches where the stack was worth less
 * than the money put into it. An average entry price of €38,000 says nothing
 * about the eleven months it spent 60% down, and eleven months 60% down is what
 * DCA actually asks of a person.
 *
 * So the picture is the water and not the profit: the line hangs *below* zero,
 * because that is where a drawdown is, and the surface is the money paid in.
 * Everything above the line belongs to the chart at the top of the page.
 *
 * The figure the card is really for is the one underneath — how many buys were
 * made down there, and what they are worth now. A drip that kept going through
 * a drawdown bought its cheapest bitcoin exactly then, and nothing else on this
 * page can say so, because the history knows what each buy cost and nothing
 * about the weather it was made in.
 */
export default function WaterlineCard({ data }: { data: Waterline | null }) {
  const stackAmount = useStackAmount();

  if (!data) {
    return (
      <Card className="flex flex-col">
        <CardHeader title="Under the waterline" />
        <div className="flex h-64 items-center justify-center">
          <Loading
            what="Working out how deep it went"
            why="Holding what the stack was worth against what it cost, every day since the first buy."
          />
        </div>
      </Card>
    );
  }

  const info = (
    <>
      <p>
        The line is how far the stack sat{" "}
        <strong className="font-semibold text-ink">below what you paid for it</strong>{" "}
        on each day &mdash; never above. The surface is the money you put in, and
        everything over it is the chart at the top of this page.
      </p>
      <p className="mt-2">
        A stretch only counts once it went deeper than {data.threshold_pct}%. A buy
        settles a fraction under its cost the moment it is made, so a stricter reading
        would mark almost every buy day and call the exchange fee a crash.
      </p>
      <p className="mt-2">
        Buys made under water and buys made above it are both valued at today&apos;s
        price, so the two figures are fair arithmetic. They are still not a verdict on
        timing: a buy from four years ago has had four years to work, whichever side
        of the water it fell on.
      </p>
    </>
  );

  if (!data.available) {
    return (
      <Card className="flex flex-col">
        <CardHeader title="Under the waterline" info={info} />
        <p className="py-6 text-center text-sm text-ink-soft">
          Not enough history yet to say how deep it has been. This fills in once the
          drip has run for a few weeks.
        </p>
      </Card>
    );
  }

  const under = data.current;
  const worst = data.deepest;

  return (
    <Card className="flex flex-col">
      <CardHeader title="Under the waterline" info={info} />

      {/* The verdict first, in one sentence, because it is the whole card:
          either you are down right now, or here is the worst you sat through. */}
      <Headline data={data} />

      {worst ? (
        <>
          <div className="mt-4 h-48 sm:h-56">
            <DepthChart data={data} />
          </div>

          <StatRow className="mt-4">
            <Stat
              label={under ? "Down right now" : "Deepest it went"}
              tone="down"
              hint={
                under
                  ? `${under.days.toLocaleString()} days under so far`
                  : `on ${formatDayMonthYear(worst.deepest_on)}`
              }
            >
              {pct(under ? data.depth_now_pct : worst.depth_pct)}
            </Stat>
            <Stat
              label="Longest stretch"
              hint={
                data.longest
                  ? `${formatDayMonthYear(data.longest.start)} onwards`
                  : undefined
              }
            >
              {data.longest ? `${data.longest.days.toLocaleString()} days` : "—"}
            </Stat>
            <Stat
              label="Days under water"
              hint={`of ${data.days.toLocaleString()} since the first buy`}
            >
              {Math.round(data.under_pct)}%
            </Stat>
            <Stat
              label="Stretches like that"
              hint={`deeper than ${data.threshold_pct}%, which is where a fee stops and a drawdown starts`}
            >
              {data.episodes.toLocaleString()}
            </Stat>
          </StatRow>

          {data.bought_under && data.bought_under.buys > 0 && (
            <KeptBuying data={data} stackAmount={stackAmount} />
          )}

          {data.recent.length > 1 && <Episodes list={data.recent} />}

          <Note>
            {under ? (
              <>
                Nothing here says the price comes back. It says what the drip did the
                last time it was down here, which is the only part you decide.
              </>
            ) : (
              <>
                Every stretch on this card ended above water. That is the record so
                far and not a promise &mdash; what it does show is that the drip kept
                buying through all of them.
              </>
            )}
          </Note>
        </>
      ) : (
        <NeverUnder days={data.days} threshold={data.threshold_pct} />
      )}
    </Card>
  );
}

/** Always negative or zero here, so the sign is written rather than implied. */
const pct = (v: number) => `${v >= 0 ? "" : "−"}${Math.abs(v).toFixed(1)}%`;

/**
 * The one sentence the card exists to say. Under water is present tense and
 * gets the rose; above it is past tense and stays in plain ink — a stack that
 * has recovered may not be coloured like one that has not.
 */
function Headline({ data }: { data: Waterline }) {
  const under = data.current;
  return (
    <div className="flex items-start gap-3 rounded-xl bg-water-soft/50 px-3.5 py-3">
      <WavesIcon
        className={`mt-0.5 shrink-0 text-xl ${under ? "text-rose" : "text-teal"}`}
        aria-hidden="true"
      />
      <p className="min-w-0 text-sm leading-relaxed text-ink-soft">
        {under ? (
          <>
            Your stack is worth{" "}
            <strong className="font-semibold text-rose">
              {pct(data.depth_now_pct)}
            </strong>{" "}
            less than the money in it, and has been under for{" "}
            <strong className="font-semibold text-ink">
              {under.days.toLocaleString()} days
            </strong>
            .
          </>
        ) : data.deepest ? (
          <>
            Above water today. The worst it ever got was{" "}
            <strong className="font-semibold text-ink">
              {pct(data.deepest.depth_pct)}
            </strong>{" "}
            on {formatDayMonthYear(data.deepest.deepest_on)} &mdash; and it took{" "}
            {data.deepest.days.toLocaleString()} days to come back.
          </>
        ) : (
          <>Above water, and never once below it.</>
        )}
      </p>
    </div>
  );
}

/**
 * The depth curve: rose area hanging under a zero line that *is* the waterline.
 *
 * The y domain is pinned to 0 at the top so the surface is always the top edge
 * of the plot, whatever the worst day was. A chart that rescaled its zero would
 * make a 4% dip and a 60% crash look identical, which is the one thing this
 * picture must not do.
 */
function DepthChart({ data }: { data: Waterline }) {
  const worst = data.deepest?.depth_pct ?? -1;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data.curve} margin={CHART_MARGIN}>
        <defs>
          <linearGradient id="waterlineDepth" x1="0" y1="0" x2="0" y2="1">
            {/* Faint at the surface, solid at the bottom: the fill is meant to
                read as depth, and rose at 12% on the night theme's ground came
                out grey rather than as a colour with a meaning. */}
            <stop offset="0%" stopColor={CHART_COLORS.rose} stopOpacity={0.22} />
            <stop offset="100%" stopColor={CHART_COLORS.rose} stopOpacity={0.75} />
          </linearGradient>
        </defs>
        {/* The shared date axis, with the year put back on. Every other chart
            here plots months and reads "23 Apr"; this one plots the whole
            history, where "23 Apr" over a five-year span names no year at all
            and the drawdown could be any of them. */}
        <XAxis {...DATE_AXIS_PROPS} tickFormatter={formatMonthYear} />
        <YAxis
          domain={[Math.floor(worst * 1.15), 0]}
          tick={AXIS_TICK}
          tickFormatter={(v: number) => `${Math.round(v)}%`}
          tickCount={4}
          width={Y_AXIS_WIDTH}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceLine
          y={0}
          stroke={CHART_COLORS.water}
          strokeWidth={2}
          strokeDasharray="9 4"
        />
        <Tooltip
          cursor={CURSOR_PROPS}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as { date: string; depth_pct: number };
            return (
              <div className="rounded-xl border-2 border-sand bg-paper px-3 py-2 shadow-puff">
                <div className="text-xs font-bold text-ink-soft">
                  {formatDayMonthYear(point.date)}
                </div>
                <div className="font-display text-lg font-semibold text-ink">
                  {point.depth_pct < 0 ? pct(point.depth_pct) : "above water"}
                </div>
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="depth_pct"
          stroke={CHART_COLORS.rose}
          strokeWidth={2}
          fill="url(#waterlineDepth)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * What the drip did while it was down there — the figure the whole card is for.
 *
 * Both sides are priced at today's price, so the comparison is arithmetic and
 * not a claim. The wording says what it is: what you bought, not what you were
 * clever enough to buy.
 */
function KeptBuying({
  data,
  stackAmount,
}: {
  data: Waterline;
  stackAmount: (btc: number) => string;
}) {
  const below = data.bought_under!;
  const above = data.bought_above;
  const share =
    below.buys + (above?.buys ?? 0) > 0
      ? (below.buys / (below.buys + (above?.buys ?? 0))) * 100
      : 0;
  const better = above && above.buys > 0 && below.profit_pct > above.profit_pct;

  return (
    <div className="mt-3 rounded-xl border-2 border-sand bg-water-soft/40 p-3.5">
      <h4 className="font-display text-base font-semibold text-ink">
        You kept buying down there
      </h4>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        <strong className="font-semibold text-ink">
          {below.buys.toLocaleString()} of your buys
        </strong>{" "}
        ({Math.round(share)}%) were made while the stack was under water &mdash;{" "}
        {fmtEur(below.eur, 0)} for {stackAmount(below.sats / SATS_PER_BTC)}, at an
        average of {fmtEur(below.avg_price_eur, 0)} a coin.
        {better && above ? (
          <>
            {" "}
            Those are the ones now up{" "}
            <strong className="font-semibold text-kelp">
              {below.profit_pct.toFixed(0)}%
            </strong>
            , against {above.profit_pct.toFixed(0)}% for everything bought above the
            line.
          </>
        ) : (
          <>
            {" "}
            They stand at{" "}
            <strong
              className={`font-semibold ${
                below.profit_pct >= 0 ? "text-kelp" : "text-rose"
              }`}
            >
              {below.profit_pct >= 0 ? "+" : ""}
              {below.profit_pct.toFixed(0)}%
            </strong>{" "}
            today.
          </>
        )}
      </p>
    </div>
  );
}

/** The last few stretches, newest first — the evidence under the verdict. */
function Episodes({ list }: { list: WaterlineEpisode[] }) {
  return (
    <div className="mt-4">
      <h4 className="text-2xs font-bold uppercase tracking-[0.12em] text-ink-soft">
        Recent stretches
      </h4>
      <ul className="mt-2 flex flex-col gap-1.5">
        {list.map((e) => (
          <li
            key={e.start}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-sand-soft/60 px-3 py-2 text-sm"
          >
            <span className="font-display font-semibold text-ink">
              {pct(e.depth_pct)}
            </span>
            <span className="text-ink-soft">
              {formatDayMonthYear(e.start)} · {e.days.toLocaleString()} days
              {e.recovered ? "" : ", still under"}
            </span>
            <span className="ml-auto text-xs text-ink-soft">
              {e.buys > 0
                ? `${e.buys} ${e.buys === 1 ? "buy" : "buys"}, ${fmtEur(e.eur, 0)}`
                : "no buy fell in it"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The best possible answer, and it needs saying rather than leaving blank. */
function NeverUnder({ days, threshold }: { days: number; threshold: number }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <p className="font-display text-2xl font-semibold text-ink">Never been under</p>
      <p className="max-w-md text-sm text-ink-soft">
        In {days.toLocaleString()} days of buying, the stack has not once been worth
        more than {threshold}% less than the money in it. That is unusual, and it is
        not something to plan around.
      </p>
    </div>
  );
}
