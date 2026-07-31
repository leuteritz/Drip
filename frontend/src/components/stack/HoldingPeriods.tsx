import WarningIcon from "~icons/ph/warning";
import type { Holdings, RipeningMonth } from "../../api/client";
import { fmtBtc, fmtEur, fmtEurSigned, formatDayMonthYear } from "../../lib/format";
import { Card, CardHeader, Note, Stat } from "../ui";

/**
 * How old each lot is, against the German one-year rule (§23 EStG): bitcoin
 * held longer than a year leaves the private-sale window.
 *
 * Drip only ever buys, so there is nothing to match a sell against and every
 * purchase is simply its own lot — FIFO and every other lot method agree here,
 * and will keep agreeing until a sell exists. Real buys only: a dry run is not
 * bitcoin and cannot ripen, whatever the overview's toggle says.
 *
 * Reports, never advises. It states what is held and how old it is; the euro
 * amounts on future months are at today's price, which is a placeholder for a
 * number nobody has yet.
 */
export default function HoldingPeriods({ data }: { data: Holdings | null }) {
  const free = data?.free;
  const locked = data?.locked;
  const excluded = data?.excluded;
  const nothingHeld = data && free?.lots === 0 && locked?.lots === 0;
  const maxValue = Math.max(
    ...(data?.timeline ?? []).map((m) => m.value_eur),
    0.01,
  );

  return (
    <Card className="flex flex-col">
      <CardHeader title="Holding periods" />

      {!data ? (
        <div className="h-40 animate-pulse rounded-xl bg-sand-soft/70" />
      ) : (
        <>
          {nothingHeld ? (
            <p className="py-6 text-center text-sm text-ink-soft">
              No real buys yet — this counts live orders only, never dry runs.
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                <Stat
                  label="Past the one-year mark"
                  // An empty bucket has a gain of exactly zero, which is not
                  // good news — colour it as the nothing it is.
                  tone={!free?.lots ? "plain" : free.gain_eur >= 0 ? "up" : "down"}
                  hint={
                    free
                      ? `${free.lots} lots · ${fmtBtc(free.btc)} · ${fmtEurSigned(
                          free.gain_eur,
                        )} gain`
                      : undefined
                  }
                >
                  {fmtEur(free?.value_eur ?? 0)}
                </Stat>
                <Stat
                  label="Still inside the year"
                  tone={!locked?.lots ? "plain" : locked.gain_eur >= 0 ? "up" : "down"}
                  hint={
                    locked
                      ? `${locked.lots} lots · ${fmtBtc(locked.btc)} · ${fmtEurSigned(
                          locked.gain_eur,
                        )} gain`
                      : undefined
                  }
                >
                  {fmtEur(locked?.value_eur ?? 0)}
                </Stat>
                <Stat
                  label="Next lot passes it"
                  hint={
                    data.next_free_date
                      ? `in ${data.next_free_in_days} days`
                      : "everything is past it"
                  }
                >
                  {data.next_free_date
                    ? formatDayMonthYear(data.next_free_date)
                    : "—"}
                </Stat>
              </div>

              {data.timeline.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {data.timeline.map((month) => (
                    <MonthRow key={month.month} month={month} maxValue={maxValue} />
                  ))}
                </div>
              )}
            </>
          )}

          {excluded && excluded.count > 0 && (
            <p className="mt-4 flex items-start gap-1.5 rounded-xl bg-rose-soft/60 px-3 py-2.5 text-xs leading-relaxed text-ink">
              <WarningIcon className="mt-0.5 shrink-0 text-rose" aria-hidden="true" />
              <span>
                <strong className="font-semibold">
                  {excluded.count} buys are not counted anywhere on this dashboard.
                </strong>{" "}
                They are recorded as failed orders &mdash; {fmtEur(excluded.eur)} and{" "}
                {fmtBtc(excluded.btc)} between them &mdash; so every figure here and
                in the overview leaves them out. If those orders did go through at the
                exchange, your real stack is larger than anything shown. Worth
                checking against your Coinbase history.
              </span>
            </p>
          )}

          <Note>
            One row per month in which a lot passes its first birthday, valued at
            today&apos;s price because no other price exists yet. This is a holding
            report, not a tax calculation and not tax advice: it does not know about
            the annual exemption limit, any other disposals you may have, or the rules
            that apply to your situation.
          </Note>
        </>
      )}
    </Card>
  );
}

function MonthRow({ month, maxValue }: { month: RipeningMonth; maxValue: number }) {
  const label = new Date(`${month.month}-01`).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
  return (
    <div className="grid grid-cols-[5rem_1fr_6rem] items-center gap-3">
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      <div className="relative h-6 rounded-lg bg-sand-soft/70">
        <span
          className="absolute inset-y-1 left-0 rounded-md"
          style={{
            width: `${Math.max((month.value_eur / maxValue) * 100, 1)}%`,
            background: "var(--color-water)",
          }}
        />
      </div>
      <div className="text-right">
        <div className="font-display text-sm font-semibold text-ink">
          {fmtEur(month.value_eur)}
        </div>
        <div className="text-[11px] text-ink-soft">
          {month.lots} {month.lots === 1 ? "lot" : "lots"}
        </div>
      </div>
    </div>
  );
}
