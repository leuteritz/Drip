import type { CandidateSignals, SignalScreenRow } from "../../api/client";
import { tintFor } from "../../lib/chart";
import { Card, CardHeader, Note, RangePills } from "../ui";

/**
 * Every signal, the three that are live and three that are not, put through
 * one identical test: sort the days by that signal, cut them into fifths, and
 * report what the price did over the next 90 days in each fifth.
 *
 * All six read "lower is cheaper", which is what makes one shared table
 * meaningful across them — so the cheap fifth beating the expensive fifth is
 * the claim, and `spread` is the size of it. Cells are shaded against the
 * all-days baseline rather than against zero, because bitcoin drifts up on its
 * own and beating zero is not the test.
 *
 * Nothing here is wired into the bot. It exists so a candidate has to earn its
 * place with the same evidence the incumbents are being held to — including
 * the cycle position, which is in the table specifically so it can be seen
 * failing.
 */
export default function SignalScreen({
  data,
  days,
  onDays,
}: {
  data: CandidateSignals | null;
  days: number;
  onDays: (v: number) => void;
}) {
  const baseline = data?.baseline_median_pct ?? 0;
  const maxAbs = Math.max(
    ...(data?.signals ?? []).flatMap((s) =>
      s.quintiles.map((q) => Math.abs(q.median_pct - baseline)),
    ),
    1,
  );

  return (
    <Card>
      <CardHeader title="Signals in and out of the score">
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
        <div className="h-64 animate-pulse rounded-xl bg-sand-soft/70" />
      ) : (
        <>
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[620px] border-separate border-spacing-x-1 border-spacing-y-1">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                  <th className="pb-1 text-left">Signal</th>
                  <th className="pb-1 pr-2 text-right">Now</th>
                  <th className="pb-1 text-center font-normal normal-case" colSpan={5}>
                    median price change over the next {data.horizon} days, by fifth
                    &mdash; cheapest on the left
                  </th>
                  <th className="pb-1 pl-2 text-right">Spread</th>
                </tr>
              </thead>
              <tbody>
                {data.signals.map((signal) => (
                  <Row
                    key={signal.key}
                    signal={signal}
                    baseline={baseline}
                    maxAbs={maxAbs}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-ink-soft">
            Baseline over all {data.sample_size} days:{" "}
            <strong className="font-semibold text-ink">
              {baseline >= 0 ? "+" : ""}
              {baseline.toFixed(1)}%
            </strong>{" "}
            &mdash; shading is relative to that, not to zero.
          </p>

          <Note>
            A signal that reads the market has a positive spread: its cheap fifth is
            followed by better returns than its expensive fifth. A negative one means
            the opposite happened &mdash; what looked cheap kept getting cheaper. Read
            this against the window it covers rather than as a law: over a stretch in
            which bitcoin fell a long way, every mean-reversion signal is going to look
            like this, and the same table over a rising stretch would flatter them all.
            The cycle position is in here as a control: it is a calendar with three
            completed observations behind it, so whatever it shows is not evidence.
          </Note>
        </>
      )}
    </Card>
  );
}

function Row({
  signal,
  baseline,
  maxAbs,
}: {
  signal: SignalScreenRow;
  baseline: number;
  maxAbs: number;
}) {
  return (
    <tr>
      <td className="py-1 pr-2">
        <div className="text-sm font-semibold text-ink">{signal.label}</div>
        <div className="text-[11px] text-ink-soft">
          {signal.in_score ? "in the score" : "candidate"}
        </div>
      </td>
      <td className="pr-2 text-right text-sm font-semibold text-ink tabular-nums">
        {signal.current.toFixed(2)}
        <div className="text-[11px] font-normal text-ink-soft">
          fifth {signal.current_quintile}
        </div>
      </td>
      {signal.quintiles.map((quintile) => (
        <td key={quintile.quintile} className="p-0">
          <div
            title={`${quintile.from_value.toFixed(2)} to ${quintile.to_value.toFixed(
              2,
            )} · n=${quintile.n}`}
            className={`rounded-lg px-1.5 py-2 text-center text-sm font-semibold tabular-nums ${
              quintile.quintile === signal.current_quintile
                ? "outline-2 outline-offset-1 outline-ink"
                : ""
            }`}
            style={tintFor(quintile.median_pct - baseline, maxAbs)}
          >
            {quintile.median_pct >= 0 ? "+" : ""}
            {quintile.median_pct.toFixed(1)}%
          </div>
        </td>
      ))}
      <td className="pl-2 text-right text-sm font-semibold tabular-nums">
        <span className={signal.spread_pct >= 0 ? "text-teal" : "text-rose"}>
          {signal.spread_pct >= 0 ? "+" : ""}
          {signal.spread_pct.toFixed(1)}
        </span>
      </td>
    </tr>
  );
}
