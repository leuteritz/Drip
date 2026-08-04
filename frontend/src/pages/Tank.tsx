import { useEffect } from "react";
import ArrowLeftIcon from "~icons/ph/arrow-left";
import DropFillIcon from "~icons/ph/drop-fill";
import PauseIcon from "~icons/ph/pause";
import TrendDownIcon from "~icons/ph/trend-down";
import TrendUpIcon from "~icons/ph/trend-up";
import type {
  BotSettings,
  BotStatus,
  Indicators,
  Performance,
} from "../api/client";
import TankBackdrop from "../components/header/TankBackdrop";
import { ScoreDrops } from "../components/drops";
import { Loading } from "../components/ui";
import { fmtEur, fmtPct, formatWeekdayTime, WEEKDAYS } from "../lib/format";
import { leaveTank } from "../lib/route";
import { useStackAmount } from "../lib/units";

/** Every readout on this screen is sized to be read from across a room, so the
 *  type scales with the viewport rather than sitting at a fixed size. */
const HEADLINE = "clamp(3.5rem, 11vw, 12rem)";
const READOUT = "clamp(1.6rem, 3.4vw, 3.4rem)";
const CAPTION =
  "text-[clamp(0.6rem,1vw,0.95rem)] font-bold uppercase tracking-[0.22em] text-cream/60";

/**
 * The wall display.
 *
 * A Raspberry Pi running a savings bot ends up on a spare monitor sooner or
 * later, and the dashboard is the wrong thing to leave there: it is a page you
 * read, with three sections and six dialogs. This is the thing you glance at —
 * the reservoir, what bitcoin costs, and what lands next — at a size that works
 * from the other side of the room, on one screen that never scrolls.
 *
 * It is deliberately read-only. Nothing here can move money, which is the point
 * of a screen nobody is sitting in front of.
 */
export default function Tank({
  performance,
  indicators,
  settings,
  status,
}: {
  performance: Performance | null;
  indicators: Indicators | null;
  settings: BotSettings | null;
  status: BotStatus | null;
}) {
  const stackAmount = useStackAmount();

  // Escape is the way out, the same key every dialog in the app answers to.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") leaveTank();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const profitable = (performance?.profit_eur ?? 0) >= 0;
  const paused = status?.paused === true;
  const nextAmount =
    settings && indicators ? settings.base_amount_eur * indicators.multiplier : null;
  const nextWhen = status?.next_run
    ? formatWeekdayTime(status.next_run)
    : settings
      ? `${WEEKDAYS[settings.schedule_weekday].slice(0, 3)} ${settings.schedule_time}`
      : "—";

  return (
    <div className="tank-water relative h-full w-full overflow-hidden text-cream">
      <TankBackdrop multiplier={indicators?.multiplier} />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-[4vw] text-center">
        <div className={CAPTION}>Your reservoir</div>

        {performance ? (
          <>
            <div
              className="mt-[1.5vh] font-display font-semibold leading-[0.88] tracking-tight drop-shadow-[0_4px_28px_rgba(0,0,0,0.3)]"
              style={{ fontSize: HEADLINE }}
            >
              {fmtEur(performance.value_eur, 0)}
            </div>
            <div
              className="mt-[2vh] flex flex-wrap items-center justify-center gap-x-[3vw] gap-y-2 font-bold [text-shadow:0_1px_10px_rgba(0,0,0,0.25)]"
              style={{ fontSize: READOUT }}
            >
              <span
                className={`inline-flex items-center gap-3 ${profitable ? "text-cream" : "text-rose-pale"}`}
              >
                {profitable ? <TrendUpIcon /> : <TrendDownIcon />}
                {profitable ? "+" : ""}
                {fmtEur(performance.profit_eur, 0)}
              </span>
              <span className="text-cream/75">{fmtPct(performance.profit_pct)}</span>
            </div>
            <div className="mt-[1.5vh] text-[clamp(0.8rem,1.4vw,1.4rem)] font-medium text-cream/60">
              {stackAmount(performance.btc_total)} &middot;{" "}
              {fmtEur(performance.invested_eur, 0)} invested
            </div>
          </>
        ) : (
          // Nobody is sitting in front of a wall display to press reload, so
          // it says what it is waiting for rather than pulsing a grey slab —
          // from across the room that is the difference between "starting up"
          // and "broken".
          <div className="mt-[4vh]">
            <Loading
              on="water"
              what="Counting your reservoir"
              why="Every buy you have made, priced at what bitcoin costs right now."
              slow="Still waiting on Coinbase — this screen refreshes itself, so it will fill in on its own."
            />
          </div>
        )}

        {/* Three things worth glancing at, on the waterline */}
        <div className="mt-[6vh] flex w-full max-w-[1500px] flex-wrap items-stretch justify-center gap-[2vw]">
          <Panel caption="Bitcoin">
            {performance ? fmtEur(performance.current_price, 0) : "—"}
          </Panel>

          <Panel caption={paused ? "Paused" : `Next buy · ${nextWhen}`}>
            <span className="inline-flex items-center gap-3">
              {paused ? <PauseIcon /> : <DropFillIcon />}
              {paused ? "—" : nextAmount != null ? fmtEur(nextAmount, 0) : "—"}
            </span>
          </Panel>

          <Panel
            caption={
              indicators ? `Score ${indicators.score}/${indicators.score_max}` : "Signal"
            }
          >
            {indicators ? (
              <span className="flex flex-col items-center gap-[1.4vh]">
                <span className="text-[clamp(1.1rem,2.2vw,2.2rem)] leading-tight">
                  {indicators.signal.replace(/ signal$/i, "")}
                </span>
                <ScoreDrops
                  multiplier={indicators.multiplier}
                  variant="solid"
                  size="text-[clamp(1rem,2vw,2rem)]"
                />
              </span>
            ) : (
              "—"
            )}
          </Panel>
        </div>
      </div>

      {/* The way back, quiet enough to ignore on a wall */}
      <button
        type="button"
        onClick={leaveTank}
        title="Back to the dashboard (Esc)"
        className="absolute bottom-[2.5vh] right-[2.5vw] z-10 flex items-center gap-2 rounded-full bg-cream/12 px-4 py-2 text-[clamp(0.65rem,0.9vw,0.85rem)] font-bold text-cream/70 transition hover:bg-cream/25 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
      >
        <ArrowLeftIcon /> Dashboard
      </button>
    </div>
  );
}

/** One frosted readout on the water — the hero's chip, at wall size. */
function Panel({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-[240px] flex-1 flex-col items-center justify-center gap-[1.4vh] rounded-[2vw] border border-cream/35 bg-cream/15 px-[2.5vw] py-[3vh] backdrop-blur-md">
      <div className={CAPTION}>{caption}</div>
      <div
        className="font-display font-semibold leading-none"
        style={{ fontSize: READOUT }}
      >
        {children}
      </div>
    </div>
  );
}
