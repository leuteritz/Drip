import { useEffect, useState } from "react";
import WarningIcon from "~icons/ph/warning";
import { api, type Purchase, type Receipt } from "../../api/client";
import {
  fmtEur,
  fmtEurSigned,
  fmtPct,
  formatDayMonthYear,
  formatTimestamp,
} from "../../lib/format";
import { originName } from "../../lib/origin";
import { useStackAmount } from "../../lib/units";
import { ScoreTable } from "../scoring";
import { Badge, Loading, Modal, Note, Stat, toneText } from "../ui";

/**
 * One buy, and what became of it.
 *
 * Every other figure on this dashboard is an average over the buys, which is
 * the right way to read a savings bot and leaves the single row unreadable: the
 * history says what a buy cost and never what came of it, and the three
 * readings in that row never say how they became the multiplier beside them.
 * This is the answer to both, for the row you tapped.
 *
 * It is deliberately not a second history card. Four questions in order — what
 * it is, what it turned into, what the multiplier had to do with that, and why
 * it was that size — and then two footnotes: where the price sits among the
 * other buys, and when it turns a year old.
 *
 * Nothing here is computed in the browser. `backend/app/receipt.py` owns the
 * arithmetic, so the multiplier's share and the one-year rule cannot drift from
 * `analytics` and `holdings`.
 */
export default function BuyReceipt({
  purchase,
  onClose,
}: {
  purchase: Purchase;
  onClose: () => void;
}) {
  const stackAmount = useStackAmount();
  const [data, setData] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    api
      .getReceipt(purchase.id)
      .then((r) => live && setData(r))
      .catch((e) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [purchase.id]);

  return (
    <Modal onClose={onClose} closeOnBackdrop className="w-full max-w-lg">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold leading-tight text-ink">
            {formatTimestamp(purchase.timestamp)}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{originName(purchase.origin)}</p>
        </div>
        {data &&
          (data.failed ? (
            <Badge tone="rose">Error</Badge>
          ) : data.dry_run ? (
            <Badge tone="neutral">Dry run</Badge>
          ) : (
            <Badge tone="teal">Bought</Badge>
          ))}
      </div>

      {error ? (
        <p className="mt-5 rounded-xl bg-rose-soft/60 px-4 py-3 text-sm font-bold text-rose">
          {error}
        </p>
      ) : !data ? (
        <div className="flex h-56 items-center justify-center">
          <Loading
            compact
            what="Working out what became of this buy"
            why="Pricing it against today, and against every other buy you have made."
          />
        </div>
      ) : (
        <>
          <Outcome data={data} stackAmount={stackAmount} />
          <Multiplier data={data} stackAmount={stackAmount} />

          <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
            Why it was that size
          </h3>
          <ScoreTable
            readings={{ ...data.scoring, price_eur: data.price_eur }}
            score={data.scoring.score}
            scoreMax={data.scoring.score_max}
            multiplier={data.scoring.multiplier}
            footer={`${data.scoring.signal} — bought at ×${data.scoring.multiplier}`}
          />
          {data.scoring.points_total !== data.scoring.score && (
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-ink-soft">
              <WarningIcon className="mt-0.5 shrink-0 text-rose" aria-hidden="true" />
              <span>
                These readings score {data.scoring.points_total} today, but{" "}
                {data.scoring.score} was recorded at the time. Either the buy was
                imported with somebody else&apos;s score, or a threshold has changed
                since. The row keeps what it recorded.
              </span>
            </p>
          )}

          <Footnotes data={data} />
        </>
      )}
    </Modal>
  );
}

