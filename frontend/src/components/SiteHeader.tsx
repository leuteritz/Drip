import { useEffect, useState, type ReactNode, type RefObject } from "react";
import CaretDownIcon from "~icons/ph/caret-down";
import ChartLineUpIcon from "~icons/ph/chart-line-up";
import DropFillIcon from "~icons/ph/drop-fill";
import DropSlashIcon from "~icons/ph/drop-slash";
import FlaskIcon from "~icons/ph/flask";
import KeyIcon from "~icons/ph/key";
import LightningIcon from "~icons/ph/lightning-fill";
import ListDashesIcon from "~icons/ph/list-dashes";
import PaperPlaneIcon from "~icons/ph/paper-plane-tilt";
import PlayIcon from "~icons/ph/play-fill";
import TrendDownIcon from "~icons/ph/trend-down";
import TrendUpIcon from "~icons/ph/trend-up";
import XIcon from "~icons/ph/x";
import {
  fmtBtc,
  fmtEur,
  fmtPct,
  WEEKDAYS,
  type BotSettings,
  type Indicators,
  type Performance,
  type RunResult,
  type BotStatus,
} from "../api/client";
import { potencyFromMultiplier } from "./drops";
import LiveModeDialog from "./LiveModeDialog";

export type Section = "overview" | "history";

export const NAV: { id: Section; label: string; Icon: typeof DropFillIcon }[] = [
  { id: "overview", label: "Overview", Icon: ChartLineUpIcon },
  { id: "history", label: "History", Icon: ListDashesIcon },
];

/** Rising bubbles for the tank — position, size, tempo and delay per the design. */
const BUBBLES: {
  left: string;
  bottom: string;
  size: string;
  color: string;
  duration: string;
  delay: string;
  short?: boolean;
}[] = [
  { left: "12%", bottom: "12px", size: "9px", color: "rgba(241,255,250,.5)", duration: "6.5s", delay: ".2s" },
  { left: "26%", bottom: "6px", size: "6px", color: "rgba(241,255,250,.45)", duration: "5s", delay: "1.4s", short: true },
  { left: "47%", bottom: "10px", size: "12px", color: "rgba(241,255,250,.4)", duration: "7.4s", delay: ".9s" },
  { left: "63%", bottom: "4px", size: "7px", color: "rgba(241,255,250,.5)", duration: "5.6s", delay: "2.1s", short: true },
  { left: "78%", bottom: "14px", size: "10px", color: "rgba(241,255,250,.42)", duration: "6.9s", delay: ".5s" },
  { left: "90%", bottom: "8px", size: "5px", color: "rgba(241,255,250,.5)", duration: "4.6s", delay: "1.8s", short: true },
];

/**
 * The signature gradient hero that opens the app. Following the "Settings in
 * Header integrieren" design, the header is now the whole command center: the
 * sticky bar carries the brand, the Dry-run / Live mode toggle and the jump-nav;
 * the hero shows the centered "reservoir" headline, one unified read-out row
 * (Score · Fear & Greed · RSI · BTC · next buy + actions), and a collapsible
 * "faucet control bar" that slides open from the Next-buy chip to tune the
 * amount, schedule, Discord and pause inline. It rides over the rolling waterline.
 */
