import WarningIcon from "~icons/ph/warning";
import type { StrategyGrid } from "../../api/client";
import { fmtPp, WEEKDAYS } from "../../lib/format";
import { tintFor } from "../../lib/chart";
import { Card, CardHeader, Failed, Loading, Note, RangePills } from "../ui";

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
  error,
  onRetry,
}: {
  data: StrategyGrid | null;
  /** This card's own failure, so a dead endpoint cannot leave it spinning. */
  error?: string | null;
  onRetry?: () => void;
  days: number;
  onDays: (v: number) => void;
}) {
  const maxAbs = Math.max(...(data?.cells ?? []).map((c) => Math.abs(c.edge_pp)), 0.01);
  const cellAt = (weekday: number, spread: number) =>
    data?.cells.find((c) => c.weekday === weekday && c.spread === spread);

  // Each column named by where it sits next to the one you run, so no two
  // columns share a caption however many steps the backend offers.
  const current = data?.current_spread ?? 1;
  const bolder = (data?.spreads ?? [])
    .map((s) => s.value)
    .filter((v) => v > current)
    .sort((a, b) => a - b);
  const gentler = (data?.spreads ?? [])
    .map((s) => s.value)
    .filter((v) => v > 0 && v < current)
    .sort((a, b) => b - a);
  const columnLabel = (value: number): string => {
    if (value === 0) return "plain DCA";
    if (value === current) return "what you run";
    if (value > current) return bolder.indexOf(value) === 0 ? "bolder" : "boldest";
    return gentler.indexOf(value) === 0 ? "gentler" : "gentlest";
  };

  return (
    <Card>
      <CardHeader
        title="Buying day against buying size"
        info={
          <>
            <p>
              Each cell is a full backtest: buy every week on that weekday, with the
              multiplier&apos;s swings widened or narrowed by the amount in the column
              heading. The outlined cell is the combination you are running.
            </p>
            <p className="mt-2">
              The <strong className="font-semibold text-ink">plain DCA</strong> column
              flattens every multiplier to a constant 1.0&times;, so it must read
              0.0 pp everywhere. It is the control that shows the rest of the grid is
              measured from the right zero.
            </p>
            <p className="mt-2">
              The swings are widened by multiplying, never by adding, so no cell can
              ever produce a 0&times; buy &mdash; Drip always buys.
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
        <div className="flex h-64 items-center justify-center rounded-xl bg-sand-soft/40">
          {error ? (
            <Failed compact what="Could not test the weekdays" why={error} onRetry={onRetry} />
          ) : (
            <Loading compact what="Testing every weekday of the window" />
          )}
        </div>
      ) : (
        <>
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[36rem] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-24" />
                  {data.spreads.map((spread) => (
                    <th
                      key={spread.value}
                      className="px-1 pb-1 text-center text-xs font-bold text-ink-soft"
                    >
                      <div className="tabular-nums text-ink">
                        {spread.min_multiplier === spread.max_multiplier
                          ? `${spread.min_multiplier.toFixed(1)}×`
                          : `${spread.min_multiplier}–${spread.max_multiplier}×`}
                      </div>
                      <div className="font-normal">{columnLabel(spread.value)}</div>
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
                            className={`rounded-lg px-2 py-2.5 text-center text-sm font-semibold tabular-nums ${
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
              Nothing makes bitcoin cheaper on a Thursday: which day won over{" "}
              {Math.round(data.days / 365)} year{data.days >= 730 ? "s" : ""} is close
              to chance, and a different stretch of history would crown a different
              cell.
            </span>
          </p>

          <Note>
            Every cell is a backtest of one weekday and one buying size. The outlined
            one is what you run.
          </Note>
        </>
      )}
    </Card>
  );
}
