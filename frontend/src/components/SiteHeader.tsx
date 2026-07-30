import { useState, type ReactNode, type RefObject } from "react";
import DropFillIcon from "~icons/ph/drop-fill";
import DropSlashIcon from "~icons/ph/drop-slash";
import KeyIcon from "~icons/ph/key";
import type {
  AccountBalance,
  BotSettings,
  BotStatus,
  Indicators,
  Performance,
  RunResult,
} from "../api/client";
import { fmtEur, formatDayMonth } from "../lib/format";
import FaucetControls from "./header/FaucetControls";
import { NAV, useScrolled, useScrollSpy, type Section } from "./header/hooks";
import ModeToggle from "./header/ModeToggle";
import NextBuyActions from "./header/NextBuyActions";
import {
  BtcReadout,
  FearGreedReadout,
  RsiReadout,
  ScoreReadout,
  WellReadout,
} from "./header/Readouts";
import Reservoir from "./header/Reservoir";
import TankBackdrop from "./header/TankBackdrop";
import ManualBuyDialog from "./ManualBuyDialog";

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
  indicators,
  performance,
  balance,
  scrollRef,
  onSimulate,
  onTestBuy,
  onBuyNow,
  onSetDryRun,
  onSaveSettings,
  onPause,
  onResume,
  onTestWebhook,
  running,
  buying,
  runResult,
}: {
  status: BotStatus | null;
  settings: BotSettings | null;
  indicators: Indicators | null;
  performance: Performance | null;
  balance: AccountBalance | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  onSimulate: () => void;
  onTestBuy: () => void;
  onBuyNow: (amountEur: number) => Promise<void>;
  onSetDryRun: (dry: boolean) => void;
  onSaveSettings: (update: Partial<BotSettings>) => Promise<void>;
  onPause: (days: number) => Promise<void>;
  onResume: () => Promise<void>;
  onTestWebhook: () => Promise<boolean>;
  running: boolean;
  buying: boolean;
  runResult: RunResult | null;
}) {
  const active = useScrollSpy(scrollRef);
  const scrolled = useScrolled(scrollRef);
  const [panelOpen, setPanelOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);

  const jumpTo = (id: Section) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
            <span className="font-display text-xl font-bold leading-none">Drip</span>
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
                <DropSlashIcon /> Off until {formatDayMonth(status.paused_until)}
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
          below the sticky bar; every bit of data lives submerged on the water in cream. */}
      <section className="hero-gradient relative -mt-16 shrink-0 overflow-hidden px-6 pb-16 pt-16 text-cream md:px-10 md:pb-20">
        <TankBackdrop />

        <div className="relative z-10 mx-auto max-w-[1180px]">
          {/* Centered reservoir headline, fully submerged below the waterline */}
          <Reservoir performance={performance} />

          {/* Submerged stat cards: Score · F&G · RSI · BTC (frosted glass) + the
              solid Next-buy card with its actions */}
          <div className="mt-8 flex flex-wrap items-stretch justify-center gap-4">
            {indicators && (
              <>
                <ScoreReadout indicators={indicators} />
                <FearGreedReadout indicators={indicators} />
                <RsiReadout indicators={indicators} />
              </>
            )}
            <BtcReadout indicators={indicators} performance={performance} />
            <WellReadout
              balance={balance}
              settings={settings}
              indicators={indicators}
            />
            <NextBuyActions
              indicators={indicators}
              settings={settings}
              status={status}
              onTestBuy={onTestBuy}
              onSimulate={onSimulate}
              onBuy={() => setBuyOpen(true)}
              onTogglePanel={() => setPanelOpen((v) => !v)}
              panelOpen={panelOpen}
              running={running}
              buying={buying}
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
    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-2.5 py-1.5 text-[11px] font-bold text-teal">
      {children}
    </span>
  );
}
