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
 * The signature gradient hero that opens the app: an app bar (brand + jump-nav
 * with scroll-spy), the "reservoir" headline with live P&L, a visual signal
 * cluster (Fear & Greed arc, score drops, RSI bar), and the market + next-buy
 * strip — all riding over the rolling waterline. Not sticky: it scrolls away,
 * but the nav still smooth-scrolls to each section and highlights the one in view.
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
    <header className="hero-gradient relative shrink-0 overflow-hidden px-6 pb-14 pt-5 text-cream md:px-10 md:pb-16">
      {/* App bar: brand (left) + jump-nav (right) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-cream/15 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream/20 text-xl">
            <DropFillIcon />
          </span>
          <span className="font-display text-2xl font-bold">Drip</span>
          <span className="ml-0.5 text-[11px] font-bold uppercase tracking-[0.16em] text-cream/70 max-sm:hidden">
            Bitcoin&nbsp;DCA
          </span>
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

      {/* Hero body: reservoir · signals · market + plan */}
      <div className="flex flex-wrap items-stretch gap-x-8 gap-y-8">
        <Reservoir
          performance={performance}
          status={status}
          onSimulate={onSimulate}
        />

        <Divider />

        {indicators && <SignalCluster indicators={indicators} />}

        <Divider />

        <MarketPlanStrip
          indicators={indicators}
          performance={performance}
          settings={settings}
          status={status}
          onTestBuy={onTestBuy}
          running={running}
          runResult={runResult}
        />
      </div>

      {/* Rolling waterline */}
      <svg
        viewBox="0 0 1080 46"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-px h-[54px] w-full"
      >
        <g className="animate-wave">
          <path
            d="M-120 32 q30 -11 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 V70 H-120 Z"
            fill="rgba(241,255,250,.55)"
          />
        </g>
        <g className="animate-wave-fast">
          <path
            d="M-120 28 q30 -14 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 V70 H-120 Z"
            fill="#f1fffa"
          />
        </g>
      </svg>
    </header>
  );
}

/** A hairline separator between hero clusters; folds away when they wrap. */
function Divider() {
  return <div className="w-px self-stretch bg-cream/18 max-xl:hidden" />;
}

