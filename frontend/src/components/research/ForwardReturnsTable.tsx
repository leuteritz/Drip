import type { ForwardReturns, ForwardStats } from "../../api/client";
import { Card, CardHeader, Loading, Note, RangePills, toneText } from "../ui";

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
      <CardHeader
        title="Does the score see anything?"
        info={
          <>
            <p>
              Every day in the window is scored, and the price change over the next
              30, 90 and 180 days written down next to it. The rows group those days
              by the size of buy the score would have triggered, and each cell is the
              middle result of its group.
            </p>
            <p className="mt-2">
              The{" "}
              <strong className="font-semibold text-ink">Any day</strong> row is the
              same measurement over every day regardless of score. Without it a number
              here would mean nothing: bitcoin drifts up on its own, so beating zero
              is not the test &mdash; beating that row is.
            </p>
            <p className="mt-2">
              What it does not prove: buying more when the market looks cheap is not
              the same as calling the bottom. A strong-buy row that trails the
              baseline over 90 days simply means the dip kept going. The periods
              measured overlap heavily, so treat the counts as far fewer independent
              observations than they look.
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
        <div className="flex h-48 items-center justify-center rounded-xl bg-sand-soft/40">
          <Loading compact counter={false} what="Measuring what came after each score" />
        </div>
      ) : (
        <>
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
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
                      <span className="font-semibold tabular-nums text-ink">
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
            What the price did after each signal, over {data.sample_size} days. The
            test is beating the{" "}
            <strong className="font-semibold text-ink">Any day</strong> row, not
            beating zero.
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
      <div className={`font-semibold tabular-nums ${toneText(up ? "up" : "down")}`}>
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
      <div className="mt-0.5 text-2xs text-ink-soft">
        n={stats.n} · {stats.win_rate.toFixed(0)}% up
      </div>
    </td>
  );
}
