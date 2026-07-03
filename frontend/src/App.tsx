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
import SettingsSection from "./pages/Settings";
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
          running={running}
          runResult={runResult}
        />

        <main className="flex flex-col">
          <Overview
            purchases={purchases}
            includeDryRun={includeDryRun}
            onToggleDryRun={onToggleDryRun}
          />
          <SettingsSection
            settings={settings}
            indicators={indicators}
            onSettingsChange={setSettings}
            onStatusChange={reloadStatus}
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
