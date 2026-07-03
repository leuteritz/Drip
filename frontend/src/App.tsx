import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  type BotSettings,
  type BotStatus,
  type Indicators,
  type Performance,
  type Purchase,
  type RunResult,
} from "./api/client";
import SiteHeader from "./components/SiteHeader";
import SimulationModal from "./components/SimulationModal";
import Overview from "./pages/Dashboard";
import HistorySection from "./pages/History";

export default function App() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [includeDryRun, setIncludeDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [showSim, setShowSim] = useState(false);

  const reloadPurchases = useCallback(() => {
    api.getPurchases().then(setPurchases).catch(() => {});
  }, []);
  const reloadStatus = useCallback(() => {
    api.getStatus().then(setStatus).catch(() => {});
  }, []);
  const loadPerformance = useCallback((dry: boolean) => {
    api.getPerformance(dry).then(setPerformance).catch(() => {});
  }, []);

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
        const next = await api.updateSettings({ dry_run: dry });
        setSettings(next);
        reloadStatus();
      } catch {
        // Header stays quiet; the Settings page surfaces mode errors.
      }
    },
    [reloadStatus],
  );

  // Persist a settings change (amount, schedule, Discord) from the header's
  // faucet control bar; keep the shared mirror + status in sync so the reservoir
  // and next-buy readouts update immediately. Schedule edits reschedule on the
  // backend (routers/settings.py).
  const saveSettings = useCallback(
    async (update: Partial<BotSettings>) => {
      const next = await api.updateSettings(update);
      setSettings(next);
      reloadStatus();
    },
    [reloadStatus],
  );

  const pause = useCallback(
    async (days: number) => {
      const next = await api.pause(days);
      setSettings(next);
      reloadStatus();
    },
    [reloadStatus],
  );

  const resume = useCallback(async () => {
    const next = await api.resume();
    setSettings(next);
    reloadStatus();
  }, [reloadStatus]);

  const testWebhook = useCallback(async () => {
    const { sent } = await api.testNotification();
    return sent;
  }, []);

  // Manual "test a buy" is always a dry run; refresh purchases + reservoir after.
  const testBuy = useCallback(async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await api.runNow(true);
      setRunResult(result);
      reloadPurchases();
      loadPerformance(includeDryRun);
    } catch {
      // Errors surface in the dashboard body; keep the header quiet.
    } finally {
      setRunning(false);
    }
  }, [includeDryRun, loadPerformance, reloadPurchases]);

  useEffect(() => {
    (async () => {
      const [st, set, purch] = await Promise.all([
        api.getStatus().catch(() => null),
        api.getSettings().catch(() => null),
        api.getPurchases().catch(() => [] as Purchase[]),
      ]);
      if (st) setStatus(st);
      if (set) setSettings(set);
      setPurchases(purch);
      loadPerformance(true);
      // Indicators last: the first call may fetch 350 days of candles.
      api.getIndicators().then(setIndicators).catch(() => {});
    })();
  }, [loadPerformance]);

  return (
    <div className="h-full bg-cream">
      {/* Full-bleed single scroll container (no frame). */}
      <div
        ref={scrollRef}
        className="relative flex h-full w-full flex-col overflow-y-auto bg-cream"
      >
        <SiteHeader
          status={status}
          settings={settings}
          indicators={indicators}
          performance={performance}
          scrollRef={scrollRef}
          onSimulate={() => setShowSim(true)}
          onTestBuy={testBuy}
          onSetDryRun={setDryRun}
          onSaveSettings={saveSettings}
          onPause={pause}
          onResume={resume}
          onTestWebhook={testWebhook}
          running={running}
          runResult={runResult}
        />

        <main className="flex flex-col">
          <Overview
            purchases={purchases}
            includeDryRun={includeDryRun}
            onToggleDryRun={onToggleDryRun}
          />
          <HistorySection purchases={purchases} onChanged={reloadPurchases} />
        </main>
      </div>

      {showSim && settings && (
        <SimulationModal settings={settings} onClose={() => setShowSim(false)} />
      )}
    </div>
  );
}
