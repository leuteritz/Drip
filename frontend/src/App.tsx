import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  type BotSettings,
  type BotStatus,
  type Indicators,
  type Purchase,
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
  const [showSim, setShowSim] = useState(false);

  const reloadPurchases = useCallback(() => {
    api.getPurchases().then(setPurchases).catch(() => {});
  }, []);
  const reloadStatus = useCallback(() => {
    api.getStatus().then(setStatus).catch(() => {});
  }, []);

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
      // Indicators last: the first call may fetch 350 days of candles.
      api.getIndicators().then(setIndicators).catch(() => {});
    })();
  }, []);

  return (
    <div className="h-full bg-cream">
      {/* Full-bleed single scroll container (no frame). */}
      <div
        ref={scrollRef}
        className="relative flex h-full w-full flex-col overflow-y-auto bg-cream"
      >
        <SiteHeader
          status={status}
          onSimulate={() => setShowSim(true)}
          scrollRef={scrollRef}
        />

        <main className="flex flex-col">
          <Overview
            settings={settings}
            indicators={indicators}
            purchases={purchases}
            onPurchasesChanged={reloadPurchases}
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