export default function SiteHeader({
  status,
  settings,
  indicators,
  performance,
  scrollRef,
  onSimulate,
  onTestBuy,
  onSetDryRun,
  onSaveSettings,
  onPause,
  onResume,
  onTestWebhook,
  running,
  runResult,
}: {
  status: BotStatus | null;
  settings: BotSettings | null;
  indicators: Indicators | null;
  performance: Performance | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  onSimulate: () => void;
  onTestBuy: () => void;
  onSetDryRun: (dry: boolean) => void;
  onSaveSettings: (update: Partial<BotSettings>) => Promise<void>;
  onPause: (days: number) => Promise<void>;
  onResume: () => Promise<void>;
  onTestWebhook: () => Promise<boolean>;
  running: boolean;
  runResult: RunResult | null;
}) {
  const active = useScrollSpy(scrollRef);
  const scrolled = useScrolled(scrollRef);
  const [panelOpen, setPanelOpen] = useState(false);

  const jumpTo = (id: Section) => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* Sticky condensed bar: brand (left) · mode toggle + jump-nav (right).
          Stays pinned across the whole scroll — transparent over the hero,
          blurred teal once scrolled. */}
      <header
        className={`sticky top-0 z-30 shrink-0 text-teal transition-colors duration-300 ${
          scrolled
            ? "border-b border-teal/10 bg-paper/90 shadow-[0_6px_24px_-14px_rgba(60,109,120,.6)] backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between px-6 md:px-10">
          <div className="flex items-center gap-2.5">
            <DropFillIcon className="text-2xl leading-none" />
            <span className="font-display text-xl font-bold leading-none">
              Drip
            </span>
          </div>
          <div className="flex items-center gap-2.5 md:gap-3.5">
            {status && (
              <ModeToggle
                status={status}
                settings={settings}
                onSetDryRun={onSetDryRun}
              />
            )}
            {status?.paused && status.paused_until && (
              <HeaderPill>
                <DropSlashIcon /> Off until {formatDate(status.paused_until)}
              </HeaderPill>
            )}
            {status && !status.has_credentials && (
              <HeaderPill>
                <KeyIcon /> <span className="max-sm:hidden">No API keys</span>
              </HeaderPill>
            )}
            <nav className="flex gap-1.5">
              {NAV.map(({ id, label, Icon }) => {
                const on = active === id;
                return (
                  <button
                    key={id}
                    onClick={() => jumpTo(id)}
                    aria-current={on ? "true" : undefined}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
                      on
                        ? "bg-teal text-cream shadow-sm"
                        : "bg-teal/10 text-teal hover:bg-teal/15"
                    }`}
                  >
                    <Icon className="text-sm" />
                    <span className="max-sm:hidden">{label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero "tank": the water fills almost the whole hero, its surface waving just
          below the sticky bar; every bit of data lives submerged on the water in cream.
          A thin light-sky strip at the very top lets the crests break the surface. */}
      <section className="hero-gradient relative -mt-16 shrink-0 overflow-hidden px-6 pb-16 pt-16 text-cream md:px-10 md:pb-20">
        {/* Body of water filling from just under the bar to the floor: waving surface
            at its top edge, rising bubbles within. Decorative — content rides on z-10. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 top-[88px] z-0"
        >
          <svg
            viewBox="0 0 1080 130"
            preserveAspectRatio="none"
            className="animate-swell absolute inset-x-0 -top-[74px] h-[150px] w-full"
          >
            {/* Back — faint, slow, wide rounded swells */}
            <g className="animate-wave-slow">
              <path
                d="M-120 95 q30 -34 60 0 q30 -52 60 0 q30 -34 60 0 q30 -52 60 0 q30 -34 60 0 q30 -52 60 0 q30 -34 60 0 q30 -52 60 0 q30 -34 60 0 q30 -52 60 0 q30 -34 60 0 q30 -52 60 0 q30 -34 60 0 q30 -52 60 0 q30 -34 60 0 q30 -52 60 0 q30 -34 60 0 q30 -52 60 0 q30 -34 60 0 q30 -52 60 0 q30 -34 60 0 q30 -52 60 0 q30 -34 60 0 q30 -52 60 0 V130 H-120 Z"
                fill="rgba(87,146,156,.35)"
              />
            </g>
            {/* Mid — medium, mixed widths */}
            <g className="animate-wave">
              <path
                d="M-120 95 q20 -60 40 0 q40 -30 80 0 q20 -60 40 0 q40 -30 80 0 q20 -60 40 0 q40 -30 80 0 q20 -60 40 0 q40 -30 80 0 q20 -60 40 0 q40 -30 80 0 q20 -60 40 0 q40 -30 80 0 q20 -60 40 0 q40 -30 80 0 q20 -60 40 0 q40 -30 80 0 q20 -60 40 0 q40 -30 80 0 q20 -60 40 0 q40 -30 80 0 q20 -60 40 0 q40 -30 80 0 q20 -60 40 0 q40 -30 80 0 V130 H-120 Z"
                fill="rgba(87,146,156,.55)"
              />
            </g>
            {/* Front — solid, fast, rounded rolling swells with a sunlit foam crest */}
            <g className="animate-wave-fast">
              <path
                d="M-120 95 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 V130 H-120 Z"
                fill="#57929c"
              />
              <path
                d="M-120 95 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0 q30 -66 60 0 q30 -40 60 0"
                fill="none"
                stroke="rgba(241,255,250,.4)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          </svg>
          <div className="tank-water absolute inset-0 overflow-hidden">
            {BUBBLES.map((b, i) => (
              <span
                key={i}
                className={
                  b.short ? "animate-bubble-short absolute rounded-full" : "animate-bubble absolute rounded-full"
                }
                style={{
                  left: b.left,
                  bottom: b.bottom,
                  width: b.size,
                  height: b.size,
                  backgroundColor: b.color,
                  animationDuration: b.duration,
                  animationDelay: b.delay,
                }}
              />
            ))}
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-[1180px]">
          {/* Centered reservoir headline floating over the sky */}
          <Reservoir performance={performance} />

          {/* Stat cards straddling the waterline: Score · F&G · RSI · BTC (frosted
              glass) + the solid Next-buy card with its actions */}
          <div className="mt-8 flex flex-wrap items-stretch justify-center gap-4">
            {indicators && (
              <>
                <ScoreReadout indicators={indicators} />
                <FearGreedReadout indicators={indicators} />
                <RsiReadout indicators={indicators} />
              </>
            )}
            <BtcReadout indicators={indicators} performance={performance} />
            <NextBuyActions
              indicators={indicators}
              settings={settings}
              status={status}
              onTestBuy={onTestBuy}
              onSimulate={onSimulate}
              onTogglePanel={() => setPanelOpen((v) => !v)}
              panelOpen={panelOpen}
              running={running}
            />
          </div>

          {/* Collapsible faucet control bar (amount · schedule · Discord · pause) */}
          <FaucetControls
            open={panelOpen}
            settings={settings}
            indicators={indicators}
            onClose={() => setPanelOpen(false)}
            onSave={onSaveSettings}
            onPause={onPause}
            onResume={onResume}
            onTestWebhook={onTestWebhook}
          />

          {runResult?.analysis && (
            <div className="mt-5 flex justify-center">
              <div className="rounded-lg bg-cream/85 px-3 py-1.5 text-xs font-bold text-teal shadow-sm">
                {runResult.analysis.signal} &middot; would buy{" "}
                {fmtEur(runResult.purchase?.amount_eur ?? 0)}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/** The centered headline: portfolio value with the P&L on a single line. */
function Reservoir({ performance }: { performance: Performance | null }) {
  const profitable = (performance?.profit_eur ?? 0) >= 0;
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
          <div className="mt-1.5 font-display text-6xl font-semibold leading-[0.9] tracking-tight text-cream md:text-[78px]">
            {valueMain}
            <span className="text-cream/70">{valueCents}</span>
          </div>
          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 text-[15px] font-bold md:text-[17px]">
            <span
              className={`inline-flex items-center gap-1.5 ${profitable ? "text-cream" : "text-rose"}`}
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

/**
 * Interactive Dry run / Live segmented switch, now living in the sticky bar.
 * Going Live is guarded by the shared LiveModeDialog (real-money confirmation);
 * going back to Dry run — the safe direction — applies immediately.
 */
function ModeToggle({
  status,
  settings,
  onSetDryRun,
}: {
  status: BotStatus;
  settings: BotSettings | null;
  onSetDryRun: (dry: boolean) => void;
}) {
  const [confirmLive, setConfirmLive] = useState(false);
  const dry = status.dry_run;
  const seg =
    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";

  return (
    <>
      <div
        role="group"
        aria-label="Trading mode"
        className="flex items-center gap-0.5 rounded-full bg-teal/12 p-0.5"
      >
        <button
          type="button"
          aria-pressed={dry}
          onClick={() => !dry && onSetDryRun(true)}
          className={`${seg} ${dry ? "bg-cream text-teal shadow-sm" : "text-teal/70 hover:text-teal"}`}
        >
          <FlaskIcon /> Dry run
        </button>
        <button
          type="button"
          aria-pressed={!dry}
          onClick={() => dry && setConfirmLive(true)}
          className={`${seg} ${!dry ? "bg-rose text-cream shadow-sm" : "text-teal/70 hover:text-teal"}`}
        >
          <LightningIcon /> Live
        </button>
      </div>
      {confirmLive && settings && (
        <LiveModeDialog
          settings={settings}
          onCancel={() => setConfirmLive(false)}
          onConfirm={() => {
            setConfirmLive(false);
            onSetDryRun(false);
          }}
        />
      )}
    </>
  );
}

/** Shared frosted-glass chip that floats the stat read-outs on the waterline. */
const FROST_CARD =
  "flex flex-col rounded-[18px] border border-cream/40 bg-cream/[0.18] px-[18px] py-[15px] text-cream shadow-[0_16px_34px_-18px_rgba(0,0,0,.5)] backdrop-blur-[9px]";

/** Score: five potency drops, the score fraction, and the buy multiplier. */
function ScoreReadout({ indicators }: { indicators: Indicators }) {
  const potency = potencyFromMultiplier(indicators.multiplier);
  return (
    <div className={`${FROST_CARD} w-[172px]`}>
      <div
        className="mb-2 flex items-center gap-1"
        role="img"
        aria-label={`Buy strength ${potency} of 5`}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <DropFillIcon
            key={i}
            className={`text-[15px] ${i <= potency ? "text-cream" : "text-cream/25"}`}
          />
        ))}
      </div>
      <div className="font-display text-3xl font-semibold leading-none">
        {indicators.score}
        <span className="text-lg text-cream/70">/{indicators.score_max}</span>
      </div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-cream/72">
        Score &middot; x{indicators.multiplier}
      </div>
    </div>
  );
}

