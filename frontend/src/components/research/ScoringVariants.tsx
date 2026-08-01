import LockIcon from "~icons/ph/lock-simple";
import type { ScoringVariant, ScoringVariants } from "../../api/client";
import { fmtEur, fmtPp, WEEKDAYS } from "../../lib/format";
import { Card, CardHeader, Note, RangePills } from "../ui";

/**
 * What the bot would have done under a different scoring, put through the same
 * rolling-window test as the real one.
 *
 * The column that matters most is the stake per window. A variant that buys
 * more on average shows a higher median edge in a window that rose, and
 * that is leverage rather than insight — the only way to tell the two apart is
 * to read the edge next to the stake that produced it, so both are here and
 * neither is buried.
 *
 * None of this is switchable and deliberately so: these are proposals with
 * evidence attached, not settings. Changing what the bot actually does means
 * changing `strategy.py`, which changes live buys, the backtest and the CSV
 * importer at once.
 */
export default function ScoringVariants({
  data,
  windowDays,
  onWindowDays,
}: {
  data: ScoringVariants | null;
  windowDays: number;
  onWindowDays: (v: number) => void;
}) {
  return (
    <Card>
      <CardHeader title="What another scoring would have done">
        <RangePills
          options={[
            { label: "6m windows", value: 180 },
            { label: "1y windows", value: 365 },
            { label: "2y windows", value: 730 },
          ]}
          value={windowDays}
          onChange={onWindowDays}
        />
      </CardHeader>

      {!data ? (
        <div className="h-48 animate-pulse rounded-xl bg-sand-soft/70" />
      ) : (
        <>
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-ink-soft">
                  <th className="py-2 pr-3">Scoring</th>
                  <th className="py-2 pr-3 text-right">Won</th>
                  <th className="py-2 pr-3 text-right">Median</th>
                  <th className="py-2 pr-3 text-right">Worst</th>
                  <th className="py-2 pr-3 text-right">Best</th>
                  <th className="py-2 text-right">Stake per window</th>
                </tr>
              </thead>
              <tbody>
                {data.variants.map((variant) => (
                  <VariantRow
                    key={variant.key}
                    variant={variant}
                    dcaInvested={data.dca_invested_eur}
                  />
                ))}
                <tr className="border-t-2 border-sand bg-sand-soft/40">
                  <td className="py-2 pr-3">
                    <div className="font-bold text-ink">Plain DCA</div>
                    <div className="text-xs text-ink-soft">
                      The same base amount every week, no multiplier.
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right text-ink-soft">&mdash;</td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums text-ink">
                    0.00 pp
                  </td>
                  <td className="py-2 pr-3 text-right text-ink-soft">&mdash;</td>
                  <td className="py-2 pr-3 text-right text-ink-soft">&mdash;</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-ink">
                    {fmtEur(data.dca_invested_eur, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4 flex items-start gap-1.5 rounded-xl bg-water-soft/70 px-3 py-2.5 text-xs leading-relaxed text-ink">
            <LockIcon className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
            <span>
              <strong className="font-semibold">
                None of these are switched on, and none of them can be from here.
              </strong>{" "}
              Your bot runs the first row. Changing that means changing the scoring in
              the code, which moves live buys, the backtest and every imported buy at
              the same time.
            </span>
          </p>

          <Note>
            Every variant buys every {WEEKDAYS[data.weekday]} across the same{" "}
            {data.variants[0]?.windows ?? 0} overlapping {windowDays}-day windows, and
            is measured in percentage points of return against plain DCA. Read{" "}
            <strong className="font-semibold text-ink">Median</strong> and{" "}
            <strong className="font-semibold text-ink">Stake per window</strong>{" "}
            together: a
            variant that simply buys more will earn more in a window that rose, and
            that is a bigger bet rather than a better signal. The two that add an
            indicator do exactly that &mdash; note that their worst window is also
            worse than the current scoring&apos;s.
          </Note>
        </>
      )}
    </Card>
  );
}

function VariantRow({
  variant,
  dcaInvested,
}: {
  variant: ScoringVariant;
  dcaInvested: number;
}) {
  const isCurrent = variant.key === "current";
  const extra = variant.invested_eur - dcaInvested;
  return (
    <tr className={`border-t border-sand/70 ${isCurrent ? "bg-water-soft/40" : ""}`}>
      <td className="py-2 pr-3">
        <div className="font-semibold text-ink">
          {variant.label}
          {isCurrent && (
            <span className="ml-2 rounded-full bg-ink-solid px-2 py-0.5 text-2xs font-bold uppercase tracking-wide text-cream">
              running
            </span>
          )}
        </div>
        <div className="text-xs text-ink-soft">{variant.description}</div>
      </td>
      <td className="py-2 pr-3 text-right font-semibold text-ink tabular-nums">
        {variant.win_rate.toFixed(0)}%
      </td>
      <td
        className={`py-2 pr-3 text-right font-semibold tabular-nums ${
          variant.median_pp >= 0 ? "text-teal" : "text-rose"
        }`}
      >
        {fmtPp(variant.median_pp)}
      </td>
      <td className="py-2 pr-3 text-right font-semibold tabular-nums text-rose">
        {fmtPp(variant.worst_pp)}
      </td>
      <td className="py-2 pr-3 text-right font-semibold tabular-nums text-teal">
        {fmtPp(variant.best_pp)}
      </td>
      <td className="py-2 text-right font-semibold text-ink tabular-nums">
        {fmtEur(variant.invested_eur, 0)}
        <div className="text-2xs font-normal text-ink-soft">
          {extra >= 0 ? "+" : ""}
          {fmtEur(extra, 0)} vs DCA
        </div>
      </td>
    </tr>
  );
}
