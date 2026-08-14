import { useCallback, useEffect, useRef, useState } from "react";
import WarningIcon from "~icons/ph/warning-fill";
import XIcon from "~icons/ph/x";
import {
  api,
  setUnauthorizedHandler,
  type AccountBalance,
  type AuthState,
  type BotSettings,
  type BotStatus,
  type DigestSettings,
  type DigestUpdate,
  type Indicators,
  type Performance,
  type Preflight,
  type Purchase,
  type RunResult,
  type SettingsUpdate,
} from "./api/client";
import { hexFromSignalColor, paintFavicon } from "./lib/favicon";
import { useLoadTracker } from "./lib/loading";
import { useIsTank } from "./lib/route";
import { useTheme } from "./lib/theme";
import { UnitProvider, useUnitChoice } from "./lib/units";
import SiteHeader from "./components/SiteHeader";
import SimulationModal from "./components/SimulationModal";
import ErrorBoundary from "./components/ErrorBoundary";
import CardsDialog from "./components/stack/CardsDialog";
import { merged } from "./lib/cards";
import Lock from "./pages/Lock";
import Overview from "./pages/Dashboard";
import HistorySection from "./pages/History";
import Research from "./pages/Research";
import Tank from "./pages/Tank";

/** How often the wall display refetches what it shows. Five minutes is well
 *  under the weekly rhythm it reports and gentle on a Pi. */
const TANK_REFRESH_MS = 5 * 60 * 1000;