/** Fear & Greed: the cream semicircle gauge, its value, and the classification. */
function FearGreedReadout({ indicators }: { indicators: Indicators }) {
  return (
    <div className={`${FROST_CARD} w-[172px]`}>
      <FearGreedArc value={indicators.fear_greed} />
      <div className="mt-0.5 font-display text-3xl font-semibold leading-none">
        {indicators.fear_greed}
      </div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-cream/72">
        {indicators.fng_classification}
      </div>
    </div>
  );
}

/** RSI: label + big value on one baseline, with the bar and knob below. */
function RsiReadout({ indicators }: { indicators: Indicators }) {
  const rsi = Math.round(indicators.rsi);
  const rsiLabel =
    indicators.rsi < 30
      ? "Oversold"
      : indicators.rsi > 70
        ? "Overbought"
        : "Neutral";
  const pos = Math.max(0, Math.min(100, rsi));

  return (
    <div className={`${FROST_CARD} w-[210px] justify-center`}>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-cream/72">
          RSI &middot; {rsiLabel}
        </span>
        <span className="font-display text-[26px] font-semibold leading-none">
          {rsi}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-cream/22">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-cream"
          style={{ width: `${pos}%` }}
        />
        <div
          className="absolute top-1/2 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream shadow-[0_0_0_4px_rgba(60,109,120,0.5)]"
          style={{ left: `${pos}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[9px] font-semibold text-cream/50">
        <span>Oversold</span>
        <span>Overbought</span>
      </div>
    </div>
  );
}

/** The cream semicircle gauge behind the Fear & Greed number. */
function FearGreedArc({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const arcLen = 131.9; // π · r with r = 42
  const offset = arcLen * (1 - clamped / 100);
  return (
    <svg viewBox="0 0 100 58" className="block h-[42px] w-[76px]">
      <path
        d="M8 50 A42 42 0 0 1 92 50"
        fill="none"
        stroke="rgba(241,255,250,.22)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M8 50 A42 42 0 0 1 92 50"
        fill="none"
        stroke="#f1fffa"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={arcLen}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

/** BTC spot price with the 350-day average and its distance underneath. */
function BtcReadout({
  indicators,
  performance,
}: {
  indicators: Indicators | null;
  performance: Performance | null;
}) {
  return (
    <div className={`${FROST_CARD} w-[210px] justify-center`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-cream/72">
        BTC price
      </div>
      <div className="mt-1 font-display text-3xl font-semibold leading-none">
        {performance ? fmtEur(performance.current_price, 0) : "—"}
      </div>
      <div className="mt-1.5 text-[11px] font-semibold text-cream/80">
        {indicators
          ? `350‑day avg ${fmtEur(indicators.ma_350, 0)} · ${fmtPct(indicators.ma_distance_pct)}`
          : "—"}
      </div>
    </div>
  );
}

/**
 * Next scheduled buy — now a button that opens the faucet control bar — plus the
 * dry-run test and simulate actions.
 */
function NextBuyActions({
  indicators,
  settings,
  status,
  onTestBuy,
  onSimulate,
  onTogglePanel,
  panelOpen,
  running,
}: {
  indicators: Indicators | null;
  settings: BotSettings | null;
  status: BotStatus | null;
  onTestBuy: () => void;
  onSimulate: () => void;
  onTogglePanel: () => void;
  panelOpen: boolean;
  running: boolean;
}) {
  const nextWhen = status?.next_run
    ? formatDateTime(status.next_run)
    : settings
      ? `${WEEKDAYS[settings.schedule_weekday].slice(0, 3)} ${settings.schedule_time}`
      : "—";
  const nextAmount =
    settings && indicators
      ? fmtEur(settings.base_amount_eur * indicators.multiplier)
      : "—";

  return (
    <div className="flex w-[210px] flex-col rounded-[18px] bg-cream px-[18px] py-[15px] shadow-[0_18px_38px_-16px_rgba(0,0,0,.55)]">
      <button
        type="button"
        onClick={onTogglePanel}
        aria-expanded={panelOpen}
        aria-label="Adjust the next buy"
        className="flex items-center gap-1.5 rounded-md text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#5c8a91] transition hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      >
        <span className="whitespace-nowrap">Next buy &middot; {nextWhen}</span>
        <span className="rounded-full bg-teal px-1.5 py-px text-[8px] tracking-[0.05em] text-cream">
          ADJUST
        </span>
        <CaretDownIcon
          className={`ml-auto text-sm transition-transform duration-300 ${panelOpen ? "rotate-180" : ""}`}
        />
      </button>
      <div className="mt-1 font-display text-3xl font-semibold leading-none text-[#2f5a63]">
        {nextAmount}
      </div>
      <div className="mt-3 flex gap-1.5">
        <button
          onClick={onTestBuy}
          disabled={running}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-teal py-[7px] text-[11px] font-bold text-cream transition hover:bg-teal/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-60"
        >
          <PlayIcon /> {running ? "Testing…" : "Test"}
        </button>
        <button
          onClick={onSimulate}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-teal/14 py-[7px] text-[11px] font-bold text-teal transition hover:bg-teal/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        >
          <ChartLineUpIcon /> Sim
        </button>
      </div>
    </div>
  );
}

const PAUSE_OPTIONS = [
  { label: "Running", days: 0 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "4 weeks", days: 28 },
];

/**
 * The collapsible glass control bar that folds the old Settings page into the
 * hero: amount stepper, schedule, Discord and pause — each persisting on change
 * through App. Slides open/closed on `open` via a max-height/opacity transition.
 */
function FaucetControls({
  open,
  settings,
  indicators,
  onClose,
  onSave,
  onPause,
  onResume,
  onTestWebhook,
}: {
  open: boolean;
  settings: BotSettings | null;
  indicators: Indicators | null;
  onClose: () => void;
  onSave: (update: Partial<BotSettings>) => Promise<void>;
  onPause: (days: number) => Promise<void>;
  onResume: () => Promise<void>;
  onTestWebhook: () => Promise<boolean>;
}) {
  const [saved, setSaved] = useState(false);
  const [webhookSent, setWebhookSent] = useState(false);
  const [testing, setTesting] = useState(false);

  const flashSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };
  const save = async (update: Partial<BotSettings>) => {
    await onSave(update);
    flashSaved();
  };

  const testWebhook = async () => {
    setTesting(true);
    setWebhookSent(false);
    try {
      const sent = await onTestWebhook();
      setWebhookSent(sent);
      window.setTimeout(() => setWebhookSent(false), 3000);
    } finally {
      setTesting(false);
    }
  };

  const isPaused =
    settings?.paused_until != null &&
    new Date(settings.paused_until) >= new Date(new Date().toDateString());

  const field =
    "rounded-lg border border-cream/30 bg-cream/15 px-2.5 py-1.5 text-[13px] font-bold text-cream outline-none [color-scheme:dark] focus:border-cream/70";
  const stepBtn =
    "flex h-7 w-7 items-center justify-center rounded-lg bg-cream/15 text-lg leading-none text-cream transition hover:bg-cream/30";
  const groupLabel =
    "text-[10px] font-bold uppercase tracking-[0.14em] text-cream/60";
  const barDivider = "h-8 w-px bg-cream/20 max-md:hidden";

  return (
    <div
      className={`overflow-hidden transition-[max-height,opacity,margin-top] duration-400 ${
        open ? "mt-4 max-h-[520px] opacity-100" : "mt-0 max-h-0 opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-[1000px] flex-wrap items-center justify-center gap-x-1 gap-y-2 rounded-[20px] border border-cream/20 bg-teal/95 p-2.5 text-cream shadow-[0_24px_60px_-24px_rgba(0,0,0,.45)] backdrop-blur-md">
        {settings ? (
          <>
            {/* Amount */}
            <div className="flex items-center gap-2.5 px-4 py-1.5">
              <span className={groupLabel}>Drip</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Less"
                  onClick={() =>
                    save({
                      base_amount_eur: Math.max(5, settings.base_amount_eur - 5),
                    })
                  }
                  className={stepBtn}
                >
                  &minus;
                </button>
                <span className="min-w-[56px] text-center font-display text-xl font-semibold">
                  {fmtEur(settings.base_amount_eur, 0)}
                </span>
                <button
                  type="button"
                  aria-label="More"
                  onClick={() =>
                    save({
                      base_amount_eur: Math.min(
                        500,
                        settings.base_amount_eur + 5,
                      ),
                    })
                  }
                  className={stepBtn}
                >
                  +
                </button>
              </div>
              {indicators && (
                <span className="whitespace-nowrap text-xs text-cream/72">
                  &times; {indicators.multiplier} &rarr;{" "}
                  <b>
                    {fmtEur(settings.base_amount_eur * indicators.multiplier)}
                  </b>
                </span>
              )}
            </div>

            <div className={barDivider} />

            {/* Schedule */}
            <div className="flex items-center gap-2 px-4 py-1.5">
              <span className={groupLabel}>Every</span>
              <select
                value={settings.schedule_weekday}
                onChange={(e) =>
                  save({ schedule_weekday: Number(e.target.value) })
                }
                className={`${field} cursor-pointer`}
              >
                {WEEKDAYS.map((day, idx) => (
                  <option key={day} value={idx}>
                    {day}
                  </option>
                ))}
              </select>
              <span className="text-xs text-cream/60">at</span>
              <input
                type="time"
                value={settings.schedule_time}
                onChange={(e) => save({ schedule_time: e.target.value })}
                className={field}
              />
            </div>

            <div className={barDivider} />

            {/* Discord */}
            <div className="flex items-center gap-2 px-4 py-1.5">
              <span className={groupLabel}>Discord</span>
              <MiniToggle
                checked={settings.discord_enabled}
                onChange={(v) => save({ discord_enabled: v })}
              />
              <button
                type="button"
                aria-label="Send test message"
                title="Send test message"
                onClick={testWebhook}
                disabled={testing}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-cream/15 text-cream transition hover:bg-cream/30 disabled:opacity-50"
              >
                <PaperPlaneIcon className="text-sm" />
              </button>
              {webhookSent && (
                <span className="text-[11px] font-bold text-cream">
                  Sent &#10003;
                </span>
              )}
            </div>

            <div className={barDivider} />

            {/* Pause */}
            <div className="flex items-center gap-2 px-4 py-1.5">
              <span className={groupLabel}>Pause</span>
              {isPaused ? (
                <>
                  <span className="inline-flex items-center rounded-full bg-rose/60 px-2.5 py-1 text-xs font-bold text-cream">
                    until{" "}
                    {new Date(settings.paused_until!).toLocaleDateString(
                      "en-GB",
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={onResume}
                    className="flex items-center gap-1 rounded-lg bg-cream px-3 py-1.5 text-xs font-bold text-teal transition hover:bg-white"
                  >
                    <PlayIcon /> Resume
                  </button>
                </>
              ) : (
                <select
                  value={0}
                  onChange={(e) => {
                    const days = Number(e.target.value);
                    if (days > 0) onPause(days);
                  }}
                  className={`${field} cursor-pointer`}
                >
                  {PAUSE_OPTIONS.map((p) => (
                    <option key={p.days} value={p.days}>
                      {p.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className={barDivider} />

            {/* Saved flag + close */}
            <div className="flex items-center gap-2 py-1.5 pl-2 pr-2.5">
              {saved && (
                <span className="inline-flex items-center rounded-full bg-cream/90 px-2.5 py-1 text-[11px] font-bold text-teal">
                  Saved &#10003;
                </span>
              )}
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-cream/15 text-cream transition hover:bg-cream/30"
              >
                <XIcon className="text-sm" />
              </button>
            </div>
          </>
        ) : (
          <div className="px-4 py-3 text-xs font-bold text-cream/70">
            Loading settings…
          </div>
        )}
      </div>
    </div>
  );
}

/** A compact cream-on-glass switch for the faucet control bar. */
function MiniToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 flex-none rounded-full border-2 transition ${
        checked ? "border-cream bg-cream/80" : "border-cream/50 bg-cream/15"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper shadow-sm transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function HeaderPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-2.5 py-1.5 text-[11px] font-bold text-teal">
      {children}
    </span>
  );
}

/** True once the scroll container has moved past `threshold` px — drives the
 *  sticky bar's condensed (blurred teal) background. */
function useScrolled(
  scrollRef: RefObject<HTMLDivElement | null>,
  threshold = 40,
): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => setScrolled(root.scrollTop > threshold);
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [scrollRef, threshold]);

  return scrolled;
}

/** Highlights the nav entry for whichever section is most in view. */
function useScrollSpy(scrollRef: RefObject<HTMLDivElement | null>): Section {
  const [active, setActive] = useState<Section>("overview");

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const sections = NAV.map((n) => document.getElementById(n.id)).filter(
      (el): el is HTMLElement => el != null,
    );
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id as Section);
      },
      { root, rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [scrollRef]);

  return active;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[(d.getDay() + 6) % 7].slice(0, 3)} ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
