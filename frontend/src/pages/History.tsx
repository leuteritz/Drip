import { useMemo, useState } from "react";
import ListDashesIcon from "~icons/ph/list-dashes";
import TrashIcon from "~icons/ph/trash";
import UploadSimpleIcon from "~icons/ph/upload-simple";
import { api, fmtBtc, fmtEur, type Purchase } from "../api/client";
import { ScoreDrops } from "../components/drops";
import ImportModal from "../components/ImportModal";
import { Badge, Card, SectionHeading } from "../components/ui";

type SortKey = "timestamp" | "price_eur" | "amount_eur" | "score";

export default function HistorySection({
  purchases,
  onChanged,
}: {
  purchases: Purchase[];
  onChanged: () => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDesc, setSortDesc] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const deleteOne = async (p: Purchase) => {
    if (!window.confirm("Delete this entry from the history?")) return;
    setBusy(true);
    try {
      await api.deletePurchase(p.id);
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const clearTestRuns = async () => {
    if (!window.confirm("Delete all dry-run (test) entries from the history?")) return;
    setBusy(true);
    try {
      await api.clearTestRuns();
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const hasTestRuns = useMemo(() => purchases.some((p) => p.dry_run), [purchases]);

  const sorted = useMemo(() => {
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
    const ok = purchases.filter((p) => p.order_id !== "ERROR");
    return {
      count: ok.length,
      eur: ok.reduce((s, p) => s + p.amount_eur, 0),
      btc: ok.reduce((s, p) => s + p.btc_amount, 0),
    };
  }, [purchases]);

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
    <section id="history" className="scroll-mt-20 flex flex-col gap-4 px-4 pb-8 pt-5 md:px-6 md:pb-10 md:pt-6">
      <SectionHeading
        icon={<ListDashesIcon />}
        title="Buy history"
        subtitle={`${totals.count} buys · ${fmtEur(totals.eur)} invested · ${fmtBtc(
          totals.btc,
        )} stacked`}
        actions={
          <>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 rounded-full bg-sand-soft px-4 py-2 text-sm font-bold text-teal transition hover:bg-water-soft"
            >
              <UploadSimpleIcon /> Import CSV
            </button>
            {hasTestRuns && (
              <button
                onClick={clearTestRuns}
                disabled={busy}
                className="flex items-center gap-2 rounded-full bg-sand-soft px-4 py-2 text-sm font-bold text-rose transition hover:bg-rose-soft disabled:opacity-40"
              >
                <TrashIcon /> Clear test runs
              </button>
            )}
          </>
        }
      />

      {error ? (
        <Card className="border-rose/50 font-bold text-rose">{error}</Card>
      ) : (
        <Card className="flex flex-col overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b-2 border-sand bg-sand-soft">
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
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
                    <span className="sr-only">Actions</span>
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
                    <td className="px-4 py-3 text-right font-bold">
                      {fmtEur(p.amount_eur)}
                    </td>
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
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteOne(p)}
                        disabled={busy}
                        aria-label="Delete entry"
                        className="rounded-lg p-2 text-ink-soft transition hover:bg-rose-soft hover:text-rose disabled:opacity-40"
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-ink-soft">
                      <p>
                        No buys yet. Run a test buy from the overview, or wait for the first
                        scheduled run.
                      </p>
                      <button
                        onClick={() => setShowImport(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-sand-soft px-4 py-2 text-sm font-bold text-teal transition hover:bg-water-soft"
                      >
                        <UploadSimpleIcon /> Import CSV history
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false);
            onChanged();
          }}
        />
      )}
    </section>
  );
}
