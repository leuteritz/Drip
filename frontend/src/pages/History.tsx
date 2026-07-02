import { useEffect, useMemo, useState } from "react";
import { api, fmtBtc, fmtEur, type Purchase } from "../api/client";
import { ScoreDrops } from "../components/drops";
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

  if (error) return <Card className="border-rose/50 font-bold text-rose">{error}</Card>;
  if (!purchases) return <Spinner />;

  const header = (label: string, key: SortKey, align = "text-left") => (
    <th
      className={`cursor-pointer select-none px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-soft hover:text-ink ${align}`}
      onClick={() => {
        if (sortKey === key) setSortDesc(!sortDesc);
        else {
          setSortKey(key);
          setSortDesc(true);
        }
      }}
    >
      {label} {sortKey === key ? (sortDesc ? "▾" : "▴") : ""}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-3xl font-semibold">Buy history</h1>
        {totals && (
          <div className="text-sm text-ink-soft">
            {totals.count} buys, {fmtEur(totals.eur)}, {fmtBtc(totals.btc)}
          </div>
        )}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b-2 border-sand bg-sand-soft/60">
            <tr>
              {header("Date", "timestamp")}
              {header("BTC price", "price_eur", "text-right")}
              {header("Amount", "amount_eur", "text-right")}
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
                BTC
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
                F&amp;G
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
                RSI
              </th>
              {header("Score", "score", "text-left")}
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr
                key={p.id}
                className={`border-b border-sand/50 ${i % 2 ? "bg-sand-soft/30" : ""}`}
              >
                <td className="whitespace-nowrap px-4 py-3 text-ink">
                  {new Date(p.timestamp).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-4 py-3 text-right">{fmtEur(p.price_eur, 0)}</td>
                <td className="px-4 py-3 text-right font-bold">{fmtEur(p.amount_eur)}</td>
                <td className="px-4 py-3 text-right text-ink-soft">
                  {p.btc_amount.toFixed(8)}
                </td>
                <td className="px-4 py-3 text-right">{p.fear_greed}</td>
                <td className="px-4 py-3 text-right">{p.rsi.toFixed(1)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ScoreDrops multiplier={p.multiplier} size="text-sm" />
                    <span className="text-xs text-ink-soft">x{p.multiplier}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {p.order_id === "ERROR" ? (
                    <Badge tone="rose">Error</Badge>
                  ) : p.dry_run ? (
                    <Badge tone="neutral">Dry run</Badge>
                  ) : (
                    <Badge tone="teal">Bought</Badge>
                  )}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-ink-soft">
                  No buys yet. Run a test buy from the overview, or wait for the first
                  scheduled run.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
