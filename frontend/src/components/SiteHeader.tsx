import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import DropFillIcon from "~icons/ph/drop-fill";
import DropSlashIcon from "~icons/ph/drop-slash";
import type {
  AccountBalance,
  BotSettings,
  BotStatus,
  DigestSettings,
  DigestUpdate,
  Indicators,
  Performance,
  RunResult,
} from "../api/client";
import { isPaletteShortcut } from "../lib/commands";
import { fmtEur, formatDayMonth } from "../lib/format";
import type { ThemeChoice } from "../lib/theme";
import { useUnit } from "../lib/units";
import DigestDialog from "./digest/DigestDialog";
import FaucetControls from "./header/FaucetControls";
import { NAV, useScrolled, useScrollSpy, type Section } from "./header/hooks";
import ModeToggle from "./header/ModeToggle";
import NextBuyActions from "./header/NextBuyActions";
import {
  BtcReadout,
  MarketReadout,
  SignalReadout,
  WellReadout,
} from "./header/Readouts";
import ReportBadge from "./header/ReportBadge";
import Reservoir from "./header/Reservoir";
import Splash from "./header/Splash";
import SetupButton from "./header/SetupButton";
import SignalBreakdown from "./header/SignalBreakdown";
import TankBackdrop from "./header/TankBackdrop";
import ThemeToggle from "./header/ThemeToggle";
import VersionBadge from "./header/VersionBadge";
import ManualBuyDialog from "./ManualBuyDialog";
import { buildCommands } from "./palette/buildCommands";
import CommandPalette from "./palette/CommandPalette";
import PaletteButton from "./palette/PaletteButton";
import SetupDialog, { type SetupTab } from "./setup/SetupDialog";

/**
 * The signature gradient hero that opens the app — the whole command center.
 *
 * This file is only the composition: the sticky bar (brand, mode toggle,
 * jump-nav) and the hero's layout. Each part lives in ./header — the tank
 * decoration in TankBackdrop, the stat chips in Readouts, the inline settings
 * in FaucetControls — so this stays readable as a page outline.
 */
