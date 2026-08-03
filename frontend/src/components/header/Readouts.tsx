import type { ReactNode } from "react";
import CoinsIcon from "~icons/ph/coins";
import KeyIcon from "~icons/ph/key";
import type {
  AccountBalance,
  BotSettings,
  Indicators,
  Performance,
} from "../../api/client";
import { fmtEur, fmtPct } from "../../lib/format";
import { useStackAmount } from "../../lib/units";
import { ScoreDrops } from "../drops";
import { Loading, Spinner } from "../ui";

/**
 * The four frosted read-outs floating on the waterline.
 *
 * There used to be five, one per indicator, which meant the hero showed the
 * score next to the two readings that produce it — the same fact three times,
 * each too small to read from a chair. They are now grouped by the question
 * they answer: what Drip is about to do (`Signal`), what the market looks like
 * (`Market`), what bitcoin costs (`Bitcoin`), and whether there is money left
 * to buy with (`Well`). The arithmetic between them lives one click away in
 * `SignalBreakdown`.
 */
const FROST_CARD =
  "flex h-full flex-col items-center justify-center gap-2 text-center rounded-[1.75rem] border border-cream/45 bg-cream/25 px-5 py-6 text-cream shadow-[0_16px_34px_-18px_rgba(0,0,0,.5)] backdrop-blur-md";

const CAPTION = "text-2xs font-bold uppercase tracking-[0.16em] text-cream/72";
const BIG_NUMBER = "font-display text-4xl font-semibold leading-none";
const SUB = "text-sm font-semibold text-cream/80";

function FrostCard({ children }: { children: ReactNode }) {
  return <div className={FROST_CARD}>{children}</div>;
}

/**
 * One chip's wait, in cream on the water.
 *
 * Each says what *this* chip is missing rather than "loading", because the
 * four of them arrive from three different calls and the slow one is worth
 * naming. No seconds here — four clocks ticking in a row is noise, and the
 * sticky bar is already counting for the page.
 */
function ChipWait({ what }: { what: string }) {
  return (
    <div className="flex w-full items-center justify-center px-1 py-3">
      <Loading compact on="water" what={what} />
    </div>
  );
}

/**
 * What the next buy will be, in one number: the multiplier. The drops above it
 * are the same fact drawn, the line under it names the signal and the score it
 * came from.
 */
export function SignalReadout({ indicators }: { indicators: Indicators | null }) {
  if (!indicators) {
    return (
      <FrostCard>
        <ChipWait what="Scoring this week" />
      </FrostCard>
    );
  }

  return (
    <FrostCard>
      <ScoreDrops
        multiplier={indicators.multiplier}
        size="text-xl"
        variant="solid"
      />
      <div className={BIG_NUMBER}>&times;{indicators.multiplier}</div>
      <div className={CAPTION}>
        {indicators.signal.replace(/ signal$/i, "")} &middot; score{" "}
        {indicators.score}/{indicators.score_max}
      </div>
    </FrostCard>
  );
}

/** Fear & Greed as the headline, with the RSI as the second opinion under it. */
export function MarketReadout({ indicators }: { indicators: Indicators | null }) {
  if (!indicators) {
    return (
      <FrostCard>
        <ChipWait what="Reading fear &amp; greed" />
      </FrostCard>
    );
  }

  const rsi = Math.round(indicators.rsi);
  const rsiLabel =
    indicators.rsi < 30 ? "oversold" : indicators.rsi > 70 ? "overbought" : "neutral";
  const pos = Math.max(0, Math.min(100, rsi));

  return (
    <FrostCard>
      <FearGreedArc value={indicators.fear_greed} />
      <div className={BIG_NUMBER}>{indicators.fear_greed}</div>
      <div className={CAPTION}>{indicators.fng_classification}</div>

      <div className="mt-1 w-full self-stretch border-t border-cream/25 pt-3">
        <div className="relative h-2 w-full rounded-full bg-cream/22">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-cream"
            style={{ width: `${pos}%` }}
          />
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream shadow-[0_0_0_4px_rgba(60,109,120,0.5)]"
            style={{ left: `${pos}%` }}
          />
        </div>
        <div className="mt-2 text-xs font-semibold text-cream/70">
          RSI {rsi} &middot; {rsiLabel}
        </div>
      </div>
    </FrostCard>
  );
}