export default function App() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // The optional lock. Asked *before* everything else, because with a password
  // set every other request 401s — so this is the one fetch that cannot be part
  // of the parallel opening batch. `null` means the question is still out, and
  // the app renders nothing until it is answered.
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [digest, setDigest] = useState<DigestSettings | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  // Whether the first history fetch has come back at all. `inFlight` cannot
  // answer this: it is empty on the very first paint too, because the effect
  // that starts the request has not run yet — so an empty array read as "no
  // buys yet" and both the history and the overview flashed their empty state
  // before anything had been asked. An empty state may never be shown while the
  // answer is still out.
  const [purchasesLoaded, setPurchasesLoaded] = useState(false);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [includeDryRun, setIncludeDryRun] = useState(true);
  // The history's search, owned here because the command palette can set it:
  // a question asked at the top of the page is answered by the table at the
  // bottom of it, and both speak the one query language in lib/query.ts.
  const [historyQuery, setHistoryQuery] = useState("");
  const [balance, setBalance] = useState<AccountBalance | null>(null);
  // Whether the next drip would land. Owned here rather than fetched by its own
  // dialog — unlike Research, this one has something to say while it is closed:
  // the sticky bar's pill is the only warning a blocked buy ever gets.
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [running, setRunning] = useState(false);
  const [buying, setBuying] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [showSim, setShowSim] = useState(false);
  // Which cards the Overview shows. Held here rather than in `SiteHeader` for
  // the reason `showSim` is: it is opened from two places that are nowhere near
  // each other — the palette at the top and the foot of the section itself.
  const [cardsOpen, setCardsOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  // Day or night. Server state this is not, but it belongs with everything else
  // the header needs handed to it.
  const { choice: themeChoice, setChoice: setThemeChoice } = useTheme();
  // BTC or sats, for every bitcoin quantity on the page. A context rather than
  // a prop: six components render one, and none of them are neighbours.
  const { unit, toggleUnit } = useUnitChoice();
  const isTank = useIsTank();
  // What is still in the air, for the sticky bar's pill. Every load below goes
  // through `track` — a request the bar does not know about is a wait nobody
  // can see once you have scrolled past the card that explains it.
  const { inFlight, track } = useLoadTracker();

  // Background refreshes used to fail silently, which left the header showing
  // empty skeletons whenever the backend was down. They now surface here.
  const report = useCallback((e: unknown) => {
    setApiError(e instanceof Error ? e.message : String(e));
  }, []);

  const reloadPurchases = useCallback(() => {
    track("purchases", api.getPurchases())
      .then((rows) => {
        setPurchases(rows);
        setPurchasesLoaded(true);
      })
      .catch(report);
  }, [report, track]);
  const reloadStatus = useCallback(() => {
    track("status", api.getStatus()).then(setStatus).catch(report);
  }, [report, track]);
  const loadPerformance = useCallback(
    (dry: boolean) => {
      track("performance", api.getPerformance(dry)).then(setPerformance).catch(report);
    },
    [report, track],
  );
  const reloadBalance = useCallback(() => {
    track("balance", api.getBalance()).then(setBalance).catch(report);
  }, [report, track]);
  const reloadDigest = useCallback(() => {
    track("digest", api.getDigest()).then(setDigest).catch(report);
  }, [report, track]);
  const reloadIndicators = useCallback(() => {
    track("indicators", api.getIndicators()).then(setIndicators).catch(report);
  }, [report, track]);
  // Deliberately not refetched on every settings change: the amount persists as
  // it is typed, and asking Coinbase per keystroke would be a request storm for
  // an answer that only moves when a key, the mode or the balance does.
  const reloadPreflight = useCallback(() => {
    setPreflight(null);
    track("preflight", api.getPreflight()).then(setPreflight).catch(report);
  }, [report, track]);

  // A key or webhook saved in Setup changes what the rest of the page may
  // claim: whether the header can show a balance, whether the report can be
  // sent at all. Everything that reads a `configured` flag is refetched.
  const credentialsChanged = useCallback(() => {
    reloadStatus();
    reloadBalance();
    reloadDigest();
    reloadPreflight();
  }, [reloadBalance, reloadDigest, reloadPreflight, reloadStatus]);

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
        // Going live changes what a failed check *means*: a missing key cannot
        // stop a test run and can stop a real one, so the answer is re-asked.
        reloadPreflight();
      } catch (e) {
        report(e);
      }
    },
    [reloadPreflight, reloadStatus, report],
  );

  // Persist a settings change (amount, schedule, Discord) from the header's
  // faucet control bar; keep the shared mirror + status in sync so the reservoir
  // and next-buy readouts update immediately. Schedule edits reschedule on the
  // backend (routers/settings.py).
  const saveSettings = useCallback(
    async (update: SettingsUpdate) => {
      setSettings(await api.updateSettings(update));
      reloadStatus();
    },
    [reloadStatus],
  );

  // One card flipped. The whole resolved selection goes up rather than the one
  // change, so the column holds what is actually on screen — see `lib/cards.ts`.
  // It goes through `saveSettings`, so the page re-renders the moment it lands
  // and the dialog needs no preview of its own: the page behind it is one.
  const toggleCard = useCallback(
    (key: string, on: boolean) => {
      saveSettings({ cards: merged(settings?.cards, key, on) }).catch(report);
    },
    [report, saveSettings, settings?.cards],
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

  // Nobody presses reload on a wall, so the kiosk refreshes what it shows.
  // Only in kiosk mode: the dashboard is a page you are sitting in front of.
  useEffect(() => {
    if (!isTank) return;
    const id = window.setInterval(() => {
      reloadStatus();
      loadPerformance(includeDryRun);
      reloadIndicators();
    }, TANK_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [includeDryRun, isTank, loadPerformance, reloadIndicators, reloadStatus]);

  // A session that dies mid-visit — thirty days on, or because the password was
  // changed on another device — puts the lock screen back rather than firing the
  // error toast once per card. `client.ts` is the only thing that can see a 401.
  useEffect(() => {
    setUnauthorizedHandler(() =>
      setAuth((current) =>
        current?.authenticated === false
          ? current
          : { required: true, authenticated: false, source: current?.source ?? "dashboard" },
      ),
    );
  }, []);

  useEffect(() => {
    (async () => {
      // Before the batch, never inside it: with a lock on, the other four would
      // 401 first and the toast would beat the lock screen to the page.
      const state = await api.getAuth().catch(() => null);
      setAuth(state ?? { required: false, authenticated: true, source: "none" });
      if (state?.required && !state.authenticated) return;

      const [st, set, purch, dig] = await Promise.all([
        track("status", api.getStatus()).catch(report),
        track("settings", api.getSettings()).catch(report),
        track("purchases", api.getPurchases()).catch(report),
        track("digest", api.getDigest()).catch(report),
      ]);
      if (st) setStatus(st);
      if (set) setSettings(set);
      if (purch) {
        setPurchases(purch);
        setPurchasesLoaded(true);
      }
      if (dig) setDigest(dig);
      loadPerformance(true);
      reloadBalance();
      reloadPreflight();
      // Indicators last: the first call may fetch 350 days of candles.
      reloadIndicators();
    })();
  }, [loadPerformance, reloadBalance, reloadIndicators, reloadPreflight, report, track]);

  // Nothing renders until the lock has answered — a flash of the dashboard in
  // front of a locked install would be a worse first frame than a blank one.
  if (!auth) return <div className="h-full bg-shell" />;
  if (auth.required && !auth.authenticated) {
    // A reload rather than choreographed state, exactly as the restore flow
    // does it: settings, history, keys and schedule are all about to exist for
    // the first time. It keeps `#tank` in the hash, so a kiosk lands on the wall.
    return <Lock onIn={() => window.location.reload()} />;
  }

  if (isTank) {
    return (
      <UnitProvider value={unit}>
        {/* The one screen nobody is sitting in front of, so it is the one that
            most needs this: a throw here used to leave a white monitor on a
            wall until somebody walked past it. */}
        <ErrorBoundary what="The wall display stopped" on="water">
          <Tank
            performance={performance}
            indicators={indicators}
            settings={settings}
            status={status}
          />
        </ErrorBoundary>
      </UnitProvider>
    );
  }

  return (
    <UnitProvider value={unit}>
      <div className="h-full bg-shell">
        {/* Full-bleed single scroll container (no frame). */}
        <div
          ref={scrollRef}
          className="relative flex h-full w-full flex-col overflow-y-auto overscroll-contain bg-shell"
        >
          <SiteHeader
            status={status}
            settings={settings}
            digest={digest}
            indicators={indicators}
            performance={performance}
            balance={balance}
            preflight={preflight}
            purchases={purchases}
            loading={inFlight}
            themeChoice={themeChoice}
            includeDryRun={includeDryRun}
            scrollRef={scrollRef}
            onSearchHistory={setHistoryQuery}
            onSetTheme={setThemeChoice}
            onToggleUnit={toggleUnit}
            onToggleDryRun={onToggleDryRun}
            onSimulate={() => setShowSim(true)}
            onOpenCards={() => setCardsOpen(true)}
            auth={auth}
            onAuthChanged={setAuth}
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
            onRecheck={reloadPreflight}
            running={running}
            runResult={runResult}
          />

          {/* One boundary per section rather than one for the page: a throw in
              the research charts must not take the history with it, and the
              sections are the largest thing a reader still recognises as "the
              part that is missing". A card that fails to *load* still answers
              for itself — this is only for one that fails to render. */}
          <main className="flex flex-col">
            <ErrorBoundary what="Could not draw your overview">
              <Overview
                purchases={purchases}
                purchasesLoaded={purchasesLoaded}
                settings={settings}
                includeDryRun={includeDryRun}
                running={running}
                onTestBuy={testBuy}
                onToggleDryRun={onToggleDryRun}
                onSaveSettings={saveSettings}
                onOpenCards={() => setCardsOpen(true)}
              />
            </ErrorBoundary>
            <ErrorBoundary what="Could not draw the strategy tests">
              <Research scrollRef={scrollRef} />
            </ErrorBoundary>
            <ErrorBoundary what="Could not draw your buy history">
              <HistorySection
                purchases={purchases}
                query={historyQuery}
                onQuery={setHistoryQuery}
                loading={!purchasesLoaded}
                onChanged={reloadPurchases}
              />
            </ErrorBoundary>
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

        {/* No preview of its own: the page behind it is the preview, which is
            why it is narrow and closes on the backdrop. */}
        {cardsOpen && (
          <CardsDialog
            cards={settings?.cards}
            onToggle={toggleCard}
            onClose={() => setCardsOpen(false)}
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
      /* Above the phone's tab bar rather than under it, and the full width of
         the glass there — a 24rem toast in a 390px window is a corner. */
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 flex items-start gap-3 rounded-card bg-paper px-4 py-3 shadow-card ring-2 ring-rose/50 md:bottom-4 md:left-auto md:max-w-md"
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
