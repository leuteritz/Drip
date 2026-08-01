import FlagIcon from "~icons/ph/flag-checkered";
import type { Outlook } from "../../api/client";
import { fmtEur, formatDayMonthYear, SATS_PER_BTC } from "../../lib/format";
import { useStackAmount } from "../../lib/units";
import { Card, CardHeader, Loading, Note, Stat } from "../ui";

const RING_RADIUS = 54;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** "32 weeks" / "about 2 years" — an ETA nobody should read to the week. */
function awayLabel(weeks: number): string {
  if (weeks <= 1) return "within the week";
  if (weeks < 78) return `about ${weeks} weeks`;
  const years = weeks / 52;
  return `about ${years < 2.5 ? "2" : Math.round(years)} years`;
}

/**
 * The one card that faces forwards.
 *
 * Everything else in the overview reports what already happened. This carries
 * the rate the bot has actually been stacking at — averaged over the last
 * `rate_weeks` weeks, not read off the settings, so a paused fortnight counts —
 * a year forward, and shows how far that leaves the next round number of sats.
 *
 * The euro side is arithmetic. The sats side prices future buys at today's
 * price, which is the one number nobody has; the footnote says so rather than
 * dressing an assumption up as a projection.
 */
export default function OutlookCard({ data }: { data: Outlook | null }) {
  const stackAmount = useStackAmount();

  if (!data) {
    return (
      <Card className="flex flex-col">
        <CardHeader title="If the drip keeps running" />
        <Loading
          what="Working out where the drip is headed"
          why="Averaging what it has actually stacked over the last couple of months, then carrying that forward."
        />
      </Card>
    );
  }

  const { milestone, streak } = data;
  const stalled = data.per_week_eur <= 0;
  const progress = Math.max(0, Math.min(100, milestone.progress_pct ?? 0));

  return (
    <Card className="flex flex-col">
      <CardHeader title="If the drip keeps running" />

      <div className="flex flex-col items-center gap-6 md:flex-row md:items-stretch md:gap-8">
        {/* The next round number, as a filling ring */}
        <div className="flex shrink-0 flex-col items-center text-center md:w-[210px]">
          {milestone.available ? (
            <>
              <div className="relative">
                <svg viewBox="0 0 128 128" className="h-[128px] w-[128px] -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="var(--color-sand)"
                    strokeWidth="11"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="var(--color-teal)"
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={RING_LENGTH}
                    strokeDashoffset={RING_LENGTH * (1 - progress / 100)}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-2xl font-semibold text-ink">
                    {Math.round(progress)}%
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-soft">
                    of the way
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-sm font-bold text-ink">
                <FlagIcon className="text-teal" aria-hidden="true" />
                {stackAmount((milestone.target_sats ?? 0) / SATS_PER_BTC)}
              </div>
              <div className="mt-1 text-xs text-ink-soft">
                {stalled || milestone.weeks_away == null
                  ? "no recent buys to judge by"
                  : `${awayLabel(milestone.weeks_away)}${
                      milestone.eta ? ` · ${formatDayMonthYear(milestone.eta)}` : ""
                    }`}
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-6">
              <FlagIcon className="text-2xl text-teal" aria-hidden="true" />
              <p className="text-sm font-bold text-ink">Past every milestone</p>
              <p className="text-xs text-ink-soft">
                {data.sats > 0
                  ? "The ladder stops at 21 BTC. Yours is above it."
                  : "The first rung is 100,000 sats."}
              </p>
            </div>
          )}
        </div>

        {/* The rate, and a year of it */}
        {/* Four across once there is room: on a full-width card a 2x2 block of
            tiles reads as a form rather than as the KPI row it is. */}
        <div className="grid flex-1 grid-cols-2 gap-2 self-center lg:grid-cols-4">
          <Stat
            label="Stacking per week"
            hint={
              stalled
                ? `nothing in the last ${data.rate_weeks} weeks`
                : `${stackAmount(data.per_week_sats / SATS_PER_BTC)} at the prices paid`
            }
          >
            {stalled ? "—" : fmtEur(data.per_week_eur)}
          </Stat>
          <Stat label="Streak" hint={`${streak.total_weeks} weeks with a buy in all`}>
            {streak.weeks} {streak.weeks === 1 ? "week" : "weeks"}
          </Stat>
          <Stat label="A year of that" hint="at the rate above, unchanged">
            {stalled ? "—" : fmtEur(data.year_eur, 0)}
          </Stat>
          <Stat label="Which buys" hint="at today's price">
            {stalled ? "—" : stackAmount(data.year_sats / SATS_PER_BTC)}
          </Stat>
        </div>
      </div>

      <Note>
        The rate is what Drip actually stacked over the last {data.rate_weeks} weeks,
        not what the schedule says it should — a paused fortnight or a run of
        half-size buys is already in it. The euro figures follow from that rate and
        nothing else. The sats do not: they price a year of future buys at today&apos;s
        {" "}
        {fmtEur(data.current_price, 0)}, which is the one number nobody has. Read them
        as an order of magnitude, and expect the real answer to be a different one.
      </Note>
    </Card>
  );
}
