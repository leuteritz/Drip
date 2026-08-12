import FlagIcon from "~icons/ph/flag-checkered";
import type { Outlook } from "../../api/client";
import { countPeriods } from "../../lib/cadence";
import { fmtEur, formatDayMonthYear, SATS_PER_BTC } from "../../lib/format";
import { useStackAmount } from "../../lib/units";
import { Card, CardHeader, Loading, Note, Stat, StatRow } from "../ui";

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
      <CardHeader
        title="If the drip keeps running"
        info={
          <>
            <p>
              The rate is what Drip actually stacked over the last {data.rate_weeks}{" "}
              weeks, not what the schedule says it should &mdash; a paused fortnight
              or a run of half-size buys is already in it.
            </p>
            <p className="mt-2">
              The euro figures follow from that rate and nothing else. The bitcoin
              figures do not: they price a year of future buys at today&apos;s{" "}
              {fmtEur(data.current_price, 0)}, which is the one number nobody has.
              Read them as an order of magnitude and expect the real answer to be a
              different one.
            </p>
            <p className="mt-2">
              The ring is the next round number of sats worth reaching, and the date
              is when this rate would get you there.
            </p>
          </>
        }
      />

      <div className="flex flex-col items-center gap-6 md:flex-row md:items-stretch md:gap-8">
        {/* The next round number, as a filling ring */}
        <div className="flex shrink-0 flex-col items-center text-center md:w-[13rem]">
          {milestone.available ? (
            <>
              <div className="relative">
                <svg viewBox="0 0 128 128" className="h-32 w-32 -rotate-90">
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
                  <span className="text-2xs font-bold uppercase tracking-[0.14em] text-ink-soft">
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
        <StatRow className="flex-1 self-center">
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
          {/* Counted in the drip's own rhythm, not in weeks: a monthly saver
              who has never missed one used to read "1 week". */}
          <Stat
            label="Streak"
            hint={`${countPeriods(streak.total_periods, streak.cadence)} with a buy in total`}
          >
            {countPeriods(streak.periods, streak.cadence)}
          </Stat>
          <Stat label="In a year" hint="at the same rate">
            {stalled ? "—" : fmtEur(data.year_eur, 0)}
          </Stat>
          <Stat label="That buys about" hint="if the price never moved">
            {stalled ? "—" : stackAmount(data.year_sats / SATS_PER_BTC)}
          </Stat>
        </StatRow>
      </div>

      <Note>
        Measured from the last {data.rate_weeks} weeks of real buys, then carried
        forward. Nobody knows next year&apos;s price, so treat the bitcoin figures as
        a rough size, not a promise.
      </Note>
    </Card>
  );
}
