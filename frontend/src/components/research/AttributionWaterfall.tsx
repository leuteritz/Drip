import type { Attribution } from "../../api/client";
import { fmtEur, fmtEurSigned, fmtPp, WEEKDAYS } from "../../lib/format";
import { Card, CardHeader, Loading, Note, RangePills, Stat, toneText } from "../ui";

/**
 * Where the edge over plain DCA comes from, as a waterfall.
 *
 * Measured in percentage points of return, not euros, and that is the whole
 * point of the card. Drip and plain DCA do not deploy the same capital — the
 * multiplier is what makes them differ — so their euro profits are not
 * comparable without also comparing the stake behind them. Return per euro
 * invested is, and on that scale a constant multiplier scores exactly zero,
 * which is what lets the three indicator bars start at zero and add up to the
 * total. The euro figures ride along underneath, where they cannot mislead.
 */
export default function AttributionWaterfall({
  data,
  days,
  onDays,
}: {
  data: Attribution | null;
  days: number;
  onDays: (v: number) => void;
}) {
  // Only the percentage-point shares are plotted. The euro shares the API also
  // returns are a decomposition of a *different* total — the euro edge starts
  // from a non-zero floor, because a neutral score is a 0.75x buy — so putting
  // them on these rows would show three numbers that visibly fail to add up to
  // the euro figure in the header. The euro story stays in the header, whole.
  const steps: { label: string; from: number; to: number; pp: number }[] = [];
  let running = 0;
  for (const share of data?.contributions ?? []) {
    const from = running;
    running += share.pp;
    steps.push({ label: share.label, from, to: running, pp: share.pp });
  }

  const total = data?.total_pp ?? 0;
  const bounds = [0, total, ...steps.map((s) => s.to)];
  const lowest = Math.min(...bounds);
  const highest = Math.max(...bounds);
  const pad = (highest - lowest) * 0.1 || 1;
  const span = highest - lowest + pad * 2;
  const pos = (v: number) => ((v - (lowest - pad)) / span) * 100;

  const extraCapital = data ? data.bot.invested_eur - data.dca.invested_eur : 0;

  return (
    <Card>
      <CardHeader
        title="Where the edge comes from"
        info={
          <>
            <p>
              Each bar is one indicator&apos;s share of the head start Drip has over
              plain DCA, split so the three add up to the total exactly. Fear and a
              low RSI tend to show up on the same day, so simply removing one at a
              time would not add up.
            </p>
            <p className="mt-2">
              The scale is{" "}
              <strong className="font-semibold text-ink">
                percentage points of return
              </strong>{" "}
              (pp) &mdash; profit per euro put in, rather than profit in euros. That
              is the only fair scale here: the multiplier deliberately puts a
              different amount of money to work, {fmtEur(Math.abs(extraCapital))}{" "}
              {extraCapital >= 0 ? "more" : "less"} than plain DCA over this window,
              so the euro figure can lean the other way in a falling market without
              the multiplier having done anything wrong.
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
        <Skeleton rows={4} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Stat
              label="vs. plain DCA, per euro"
              tone={total >= 0 ? "up" : "down"}
              hint={`over ${data.purchase_count} test buys, every ${
                WEEKDAYS[data.weekday]
              }`}
            >
              {fmtPp(total)}
            </Stat>
            <Stat
              label="vs. plain DCA, in euros"
              tone={data.total_eur >= 0 ? "up" : "down"}
              hint={`with ${fmtEur(Math.abs(extraCapital))} ${
                extraCapital >= 0 ? "more" : "less"
              } money put in`}
            >
              {fmtEurSigned(data.total_eur)}
            </Stat>
            <Stat label="Tested over" hint={`${data.start_date} → ${data.end_date}`}>
              {Math.round(data.days / 365) > 1
                ? `${Math.round(data.days / 365)} years`
                : "1 year"}
            </Stat>
          </div>

          <div className="flex flex-col gap-1.5">
            {steps.map((step) => (
              <Row
                key={step.label}
                label={step.label}
                from={step.from}
                to={step.to}
                pp={step.pp}
                pos={pos}
              />
            ))}
            <div className="mt-1 border-t-2 border-dashed border-sand pt-2">
              <Row label="Drip total" from={0} to={total} pp={total} pos={pos} emphasis />
            </div>
          </div>

          <Note>
            Each bar is what one indicator added to Drip&apos;s head start over plain
            DCA. Together they make the total.
          </Note>
        </>
      )}
    </Card>
  );
}

function Row({
  label,
  from,
  to,
  pp,
  pos,
  emphasis = false,
}: {
  label: string;
  from: number;
  to: number;
  pp: number;
  pos: (v: number) => number;
  emphasis?: boolean;
}) {
  const left = pos(Math.min(from, to));
  const width = Math.max(pos(Math.max(from, to)) - left, 0.5);
  const up = pp >= 0;
  return (
    <div className="grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-3 sm:grid-cols-[8rem_1fr_6.5rem]">
      <span
        className={`truncate text-sm ${
          emphasis ? "font-bold text-ink" : "font-medium text-ink-soft"
        }`}
      >
        {label}
      </span>
      <div className="relative h-7 rounded-lg bg-sand-soft/70">
        <span
          className="absolute inset-y-0 w-px bg-sand"
          style={{ left: `${pos(0)}%` }}
          aria-hidden="true"
        />
        <span
          className="absolute inset-y-1 rounded-md transition-all"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            background: emphasis
              ? "var(--color-ink)"
              : up
                ? "var(--color-teal)"
                : "var(--color-rose)",
          }}
        />
      </div>
      <div
        className={`text-right text-sm font-semibold tabular-nums ${
          emphasis ? "text-ink" : toneText(up ? "up" : "down")
        }`}
      >
        {fmtPp(pp)}
      </div>
    </div>
  );
}

/** The bars' space, held open and saying what is being worked out in it. */
function Skeleton({ rows }: { rows: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl bg-sand-soft/40"
      style={{ height: `${rows * 2.25}rem` }}
    >
      <Loading compact what="Splitting the edge between the three signals" />
    </div>
  );
}
