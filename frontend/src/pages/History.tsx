import { useEffect, useMemo, useState } from "react";
import { api, fmtBtc, fmtEur, type Purchase } from "../api/client";
import { Badge, Card, Spinner } from "../components/ui";

type SortKey = "timestamp" | "price_eur" | "amount_eur" | "score";

export default function History() {
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDesc, setSortDesc] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getPurchases().then(setPurchases).catch((e) => setError(String(e)));
  }, []);

  const sorted = useMemo(() => {
    if (!purchases) return [];
    const copy = [...purchases];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDesc ? -cmp : cmp;
    });
    return copy;
  }, [purchases, sortKey, sortDesc]);

  const totals = useMemo(() => {
    if (!purchases) return null;
    const ok = purchases.filter((p) => p.order_id !== "ERROR");
    return {
      count: ok.length,
      eur: ok.reduce((s, p) => s + p.amount_eur, 0),
      btc: ok.reduce((s, p) => s + p.btc_amount, 0),
    };
  }, [purchases]);

  if (error) return <Card className="border-down/40 text-down">⚠️ {error}</Card>;
  if (!purchases) return <Spinner />;

  const header = (label: string, key: SortKey, align = "text-left") => (
    <th
      className={`cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 ${align}`}
      onClick={() => {
        if (sortKey === key) setSortDesc(!sortDesc);
        else {
          setSortKey(key);
          setSortDesc(true);
        }
      }}
    >
      {label} {sortKey === key ? (sortDesc ? "▼" : "▲") : ""}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">📜 Kauf-Historie</h1>
        {totals && (
          <div className="text-sm text-slate-400">
            {totals.count} Käufe · {fmtEur(totals.eur)} · {fmtBtc(totals.btc)}
          </div>
        )}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-line bg-surface-2/50">
            <tr>
              {header("Datum", "timestamp")}
              {header("BTC-Preis", "price_eur", "text-right")}
              {header("Betrag", "amount_eur", "text-right")}
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                BTC
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                F&amp;G
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                RSI
              </th>
              {header("Score", "score", "text-right")}
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                Mult.
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-b border-line/50 hover:bg-surface-2/40">
                <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                  {new Date(p.timestamp).toLocaleString("de-DE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtEur(p.price_eur, 0)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {fmtEur(p.amount_eur)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                  {p.btc_amount.toFixed(8)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{p.fear_greed}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.rsi.toFixed(1)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-btc">
                  {p.score}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">×{p.multiplier}</td>
                <td className="px-3 py-2">
                  {p.order_id === "ERROR" ? (
                    <Badge tone="red">Fehler</Badge>
                  ) : p.dry_run ? (
                    <Badge tone="orange">Dry-Run</Badge>
                  ) : (
                    <Badge tone="green">Gekauft</Badge>
                  )}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                  Noch keine Käufe — starte auf dem Dashboard eine Analyse oder warte auf den
                  ersten geplanten Lauf.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
