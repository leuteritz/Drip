import { useCallback, useEffect, useState } from "react";
import {
  api,
  fmtBtc,
  fmtEur,
  fmtPct,
  WEEKDAYS,
  type BotStatus,
  type Candle,
  type ComparisonPoint,
  type Indicators,
  type Performance,
  type Purchase,
  type RunResult,
} from "../api/client";
import ComparisonChart from "../components/ComparisonChart";
import Gauge from "../components/Gauge";
import PriceChart from "../components/PriceChart";
import { Badge, Card, CardTitle, Spinner, StatCard, Toggle } from "../components/ui";

const RANGES = [
  { label: "30T", days: 30 },
  { label: "90T", days: 90 },
  { label: "1J", days: 365 },
];

export default function Dashboard() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [comparison, setComparison] = useState<ComparisonPoint[]>([]);
  const [rangeDays, setRangeDays] = useState(90);
  const [includeDryRun, setIncludeDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (dry: boolean) => {
    const [perf, comp] = await Promise.all([
      api.getPerformance(dry),
      api.getComparison(dry),
    ]);
    setPerformance(perf);
    setComparison(comp);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [st, purch] = await Promise.all([api.getStatus(), api.getPurchases()]);
        setStatus(st);
        setPurchases(purch);
        await loadStats(true);
        // Indikatoren zuletzt - der erste Aufruf laedt ggf. 350 Tage Candles
        setIndicators(await api.getIndicators());
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [loadStats]);

  useEffect(() => {
    api.getCandles(rangeDays).then(setCandles).catch((e) => setError(String(e)));
  }, [rangeDays]);

  const toggleDryRunStats = async (v: boolean) => {
    setIncludeDryRun(v);
    await loadStats(v);
  };

  const runAnalysis = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await api.runNow(true); // manueller Lauf immer als Dry-Run
      setRunResult(result);
      setPurchases(await api.getPurchases());
      await loadStats(includeDryRun);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  if (error) {
    return (
      <Card className="border-down/40">
        <div className="text-down">⚠️ {error}</div>
        <div className="mt-2 text-sm text-slate-400">
          Läuft das Backend? <code className="text-slate-300">uvicorn app.main:app</code>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status-Banner */}
      {status && (
        <Card className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                status.paused ? "bg-slate-500" : "animate-pulse bg-up"
              }`}
            />
            <span className="font-semibold">
              {status.paused ? "Bot pausiert" : "Bot aktiv"}
            </span>
          </div>
          {status.paused && status.paused_until && (
            <Badge tone="gray">bis {formatDate(status.paused_until)}</Badge>
          )}
          <Badge tone={status.dry_run ? "orange" : "green"}>
            {status.dry_run ? "🧪 Dry-Run" : "🔴 LIVE-Trading"}
          </Badge>
          {status.next_run && !status.paused && (
            <span className="text-sm text-slate-400">
              Nächster Kauf: <span className="text-slate-200">{formatDateTime(status.next_run)}</span>
            </span>
          )}
          {!status.has_credentials && (
            <Badge tone="red">Keine API-Keys (.env) – nur Dry-Run möglich</Badge>
          )}
          <button
            onClick={runAnalysis}
            disabled={running}
            className="ml-auto rounded-lg bg-btc px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
          >
            {running ? "Analysiere…" : "▶ Jetzt analysieren (Dry-Run)"}
          </button>
        </Card>
      )}

      {runResult?.analysis && (
        <Card className="border-btc/40">
          <div className="font-semibold text-btc">
            {runResult.analysis.emoji} {runResult.analysis.signal} — Score{" "}
            {runResult.analysis.score}/{runResult.analysis.score_max}, Kaufbetrag{" "}
            {fmtEur(runResult.purchase?.amount_eur ?? 0)}
          </div>
          <ul className="mt-2 space-y-0.5 text-sm text-slate-400">
            {runResult.analysis.factors.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Performance-Kacheln */}
      {performance ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              {performance.profit_eur >= 0 ? "📈 Du machst Gewinn" : "📉 Aktuell im Minus"}{" "}
              <span className={performance.profit_eur >= 0 ? "text-up" : "text-down"}>
                {fmtPct(performance.profit_pct)}
              </span>
            </h2>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              Dry-Runs einbeziehen
              <Toggle checked={includeDryRun} onChange={toggleDryRunStats} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Investiert" value={fmtEur(performance.invested_eur)} sub={`${performance.purchase_count} Käufe`} />
            <StatCard
              label="Aktueller Wert"
              value={fmtEur(performance.value_eur)}
              sub={`BTC-Kurs ${fmtEur(performance.current_price, 0)}`}
            />
            <StatCard
              label="Gewinn / Verlust"
              value={`${performance.profit_eur >= 0 ? "+" : ""}${fmtEur(performance.profit_eur)}`}
              sub={fmtPct(performance.profit_pct)}
              tone={performance.profit_eur >= 0 ? "up" : "down"}
            />
            <StatCard label="Bitcoin-Bestand" value={fmtBtc(performance.btc_total)} />
          </div>
        </>
      ) : (
        <Spinner />
      )}

      {/* Kurs-Chart */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <CardTitle>Bitcoin-Kurs (BTC-EUR) &amp; Käufe</CardTitle>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setRangeDays(r.days)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  rangeDays === r.days
                    ? "bg-btc text-black"
                    : "bg-surface-2 text-slate-400 hover:text-slate-200"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {candles.length ? (
          <PriceChart candles={candles} purchases={purchases} />
        ) : (
          <Spinner />
        )}
      </Card>

      {/* Live-Indikatoren */}
      <Card>
        <CardTitle>Live-Analyse — was würde der Bot jetzt tun?</CardTitle>
        {indicators ? (
          <div className="grid grid-cols-2 items-center gap-6 md:grid-cols-4 lg:grid-cols-5">
            <Gauge
              value={indicators.rsi}
              label="RSI (14)"
              sublabel={
                indicators.rsi < 30 ? "Überverkauft" : indicators.rsi > 70 ? "Überkauft" : "Neutral"
              }
              zones={[
                { to: 30, color: "#22c55e" },
                { to: 45, color: "#84cc16" },
                { to: 70, color: "#64748b" },
                { to: 100, color: "#ef4444" },
              ]}
            />
            <Gauge
              value={indicators.fear_greed}
              label="Fear & Greed"
              sublabel={indicators.fng_classification}
              zones={[
                { to: 25, color: "#22c55e" },
                { to: 45, color: "#84cc16" },
                { to: 55, color: "#64748b" },
                { to: 100, color: "#ef4444" },
              ]}
            />
            <div className="text-center">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
                350-Tage-MA
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums">
                {fmtEur(indicators.ma_350, 0)}
              </div>
              <div
                className={`text-sm font-semibold ${
                  indicators.ma_distance_pct < 0 ? "text-up" : "text-slate-400"
                }`}
              >
                Kurs {fmtPct(indicators.ma_distance_pct)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Score
              </div>
              <div className="mt-1 text-3xl font-bold text-btc tabular-nums">
                {indicators.score}
                <span className="text-base text-slate-500">/{indicators.score_max}</span>
              </div>
              <div className="text-sm text-slate-400">{indicators.signal}</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Multiplikator
              </div>
              <div className="mt-1 text-3xl font-bold tabular-nums">
                ×{indicators.multiplier}
              </div>
              <div className="text-sm text-slate-400">auf den Basisbetrag</div>
            </div>
          </div>
        ) : (
          <Spinner />
        )}
      </Card>

      {/* Strategie-Vergleich */}
      <Card>
        <CardTitle>Bot-Strategie vs. einfaches DCA (Portfoliowert)</CardTitle>
        {comparison.length > 1 ? (
          <>
            <ComparisonChart data={comparison} />
            {performance && (
              <p className="mt-3 text-sm text-slate-400">
                {strategyVerdict(performance)}
              </p>
            )}
          </>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">
            Noch nicht genug Käufe für einen Vergleich — nach den ersten Bot-Läufen
            erscheint hier der Verlauf.
          </p>
        )}
      </Card>
    </div>
  );
}

function strategyVerdict(p: Performance): string {
  const diff = p.profit_pct - p.dca.profit_pct;
  if (Math.abs(diff) < 0.05) {
    return "Die Bot-Strategie und einfaches DCA liegen aktuell praktisch gleichauf.";
  }
  if (diff > 0) {
    return `✅ Die Bot-Strategie schlägt einfaches DCA aktuell um ${diff.toFixed(2).replace(".", ",")} Prozentpunkte (Bot ${p.profit_pct.toFixed(2)}% vs. DCA ${p.dca.profit_pct.toFixed(2)}%).`;
  }
  return `Einfaches DCA liegt aktuell um ${Math.abs(diff).toFixed(2).replace(".", ",")} Prozentpunkte vorn (Bot ${p.profit_pct.toFixed(2)}% vs. DCA ${p.dca.profit_pct.toFixed(2)}%).`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[(d.getDay() + 6) % 7]}, ${d.toLocaleDateString("de-DE")} ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
}
