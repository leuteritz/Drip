import { useCallback, useEffect, useRef, useState } from "react";
import WarningIcon from "~icons/ph/warning-fill";
import XIcon from "~icons/ph/x";
import {
  api,
  type AccountBalance,
  type BotSettings,
  type BotStatus,
  type DigestSettings,
  type DigestUpdate,
  type Indicators,
  type Performance,
  type Purchase,
  type RunResult,
} from "./api/client";
import { hexFromSignalColor, paintFavicon } from "./lib/favicon";
import { useTheme } from "./lib/theme";
import { UnitProvider, useUnitChoice } from "./lib/units";
import SiteHeader from "./components/SiteHeader";
import SimulationModal from "./components/SimulationModal";
import Overview from "./pages/Dashboard";
import HistorySection from "./pages/History";
import Research from "./pages/Research";

export default function App() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [digest, setDigest] = useState<DigestSettings | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [includeDryRun, setIncludeDryRun] = useState(true);
  const [balance, setBalance] = useState<AccountBalance | null>(null);
  const [running, setRunning] = useState(false);
  const [buying, setBuying] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [showSim, setShowSim] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  // Day or night. Server state this is not, but it belongs with everything else
  // the header needs handed to it.
  const { choice: themeChoice, setChoice: setThemeChoice } = useTheme();
  // BTC or sats, for every bitcoin quantity on the page. A context rather than
  // a prop: six components render one, and none of them are neighbours.
  const { unit, toggleUnit } = useUnitChoice();

  // Background refreshes used to fail silently, which left the header showing
  // empty skeletons whenever the backend was down. They now surface here.
  const report = useCallback((e: unknown) => {
    setApiError(e instanceof Error ? e.message : String(e));
  }, []);

  const reloadPurchases = useCallback(() => {
    api.getPurchases().then(setPurchases).catch(report);
  }, [report]);
  const reloadStatus = useCallback(() => {
    api.getStatus().then(setStatus).catch(report);
  }, [report]);
  const loadPerformance = useCallback(
    (dry: boolean) => {
      api.getPerformance(dry).then(setPerformance).catch(report);
    },
    [report],
  );
  const reloadBalance = useCallback(() => {
    api.getBalance().then(setBalance).catch(report);
  }, [report]);
  const reloadDigest = useCallback(() => {
    api.getDigest().then(setDigest).catch(report);
  }, [report]);

  // A key or webhook saved in Setup changes what the rest of the page may
  // claim: whether the header can show a balance, whether the report can be
  // sent at all. Everything that reads a `configured` flag is refetched.
  const credentialsChanged = useCallback(() => {
    reloadStatus();
    reloadBalance();
    reloadDigest();
  }, [reloadBalance, reloadDigest, reloadStatus]);

  const onToggleDryRun = useCallback(
    (v: boolean) => {
      setIncludeDryRun(v);
      loadPerformance(v);
    },
    [loadPerformance],
  );

  // Switch the bot's live/dry-run mode from the header; keep the settings
  // mirror and status in sync. Going live is guarded by LiveModeDialog upstream.
  const setDryRun = useCallback(
    async (dry: boolean) => {
      try {
        setSettings(await api.updateSettings({ dry_run: dry }));
        reloadStatus();
      } catch (e) {
        report(e);
      }
    },
    [reloadStatus, report],
  );

  // Persist a settings change (amount, schedule, Discord) from the header's
  // faucet control bar; keep the shared mirror + status in sync so the reservoir
  // and next-buy readouts update immediately. Schedule edits reschedule on the
  // backend (routers/settings.py).
  const saveSettings = useCallback(
    async (update: Partial<BotSettings>) => {
      setSettings(await api.updateSettings(update));
      reloadStatus();
    },
    [reloadStatus],
  );

  const pause = useCallback(
    async (days: number) => {
      setSettings(await api.pause(days));
      reloadStatus();
    },
    [reloadStatus],
  );

  const resume = useCallback(async () => {
    setSettings(await api.resume());
    reloadStatus();
  }, [reloadStatus]);

  const testWebhook = useCallback(async () => {
    const { sent } = await api.testNotification();
    return sent;
  }, []);

  // The weekly report's own settings: which blocks it carries and when it goes
  // out. Kept here with the rest of the server state; the dialog fetches only
  // its preview itself, which is the expensive part.
  const saveDigest = useCallback(async (update: DigestUpdate) => {
    setDigest(await api.updateDigest(update));
  }, []);

  const sendDigest = useCallback(async () => {
    const { sent } = await api.sendDigest();
    return sent;
  }, []);

  // Manual "test a buy" is always a dry run; refresh purchases + reservoir after.
  const testBuy = useCallback(async () => {
    setRunning(true);
    setRunResult(null);
    try {
      setRunResult(await api.runNow(true));
      reloadPurchases();
      loadPerformance(includeDryRun);
    } catch (e) {
      report(e);
    } finally {
      setRunning(false);
    }
  }, [includeDryRun, loadPerformance, reloadPurchases, report]);

  // Manual buy from the header's Well card; respects the stored dry_run
  // setting (the dialog only reflects it). Refresh the balance afterwards —
  // a real buy drains the Coinbase well.
  const buyNow = useCallback(
    async (amountEur: number) => {
      setBuying(true);
      setRunResult(null);
      try {
        setRunResult(await api.buyNow(amountEur));
        reloadPurchases();
        loadPerformance(includeDryRun);
        reloadBalance();
      } finally {
        setBuying(false);
      }
    },
    [includeDryRun, loadPerformance, reloadBalance, reloadPurchases],
  );

  // The tab's drop carries the day's signal colour, so a pinned Drip says
  // something from the tab strip alone.
  useEffect(() => {
    if (indicators) paintFavicon(hexFromSignalColor(indicators.color));
  }, [indicators]);

  useEffect(() => {
    (async () => {
      const [st, set, purch, dig] = await Promise.all([
        api.getStatus().catch(report),
        api.getSettings().catch(report),
        api.getPurchases().catch(report),
        api.getDigest().catch(report),
      ]);
      if (st) setStatus(st);
      if (set) setSettings(set);
      if (purch) setPurchases(purch);
      if (dig) setDigest(dig);
      loadPerformance(true);
      reloadBalance();
      // Indicators last: the first call may fetch 350 days of candles.
      api.getIndicators().then(setIndicators).catch(report);
    })();
  }, [loadPerformance, reloadBalance, report]);

  return (
    <UnitProvider value={unit}>
      <div className="h-full bg-shell">
        {/* Full-bleed single scroll container (no frame). */}
        <div
          ref={scrollRef}
          className="relative flex h-full w-full flex-col overflow-y-auto bg-shell"
        >
          <SiteHeader
            status={status}
            settings={settings}
            digest={digest}
            indicators={indicators}
            performance={performance}
            balance={balance}
            themeChoice={themeChoice}
            includeDryRun={includeDryRun}
            scrollRef={scrollRef}
            onSetTheme={setThemeChoice}
            onToggleUnit={toggleUnit}
            onToggleDryRun={onToggleDryRun}
            onSimulate={() => setShowSim(true)}
            onTestBuy={testBuy}
            onBuyNow={buyNow}
            buying={buying}
            onSetDryRun={setDryRun}
            onSaveSettings={saveSettings}
            onPause={pause}
            onResume={resume}
            onTestWebhook={testWebhook}
            onSaveDigest={saveDigest}
            onSendDigest={sendDigest}
            onCredentialsChanged={credentialsChanged}
            onHistoryChanged={reloadPurchases}
            running={running}
            runResult={runResult}
          />

          <main className="flex flex-col">
            <Overview
              purchases={purchases}
              includeDryRun={includeDryRun}
              onToggleDryRun={onToggleDryRun}
            />
            <Research scrollRef={scrollRef} />
            <HistorySection purchases={purchases} onChanged={reloadPurchases} />
          </main>
        </div>

        {apiError && (
          <ErrorToast message={apiError} onDismiss={() => setApiError(null)} />
        )}

        {showSim && settings && (
          <SimulationModal
            settings={settings}
            onClose={() => setShowSim(false)}
          />
        )}
      </div>
    </UnitProvider>
  );
}

/** Surfaces a failed background request without interrupting the dashboard. */
function ErrorToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-40 flex max-w-md items-start gap-3 rounded-card border-2 border-rose/50 bg-paper px-4 py-3 shadow-puff"
    >
      <WarningIcon className="mt-0.5 shrink-0 text-rose" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-sm font-bold text-rose">Backend unreachable</div>
        <div className="mt-0.5 break-words text-xs text-ink-soft">
          {message}
        </div>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-ink-soft transition hover:text-ink"
      >
        <XIcon className="text-sm" />
      </button>
    </div>
  );
}
