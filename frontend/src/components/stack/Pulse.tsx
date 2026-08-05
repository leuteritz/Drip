import WarningIcon from "~icons/ph/warning";
import type { BotSettings, Pulse, PulseWeek } from "../../api/client";
import { fmtEur, formatDayMonthYear, SATS_PER_BTC } from "../../lib/format";
import { useStackAmount } from "../../lib/units";
import { Card, CardHeader, Loading, Note, Stat, Toggle } from "../ui";

/** How many gaps are named in words before the rest are counted in one line. */
const GAPS_LISTED = 5;

const MARK: Record<PulseWeek["state"], string> = {
  landed: "bg-water",
  failed: "bg-rose",
  missed: "bg-rose/45",
};

/**
 * Whether the drip actually dripped, week by week.
 *
 * Every other card here reports buys that happened. This one reports the weeks
 * nothing did — the one thing a savings bot can get wrong that its own history
 * cannot show, because a missed week leaves no row behind and every average
 * above carries on happily without it.
 *
 * It counts every run, test or live: the question is whether the Pi woke up,
 * not whether it spent money, so the overview's dry-run toggle deliberately
 * does not reach this card. A week whose only run was a failed order is its own
 * third state — the bot did wake up, and that is a different fault with a
 * different fix.
 *
 * Priced, not guessed: a gap is worth one buy at today's base amount and that
 * day's closing price. The multiplier that week is not knowable without
 * re-scoring the day, and a reconstructed 1.25x would be a made-up number in a
 * card whose whole point is that it does not paper over anything.
 *
 * It carries the one switch that can do something about all this, because this
 * is where the problem is read — the same rule the spout follows, where the
 * drip is set on the figure that states it. Off by default: it is the only
 * thing in Drip that can spend money at a moment nobody picked.
 */
