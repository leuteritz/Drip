import WarningIcon from "~icons/ph/warning";
import type { StrategyGrid } from "../../api/client";
import { fmtPp, WEEKDAYS } from "../../lib/format";
import { Card, CardHeader, Note, RangePills } from "../ui";

/**
 * Buy weekday against multiplier spread, as a heatmap.
 *
 * The spread column is an exponent on every multiplier (`m ** k`), not a new
 * ladder: k=0 flattens everything to 1.0 and is therefore plain DCA — the
 * column that must read exactly 0.00 pp, and the proof that the rest of the
 * grid is measured from the right zero. Geometric scaling is deliberate; a
 * linear one would eventually produce a 0x buy, and Drip always buys.
 *
 * This card is the most dangerous one in the section, so it wears its warning
 * rather than hiding it in a footnote: the best cell is the one that fit the
 * past, and picking it is how a strategy gets overfitted.
 */
export default function WeekdayGrid({
  data,
  days,
  onDays,
}: {
  data: StrategyGrid | null;
  days: number;
  onDays: (v: number) => void;
}) {
  const maxAbs = Math.max(...(data?.cells ?? []).map((c) => Math.abs(c.edge_pp)), 0.01);
  const cellAt = (weekday: number, spread: number) =>
    data?.cells.find((c) => c.weekday === weekday && c.spread === spread);

  return (
    <Card>
      <CardHeader title="Weekday against spread">
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
            <table className="w-full min-w-[560px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-24" />
                  {data.spreads.map((spread) => (
                    <th
                      key={spread.value}
                      className="px-1 pb-1 text-center text-xs font-bold text-ink-soft"
                    >
                      <div className="font-display text-ink">
                        {spread.min_multiplier === spread.max_multiplier
                          ? `${spread.min_multiplier.toFixed(1)}×`
                          : `${spread.min_multiplier}–${spread.max_multiplier}×`}
                      </div>
                      <div className="font-normal">
                        {spread.value === 0
                          ? "plain DCA"
                          : spread.value === data.current_spread
                            ? "current"
                            : `×${spread.value} spread`}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS.map((name, weekday) => (
                  <tr key={name}>
                    <th className="pr-2 text-right text-xs font-bold text-ink-soft">
                      {name.slice(0, 3)}
                    </th>
                    {data.spreads.map((spread) => {
                      const cell = cellAt(weekday, spread.value);
                      const current =
                        weekday === data.current_weekday &&
                        spread.value === data.current_spread;
                      return (
                        <td key={spread.value} className="p-0">
                          <div
                            title={
                              cell
                                ? `${name}, ${spread.min_multiplier}–${spread.max_multiplier}× · ${cell.purchase_count} buys`
                                : undefined
                            }
                            className={`rounded-lg px-2 py-2.5 text-center font-display text-sm font-semibold tabular-nums ${
                              current ? "outline-2 outline-offset-1 outline-ink" : ""
                            }`}
                            style={tintFor(cell?.edge_pp ?? 0, maxAbs)}
                          >
                            {cell ? fmtPp(cell.edge_pp, 1) : "—"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 flex items-start gap-1.5 rounded-xl bg-rose-soft/60 px-3 py-2.5 text-xs leading-relaxed text-ink">
            <WarningIcon className="mt-0.5 shrink-0 text-rose" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Do not tune your bot from this
              grid.</strong>{" "}
              Which weekday won over {Math.round(data.days / 365)} year
              {data.days >= 730 ? "s" : ""} is close to noise &mdash; there is no
              mechanism that makes bitcoin cheaper on a Thursday &mdash; and a wider
              spread scoring higher here mostly means the window happened to reward
              conviction. Both would flip on a different stretch of history. The
              outlined cell is what you are running.
            </span>
          </p>

          <Note>
            Each cell is a full backtest: buy every week on that weekday, with every
            multiplier raised to that power. The{" "}
            <strong className="font-semibold text-ink">plain DCA</strong> column
            flattens the ladder to a constant 1.0&times;, so it must read 0.0 pp
            everywhere &mdash; it is the control that shows the rest is measured from
            the right zero.
          </Note>
        </>
      )}
    </Card>
  );
}

/**
 * A cell tint from the fixed palette: teal for good, rose for bad, mixed into
 * the paper surface by magnitude. `color-mix` on the CSS custom properties
 * keeps the `@theme` block the single source of truth — no hex reaches here.
 *
 * The mix tops out well short of the full hue on purpose. Both teal and rose
 * land mid-tone, where neither ink nor paper text has much contrast left, so
 * the scale stays light enough for ink to stay readable in every cell rather
 * than flipping to paper at the dark end and being worse at both.
 */
function tintFor(value: number, maxAbs: number) {
  const share = maxAbs > 0 ? Math.min(Math.abs(value) / maxAbs, 1) : 0;
  const strength = Math.round(8 + share * 52);
  const hue = value >= 0 ? "var(--color-teal)" : "var(--color-rose)";
  return {
    background: `color-mix(in srgb, ${hue} ${strength}%, var(--color-paper))`,
    color: "var(--color-ink)",
  };
}