/** The headline: portfolio value, P&L, the invested·buys·BTC line, actions. */
function Reservoir({
  performance,
  status,
  onSimulate,
}: {
  performance: Performance | null;
  status: BotStatus | null;
  onSimulate: () => void;
}) {
  const profitable = (performance?.profit_eur ?? 0) >= 0;

  return (
    <div className="min-w-[210px]">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-cream/80">
        Your reservoir
      </div>
      {performance ? (
        <>
          <div className="mt-2 font-display text-5xl font-semibold leading-[0.95] md:text-6xl">
            {fmtEur(performance.value_eur)}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[15px] font-bold">
            {profitable ? <TrendUpIcon /> : <TrendDownIcon />}
            {profitable ? "+" : ""}
            {fmtEur(performance.profit_eur)}
            <span className="font-semibold text-cream/75">
              {fmtPct(performance.profit_pct)}
            </span>
          </div>
          <div className="mt-2 text-xs font-medium text-cream/75">
            {fmtEur(performance.invested_eur)} invested &middot;{" "}
            {performance.purchase_count} buys &middot;{" "}
            {fmtBtc(performance.btc_total)}
          </div>
        </>
      ) : (
        <>
          <div className="mt-2 h-14 w-44 animate-pulse rounded-xl bg-cream/20" />
          <div className="mt-3 h-5 w-52 animate-pulse rounded-lg bg-cream/15" />
        </>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={onSimulate}
          className="flex items-center gap-1.5 rounded-full bg-cream px-4 py-2 text-xs font-bold text-teal shadow-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
        >
          <ChartLineUpIcon /> Simulate
        </button>
        {status && <ModePills status={status} />}
      </div>
    </div>
  );
}

/** Bot-mode + warning pills that sit under the reservoir headline. */
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

/** Three at-a-glance signals: Fear & Greed arc, score drops, RSI bar. */
function SignalCluster({ indicators }: { indicators: Indicators }) {
  const potency = potencyFromMultiplier(indicators.multiplier);
  const rsi = Math.round(indicators.rsi);
  const rsiLabel = indicators.rsi < 30 ? "Oversold" : indicators.rsi > 70 ? "Overbought" : "Neutral";

  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-6">
      {/* Fear & Greed arc */}
      <div className="text-center">
        <FearGreedArc value={indicators.fear_greed} />
        <div className="-mt-1 font-display text-2xl font-semibold leading-none">
          {indicators.fear_greed}
        </div>
        <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-cream/60">
          {indicators.fng_classification}
        </div>
      </div>

      {/* Score drops */}
      <div className="text-center">
        <div className="flex h-[34px] items-end justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <DropFillIcon
              key={i}
              className={`text-xl ${i <= potency ? "text-cream" : "text-cream/25"}`}
            />
          ))}
        </div>
        <div className="mt-1.5 font-display text-2xl font-semibold leading-none">
          {indicators.score}/{indicators.score_max}
        </div>
        <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-cream/60">
          Score &middot; x{indicators.multiplier}
        </div>
      </div>

      {/* RSI bar */}
      <div className="w-[150px]">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-cream/60">
            RSI
          </span>
          <span className="font-display text-[22px] font-semibold leading-none">{rsi}</span>
        </div>
        <div className="relative h-[7px] rounded-full bg-cream/20">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-cream"
            style={{ width: `${Math.max(0, Math.min(100, rsi))}%` }}
          />
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream shadow-[0_0_0_3px_rgba(69,129,140,0.5)]"
            style={{ left: `${Math.max(0, Math.min(100, rsi))}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[9px] font-semibold text-cream/50">
          <span>Oversold</span>
          <span>{rsiLabel}</span>
          <span>Overbought</span>
        </div>
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
    <svg viewBox="0 0 100 58" className="mx-auto block h-[60px] w-[104px]">
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

/** Market read-outs plus the next scheduled buy and a dry-run test action. */
function MarketPlanStrip({
  indicators,
  performance,
  settings,
  status,
  onTestBuy,
  running,
  runResult,
}: {
  indicators: Indicators | null;
  performance: Performance | null;
  settings: BotSettings | null;
  status: BotStatus | null;
  onTestBuy: () => void;
  running: boolean;
  runResult: RunResult | null;
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
    <div className="flex min-w-[220px] flex-col gap-3">
      <div className="flex gap-6">
        <Metric
          label="BTC price"
          value={performance ? fmtEur(performance.current_price, 0) : "—"}
        />
        <Metric
          label="350-day avg"
          value={indicators ? fmtEur(indicators.ma_350, 0) : "—"}
          sub={indicators ? `price ${fmtPct(indicators.ma_distance_pct)}` : undefined}
        />
      </div>
      <div className="flex items-center gap-3 rounded-xl bg-cream/12 px-3.5 py-2.5">
        <div className="flex-1">
          <div className="text-[10px] font-semibold text-cream/70">
            Next buy &middot; {nextWhen}
          </div>
          <div className="font-display text-lg font-semibold">{nextAmount}</div>
        </div>
        <button
          onClick={onTestBuy}
          disabled={running}
          className="flex items-center gap-1.5 rounded-full bg-cream px-3.5 py-2 text-xs font-bold text-teal shadow-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream disabled:opacity-60"
        >
          <PlayIcon /> {running ? "Testing…" : "Test a buy"}
        </button>
      </div>
      {runResult?.analysis && (
        <div className="rounded-lg bg-cream/15 px-3 py-1.5 text-xs font-bold text-cream">
          {runResult.analysis.signal} &middot; would buy{" "}
          {fmtEur(runResult.purchase?.amount_eur ?? 0)}
        </div>
      )}
    </div>
  );
}

/** A small labelled read-out on the gradient (no background). */
function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-cream/60">
        {label}
      </div>
      <div className="mt-0.5 font-display text-xl font-semibold">{value}</div>
      {sub && <div className="text-[11px] font-medium text-cream/70">{sub}</div>}
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
