import TrendDownIcon from "~icons/ph/trend-down";
import TrendUpIcon from "~icons/ph/trend-up";
import type { Performance } from "../../api/client";
import { fmtBtc, fmtEur, fmtPct } from "../../lib/format";

/** The centered headline: portfolio value with the P&L on a single line. */
export default function Reservoir({
  performance,
}: {
  performance: Performance | null;
}) {
  const profitable = (performance?.profit_eur ?? 0) >= 0;
  // The cents are dimmed, so the value is split at its decimal separator.
  const value = performance ? fmtEur(performance.value_eur) : "";
  const dot = value.lastIndexOf(".");
  const valueMain = dot >= 0 ? value.slice(0, dot) : value;
  const valueCents = dot >= 0 ? value.slice(dot) : "";

  return (
    <div className="mt-[72px] text-center">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-cream/80">
        Your reservoir
      </div>
      {performance ? (
        <>
          <div className="mt-1.5 font-display text-6xl font-semibold leading-[0.9] tracking-tight text-cream drop-shadow-[0_2px_18px_rgba(0,0,0,0.28)] md:text-[78px]">
            {valueMain}
            <span className="text-cream/70">{valueCents}</span>
          </div>
          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 text-[15px] font-bold [text-shadow:0_1px_8px_rgba(0,0,0,0.25)] md:text-[17px]">
            <span
              className={`inline-flex items-center gap-1.5 ${profitable ? "text-cream" : "text-rose-soft"}`}
            >
              {profitable ? <TrendUpIcon /> : <TrendDownIcon />}
              {profitable ? "+" : ""}
              {fmtEur(performance.profit_eur)}
            </span>
            <span className="text-cream/40">&middot;</span>
            <span className="font-semibold text-cream/80">
              {fmtPct(performance.profit_pct)}
            </span>
            <span className="text-cream/40 max-sm:hidden">&middot;</span>
            <span className="text-[13px] font-medium text-cream/70 max-sm:w-full">
              {fmtEur(performance.invested_eur)} invested &middot;{" "}
              {performance.purchase_count} buys &middot;{" "}
              {fmtBtc(performance.btc_total)}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="mx-auto mt-3 h-16 w-64 animate-pulse rounded-xl bg-cream/20" />
          <div className="mx-auto mt-4 h-5 w-80 max-w-full animate-pulse rounded-lg bg-cream/15" />
        </>
      )}
    </div>
  );
}
