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
  Preflight,
  Purchase,
  RunResult,
} from "../api/client";
import { isPaletteShortcut } from "../lib/commands";
import { fmtEur, formatDayMonth } from "../lib/format";
import type { LoadKey } from "../lib/loading";
import type { ThemeChoice } from "../lib/theme";
import { useUnit } from "../lib/units";
import DigestDialog from "./digest/DigestDialog";
import BacktestButton from "./header/BacktestButton";
import BottomNav from "./header/BottomNav";
import { SEGMENT, SEGMENT_OFF, SEGMENT_ON, TRAY } from "./header/chrome";
import { NAV, useScrolled, useScrollSpy, type Section } from "./header/hooks";
import LoadPill from "./header/LoadPill";
import ModeToggle from "./header/ModeToggle";
import NextBuyActions, { type SpoutEdit } from "./header/NextBuyActions";
import PreflightPill from "./header/PreflightPill";
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
import PreflightDialog from "./preflight/PreflightDialog";
import { buildCommands } from "./palette/buildCommands";
import CommandPalette from "./palette/CommandPalette";
import PaletteButton from "./palette/PaletteButton";
import SetupDialog, { type SetupTab } from "./setup/SetupDialog";

/**
 * The signature gradient hero that opens the app — the whole command center.
 *
 * This file is only the composition: the sticky bar (brand, mode toggle,
 * jump-nav) and the hero's layout. Each part lives in ./header — the tank
 * decoration in TankBackdrop, the stat chips in Readouts, the next buy and the
 * settings it carries in NextBuyActions — so this stays readable as a page
 * outline.
 */
