import { useEffect, useState, type ReactNode, type RefObject } from "react";
import ChartLineUpIcon from "~icons/ph/chart-line-up";
import DropFillIcon from "~icons/ph/drop-fill";
import DropSlashIcon from "~icons/ph/drop-slash";
import FlaskIcon from "~icons/ph/flask";
import KeyIcon from "~icons/ph/key";
import LightningIcon from "~icons/ph/lightning-fill";
import ListDashesIcon from "~icons/ph/list-dashes";
import PlayIcon from "~icons/ph/play-fill";
import SlidersIcon from "~icons/ph/sliders-horizontal";
import TrendDownIcon from "~icons/ph/trend-down";
import TrendUpIcon from "~icons/ph/trend-up";
import {
  fmtBtc,
  fmtEur,
  fmtPct,
  WEEKDAYS,
  type BotSettings,
  type BotStatus,
  type Indicators,
  type Performance,
  type RunResult,
} from "../api/client";
import { potencyFromMultiplier } from "./drops";

export type Section = "overview" | "settings" | "history";

export const NAV: { id: Section; label: string; Icon: typeof DropFillIcon }[] = [
  { id: "overview", label: "Overview", Icon: ChartLineUpIcon },
  { id: "settings", label: "Settings", Icon: SlidersIcon },
  { id: "history", label: "History", Icon: ListDashesIcon },
];

/**
 * The signature gradient hero that opens the app — the "2b" centered layout:
 * an app bar (brand + mode pills on the left, jump-nav with scroll-spy on the
 * right), a centered "reservoir" headline with the P&L on a single line, and one
 * unified read-out row (Score · Fear & Greed · RSI · BTC · next buy + actions)
 * riding over the rolling waterline. Not sticky: it scrolls away, but the nav
 * still smooth-scrolls to each section and highlights the one in view.
 */
