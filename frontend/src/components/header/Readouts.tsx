import type { FunctionComponent, ReactNode, SVGProps } from "react";
import CoinsIcon from "~icons/ph/coins";
import CurrencyBtcIcon from "~icons/ph/currency-btc";
import DropIcon from "~icons/ph/drop";
import KeyIcon from "~icons/ph/key";
import PlusIcon from "~icons/ph/plus";
import PulseIcon from "~icons/ph/pulse";
import type {
  AccountBalance,
  BotSettings,
  Indicators,
  Performance,
} from "../../api/client";
import { potencyFromMultiplier } from "../drops";
import { COINBASE_DEPOSIT_URL, HOST } from "../../lib/coinbase";
import { fmtEur, fmtPct } from "../../lib/format";
import { MA_FAR_ABOVE, RSI_OVERBOUGHT, RSI_STRONG } from "../../lib/scoringRules";
import { useStackAmount } from "../../lib/units";
import { Loading, OutLink, Spinner } from "../ui";

/**
 * The four read-outs floating on the waterline — instruments on the tank wall.
 *
 * There used to be five, one per indicator, which meant the hero showed the
 * score next to the two readings that produce it — the same fact three times,
 * each too small to read from a chair. They are now grouped by the question
 * they answer: what Drip is about to do (`Signal`), what the market looks like
 * (`Market`), what bitcoin costs (`Bitcoin`), and whether there is money left
 * to buy with (`Well`). The arithmetic between them lives one click away in
 * `SignalBreakdown`.
 *
 * All four are one grammar, read top to bottom, so the set reads as a panel of
 * gauges rather than four unrelated cards:
 *
 *   1. an **eyebrow** — an icon and the name of the instrument, always present,
 *      so a chip that is still fetching still says what it is going to show;
 *   2. the **figure**, pushed to the bottom of the card so all four sit on one
 *      line whatever the label above them wraps to;
 *   3. one line of **plain words** saying what the figure means; and
 *   4. a **rail** across the foot — the same track in all four, filled four
 *      different ways, each panel measuring its own scale.
 *
 * The rail is what makes them a set. Two of them used to have a bar and two did
 * not, so the four had no shared bottom edge and the eye had to start over on
 * each one. Everything is left-aligned for the same reason: a rail runs left to
 * right, and a centred figure above one never resolves.
 */

/**
 * The glass itself.
 *
 * A heavy cream wash over the tank reads as fog, not as glass — a pale patch
 * with a line round it. What makes it glass is that the pane is nearly clear
 * and the *light* does the drawing: the tank is lit from the surface above, so
 * the top edge catches a bright specular line, the wash falls off downward, the
 * bottom edge sits in its own shade, and the blur behind is deep enough to
 * genuinely defocus the bubbles rising past. The rim is what states the shape;
 * the fill only has to tint.
 */
const GAUGE =
  "relative flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-cream/30 " +
  "bg-linear-to-b from-cream/16 to-cream/[.04] px-3.5 py-4 text-cream backdrop-blur-2xl " +
  "shadow-[inset_0_1px_0_rgba(241,255,250,.5),inset_0_-1px_0_rgba(0,0,0,.3),0_20px_40px_-24px_rgba(0,0,0,.65)] " +
  "sm:rounded-[1.75rem] sm:px-5 sm:py-5";

/** The sunlight landing on the top-left corner of each pane. */
const SHEEN =
  "pointer-events-none absolute inset-0 bg-[radial-gradient(130%_90%_at_8%_-20%,rgba(241,255,250,0.28),transparent_58%)]";

const EYEBROW =
  "flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.16em] text-cream/80";

/**
 * The figure each chip is about.
 *
 * Two of these are euro amounts that can reach five figures, and on a phone the
 * chip they sit in is half the width of the glass — so below ~550px the size is
 * measured in vw and shrinks with it. Above that it is capped at the 2.25rem it
 * has always been, so nothing on a desk moved. `mt-auto` is what parks it on the
 * card's bottom edge, above its own words and rail.
 */
