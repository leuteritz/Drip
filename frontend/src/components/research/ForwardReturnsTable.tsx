import type { ForwardReturns, ForwardStats } from "../../api/client";
import { Card, CardHeader, Note, RangePills, toneText } from "../ui";

/**
 * Does a high score actually mark a cheap entry?
 *
 * For every day in the window the score is computed and the price change over
 * the next 30/90/180 days recorded, then bucketed by the multiplier that score
 * would have triggered. The baseline row is the same measurement over every
 * day regardless of score — without it a bucket's number means nothing, since
 * bitcoin drifts upward on its own.
 *
 * Scored on all days, not just buy days: whether the score reads the market is
 * a question about the score, not about the schedule.
 */
export default function ForwardReturnsTable({
  data,
  days,
  onDays,
}: {
  data: ForwardReturns | null;
  days: number;
  onDays: (v: number) => void;
}) {
  const horizons = data?.horizons ?? [30, 90, 180];
  const cells = data
    ? [
        ...data.buckets.flatMap((b) => horizons.map((h) => b.by_horizon[String(h)])),
        ...horizons.map((h) => data.baseline[String(h)]),
      ]
    : [];
  const maxAbs = Math.max(...cells.map((c) => Math.abs(c?.median_pct ?? 0)), 1);

  return (
    <Card>
      <CardHeader title="Does the score see anything?">
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
        <div className="h-48 animate-pulse rounded-xl bg-sand-soft/70" />
      ) : (
        <>
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-ink-soft">
                  <th className="py-2 pr-3 font-bold">Signal</th>
                  <th className="py-2 pr-3 font-bold">Score</th>
                  {horizons.map((h) => (
                    <th key={h} className="py-2 pr-3 text-right font-bold">
                      after {h}d
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.buckets.map((bucket) => (
                  <tr key={bucket.multiplier} className="border-t border-sand/70">
                    <td className="py-2 pr-3">
                      <span className="font-display font-semibold text-ink">
                        {bucket.multiplier}&times;
                      </span>
                      <span className="ml-2 text-xs text-ink-soft">
                        {bucket.signal}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-ink-soft">
                      {bucket.score_min === bucket.score_max
                        ? bucket.score_min
                        : `${bucket.score_min} to ${bucket.score_max}`}
                    </td>
                    {horizons.map((h) => (
                      <ReturnCell
                        key={h}
                        stats={bucket.by_horizon[String(h)]}
                        maxAbs={maxAbs}
                      />
                    ))}
                  </tr>
                ))}
                <tr className="border-t-2 border-sand bg-sand-soft/40">
                  <td className="py-2 pr-3 font-bold text-ink">Any day</td>
                  <td className="py-2 pr-3 text-xs text-ink-soft">baseline</td>
                  {horizons.map((h) => (
                    <ReturnCell
                      key={h}
                      stats={data.baseline[String(h)]}
                      maxAbs={maxAbs}
                    />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <Note>
            Median price change after each score, over {data.sample_size} scored days.
            A bucket only means something against the{" "}
            <strong className="font-semibold text-ink">Any day</strong> row: bitcoin
            drifts up on its own, so beating zero is not the test &mdash; beating the
            baseline is. Note what this measures and what it does not: buying more
            when the market looks cheap is not the same as calling a bottom, and a
            strong-buy bucket that trails the baseline over 90 days simply means the
            dip kept going. The windows overlap heavily, so treat the counts as far
            fewer independent observations than they look.
          </Note>
        </>
      )}
    </Card>
  );
}

function ReturnCell({ stats, maxAbs }: { stats?: ForwardStats; maxAbs: number }) {
  if (!stats || stats.n === 0) {
    return <td className="py-2 pr-3 text-right text-xs text-ink-soft">&mdash;</td>;
  }
  const up = stats.median_pct >= 0;
  const share = Math.min(Math.abs(stats.median_pct) / maxAbs, 1) * 100;
  return (
    <td className="py-2 pr-3 text-right align-middle">
      <div className={`font-display font-semibold ${toneText(up ? "up" : "down")}`}>
        {up ? "+" : ""}
        {stats.median_pct.toFixed(1)}%
      </div>
      <div className="ml-auto mt-1 h-1 w-16 overflow-hidden rounded-full bg-sand-soft">
        <div
          className="h-full rounded-full"
          style={{
            width: `${share}%`,
            marginLeft: up ? undefined : "auto",
            background: up ? "var(--color-teal)" : "var(--color-rose)",
          }}
        />
      </div>
      <div className="mt-0.5 text-[11px] text-ink-soft">
        n={stats.n} · {stats.win_rate.toFixed(0)}% up
      </div>
    </td>
  );
}