export default function SiteHeader({
  status,
  settings,
  indicators,
  performance,
  scrollRef,
  onSimulate,
  onTestBuy,
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
  running: boolean;
  runResult: RunResult | null;
}) {
  const active = useScrollSpy(scrollRef);

  const jumpTo = (id: Section) => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header className="hero-gradient relative shrink-0 overflow-hidden px-6 pb-24 pt-5 text-cream md:px-10 md:pb-28">
      <div className="mx-auto max-w-[1180px]">
        {/* App bar: brand + mode pills (left) · jump-nav (right) */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <DropFillIcon className="text-3xl leading-none" />
              <span className="font-display text-2xl font-bold leading-none">
                Drip
              </span>
            </div>
            {status && (
              <div className="flex flex-wrap items-center gap-1.5">
                <ModePills status={status} />
              </div>
            )}
          </div>
          <nav className="flex gap-1.5">
            {NAV.map(({ id, label, Icon }) => {
              const on = active === id;
              return (
                <button
                  key={id}
                  onClick={() => jumpTo(id)}
                  aria-current={on ? "true" : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream ${
                    on
                      ? "bg-cream/95 text-teal shadow-sm"
                      : "bg-cream/20 text-cream hover:bg-cream/30"
                  }`}
                >
                  <Icon className="text-sm" />
                  <span className="max-sm:hidden">{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Centered reservoir headline with the P&L on a single line */}
        <Reservoir performance={performance} />

        {/* Unified read-out row: Score · F&G · RSI · BTC · next buy + actions */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-6">
          {indicators && (
            <>
              <ScoreReadout indicators={indicators} />
              <Divider />
              <FearGreedReadout indicators={indicators} />
              <Divider />
              <RsiReadout indicators={indicators} />
              <Divider />
            </>
          )}
          <BtcReadout indicators={indicators} performance={performance} />
          <Divider />
          <NextBuyActions
            indicators={indicators}
            settings={settings}
            status={status}
            onTestBuy={onTestBuy}
            onSimulate={onSimulate}
            running={running}
          />
        </div>

        {runResult?.analysis && (
          <div className="mt-5 flex justify-center">
            <div className="rounded-lg bg-cream/15 px-3 py-1.5 text-xs font-bold text-cream">
              {runResult.analysis.signal} &middot; would buy{" "}
              {fmtEur(runResult.purchase?.amount_eur ?? 0)}
            </div>
          </div>
        )}
      </div>

      {/* Rolling waterline */}
      <svg
        viewBox="0 0 1080 46"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-px h-[70px] w-full"
      >
        <g className="animate-wave">
          <path
            d="M-120 32 q30 -11 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 V70 H-120 Z"
            fill="rgba(241,255,250,.35)"
          />
        </g>
        <g className="animate-wave-fast">
          <path
            d="M-120 28 q30 -14 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 V70 H-120 Z"
            fill="rgba(241,255,250,.6)"
          />
        </g>
      </svg>
    </header>
  );
}

/** A hairline separator between read-out items; folds away when they wrap. */
function Divider() {
  return <div className="h-16 w-px bg-cream/20 max-lg:hidden" />;
}

/** The centered headline: portfolio value with the P&L on a single line. */
function Reservoir({ performance }: { performance: Performance | null }) {
  const profitable = (performance?.profit_eur ?? 0) >= 0;

  return (
    <div className="mt-8 text-center">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-cream/80">
        Your reservoir
      </div>
      {performance ? (
        <>
          <div className="mt-1 font-display text-6xl font-semibold leading-[0.9] tracking-tight md:text-[78px]">
            {fmtEur(performance.value_eur)}
          </div>
          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 text-[15px] font-bold md:text-[17px]">
            <span className="inline-flex items-center gap-1.5">
              {profitable ? <TrendUpIcon /> : <TrendDownIcon />}
              {profitable ? "+" : ""}
              {fmtEur(performance.profit_eur)}
            </span>
            <span className="text-cream/50">&middot;</span>
            <span className="font-semibold text-cream/80">
              {fmtPct(performance.profit_pct)}
            </span>
            <span className="text-cream/50 max-sm:hidden">&middot;</span>
            <span className="text-sm font-medium text-cream/75 max-sm:w-full">
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

/** Bot-mode + warning pills that sit under the brand in the app bar. */
function ModePills({ status }: { status: BotStatus }) {
  return (
    <>
      <HeaderPill>
        {status.dry_run ? (
          <>
            <FlaskIcon /> Dry run
          </>
        ) : (
          <>
            <LightningIcon /> Live
          </>
        )}
      </HeaderPill>
      {status.paused && status.paused_until && (
        <HeaderPill>
          <DropSlashIcon /> Off until {formatDate(status.paused_until)}
        </HeaderPill>
      )}
      {!status.has_credentials && (
        <HeaderPill>
          <KeyIcon /> No API keys
        </HeaderPill>
      )}
    </>
  );
}

/** Score: five potency drops, the score fraction, and the buy multiplier. */
function ScoreReadout({ indicators }: { indicators: Indicators }) {
  const potency = potencyFromMultiplier(indicators.multiplier);
  return (
    <div className="text-center">
      <div
        className="mb-1.5 flex items-center justify-center gap-1.5"
        role="img"
        aria-label={`Buy strength ${potency} of 5`}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <DropFillIcon
            key={i}
            className={`text-xl ${i <= potency ? "text-cream" : "text-cream/25"}`}
          />
        ))}
      </div>
      <div className="font-display text-3xl font-semibold leading-none">
        {indicators.score}
        <span className="text-xl text-cream/70">/{indicators.score_max}</span>
      </div>
      <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-cream/65">
        Score &middot; x{indicators.multiplier}
      </div>
    </div>
  );
}

/** Fear & Greed: the cream semicircle gauge, its value, and the classification. */
function FearGreedReadout({ indicators }: { indicators: Indicators }) {
  return (
    <div className="text-center">
      <FearGreedArc value={indicators.fear_greed} />
      <div className="-mt-0.5 font-display text-3xl font-semibold leading-none">
        {indicators.fear_greed}
      </div>
      <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-cream/65">
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
    <div className="w-[190px]">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-cream/65">
          RSI &middot; {rsiLabel}
        </span>
        <span className="font-display text-3xl font-semibold leading-none">
          {rsi}
        </span>
      </div>
      <div className="relative h-[9px] rounded-full bg-cream/20">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-cream"
          style={{ width: `${pos}%` }}
        />
        <div
          className="absolute top-1/2 h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream shadow-[0_0_0_4px_rgba(69,129,140,0.5)]"
          style={{ left: `${pos}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-semibold text-cream/50">
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
    <svg viewBox="0 0 100 58" className="mx-auto block h-[56px] w-[100px]">
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
    <div className="text-center">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-cream/65">
        BTC price
      </div>
      <div className="mt-1 font-display text-3xl font-semibold leading-none">
        {performance ? fmtEur(performance.current_price, 0) : "—"}
      </div>
      <div className="mt-1.5 text-xs font-semibold text-cream/72">
        {indicators
          ? `350-day avg ${fmtEur(indicators.ma_350, 0)} · ${fmtPct(indicators.ma_distance_pct)}`
          : "—"}
      </div>
    </div>
  );
}

/** Next scheduled buy plus the dry-run test and simulate actions. */
function NextBuyActions({
  indicators,
  settings,
  status,
  onTestBuy,
  onSimulate,
  running,
}: {
  indicators: Indicators | null;
  settings: BotSettings | null;
  status: BotStatus | null;
  onTestBuy: () => void;
  onSimulate: () => void;
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
    <div className="flex items-center gap-4">
      <div className="text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-cream/65">
          Next buy &middot; {nextWhen}
        </div>
        <div className="mt-1 font-display text-3xl font-semibold leading-none">
          {nextAmount}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <button
          onClick={onTestBuy}
          disabled={running}
          className="flex items-center justify-center gap-1.5 rounded-full bg-cream px-4 py-2 text-xs font-bold text-teal shadow-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream disabled:opacity-60"
        >
          <PlayIcon /> {running ? "Testing…" : "Test a buy"}
        </button>
        <button
          onClick={onSimulate}
          className="flex items-center justify-center gap-1.5 rounded-full bg-cream/20 px-4 py-2 text-xs font-bold text-cream transition hover:bg-cream/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
        >
          <ChartLineUpIcon /> Simulate
        </button>
      </div>
    </div>
  );
}

export function HeaderPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/20 px-3 py-1.5 text-xs font-bold text-cream">
      {children}
    </span>
  );
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