const FIGURE =
  "mt-auto pt-4 font-display text-[clamp(1.45rem,6.4vw,2.25rem)] font-semibold leading-none tracking-tight";
/**
 * The line of plain words under the figure. Two lines are reserved for it on a
 * phone, where the chip is half the glass wide and the bitcoin one wraps: the
 * figures above only sit on a shared line while the words below them are the
 * same height. From `sm` up every one of them fits on a line of its own.
 */
const SUB =
  "mt-1.5 text-xs font-semibold text-cream/75 max-sm:min-h-[2.7em] sm:text-sm";

/**
 * The way out of Drip, and the only one: Coinbase's own deposit page.
 *
 * It rides on the **figure's** line rather than in the eyebrow, because the
 * eyebrow is already the full width of the chip on a phone and a button beside
 * it would push the instrument's name onto a second line. Aligned to the bottom
 * of that line, so the four figures keep the single baseline the set is built
 * on however tall this is.
 *
 * **Two marks, never one.** The `+` says what it does to the well; the
 * out-mark `OutLink` adds says it happens somewhere else. A bare `+` on a chip
 * headed "Coinbase well" reads as a button that tops the well up from here —
 * which is the one thing Drip cannot do. Together they say "add money, over
 * there", which is exactly what the link is.
 *
 * **No word at rest, in any state**, and that was measured rather than guessed.
 * The hero is a fixed number of rem and the root size grows with the window, so
 * the chip-to-type ratio never changes: a spelled-out pill leaves the balance
 * ~7px of clearance at 1280 *and* at 1920, and a permanent one starved the
 * figure outright once the pill also had to hold "Coinbase". The balance is the
 * one thing on this chip that may never be shortened, so the word is something
 * the pointer asks for — see `TopUp`.
 *
 * What the **state** changes is the colour, which costs no width at all: a well
 * running dry, or one with no key yet, wears `rose-pale` — the same colour the
 * line under it turns, since a figure on the water can never use the `-soft`
 * tints. The hover colour beats both, because it belongs to neither.
 */
const TOP_UP =
  "group absolute bottom-0 right-0 flex h-9 items-center gap-1 overflow-hidden " +
  "rounded-full border px-2 text-2xs font-bold uppercase tracking-[0.1em] " +
  "backdrop-blur-md transition-all duration-300 ease-out " +
  "hover:border-coinbase hover:bg-coinbase hover:text-cream " +
  "focus-visible:border-coinbase focus-visible:bg-coinbase focus-visible:text-cream " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream " +
  "max-sm:h-11 max-sm:px-3";
/** Quiet: the well is fine and this is only the way to keep it that way. */
const TOP_UP_CALM = "border-cream/35 bg-cream/12 text-cream";
/** Loud: the well is nearly empty, or was never filled. */
const TOP_UP_LOW = "border-rose-pale/50 bg-rose-pale/15 text-rose-pale";
/**
 * The room the pill needs while nobody is pointing at it. It floats **over**
 * the figure's line rather than in it, so growing on hover cannot push the
 * balance around or shorten it; this is the space the balance keeps clear so
 * the two never sit on top of each other at rest. Two values because the loud
 * state is already carrying a word.
 */
const FIGURE_CLEAR = "pr-16";
/**
 * The balance steps back while the pill is taking over.
 *
 * The pill grows across it on hover, and a figure half-covered by a button
 * reads as a bug; faded, the same overlap reads as the chip changing what it is
 * about for as long as you are pointing at it. `group-has-[a:hover]` rather
 * than a plain group hover, so passing over the *number* leaves it alone — it
 * is only the link taking the chip over that dims it.
 */
const FIGURE_STEPS_BACK =
  "transition-opacity duration-300 ease-out group-has-[a:hover]/well:opacity-25";