/** What the euros turned into — or, on a test run, what they would have. */
function Outcome({
  data,
  stackAmount,
}: {
  data: Receipt;
  stackAmount: (btc: number) => string;
}) {
  if (data.failed) {
    return (
      <p className="mt-5 flex items-start gap-1.5 rounded-xl bg-rose-soft/60 px-4 py-3 text-sm leading-relaxed text-ink">
        <WarningIcon className="mt-0.5 shrink-0 text-rose" aria-hidden="true" />
        <span>
          The exchange refused this order, so nothing was bought and nothing on this
          dashboard counts it. It is kept because a week Drip tried and failed is a
          different thing from a week it slept through.
        </span>
      </p>
    );
  }

  const up = data.outcome.gain_eur >= 0;
  return (
    <div className="mt-5 rounded-xl bg-sand-soft/60 px-5 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-soft">
        {data.dry_run ? "What it would be worth today" : "Worth today"}
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-4xl font-semibold leading-none text-ink">
          {fmtEur(data.outcome.value_eur)}
        </span>
        <span className={`font-display text-lg font-semibold ${toneText(up ? "up" : "down")}`}>
          {fmtEurSigned(data.outcome.gain_eur)} ({fmtPct(data.outcome.gain_pct)})
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        {fmtEur(data.amount_eur)} bought{" "}
        <span className="font-semibold text-ink">{stackAmount(data.btc_amount)}</span> at{" "}
        {fmtEur(data.price_eur, 0)}
        {data.filled && data.fee_eur > 0 && <>, {fmtEur(data.fee_eur)} of it the fee</>}.
        {data.dry_run && (
          <>
            {" "}
            This was a test run — no order was placed and none of it is in your stack.
          </>
        )}
      </p>
    </div>
  );
}

/**
 * What the score had to do with any of it.
 *
 * The one figure on this dialog that no other card can show: at 1.25x a quarter
 * of the euros went in *because the market looked cheap*, and this says what
 * that decision has been worth since. Below 1.0x it reads the other way — the
 * score kept money out of a rise, and that is a cost.
 *
 * A 1.0x buy is skipped entirely rather than shown as a row of zeroes: the
 * score changed nothing there, which is not a finding.
 */
function Multiplier({
  data,
  stackAmount,
}: {
  data: Receipt;
  stackAmount: (btc: number) => string;
}) {
  const { multiplier } = data.scoring;
  if (data.failed || multiplier === 1) return null;

  const more = multiplier > 1;
  const { extra_eur, extra_btc, multiplier_eur, base_eur, current_price } = data.outcome;
  const worked = multiplier_eur >= 0;
  const swung = Math.abs(extra_btc) * current_price;

  return (
    <p className="mt-3 rounded-xl border border-sand px-5 py-4 text-sm leading-relaxed text-ink-soft">
      <span className="font-semibold text-ink">
        &times;{multiplier} {more ? "put" : "held"} {fmtEur(Math.abs(extra_eur))}{" "}
        {more ? "in on top of" : "back from"}
      </span>{" "}
      the {fmtEur(base_eur)} base.{" "}
      {more ? (
        <>That extra {stackAmount(Math.abs(extra_btc))} is worth {fmtEur(swung)} today</>
      ) : (
        <>
          The {stackAmount(Math.abs(extra_btc))} it did not buy would be worth{" "}
          {fmtEur(swung)} today
        </>
      )}{" "}
      — so {more ? "buying more" : "holding back"} is{" "}
      <span className={`font-semibold ${toneText(worked ? "up" : "down")}`}>
        {fmtEur(Math.abs(multiplier_eur))} {worked ? "ahead" : "behind"}
      </span>
      .
    </p>
  );
}

/**
 * Whether the price was any good, and when the lot turns a year old. Both are
 * about real bitcoin, so both are absent on anything else.
 *
 * The price is held against the market's own average over the days either side
 * of the buy, not against the rest of the history: over five years of a rising
 * market a ranking by price is very nearly a ranking by date, and would say
 * "you bought late" while sounding like "you bought badly".
 */
function Footnotes({ data }: { data: Receipt }) {
  if (!data.standing || !data.free_at) return null;
  const { days_covered, market_avg_eur, vs_market_pct } = data.standing;
  const below = vs_market_pct >= 0;

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        <Stat
          label="Against the month around it"
          tone={below ? "up" : "down"}
          hint={`${fmtEur(data.price_eur, 0)} paid · the market averaged ${fmtEur(
            market_avg_eur,
            0,
          )} over those ${days_covered} days`}
        >
          {fmtPct(vs_market_pct)}
        </Stat>
        <Stat
          label="Turns a year old"
          hint={
            data.free_in_days > 0
              ? `in ${data.free_in_days} ${data.free_in_days === 1 ? "day" : "days"}`
              : "already past it"
          }
        >
          {formatDayMonthYear(data.free_at)}
        </Stat>
      </div>

      <Note>
        The comparison is this buy against the days around it, which is the same
        yardstick the cost-basis card holds your whole stack to. The one-year mark is
        the German private-sale rule (&sect;23 EStG) applied to this buy on its own — a
        holding report, not tax advice.
      </Note>
    </>
  );
}