/** The cream semicircle gauge behind the Fear & Greed number. */
function FearGreedArc({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const arcLen = 131.9; // π · r with r = 42
  const arc = "M8 50 A42 42 0 0 1 92 50";
  return (
    <svg viewBox="0 0 100 54" className="block h-[2.6rem] w-[4.8rem]">
      <path
        d={arc}
        fill="none"
        stroke="rgba(241,255,250,.22)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d={arc}
        fill="none"
        stroke="var(--color-cream)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={arcLen}
        strokeDashoffset={arcLen * (1 - clamped / 100)}
      />
    </svg>
  );
}

/** BTC spot price with the 350-day average and its distance underneath. */
export function BtcReadout({
  indicators,
  performance,
}: {
  indicators: Indicators | null;
  performance: Performance | null;
}) {
  if (!performance) {
    return (
      <FrostCard>
        <ChipWait what="Fetching the price" />
      </FrostCard>
    );
  }

  return (
    <FrostCard>
      <div className={CAPTION}>Bitcoin</div>
      <div className={BIG_NUMBER}>{fmtEur(performance.current_price, 0)}</div>
      {indicators ? (
        <div className={SUB}>
          {fmtPct(indicators.ma_distance_pct)} vs. its 350-day average
        </div>
      ) : (
        // The price is in but the average is not: it is the one figure here
        // that costs 350 days of candles, so it says so rather than showing a
        // dash that looks like a missing number.
        <div className={`${SUB} inline-flex items-center gap-2 text-cream/70`}>
          <Spinner className="h-3 w-3 border-[1.5px]" on="water" />
          Averaging 350 days
        </div>
      )}
    </FrostCard>
  );
}

/** Full when the well covers this many base buys. */
const WELL_FULL_AT_BUYS = 10;
/** At or below this many remaining buys the well reads as running dry. */
const WELL_LOW_BUYS = 2;

/**
 * The Coinbase "well" — the source that feeds the reservoir. Shows the EUR
 * balance available for buying and a water-level runway bar: how many
 * scheduled drips the well still covers at today's potency. Buying lives in
 * the Next-buy card.
 */
export function WellReadout({
  balance,
  settings,
  indicators,
}: {
  balance: AccountBalance | null;
  settings: BotSettings | null;
  indicators: Indicators | null;
}) {
  const stackAmount = useStackAmount();
  const eur = balance?.configured ? balance.eur_available : null;
  const nextAmount =
    settings && indicators ? settings.base_amount_eur * indicators.multiplier : null;
  const buysLeft =
    eur != null && nextAmount != null && nextAmount > 0
      ? Math.floor(eur / nextAmount)
      : null;
  const runningDry = buysLeft != null && buysLeft <= WELL_LOW_BUYS;
  const level =
    eur != null && settings
      ? Math.max(0, Math.min(1, eur / (settings.base_amount_eur * WELL_FULL_AT_BUYS)))
      : 0;

  if (balance === null) {
    return (
      <FrostCard>
        <ChipWait what="Checking your well" />
      </FrostCard>
    );
  }

  return (
    <FrostCard>
      <div className={`flex items-center gap-1.5 ${CAPTION}`}>
        <CoinsIcon className="text-sm" /> Coinbase well
      </div>
      {balance.configured && eur != null ? (
        <>
          <div className={BIG_NUMBER}>{fmtEur(eur)}</div>
          <div className="relative mt-1 h-2 w-full self-stretch rounded-full bg-cream/22">
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${runningDry ? "bg-rose-pale" : "bg-cream"}`}
              style={{ width: `${level * 100}%` }}
            />
          </div>
          <div
            className={`text-sm font-semibold ${runningDry ? "text-rose-pale" : "text-cream/70"}`}
          >
            {buysLeft == null
              ? `${stackAmount(balance.btc_available ?? 0)} on Coinbase`
              : runningDry
                ? `Running dry · ~${buysLeft} ${buysLeft === 1 ? "buy" : "buys"} left`
                : `Feeds ~${buysLeft} more buys`}
          </div>
        </>
      ) : (
        <>
          <div className={`${BIG_NUMBER} text-cream/60`}>—</div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-cream/70">
            <KeyIcon className="text-sm" />
            {balance.configured ? "Balance unavailable" : "No API keys yet"}
          </div>
        </>
      )}
    </FrostCard>
  );
}