/** The out-mark leaves before you do — a nudge in the direction it points. */
const MARK_MOVE =
  "text-2xs transition-all duration-300 ease-out group-hover:text-cream " +
  "group-hover:-translate-y-px group-hover:translate-x-px";

/** The shared track every rail is drawn on. */
const TRACK = "relative mt-4 h-1.5 w-full rounded-full bg-cream/20";
/** A scale mark, overhanging the track on both sides so it survives the fill. */
const NOTCH = "absolute top-1/2 h-3 w-px -translate-y-1/2 bg-cream/70";

function Gauge({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: FunctionComponent<SVGProps<SVGSVGElement>>;
  children: ReactNode;
}) {
  return (
    <div className={GAUGE}>
      <span aria-hidden="true" className={SHEEN} />
      <div className="relative flex h-full flex-col">
        <div className={EYEBROW}>
          <Icon className="shrink-0 text-sm opacity-80" />
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * One chip's wait, in cream on the water.
 *
 * Each says what *this* chip is missing rather than "loading", because the
 * four of them arrive from three different calls and the slow one is worth
 * naming. No seconds here — four clocks ticking in a row is noise, and the
 * sticky bar is already counting for the page. The empty rail stays under it so
 * the card is the same height before and after the answer lands.
 */
function ChipWait({ what }: { what: string }) {
  return (
    <>
      <div className="mt-auto pt-4">
        <Loading compact on="water" what={what} />
      </div>
      <div aria-hidden="true" className={TRACK} />
    </>
  );
}

/** The 0.5x–1.5x ladder, drawn: five rungs, lit up to the one in force. */
function LadderRail({ lit }: { lit: number }) {
  return (
    <div aria-hidden="true" className="mt-4 flex w-full gap-1">
      {[1, 2, 3, 4, 5].map((rung) => (
        <span
          key={rung}
          className={`h-1.5 flex-1 rounded-full ${rung <= lit ? "bg-cream" : "bg-cream/20"}`}
        />
      ))}
    </div>
  );
}

/** A 0–100 scale with the reading pinned on it and neutral marked at the middle. */
function PinRail({ value }: { value: number }) {
  const pos = Math.max(0, Math.min(100, value));
  return (
    <div aria-hidden="true" className={TRACK}>
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-cream/70"
        style={{ width: `${pos}%` }}
      />
      <span className={NOTCH} style={{ left: "50%" }} />
      <div
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream shadow-[0_0_0_3px_rgba(0,0,0,.18)]"
        style={{ left: `${pos}%` }}
      />
    </div>
  );
}

/**
 * How far either side of the average the rail can show before it pegs — the
 * distance at which `strategy.py` stops grading and pays the last step, so a
 * pegged bar is a block that has run out of things to say rather than a chosen
 * number.
 */
const SPAN_PCT = MA_FAR_ABOVE;

/**
 * A distance from a middle: the notch is the 350-day average and the bar grows
 * out of it — left when bitcoin is under that average, right when it is over.
 */
function SpanRail({ pct }: { pct: number }) {
  const share = Math.min(1, Math.abs(pct) / SPAN_PCT);
  const width = `${share * 50}%`;
  return (
    <div aria-hidden="true" className={TRACK}>
      <div
        className="absolute inset-y-0 rounded-full bg-cream/75"
        style={pct < 0 ? { right: "50%", width } : { left: "50%", width }}
      />
      <span className={NOTCH} style={{ left: "50%" }} />
    </div>
  );
}

/** One tick per buy still in the well, so the runway can be counted. */
function TickRail({ lit, total, dry }: { lit: number; total: number; dry: boolean }) {
  return (
    <div aria-hidden="true" className="mt-4 flex w-full gap-0.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full ${
            i < lit ? (dry ? "bg-rose-pale" : "bg-cream") : "bg-cream/20"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * What the next buy will be, in one number: the multiplier. The line under it
 * names the signal and the score it came from, and the rungs at the foot are
 * the 0.5x–1.5x ladder the multiplier came off. The drops stay on the spout
 * below, where the money is.
 */
export function SignalReadout({ indicators }: { indicators: Indicators | null }) {
  return (
    <Gauge label="Buy signal" icon={DropIcon}>
      {indicators ? (
        <>
          <div className={FIGURE}>&times;{indicators.multiplier}</div>
          <div className={SUB}>
            {indicators.signal.replace(/ signal$/i, "")} &middot; score{" "}
            {indicators.score}/{indicators.score_max}
          </div>
          <LadderRail lit={potencyFromMultiplier(indicators.multiplier)} />
        </>
      ) : (
        <ChipWait what="Scoring this week" />
      )}
    </Gauge>
  );
}

/** Fear & Greed as the headline, with the RSI as the second opinion under it. */
export function MarketReadout({ indicators }: { indicators: Indicators | null }) {
  if (!indicators) {
    return (
      <Gauge label="Fear & greed" icon={PulseIcon}>
        <ChipWait what="Reading the mood" />
      </Gauge>
    );
  }

  // The RSI's own word is only said when it is worth saying — a neutral RSI is
  // the second opinion agreeing that there is nothing to add.
  const rsi = Math.round(indicators.rsi);
  const rsiLabel =
    indicators.rsi < RSI_STRONG
      ? " oversold"
      : indicators.rsi > RSI_OVERBOUGHT
        ? " overbought"
        : "";

  return (
    <Gauge label="Fear & greed" icon={PulseIcon}>
      <div className={FIGURE}>{indicators.fear_greed}</div>
      <div className={SUB}>
        {indicators.fng_classification} &middot; RSI {rsi}
        {rsiLabel}
      </div>
      <PinRail value={indicators.fear_greed} />
    </Gauge>
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
      <Gauge label="Bitcoin" icon={CurrencyBtcIcon}>
        <ChipWait what="Fetching the price" />
      </Gauge>
    );
  }

  return (
    <Gauge label="Bitcoin" icon={CurrencyBtcIcon}>
      <div className={FIGURE}>{fmtEur(performance.current_price, 0)}</div>
      {indicators ? (
        <>
          <div className={SUB}>
            {fmtPct(indicators.ma_distance_pct)} vs. its 350-day average
          </div>
          <SpanRail pct={indicators.ma_distance_pct} />
        </>
      ) : (
        // The price is in but the average is not: it is the one figure here
        // that costs 350 days of candles, so it says so rather than showing a
        // dash that looks like a missing number.
        <>
          <div className={`${SUB} inline-flex items-center gap-2 text-cream/70`}>
            <Spinner className="h-3 w-3 border-[1.5px]" on="water" />
            Averaging 350 days
          </div>
          <div aria-hidden="true" className={TRACK} />
        </>
      )}
    </Gauge>
  );
}

/** Full when the well covers this many base buys. */
const WELL_FULL_AT_BUYS = 10;
/**
 * At or below this many remaining buys the well reads as running dry — the same
 * number, and the same whole-buys arithmetic, as `LOW_BUYS` in `backend/app/
 * well.py`, which is what makes Discord call the well low on the week this chip
 * turns rose. Change one and change the other.
 */
const WELL_LOW_BUYS = 2;

/**
 * Fills the well: Coinbase's deposit page, in a tab of its own.
 *
 * **It becomes its destination while you point at it.** Drip's own glass turns
 * Coinbase blue and the word turns into "Coinbase" — the button's whole job is
 * to hand you to another company, so the moment it takes over it stops looking
 * like this app and starts looking like where it is about to send you. That
 * says it better than any wording, and it is why `--color-coinbase` exists.
 *
 * It floats over the figure's line rather than sitting in it, so growing to fit
 * the longer word cannot push the balance around or clip it — `FIGURE_CLEAR` is
 * the space the balance keeps free for it at rest.
 */
function TopUp({ low = false }: { low?: boolean }) {
  return (
    <OutLink
      href={COINBASE_DEPOSIT_URL}
      host={HOST[COINBASE_DEPOSIT_URL]}
      className={`${TOP_UP} ${low ? TOP_UP_LOW : TOP_UP_CALM}`}
      markClassName={`${MARK_MOVE} ${low ? "opacity-80" : "text-cream/70"}`}
    >
      <PlusIcon className="shrink-0 text-sm" aria-hidden="true" />
      {/* The name unrolls out of the mark on hover and rolls back in when the
          pointer leaves. It is never here at rest, in either state: the pill
          shares the chip with a five-figure balance, and a word standing there
          permanently is a word taking the figure's room. What the loud state
          changes is the colour, which costs nothing. */}
      <span className="max-w-0 overflow-hidden opacity-0 transition-all duration-300 ease-out group-hover:max-w-28 group-hover:opacity-100">
        <span className="block whitespace-nowrap">Coinbase</span>
      </span>
    </OutLink>
  );
}

/**
 * The Coinbase "well" — the source that feeds the reservoir. Shows the EUR
 * balance available for buying and a runway rail: one tick per scheduled drip
 * the well still covers at today's potency, so the number of buys left can be
 * counted off it rather than estimated from a bar. Buying lives in the Next-buy
 * card; filling the well is the one thing Drip cannot do itself, so it hands
 * that over to Coinbase from here — where the running-dry line is read.
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

  if (balance === null) {
    return (
      <Gauge label="Coinbase well" icon={CoinsIcon}>
        <ChipWait what="Checking your well" />
      </Gauge>
    );
  }

  const eur = balance.configured ? balance.eur_available : null;
  const nextAmount =
    settings && indicators ? settings.base_amount_eur * indicators.multiplier : null;
  const buysLeft =
    eur != null && nextAmount != null && nextAmount > 0
      ? Math.floor(eur / nextAmount)
      : null;
  const runningDry = buysLeft != null && buysLeft <= WELL_LOW_BUYS;

  return (
    <Gauge label="Coinbase well" icon={CoinsIcon}>
      {balance.configured && eur != null ? (
        <>
          <div className={`${FIGURE} group/well relative flex items-end`}>
            {/* Whole euros, like the price beside it: the cents of a balance
                are not a fact this instrument is for, and they were what the
                deposit pill had to take its width from. */}
            <span
              className={`min-w-0 truncate ${FIGURE_STEPS_BACK} ${FIGURE_CLEAR}`}
            >
              {fmtEur(eur, 0)}
            </span>
            <TopUp low={runningDry} />
          </div>
          <div className={`${SUB} ${runningDry ? "text-rose-pale" : ""}`}>
            {buysLeft == null
              ? `${stackAmount(balance.btc_available ?? 0)} on Coinbase`
              : runningDry
                ? `Running dry · ~${buysLeft} ${buysLeft === 1 ? "buy" : "buys"} left`
                : `Feeds ~${buysLeft} more buys`}
          </div>
          <TickRail
            lit={Math.min(WELL_FULL_AT_BUYS, buysLeft ?? 0)}
            total={WELL_FULL_AT_BUYS}
            dry={runningDry}
          />
        </>
      ) : (
        <>
          {/* No key is no reason not to fund the account — the money can be in
              place before Coinbase has been asked for a key at all. */}
          <div className={`${FIGURE} group/well relative flex items-end`}>
            <span className={`text-cream/55 ${FIGURE_STEPS_BACK} ${FIGURE_CLEAR}`}>
              &mdash;
            </span>
            <TopUp low />
          </div>
          <div className={`${SUB} inline-flex items-center gap-1.5`}>
            <KeyIcon className="shrink-0 text-sm" />
            {balance.configured ? "Balance unavailable" : "No API keys yet"}
          </div>
          <TickRail lit={0} total={WELL_FULL_AT_BUYS} dry={false} />
        </>
      )}
    </Gauge>
  );
}