export default function PulseCard({
  data,
  settings,
  onSaveSettings,
}: {
  data: Pulse | null;
  settings: BotSettings | null;
  onSaveSettings: (update: Partial<BotSettings>) => Promise<void>;
}) {
  const stackAmount = useStackAmount();

  if (!data) {
    return (
      <Card className="flex flex-col">
        <CardHeader title="Weeks the drip landed" />
        <div className="flex h-40 items-center justify-center">
          <Loading
            compact
            what="Checking every week since your first buy"
            why="Looking for the weeks a buy should have landed in and did not."
          />
        </div>
      </Card>
    );
  }

  const { overdue, gaps } = data;
  const clean = data.missed === 0 && data.failed === 0;
  const gapSats = data.gap_cost.sats;

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Weeks the drip landed"
        info={
          <>
            <p>
              One mark per calendar week since your first buy, up to a year of them.
              Blue means a buy landed that week; the two rose marks are weeks it did
              not &mdash; the muted one is a week nothing happened at all, the solid
              one a week the bot ran and the order failed.
            </p>
            <p className="mt-2">
              Test runs count here, and only here: everywhere else on this dashboard
              a dry run is not bitcoin, but this card asks whether the Pi woke up,
              not whether it spent anything.
            </p>
            <p className="mt-2">
              A missed week is priced at one buy of your current base amount at that
              day&apos;s closing price &mdash; what the week would have bought, not
              what it cost you, since the money was never spent.
            </p>
            <p className="mt-2">
              <strong className="font-semibold text-ink">
                A week you paused looks exactly like a week the Pi was off.
              </strong>{" "}
              Drip stores when the pause ends and no record of past ones, so it
              cannot tell the two apart afterwards. Weeks before your first buy are
              never counted.
            </p>
            <p className="mt-2">
              Switch <strong className="font-semibold text-ink">catching up</strong> on
              and Drip looks for a missed slot when it starts and once a day after
              that, and buys it &mdash; at that moment&apos;s price and that
              moment&apos;s score, since a Monday that was missed cannot be bought at
              Monday&apos;s price. Only ever the most recent slot, so a Pi that was off
              for two months comes back to one buy and not to eight. Never while
              paused, never before your first buy, and never when the bot did run and
              the order was refused &mdash; that is the exchange&apos;s answer, not a
              gap.
            </p>
          </>
        }
      />

      {overdue.overdue && (
        <p className="mb-4 flex items-start gap-1.5 rounded-xl bg-rose-soft/60 px-3 py-2.5 text-xs leading-relaxed text-ink">
          <WarningIcon className="mt-0.5 shrink-0 text-rose" aria-hidden="true" />
          <span>
            <strong className="font-semibold">
              The buy due {overdue.days < 1 ? "today" : `${overdue.days} ${overdue.days === 1 ? "day" : "days"} ago`} has
              not landed.
            </strong>{" "}
            Nothing has been bought since the last scheduled slot, and the bot is not
            paused. Worth checking that the Pi is up and the container is running
            &mdash; a run now still lands this week.
          </span>
        </p>
      )}

      {data.weeks_checked === 0 ? (
        <p className="py-6 text-center text-sm text-ink-soft">
          No buys yet, so there is nothing to have missed. The record starts with your
          first one.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Stat
              label="Weeks bought"
              hint={`of the last ${data.weeks_checked} · ${data.coverage_pct.toFixed(0)}%`}
            >
              {data.landed}
            </Stat>
            <Stat
              label="Weeks nothing landed"
              tone={clean ? "plain" : "down"}
              hint={
                data.failed
                  ? `plus ${data.failed} ${data.failed === 1 ? "week" : "weeks"} the order failed`
                  : clean
                    ? "the drip has not skipped one"
                    : "no buy at all, for any reason"
              }
            >
              {data.missed}
            </Stat>
            <Stat
              label="What they would have bought"
              hint={
                data.missed
                  ? `${fmtEur(data.gap_cost.eur)} at those days' prices`
                  : "nothing to make up"
              }
            >
              {gapSats ? stackAmount(gapSats / SATS_PER_BTC) : "—"}
            </Stat>
          </div>

          <WeekStrip data={data} stackAmount={stackAmount} />

          {gaps.length > 0 && (
            <div className="mt-4 flex flex-col gap-1.5">
              {gaps.slice(0, GAPS_LISTED).map((gap) => (
                <div
                  key={gap.week_start}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-xl bg-sand-soft/60 px-3 py-2"
                >
                  <span className="text-sm font-medium text-ink">
                    {formatDayMonthYear(gap.expected)}
                  </span>
                  <span className="text-sm text-ink-soft">
                    {gap.price_eur ? (
                      <>
                        <span className="font-semibold text-ink">
                          {stackAmount(gap.sats / SATS_PER_BTC)}
                        </span>{" "}
                        at {fmtEur(gap.price_eur, 0)}
                      </>
                    ) : (
                      "no price cached for that day"
                    )}
                  </span>
                </div>
              ))}
              {gaps.length > GAPS_LISTED && (
                <p className="px-3 text-xs text-ink-soft">
                  and {gaps.length - GAPS_LISTED} earlier{" "}
                  {gaps.length - GAPS_LISTED === 1 ? "week" : "weeks"}.
                </p>
              )}
            </div>
          )}

          <Note>
            {clean
              ? `Every one of the last ${data.weeks_checked} weeks got its buy.`
              : "One mark per week — the rose ones are the weeks a buy never landed."}
          </Note>
        </>
      )}

      {/* The one thing that can act on any of the above, so it lives under it
          rather than in a settings dialog three clicks away. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl bg-water-soft/50 px-3.5 py-3">
        <Toggle
          checked={settings?.catch_up ?? false}
          disabled={!settings}
          onChange={(v) => void onSaveSettings({ catch_up: v })}
        />
        <span className="text-sm font-bold text-ink">Catch a missed buy up</span>
        <span className="min-w-0 flex-1 text-xs text-ink-soft">
          If a buy was due while Drip was off, buy it when Drip is back &mdash; once,
          at that moment&apos;s price.
        </span>
      </div>
    </Card>
  );
}

/**
 * The record as one row: a mark per week, oldest on the left.
 *
 * Sized by the grid rather than in pixels (`auto-cols-fr`), so eight weeks of
 * history reads as eight wide bars and a full year as a fine texture, at any
 * width down to a phone. The hover titles are a bonus, not the information —
 * a touch screen has no hover, which is why the gaps are listed in words
 * underneath as well.
 */
function WeekStrip({
  data,
  stackAmount,
}: {
  data: Pulse;
  stackAmount: (btc: number) => string;
}) {
  const describe = (week: PulseWeek) => {
    const when = `Week of ${formatDayMonthYear(week.start)}`;
    if (week.state === "missed") return `${when} — nothing bought`;
    if (week.state === "failed") return `${when} — the order failed`;
    return `${when} — ${week.buys} ${week.buys === 1 ? "buy" : "buys"}, ${fmtEur(
      week.eur,
    )}, ${stackAmount(week.sats / SATS_PER_BTC)}`;
  };

  return (
    <>
      <div
        role="img"
        aria-label={`${data.landed} of the last ${data.weeks_checked} weeks got a buy`}
        className="grid grid-flow-col auto-cols-fr gap-px overflow-hidden rounded-lg bg-sand-soft/60 p-1 sm:gap-0.5"
      >
        {data.weeks.map((week) => (
          <span
            key={week.start}
            title={describe(week)}
            className={`h-8 rounded-[2px] sm:h-10 ${MARK[week.state]}`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-2xs text-ink-soft">
        <span>{formatDayMonthYear(data.weeks[0].start)}</span>
        <div className="flex items-center gap-3">
          <Key className="bg-water">bought</Key>
          <Key className="bg-rose/45">nothing</Key>
          <Key className="bg-rose">failed</Key>
        </div>
        <span>this week</span>
      </div>
    </>
  );
}

function Key({ className, children }: { className: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-[2px] ${className}`} aria-hidden="true" />
      {children}
    </span>
  );
}
