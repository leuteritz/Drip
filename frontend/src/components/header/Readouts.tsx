import type { ReactNode } from "react";
import CoinsIcon from "~icons/ph/coins";
import KeyIcon from "~icons/ph/key";
import type {
  AccountBalance,
  BotSettings,
  Indicators,
  Performance,
} from "../../api/client";
import { fmtBtc, fmtEur, fmtPct } from "../../lib/format";
import { ScoreDrops } from "../drops";

/** Shared frosted-glass chip that floats the stat read-outs on the waterline. */
const FROST_CARD =
  "flex flex-col items-center justify-center text-center rounded-[18px] border border-cream/45 bg-cream/25 px-[18px] py-[15px] text-cream shadow-[0_16px_34px_-18px_rgba(0,0,0,.5)] backdrop-blur-md";

const CAPTION = "text-[10px] font-bold uppercase tracking-[0.13em] text-cream/72";
const BIG_NUMBER = "font-display text-3xl font-semibold leading-none";

function FrostCard({ width, children }: { width: string; children: ReactNode }) {
  return <div className={`${FROST_CARD} ${width}`}>{children}</div>;
}

/** Score: five potency drops, the score fraction, and the buy multiplier. */
export function ScoreReadout({ indicators }: { indicators: Indicators }) {
  return (
    <FrostCard width="w-[172px]">
      <ScoreDrops
        multiplier={indicators.multiplier}
        size="text-[15px]"
        variant="solid"
        className="mb-2"
      />
      <div className={BIG_NUMBER}>
        {indicators.score}
        <span className="text-lg text-cream/70">/{indicators.score_max}</span>
      </div>
      <div className={`mt-1.5 ${CAPTION}`}>Score &middot; x{indicators.multiplier}</div>
    </FrostCard>
  );
}

/** Fear & Greed: the cream semicircle gauge, its value, and the classification. */
export function FearGreedReadout({ indicators }: { indicators: Indicators }) {
  return (
    <FrostCard width="w-[172px]">
      <FearGreedArc value={indicators.fear_greed} />
      <div className={`mt-0.5 ${BIG_NUMBER}`}>{indicators.fear_greed}</div>
      <div className={`mt-1.5 ${CAPTION}`}>{indicators.fng_classification}</div>
    </FrostCard>
  );
}

/** The cream semicircle gauge behind the Fear & Greed number. */
function FearGreedArc({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const arcLen = 131.9; // π · r with r = 42
  const arc = "M8 50 A42 42 0 0 1 92 50";
  return (
    <svg viewBox="0 0 100 58" className="block h-[42px] w-[76px]">
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

/** RSI: label + big value on one baseline, with the bar and knob below. */
export function RsiReadout({ indicators }: { indicators: Indicators }) {
  const rsi = Math.round(indicators.rsi);
  const rsiLabel =
    indicators.rsi < 30 ? "Oversold" : indicators.rsi > 70 ? "Overbought" : "Neutral";
  const pos = Math.max(0, Math.min(100, rsi));

  return (
    <FrostCard width="w-[210px]">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-cream/72">
        RSI &middot; {rsiLabel}
      </div>
      <div className={`mt-1 ${BIG_NUMBER}`}>{rsi}</div>
      <div className="relative mt-3 h-2 w-full self-stretch rounded-full bg-cream/22">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-cream"
          style={{ width: `${pos}%` }}
        />
        <div
          className="absolute top-1/2 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream shadow-[0_0_0_4px_rgba(60,109,120,0.5)]"
          style={{ left: `${pos}%` }}
        />
      </div>
      <div className="mt-2 flex w-full justify-between text-[9px] font-semibold text-cream/50">
        <span>Oversold</span>
        <span>Overbought</span>
      </div>
    </FrostCard>
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
  return (
    <FrostCard width="w-[210px]">
      <div className={CAPTION}>BTC price</div>
      <div className={`mt-1 ${BIG_NUMBER}`}>
        {performance ? fmtEur(performance.current_price, 0) : "—"}
      </div>
      <div className="mt-1.5 text-[11px] font-semibold text-cream/80">
        {indicators
          ? `350‑day avg ${fmtEur(indicators.ma_350, 0)} · ${fmtPct(indicators.ma_distance_pct)}`
          : "—"}
      </div>
    </FrostCard>
  );
}

/** Full when the well covers this many base buys. */
const WELL_FULL_AT_BUYS = 10;
/** At or below this many remaining buys the well reads as running dry. */
const WELL_LOW_BUYS = 2;

/**
 * The Coinbase "well" — the source that feeds the reservoir. Shows the EUR
 * balance available for buying, the BTC held on Coinbase, and a water-level
 * runway bar: how many scheduled drips the well still covers at today's
 * potency. Buying lives in the Next-buy card.
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

  return (
    <FrostCard width="w-[210px]">
      <div className={`flex items-center gap-1.5 ${CAPTION}`}>
        <CoinsIcon className="text-xs" /> Coinbase well
      </div>
      {balance === null ? (
        <>
          <div className="mt-2 h-7 w-24 animate-pulse rounded-lg bg-cream/20" />
          <div className="mt-2 h-3 w-32 animate-pulse rounded bg-cream/15" />
        </>
      ) : balance.configured && eur != null ? (
        <>
          <div className={`mt-1 ${BIG_NUMBER}`}>{fmtEur(eur)}</div>
          <div className="mt-1.5 text-[11px] font-semibold text-cream/80">
            {fmtBtc(balance.btc_available ?? 0)} on Coinbase
          </div>
          <div className="relative mt-2.5 h-2 w-full self-stretch rounded-full bg-cream/22">
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${runningDry ? "bg-rose-soft" : "bg-cream"}`}
              style={{ width: `${level * 100}%` }}
            />
          </div>
          <div
            className={`mt-1.5 text-[10px] font-semibold ${runningDry ? "text-rose-soft" : "text-cream/60"}`}
          >
            {buysLeft == null
              ? " "
              : runningDry
                ? `Well running dry · ~${buysLeft} ${buysLeft === 1 ? "buy" : "buys"} left`
                : `Feeds ~${buysLeft} more buys`}
          </div>
        </>
      ) : (
        <>
          <div className={`mt-1 ${BIG_NUMBER} text-cream/60`}>—</div>
          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-cream/60">
            <KeyIcon className="text-xs" />
            {balance.configured
              ? "Balance unavailable"
              : "No API keys — add them under Setup"}
          </div>
        </>
      )}
    </FrostCard>
  );
}
