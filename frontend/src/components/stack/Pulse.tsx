import WarningIcon from "~icons/ph/warning";
import type { BotSettings, Pulse, PulsePeriod, SettingsUpdate } from "../../api/client";
import { cadenceOf, countPeriods } from "../../lib/cadence";
import { fmtEur, formatDayMonthYear, SATS_PER_BTC } from "../../lib/format";
import { useStackAmount } from "../../lib/units";
import {
  Card,
  CardHeader,
  Failed,
  Loading,
  Note,
  Stat,
  StatFacts,
  StatRow,
  Toggle,
} from "../ui";

/** How many gaps are named in words before the rest are counted in one line. */
const GAPS_LISTED = 5;

/**
 * A period is one of four things, and only two of them are faults.
 *
 * `paused` is a muted `ink` rather than a colour of its own: a period you asked
 * for nothing in is not a result, and the palette has no hue that means "not a
 * question" — rose is for the ones Drip meant to buy in and did not. Grey is the
 * one reading left, and it works in both themes because `ink` flips with them,
 * dark type on a light card and light type on a dark one, so the mark stays a
 * quiet notch against the strip either way.
 *
 * Not `sand`: the strip's own bed is `sand-soft`, so a sand mark came out
 * darker than the tray it sat in and read as a hole punched through the record
 * — which is precisely the thing this state exists to stop it saying.
 */
