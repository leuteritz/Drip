import { useCallback, useEffect, useState, type MouseEvent } from "react";
import XIcon from "~icons/ph/x";
import TrendUpIcon from "~icons/ph/trend-up";
import TrendDownIcon from "~icons/ph/trend-down";
import {
  api,
  fmtEur,
  fmtPct,
  WEEKDAYS,
  type BotSettings,
  type SimulationResult,
} from "../api/client";
import ComparisonChart from "./ComparisonChart";
import { Card, Spinner } from "./ui";

const PERIODS = [
  { label: "1m", days: 30 },
  { label: "3m", days: 90 },
  { label: "6m", days: 182 },
  { label: "1y", days: 365 },
  { label: "2y", days: 730 },
];

export default function SimulationModal({
  settings,
  onClose,
}: {
  settings: BotSettings;
  onClose: () => void;
}) {
  const [days, setDays] = useState(365);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.getSimulation(d));
    } catch (e) {
      setError(String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run(days);
  }, [days, run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const s = result?.summary;
  const botWins = s ? s.bot.profit_pct >= s.dca.profit_pct : true;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={onClose}
    >
      <Card
        className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto"
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Backtest simulation</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Replays your current settings -{" "}
              <b className="text-ink">
                every {WEEKDAYS[settings.schedule_weekday]}, {fmtEur(settings.base_amount_eur)} base
              </b>{" "}
              - against real historical prices.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full bg-sand-soft p-2 text-ink-soft transition hover:text-ink"
          >
            <XIcon />
          </button>
        </div>

        <div className="mt-4 flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                days === p.days
                  ? "bg-ink text-cream"
                  : "bg-sand-soft text-ink-soft hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border-2 border-rose/50 bg-rose-soft p-4 text-sm font-bold text-rose">
            {error}
          </div>
        )}

        {loading && <Spinner />}

        {!loading && s && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SimStat
                label="Drip result"
                value={fmtPct(s.bot.profit_pct)}
                sub={`${fmtEur(s.bot.value_eur)} value`}
                tone={s.bot.profit_pct >= 0 ? "up" : "down"}
                highlight={botWins}
              />
              <SimStat
                label="Plain DCA"
                value={fmtPct(s.dca.profit_pct)}
                sub={`${fmtEur(s.dca.value_eur)} value`}
                tone={s.dca.profit_pct >= 0 ? "up" : "down"}
                highlight={!botWins}
              />
              <SimStat
                label="Invested"
                value={fmtEur(s.bot.invested_eur)}
                sub={`${s.purchase_count} buys`}
              />
              <SimStat
                label="BTC stacked"
                value={s.bot.btc_total.toFixed(6)}
                sub="by Drip"
              />
            </div>

            {result && result.series.length > 1 ? (
              <div className="mt-4">
                <ComparisonChart data={result.series} />
                <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
                  {botWins ? <TrendUpIcon /> : <TrendDownIcon />}
                  {verdict(s.bot.profit_pct, s.dca.profit_pct)}
                </p>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-ink-soft">
                Not enough historical data for this period.
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function SimStat({
  label,
  value,
  sub,
  tone,
  highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down";
  highlight?: boolean;
}) {
  const valueColor =
    tone === "up" ? "text-teal" : tone === "down" ? "text-rose" : "text-ink";
  return (
    <div
      className={`rounded-xl border-2 p-3 ${
        highlight ? "border-teal bg-water-soft" : "border-sand bg-paper"
      }`}
    >
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </div>
      <div className={`mt-1 font-display text-2xl font-semibold ${valueColor}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-ink-soft">{sub}</div>}
    </div>
  );
}

function verdict(botPct: number, dcaPct: number): string {
  const diff = botPct - dcaPct;
  if (Math.abs(diff) < 0.05) {
    return "Drip and plain DCA came out neck and neck over this period.";
  }
  if (diff > 0) {
    return `Drip beat plain DCA by ${diff.toFixed(2)} percentage points over this period.`;
  }
  return `Plain DCA was ahead by ${Math.abs(diff).toFixed(2)} percentage points over this period.`;
}
