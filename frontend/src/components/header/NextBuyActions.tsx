import CaretDownIcon from "~icons/ph/caret-down";
import ChartLineUpIcon from "~icons/ph/chart-line-up";
import DropHalfBottomIcon from "~icons/ph/drop-half-bottom";
import PauseIcon from "~icons/ph/pause";
import PlayIcon from "~icons/ph/play-fill";
import QuestionIcon from "~icons/ph/question";
import SlidersIcon from "~icons/ph/sliders-horizontal";
import type { BotSettings, BotStatus, Indicators } from "../../api/client";
import { fmtEur, formatDayMonth, formatWeekdayTime, WEEKDAYS } from "../../lib/format";
import { ScoreDrops } from "../drops";
import { useNow, WEEK_MS } from "./hooks";

const ACTION =
  "flex h-14 items-center justify-center gap-2 rounded-2xl px-7 text-base font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60";
const ICON_ACTION =
  "flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-teal/12 text-teal transition hover:bg-teal/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";
const CAPTION = "text-2xs font-bold uppercase tracking-[0.18em] text-teal/60";

/** "in 3 days" / "in 5 h" / "in 20 min" — how far off the next drip is. */
function untilLabel(ms: number): string {
  if (ms <= 0) return "due now";
  if (ms < 60 * 60 * 1000) return `in ${Math.max(1, Math.round(ms / 60_000))} min`;
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 24) return `in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  return `in ${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * The spout of the tank: a full-width bar under the read-outs carrying the
 * next scheduled buy — when it lands and how big it is — plus every action
 * that can move money: the dry-run test, a manual buy, the backtest and the
 * faucet controls.
 *
 * It used to carry a third column naming the signal. That now sits in the
 * `Signal` read-out above, which leaves this row two things instead of three
 * and lets the amount be set at the size the row is actually about.
 *
 * Buy uses the same simple mechanic as the bot (a market buy for an amount) via
 * ManualBuyDialog; in live mode it turns rose to signal real money. The pipe
 * along the bottom edge fills as the week runs down toward the next drip.
 */
export default function NextBuyActions({
  indicators,
  settings,
  status,
  onTestBuy,
  onSimulate,
  onBuy,
  onExplain,
  onTogglePanel,
  panelOpen,
  running,
  buying,
}: {
  indicators: Indicators | null;
  settings: BotSettings | null;
  status: BotStatus | null;
  onTestBuy: () => void;
  onSimulate: () => void;
  onBuy: () => void;
  onExplain: () => void;
  onTogglePanel: () => void;
  panelOpen: boolean;
  running: boolean;
  buying: boolean;
}) {
  const now = useNow();
  const live = status != null && !status.dry_run;
  const paused = status?.paused === true;

  // Prefer the scheduler's own next-run time; fall back to the configured slot
  // while the status is still loading.
  const nextWhen = status?.next_run
    ? formatWeekdayTime(status.next_run)
    : settings
      ? `${WEEKDAYS[settings.schedule_weekday].slice(0, 3)} ${settings.schedule_time}`
      : "—";
  const remaining = status?.next_run
    ? new Date(status.next_run).getTime() - now
    : null;
  // The pipe fills as the week drains toward the next buy.
  const filled =
    remaining == null ? 0 : Math.max(0, Math.min(1, 1 - remaining / WEEK_MS));

  const amount =
    settings && indicators
      ? fmtEur(settings.base_amount_eur * indicators.multiplier)
      : "—";
  const dot = amount.lastIndexOf(".");
  const amountMain = dot >= 0 ? amount.slice(0, dot) : amount;
  const amountCents = dot >= 0 ? amount.slice(dot) : "";

  return (
    <div className="relative mx-auto mt-8 w-full max-w-spout overflow-hidden rounded-[2rem] bg-spout pb-2.5 shadow-[0_28px_64px_-26px_rgba(0,0,0,.62)]">
      {/* A pool of water around the drop, so the bar reads as the tank's spout
          rather than a white slab dropped onto it */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(16rem_11rem_at_5rem_50%,rgba(147,183,190,.22),transparent_72%)]"
      />

      <div className="relative flex flex-col gap-6 px-6 py-6 md:flex-row md:flex-wrap md:items-center md:gap-7 md:px-8 md:py-7">
        {/* Left: the drop, the amount, and what makes it that size */}
        <div className="flex min-w-0 flex-1 items-center gap-5">
          <span
            className={`relative flex h-16 w-16 flex-none items-center justify-center rounded-full text-3xl text-cream shadow-[0_10px_22px_-10px_rgba(47,90,99,.9)] ${
              paused ? "bg-rose-deep" : "bg-teal-deep"
            }`}
          >
            <span className="absolute inset-0 rounded-full ring-8 ring-teal/8" />
            {paused ? <PauseIcon /> : <DropHalfBottomIcon />}
          </span>

          <div className="min-w-0">
            <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 ${CAPTION}`}>
              <span>Next buy</span>
              <span className="rounded-full bg-teal/10 px-2.5 py-0.5 tracking-[0.1em] text-teal/80">
                {nextWhen}
              </span>
              {paused && status?.paused_until ? (
                <span className="rounded-full bg-rose/12 px-2.5 py-0.5 tracking-[0.1em] text-rose">
                  Paused until {formatDayMonth(status.paused_until)}
                </span>
              ) : (
                remaining != null && (
                  <span className="normal-case tracking-normal text-teal/50">
                    {untilLabel(remaining)}
                  </span>
                )
              )}
            </div>

            <div className="mt-1.5 font-display text-5xl font-semibold leading-none text-teal md:text-6xl">
              {amountMain}
              <span className="text-teal/45">{amountCents}</span>
            </div>

            {/* The line that already states the arithmetic is the way into the
                whole of it. */}
            {settings && indicators && (
              <button
                type="button"
                onClick={onExplain}
                title="What makes the next buy this size"
                className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg text-sm font-semibold text-teal/60 transition hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              >
                <ScoreDrops multiplier={indicators.multiplier} size="text-base" />
                <span>
                  {fmtEur(settings.base_amount_eur, 0)} base &times;{" "}
                  {indicators.multiplier}
                </span>
                <QuestionIcon className="text-base opacity-70" />
              </button>
            )}
          </div>
        </div>

        {/* Right: everything that can move money */}
        <div className="flex flex-none items-center gap-2.5 max-md:justify-end md:ml-auto md:border-l md:border-teal/12 md:pl-7">
          <button
            onClick={onTestBuy}
            disabled={running}
            title="Run the strategy once without spending anything"
            className={`${ACTION} flex-1 bg-teal/12 text-teal hover:bg-teal/20 focus-visible:outline-teal md:flex-none`}
          >
            <PlayIcon /> {running ? "Testing…" : "Test"}
          </button>
          <button
            onClick={onBuy}
            disabled={buying}
            title={live ? "Place a real market buy" : "Place a dry-run buy"}
            className={`${ACTION} flex-1 md:flex-none ${
              live
                ? "bg-rose-deep text-cream hover:opacity-90 focus-visible:outline-rose"
                : "bg-teal-deep text-cream hover:bg-teal-deep/90 focus-visible:outline-teal"
            }`}
          >
            <DropHalfBottomIcon className="text-lg" />
            {buying ? "Buying…" : "Buy"}
          </button>
          <button
            onClick={onSimulate}
            aria-label="Simulate the strategy"
            title="Backtest the strategy"
            className={ICON_ACTION}
          >
            <ChartLineUpIcon className="text-lg" />
          </button>
          <button
            type="button"
            onClick={onTogglePanel}
            aria-expanded={panelOpen}
            aria-label="Adjust the next buy"
            title="Amount, schedule, pause"
            className={`${ICON_ACTION} ${panelOpen ? "bg-teal-deep text-cream hover:bg-teal-deep/90" : ""}`}
          >
            <SlidersIcon className="text-lg" />
            <CaretDownIcon
              className={`ml-[-2px] text-xs transition-transform duration-300 ${
                panelOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* The pipe: fills across the week as the next drip approaches */}
      <div className="absolute inset-x-0 bottom-0 h-2.5 bg-teal/10">
        <div
          className={`h-full rounded-r-full transition-[width] duration-700 ${
            paused ? "bg-rose/45" : "bg-teal/45"
          }`}
          style={{ width: `${filled * 100}%` }}
        />
      </div>
    </div>
  );
}