const MARK: Record<PulsePeriod["state"], string> = {
  landed: "bg-water",
  failed: "bg-rose",
  missed: "bg-rose/45",
  paused: "bg-ink/30",
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
  error,
  onRetry,
  settings,
  onSaveSettings,
}: {
  data: Pulse | null;
  error?: string | null;
  onRetry?: () => void;
  settings: BotSettings | null;
  onSaveSettings: (update: SettingsUpdate) => Promise<void>;
}) {
  const stackAmount = useStackAmount();

  if (!data) {
    return (
      <Card tone="strip" className="flex flex-col">
        <CardHeader title="When the drip landed" />
        <div className="flex h-40 items-center justify-center">
          {error ? (
            <Failed
              compact
              what="Could not check whether the drip landed"
              why={error}
              onRetry={onRetry}
            />
          ) : (
            <Loading
              compact
              what="Checking every period since your first buy"
              why="Looking for the slots a buy should have landed in and did not."
            />
          )}
        </div>
      </Card>
    );
  }

  const { overdue, gaps } = data;
  // What a mark on this card *is*. Every count and every sentence below is in
  // this unit — the whole point of the card is that it judges the drip by its
  // own rhythm rather than by the week it used to assume.
  const unit = cadenceOf(data.cadence);
  const clean = data.missed === 0 && data.failed === 0;
  const gapSats = data.gap_cost.sats;

  return (
    <Card tone="strip" className="flex flex-col">
      <CardHeader
        title="When the drip landed"
        info={
          <>
            <p>
              One mark per {unit.unit} since your first buy, up to a year of them
              &mdash; a mark is whatever your drip&apos;s rhythm makes it, so a monthly
              drip is judged by the month and not by the week. Blue means a buy landed;
              the two rose marks are the times it did not &mdash; the muted one is
              nothing at all, the solid one the bot running and the order failing.
            </p>
            <p className="mt-2">
              Test runs count here, and only here: everywhere else on this dashboard
              a dry run is not bitcoin, but this card asks whether the Pi woke up,
              not whether it spent anything.
            </p>
            <p className="mt-2">
              A missed {unit.unit} is priced at one buy of your current base amount
              at that day&apos;s closing price &mdash; what it would have bought, not
              what it cost you, since the money was never spent.
            </p>
            <p className="mt-2">
              <strong className="font-semibold text-ink">
                A {unit.unit} you paused is not a {unit.unit} that went wrong.
              </strong>{" "}
              Drip writes down every pause you ask for, so those are marked in grey and
              left out of the count entirely &mdash; a fortnight off does not dent the
              percentage, and Drip will not buy it later either. Pauses from before
              this was recorded cannot be recovered, so anything older than your first
              paused one still reads as a gap. Nothing before your first buy is ever
              counted.
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

      {data.periods_checked === 0 ? (
        <p className="py-6 text-center text-sm text-ink-soft">
          No buys yet, so there is nothing to have missed. The record starts with your
          first one.
        </p>
      ) : (
        <>
          <StatRow className="mb-4">
            {/* Of the periods that were *asked* for: a fortnight you paused is
                out of the denominator, not counted against you. */}
            <Stat
              label={`${unit.units} bought`}
              hint={`of the last ${data.periods_judged} · ${data.coverage_pct.toFixed(0)}%${
                data.paused ? ` · ${data.paused} paused` : ""
              }`}
            >
              {data.landed}
            </Stat>
          </StatRow>
          <StatFacts
            className="mb-4"
            items={[
              {
                label: "nothing landed",
                value: clean ? "not one skipped" : `${data.missed}`,
                tone: clean ? "plain" : "down",
              },
              data.failed
                ? {
                    label: "the order failed",
                    value: countPeriods(data.failed, data.cadence),
                    tone: "down",
                  }
                : null,
              data.missed
                ? {
                    label: "they would have bought",
                    value: `${
                      gapSats ? stackAmount(gapSats / SATS_PER_BTC) : "—"
                    } · ${fmtEur(data.gap_cost.eur)}`,
                  }
                : null,
            ]}
          />

          <PeriodStrip data={data} stackAmount={stackAmount} />

          {gaps.length > 0 && (
            <div className="mt-4 flex flex-col gap-1.5">
              {gaps.slice(0, GAPS_LISTED).map((gap) => (
                <div
                  key={gap.period_start}
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
                  and {countPeriods(gaps.length - GAPS_LISTED, data.cadence)} earlier.
                </p>
              )}
            </div>
          )}

          <Note>
            {clean
              ? `Every one of the last ${countPeriods(data.periods_judged, data.cadence)} got its buy.`
              : `One mark per ${unit.unit} — the rose ones are when a buy never landed.`}
            {data.paused > 0 &&
              (data.paused === 1
                ? ` The grey mark is a ${unit.unit} you paused, which counts neither way.`
                : ` The ${data.paused} grey marks are ${unit.units} you paused, which count neither way.`)}
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
function PeriodStrip({
  data,
  stackAmount,
}: {
  data: Pulse;
  stackAmount: (btc: number) => string;
}) {
  const unit = cadenceOf(data.cadence);
  const describe = (week: PulsePeriod) => {
    // Daily needs no "day of" in front of a date, and would read as a stutter.
    const when =
      unit.key === "daily"
        ? formatDayMonthYear(week.start)
        : `${unit.unit[0].toUpperCase()}${unit.unit.slice(1)} of ${formatDayMonthYear(week.start)}`;
    if (week.state === "missed") return `${when} — nothing bought`;
    if (week.state === "failed") return `${when} — the order failed`;
    if (week.state === "paused") return `${when} — paused, no buy was due`;
    return `${when} — ${week.buys} ${week.buys === 1 ? "buy" : "buys"}, ${fmtEur(
      week.eur,
    )}, ${stackAmount(week.sats / SATS_PER_BTC)}`;
  };

  return (
    <>
      <div
        role="img"
        aria-label={`${data.landed} of the last ${countPeriods(data.periods_judged, data.cadence)} got a buy${
          data.paused ? `, ${data.paused} more paused` : ""
        }`}
        className="grid grid-flow-col auto-cols-fr gap-px overflow-hidden rounded-lg bg-sand-soft/60 p-1 sm:gap-0.5"
      >
        {data.periods.map((week) => (
          <span
            key={week.start}
            title={describe(week)}
            className={`h-8 rounded-[2px] sm:h-10 ${MARK[week.state]}`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-2xs text-ink-soft">
        <span>{formatDayMonthYear(data.periods[0].start)}</span>
        <div className="flex items-center gap-3">
          <Key className="bg-water">bought</Key>
          <Key className="bg-rose/45">nothing</Key>
          <Key className="bg-rose">failed</Key>
          {/* Only once there is one to explain: four keys is a wrapped line on
              a phone, and a state nobody has is not worth the room. */}
          {data.paused > 0 && <Key className="bg-ink/30">paused</Key>}
        </div>
        <span>now</span>
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