export default function SiteHeader({
  status,
  settings,
  digest,
  indicators,
  performance,
  balance,
  preflight,
  purchases,
  loading,
  themeChoice,
  includeDryRun,
  scrollRef,
  onSearchHistory,
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
  onRecheck,
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
  /** Whether the next drip would land. Null while it is still being asked. */
  preflight: Preflight | null;
  /** The buy history, so the palette can answer questions about it. */
  purchases: Purchase[];
  /** What the page is still fetching — named in the bar by `LoadPill`. */
  loading: LoadKey[];
  themeChoice: ThemeChoice;
  includeDryRun: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Puts a query into the history's own search bar. */
  onSearchHistory: (query: string) => void;
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
  /** Ask the preflight again — the dialog's own button, and what a fixed key
   *  needs before the pill will go away. */
  onRecheck: () => void;
  running: boolean;
  buying: boolean;
  runResult: RunResult | null;
}) {
  const active = useScrollSpy(scrollRef);
  const scrolled = useScrolled(scrollRef);
  // Which figure on the next-buy card is open for editing — held here rather
  // than in the card so the palette can open one from anywhere in the scroll.
  const [editing, setEditing] = useState<SpoutEdit | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  // Which tab Setup opens on - null while closed, so the credential pill can
  // land straight on Coinbase.
  const [setupTab, setSetupTab] = useState<SetupTab | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [preflightOpen, setPreflightOpen] = useState(false);
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

  // The card's editors are opened by clicking the figure they change, so a
  // palette entry has to bring that figure back on screen first.
  const editSpout = useCallback(
    (target: SpoutEdit) => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      setEditing(target);
    },
    [scrollRef],
  );

  // A question asked in the palette is answered in full by the history: the
  // query goes into its own search bar and the page scrolls to the table it
  // narrows, so the palette never has to grow a second buy list of its own.
  const searchHistory = useCallback(
    (query: string) => {
      onSearchHistory(query);
      jumpTo("history");
    },
    [jumpTo, onSearchHistory],
  );

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
        openPreflight: () => setPreflightOpen(true),
        openBuy: () => setBuyOpen(true),
        openExplain: () => setExplainOpen(true),
        editAmount: () => editSpout("amount"),
        editSchedule: () => editSpout("when"),
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
      editSpout,
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
      {/* Sticky condensed bar. Two halves, and each has one job.
          Left is what Drip *is* right now — the brand, the build, what it is
          still fetching, whether it is switched off — so everything that comes
          and goes on its own lives here and nothing you might be aiming at
          moves when it does. Right is what you can *do*, in three trays of the
          same shape (see ./header/chrome): the mode switch, the tools, the
          jump-nav. Transparent over the hero, blurred teal once scrolled.

          On a phone the third tray leaves it: the jump-nav becomes `BottomNav`
          at the foot of the screen, where a thumb is. What stays is what has to
          be seen rather than reached for — the mode you are in, and the way
          into everything else. */}
      <header
        className={`pad-safe-x sticky top-0 z-30 shrink-0 text-teal transition-colors duration-300 ${
          scrolled
            ? "border-b border-teal/10 bg-paper/90 shadow-[0_6px_24px_-14px_rgba(60,109,120,.6)] backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 w-full max-w-shell items-center justify-between gap-2 px-4 sm:px-6 md:px-10">
          <div className="flex min-w-0 items-center gap-3">
            {/* On a phone the drop alone is the brand: the word and the build
                give way before the trays on the right do. */}
            <DropFillIcon className="shrink-0 text-3xl leading-none" />
            <span className="font-display text-2xl font-bold leading-none max-sm:hidden">
              Drip
            </span>
            <VersionBadge />
            <LoadPill loading={loading} />
            <PreflightPill
              report={preflight}
              onOpen={() => setPreflightOpen(true)}
            />
            {status?.paused && status.paused_until && (
              <HeaderPill>
                <DropSlashIcon /> Off until {formatDayMonth(status.paused_until)}
              </HeaderPill>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {status && (
              <ModeToggle
                status={status}
                settings={settings}
                onSetDryRun={onSetDryRun}
              />
            )}

            {/* The tools tray: everything that only opens something — search,
                report, backtest, theme, setup. Nothing in here spends money,
                which is what keeps it one undivided group.

                Two of the five stand down on a phone, where five touch-sized
                items plus the mode switch is more than a 390px row holds. The
                backtest and the theme are the two that go, because the search
                beside them opens both by name — and the report stays, since it
                is the one thing here that is counting down rather than waiting
                to be asked. */}
            <div className={TRAY}>
              <PaletteButton onOpen={() => setPaletteOpen(true)} />
              {digest && (
                <ReportBadge digest={digest} onOpen={() => setDigestOpen(true)} />
              )}
              <span className="contents max-sm:hidden">
                <BacktestButton onOpen={onSimulate} />
                <ThemeToggle choice={themeChoice} onChange={onSetTheme} />
              </span>
              <SetupButton
                status={status}
                onOpen={() => setSetupTab(status?.has_credentials ? "system" : "coinbase")}
              />
            </div>

            {/* The jump-nav, segmented like the mode switch: three places, one
                of them you are in. Below `md` it is `BottomNav` instead. */}
            <nav className={`${TRAY} max-md:hidden`} aria-label="Sections">
              {NAV.map(({ id, label, Icon }) => {
                const on = active === id;
                return (
                  <button
                    key={id}
                    onClick={() => jumpTo(id)}
                    aria-current={on ? "true" : undefined}
                    className={`${SEGMENT} ${on ? SEGMENT_ON : SEGMENT_OFF}`}
                  >
                    <Icon className="text-sm" />
                    <span className="max-md:hidden">{label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero "tank": the water fills almost the whole hero, its surface waving just
          below the sticky bar; every bit of data lives submerged on the water in cream. */}
      <section className="hero-gradient pad-safe-x relative -mt-16 shrink-0 overflow-hidden px-4 pb-10 pt-16 text-cream sm:px-6 sm:pb-14 md:px-10 md:pb-16">
        <TankBackdrop multiplier={indicators?.multiplier} />
        {splash > 0 && <Splash key={splash} />}

        <div className="relative z-10 mx-auto max-w-hero">
          {/* Centered reservoir headline, fully submerged below the waterline */}
          <Reservoir performance={performance} onToggleUnit={onToggleUnit} />

          {/* Submerged read-outs: signal · market · bitcoin · well — four
              instruments in one glass grammar (see Readouts). A grid rather
              than a wrapping row, so the four keep one width and one baseline
              at every size the app is read at. */}
          <div className="mt-7 grid grid-cols-2 items-stretch gap-2.5 sm:mt-9 sm:gap-4 lg:grid-cols-4">
            {/* All four are always here, waiting or not: the signal is the
                slowest call in the app, and a grid that fills in from two
                chips to four moves everything under it while you read. */}
            <SignalReadout indicators={indicators} />
            <MarketReadout indicators={indicators} />
            <BtcReadout indicators={indicators} performance={performance} />
            <WellReadout
              balance={balance}
              settings={settings}
              indicators={indicators}
            />
          </div>

          {/* The spout: next buy, every action, and the settings behind both —
              each figure on it doubling as the control that changes it */}
          <NextBuyActions
            indicators={indicators}
            settings={settings}
            status={status}
            editing={editing}
            onEdit={setEditing}
            onSaveSettings={onSaveSettings}
            onPause={onPause}
            onResume={onResume}
            onTestBuy={onTestBuy}
            onBuy={() => setBuyOpen(true)}
            onExplain={() => setExplainOpen(true)}
            running={running}
            buying={buying}
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
        <CommandPalette
          commands={commands}
          purchases={purchases}
          onSearchHistory={searchHistory}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      {preflightOpen && (
        <PreflightDialog
          report={preflight}
          refreshing={preflight === null}
          onRefresh={onRecheck}
          onClose={() => setPreflightOpen(false)}
        />
      )}

      {explainOpen && indicators && (
        <SignalBreakdown
          indicators={indicators}
          settings={settings}
          onClose={() => setExplainOpen(false)}
        />
      )}

      {/* The phone's own jump-nav, over everything below the dialogs. */}
      <BottomNav active={active} onJump={jumpTo} />

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