export default function SiteHeader({
  status,
  settings,
  digest,
  indicators,
  performance,
  balance,
  themeChoice,
  includeDryRun,
  scrollRef,
  onSetTheme,
  onToggleUnit,
  onToggleDryRun,
  onSimulate,
  onTestBuy,
  onBuyNow,
  onSetDryRun,
  onSaveSettings,
  onPause,
  onResume,
  onTestWebhook,
  onSaveDigest,
  onSendDigest,
  onCredentialsChanged,
  onHistoryChanged,
  running,
  buying,
  runResult,
}: {
  status: BotStatus | null;
  settings: BotSettings | null;
  digest: DigestSettings | null;
  indicators: Indicators | null;
  performance: Performance | null;
  balance: AccountBalance | null;
  themeChoice: ThemeChoice;
  includeDryRun: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  onSetTheme: (choice: ThemeChoice) => void;
  onToggleUnit: () => void;
  onToggleDryRun: (v: boolean) => void;
  onSimulate: () => void;
  onTestBuy: () => void;
  onBuyNow: (amountEur: number) => Promise<void>;
  onSetDryRun: (dry: boolean) => void;
  onSaveSettings: (update: Partial<BotSettings>) => Promise<void>;
  onPause: (days: number) => Promise<void>;
  onResume: () => Promise<void>;
  onTestWebhook: () => Promise<boolean>;
  onSaveDigest: (update: DigestUpdate) => Promise<void>;
  onSendDigest: () => Promise<boolean>;
  onCredentialsChanged: () => void;
  onHistoryChanged: () => void;
  running: boolean;
  buying: boolean;
  runResult: RunResult | null;
}) {
  const active = useScrollSpy(scrollRef);
  const scrolled = useScrolled(scrollRef);
  const [panelOpen, setPanelOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  // Which tab Setup opens on - null while closed, so the credential pill can
  // land straight on Coinbase.
  const [setupTab, setSetupTab] = useState<SetupTab | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Bumped by every landed buy, and only used as a key: remounting Splash is
  // what replays the animation.
  const [splash, setSplash] = useState(0);
  const unit = useUnit();

  useEffect(() => {
    if (runResult) setSplash((n) => n + 1);
  }, [runResult]);

  const jumpTo = useCallback((id: Section) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Ctrl/Cmd-K from anywhere in the scroll. Registered here rather than in the
  // palette because the palette only exists once it is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPaletteShortcut(e)) return;
      e.preventDefault();
      setPaletteOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commands = useMemo(
    () =>
      buildCommands({
        indicators,
        status,
        unit,
        themeChoice,
        includeDryRun,
        jumpTo,
        openSetup: () => setSetupTab("coinbase"),
        openSystem: () => setSetupTab("system"),
        openDigest: () => setDigestOpen(true),
        openBuy: () => setBuyOpen(true),
        openExplain: () => setExplainOpen(true),
        openPanel: () => setPanelOpen(true),
        onSimulate,
        onTestBuy,
        onPause,
        onResume,
        onSetDryRun,
        onSetTheme,
        onToggleUnit,
        onToggleDryRun,
      }),
    [
      includeDryRun,
      indicators,
      jumpTo,
      onPause,
      onResume,
      onSetDryRun,
      onSetTheme,
      onSimulate,
      onTestBuy,
      onToggleDryRun,
      onToggleUnit,
      status,
      themeChoice,
      unit,
    ],
  );

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
        <div className="mx-auto flex h-16 w-full max-w-shell items-center justify-between px-6 md:px-10">
          <div className="flex items-center gap-3">
            <DropFillIcon className="text-3xl leading-none" />
            <span className="font-display text-2xl font-bold leading-none">Drip</span>
            <VersionBadge />
          </div>
          <div className="flex items-center gap-2.5 md:gap-3.5">
            {status && (
              <ModeToggle
                status={status}
                settings={settings}
                onSetDryRun={onSetDryRun}
              />
            )}
            {digest && (
              <ReportBadge digest={digest} onOpen={() => setDigestOpen(true)} />
            )}
            {status?.paused && status.paused_until && (
              <HeaderPill>
                <DropSlashIcon /> Off until {formatDayMonth(status.paused_until)}
              </HeaderPill>
            )}
            <PaletteButton onOpen={() => setPaletteOpen(true)} />
            <ThemeToggle choice={themeChoice} onChange={onSetTheme} />
            <SetupButton
              status={status}
              onOpen={() => setSetupTab(status?.has_credentials ? "system" : "coinbase")}
            />
            <nav className="flex gap-1.5">
              {NAV.map(({ id, label, Icon }) => {
                const on = active === id;
                return (
                  <button
                    key={id}
                    onClick={() => jumpTo(id)}
                    aria-current={on ? "true" : undefined}
                    className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
                      on
                        ? "bg-teal-deep text-cream shadow-sm"
                        : "bg-teal/10 text-teal hover:bg-teal/15"
                    }`}
                  >
                    <Icon className="text-base" />
                    <span className="max-sm:hidden">{label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero "tank": the water fills almost the whole hero, its surface waving just
          below the sticky bar; every bit of data lives submerged on the water in cream. */}
      <section className="hero-gradient relative -mt-16 shrink-0 overflow-hidden px-6 pb-14 pt-16 text-cream md:px-10 md:pb-16">
        <TankBackdrop />
        {splash > 0 && <Splash key={splash} />}

        <div className="relative z-10 mx-auto max-w-hero">
          {/* Centered reservoir headline, fully submerged below the waterline */}
          <Reservoir performance={performance} onToggleUnit={onToggleUnit} />

          {/* Submerged read-outs: signal · market · bitcoin · well (frosted
              glass). A grid rather than a wrapping row, so the four keep one
              width and one baseline at every size the app is read at. */}
          <div className="mt-9 grid grid-cols-2 items-stretch gap-4 lg:grid-cols-4">
            {indicators && (
              <>
                <SignalReadout indicators={indicators} />
                <MarketReadout indicators={indicators} />
              </>
            )}
            <BtcReadout indicators={indicators} performance={performance} />
            <WellReadout
              balance={balance}
              settings={settings}
              indicators={indicators}
            />
          </div>

          {/* The spout: next buy + every action, on its own full-width row */}
          <NextBuyActions
            indicators={indicators}
            settings={settings}
            status={status}
            onTestBuy={onTestBuy}
            onSimulate={onSimulate}
            onBuy={() => setBuyOpen(true)}
            onExplain={() => setExplainOpen(true)}
            onTogglePanel={() => setPanelOpen((v) => !v)}
            panelOpen={panelOpen}
            running={running}
            buying={buying}
          />

          {/* Collapsible faucet control bar (amount · schedule · Discord · pause) */}
          <FaucetControls
            open={panelOpen}
            settings={settings}
            digest={digest}
            indicators={indicators}
            onClose={() => setPanelOpen(false)}
            onSave={onSaveSettings}
            onPause={onPause}
            onResume={onResume}
            onTestWebhook={onTestWebhook}
            onOpenDigest={() => setDigestOpen(true)}
            onOpenSetup={() => setSetupTab("coinbase")}
          />

          {runResult?.analysis && (
            <div className="mt-6 flex justify-center">
              <div className="rounded-xl bg-cream/85 px-4 py-2 text-sm font-bold text-teal-deep shadow-sm">
                {runResult.analysis.signal} &middot;{" "}
                {runResult.purchase && !runResult.purchase.dry_run
                  ? "bought"
                  : "would buy"}{" "}
                {fmtEur(runResult.purchase?.amount_eur ?? 0)}
              </div>
            </div>
          )}
        </div>
      </section>

      {setupTab && (
        <SetupDialog
          settings={settings}
          initialTab={setupTab}
          onSaveSettings={onSaveSettings}
          onTestWebhook={onTestWebhook}
          onCredentialsChanged={onCredentialsChanged}
          onHistoryChanged={onHistoryChanged}
          onOpenDigest={() => {
            setSetupTab(null);
            setDigestOpen(true);
          }}
          onClose={() => setSetupTab(null)}
        />
      )}

      {digestOpen && digest && (
        <DigestDialog
          digest={digest}
          onSave={onSaveDigest}
          onSend={onSendDigest}
          onClose={() => setDigestOpen(false)}
        />
      )}

      {paletteOpen && (
        <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />
      )}

      {explainOpen && indicators && (
        <SignalBreakdown
          indicators={indicators}
          settings={settings}
          onClose={() => setExplainOpen(false)}
        />
      )}

      {buyOpen && settings && status && (
        <ManualBuyDialog
          settings={settings}
          status={status}
          balance={balance}
          buying={buying}
          onCancel={() => setBuyOpen(false)}
          onConfirm={onBuyNow}
        />
      )}
    </>
  );
}

function HeaderPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1.5 text-2xs font-bold text-teal">
      {children}
    </span>
  );
}
