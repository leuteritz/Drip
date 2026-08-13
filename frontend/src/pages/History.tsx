import { useMemo, useState } from "react";
import DownloadSimpleIcon from "~icons/ph/download-simple";
import ListDashesIcon from "~icons/ph/list-dashes";
import ReceiptIcon from "~icons/ph/receipt";
import TrashIcon from "~icons/ph/trash";
import UploadSimpleIcon from "~icons/ph/upload-simple";
import XIcon from "~icons/ph/x";
import { api, ORDER_ID_ERROR, type Purchase } from "../api/client";
import { fmtEur, formatTimestamp } from "../lib/format";
import { useStackAmount } from "../lib/units";
import { originNote } from "../lib/origin";
import { buildFilter } from "../lib/query";
import { ScoreDrops } from "../components/drops";
import BuyReceipt from "../components/history/BuyReceipt";
import PurchaseSearch from "../components/history/PurchaseSearch";
import ImportModal from "../components/ImportModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { Badge, Card, Failed, Loading, SectionHeading } from "../components/ui";

type SortKey = "timestamp" | "price_eur" | "amount_eur" | "score";

/** The heading's own buttons. Full-width-ish on a phone, where four of them
 *  right-aligned would be a column of orphans. */
const HEAD_ACTION =
  "flex min-w-0 flex-1 basis-[calc(50%-0.25rem)] items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 py-2.5 text-sm font-bold transition sm:basis-auto sm:flex-none sm:justify-start sm:px-4 sm:py-2";

/** What a phone sorts by, since there is no column header to click there. */
const SORTS: { key: SortKey; label: string }[] = [
  { key: "timestamp", label: "Date" },
  { key: "amount_eur", label: "Amount" },
  { key: "price_eur", label: "Price" },
  { key: "score", label: "Score" },
];

export default function HistorySection({
  purchases,
  query,
  onQuery,
  loading,
  onChanged,
}: {
  purchases: Purchase[];
  /** Owned by App, because the command palette can also set it. */
  query: string;
  onQuery: (query: string) => void;
  /** The first fetch is still out — an empty table is not yet "no buys". */
  loading: boolean;
  onChanged: () => void;
}) {
  const stackAmount = useStackAmount();
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDesc, setSortDesc] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  // Which row is open as a receipt. Both shapes of the table set it, and the
  // dialog fetches its own figures — nothing on the table itself needs them.
  const [receiptOf, setReceiptOf] = useState<Purchase | null>(null);
  // Which deletion is waiting to be confirmed. A row, or every test run.
  const [confirming, setConfirming] = useState<Purchase | "test-runs" | null>(null);

  const runDelete = async (task: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await task();
      onChanged();
      setConfirming(null);
    } catch (e) {
      setError(String(e));
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  };

  const testRuns = useMemo(() => purchases.filter((p) => p.dry_run).length, [purchases]);

  // The search narrows the table, and with it the totals below the heading —
  // "12 of 48 buys" is the point of filtering, so the sums have to follow.
  const filtered = useMemo(
    () => purchases.filter(buildFilter(query)),
    [purchases, query],
  );
  const filtering = query.trim().length > 0;

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDesc ? -cmp : cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDesc]);

  const totals = useMemo(() => {
    const ok = filtered.filter((p) => p.order_id !== ORDER_ID_ERROR);
    return {
      count: ok.length,
      eur: ok.reduce((s, p) => s + p.amount_eur, 0),
      btc: ok.reduce((s, p) => s + p.btc_amount, 0),
    };
  }, [filtered]);

  const allCount = useMemo(
    () => purchases.filter((p) => p.order_id !== ORDER_ID_ERROR).length,
    [purchases],
  );

  /** Same rule as a column header: a new column sorts high-to-low, the one
   *  already sorted flips. Shared by the table's headers and the phone's chips. */
  const sortBy = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const header = (label: string, key: SortKey, align = "text-left") => (
    <th
      className={`cursor-pointer select-none px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-soft hover:text-ink ${align}`}
      onClick={() => sortBy(key)}
    >
      {label} {sortKey === key ? (sortDesc ? "▾" : "▴") : ""}
    </th>
  );

  return (
    <section
      id="history"
      className="pad-safe-x pad-tabbar mx-auto flex w-full max-w-shell scroll-mt-20 flex-col gap-3 px-3 pb-8 pt-5 sm:gap-4 sm:px-4 md:px-6 md:pb-10 md:pt-6"
    >
      <SectionHeading
        icon={<ListDashesIcon />}
        title="Buy history"
        subtitle={`${filtering ? `${totals.count} of ${allCount}` : totals.count} buys · ${fmtEur(
          totals.eur,
        )} invested · ${stackAmount(totals.btc)} stacked`}
        actions={
          <>
            <button
              onClick={() => setShowImport(true)}
              className={`${HEAD_ACTION} bg-sand-soft text-teal hover:bg-water-soft`}
            >
              <UploadSimpleIcon /> Import CSV
            </button>
            <a
              href={api.exportUrl}
              download
              className={`${HEAD_ACTION} bg-sand-soft text-teal hover:bg-water-soft ${
                purchases.length === 0 ? "pointer-events-none opacity-40" : ""
              }`}
            >
              <DownloadSimpleIcon /> Export CSV
            </a>
            {testRuns > 0 && (
              <button
                onClick={() => setConfirming("test-runs")}
                disabled={busy}
                className={`${HEAD_ACTION} bg-sand-soft text-rose hover:bg-rose-soft disabled:opacity-40`}
              >
                <TrashIcon /> Clear test runs
              </button>
            )}
            {/* "Delete all" used to be a third slab here, and on a phone that
                put the one irreversible action in the app above the first buy,
                in the loudest colour on the screen. It lives in Setup →
                System → Maintenance now, which is the drawer for everything
                that cannot be undone by waiting. */}
          </>
        }
      />

      {error ? (
        <Card tone="alert">
          <Failed
            compact
            what="Could not change the history"
            why={error}
            onRetry={() => {
              setError(null);
              onChanged();
            }}
          />
        </Card>
      ) : (
        <Card className="flex flex-col overflow-hidden p-0">
          {purchases.length > 0 && (
            <PurchaseSearch
              purchases={purchases}
              query={query}
              onQuery={onQuery}
              matched={filtered.length}
            />
          )}
          {/* A phone gets the same buys as cards. Nine columns on a 390px
              screen is a sideways scroll with the numbers that matter parked
              off the right-hand edge — and the one control the table carries in
              its headers, the sort, comes back as the chip row above. */}
          {sorted.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 overflow-x-auto border-b-2 border-sand px-3 py-2.5 sm:hidden">
                <span className="shrink-0 pl-1 pr-1 text-2xs font-bold uppercase tracking-[0.12em] text-ink-soft">
                  Sort
                </span>
                {SORTS.map(({ key, label }) => {
                  const on = sortKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => sortBy(key)}
                      className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition ${
                        on ? "bg-ink-solid text-cream" : "bg-sand-soft text-ink-soft"
                      }`}
                    >
                      {label} {on && (sortDesc ? "▾" : "▴")}
                    </button>
                  );
                })}
              </div>
              <ul className="divide-y divide-sand/60 sm:hidden">
                {sorted.map((p) => (
                  <BuyCard
                    key={p.id}
                    purchase={p}
                    busy={busy}
                    amount={stackAmount(p.btc_amount)}
                    onOpen={() => setReceiptOf(p)}
                    onDelete={() => setConfirming(p)}
                  />
                ))}
              </ul>
            </>
          )}

          <div className="overflow-x-auto max-sm:hidden">
            <table className="w-full min-w-[54rem] text-sm">
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
                  /* The whole row opens the receipt, so the target is the row
                     rather than a 2rem icon. The icon in the action column is
                     still a real button — it is what a keyboard and a screen
                     reader reach, and what says the row can be opened at all. */
                  <tr
                    key={p.id}
                    onClick={() => setReceiptOf(p)}
                    className={`cursor-pointer border-b border-sand/50 transition hover:bg-water-soft/50 ${
                      i % 2 ? "bg-sand-soft/30" : ""
                    }`}
                  >
                    {/* Where the buy came from goes under its date, the way
                        the fee goes under the amount it came out of: it is
                        what explains this row landing on this day. Only the
                        two exceptions speak — the weekly drip is what Drip
                        does, and a row that never recorded an origin has
                        nothing to say. */}
                    <td className="whitespace-nowrap px-4 py-3 leading-tight text-ink">
                      <div>{formatTimestamp(p.timestamp)}</div>
                      {originNote(p.origin) && (
                        <div className="text-2xs text-ink-soft">{originNote(p.origin)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{fmtEur(p.price_eur, 0)}</td>
                    {/* The amount is what the buy was ordered for; the fee is
                        the slice of it that never became bitcoin, so it belongs
                        under the number it came out of rather than in a column
                        of its own. Absent on every buy that has none. */}
                    <td className="px-4 py-3 text-right leading-tight">
                      <div className="font-bold">{fmtEur(p.amount_eur)}</div>
                      {p.fee_eur > 0 && (
                        <div className="text-2xs text-ink-soft">
                          {fmtEur(p.fee_eur)} fee
                        </div>
                      )}
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
                      {p.order_id === ORDER_ID_ERROR ? (
                        <Badge tone="rose">Error</Badge>
                      ) : p.dry_run ? (
                        <Badge tone="neutral">Dry run</Badge>
                      ) : (
                        <Badge tone="teal">Bought</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setReceiptOf(p)}
                          aria-label="What became of this buy"
                          className="rounded-lg p-2 text-ink-soft transition hover:bg-water-soft hover:text-teal"
                        >
                          <ReceiptIcon />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirming(p);
                          }}
                          disabled={busy}
                          aria-label="Delete entry"
                          className="rounded-lg p-2 text-ink-soft transition hover:bg-rose-soft hover:text-rose disabled:opacity-40"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* One empty state for both shapes, under whichever of them is on */}
          {sorted.length === 0 && (
            <div className="px-4 py-12 text-center text-ink-soft">
              {loading ? (
                <div className="flex justify-center">
                  <Loading
                    compact
                    what="Reading your buys"
                    why="Every drip the bot has recorded, test runs included."
                  />
                </div>
              ) : filtering ? (
                <>
                  <p>
                    No buy matches <b className="text-ink">{query.trim()}</b>.
                  </p>
                  <button
                    onClick={() => onQuery("")}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-sand-soft px-4 py-2.5 text-sm font-bold text-teal transition hover:bg-water-soft"
                  >
                    <XIcon /> Clear the search
                  </button>
                </>
              ) : (
                <>
                  <p>
                    No buys yet. Run a test buy from the overview, or wait for the first
                    scheduled run.
                  </p>
                  <button
                    onClick={() => setShowImport(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-sand-soft px-4 py-2.5 text-sm font-bold text-teal transition hover:bg-water-soft"
                  >
                    <UploadSimpleIcon /> Import CSV history
                  </button>
                </>
              )}
            </div>
          )}
        </Card>
      )}

      {receiptOf && (
        <BuyReceipt purchase={receiptOf} onClose={() => setReceiptOf(null)} />
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

      {/* Both deletions ask with the thing itself in the question — the buy's
          own date and amount, or how many test runs are about to go. A
          confirmation that names nothing is one people learn to click past. */}
      {confirming === "test-runs" ? (
        <ConfirmDialog
          title="Delete every test run?"
          confirmLabel={`Delete ${testRuns}`}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => runDelete(() => api.clearTestRuns())}
        >
          <b>
            {testRuns} test {testRuns === 1 ? "run" : "runs"}
          </b>{" "}
          will be removed. Real buys are never touched.
        </ConfirmDialog>
      ) : confirming ? (
        <ConfirmDialog
          title="Delete this buy?"
          confirmLabel="Delete"
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => runDelete(() => api.deletePurchase(confirming.id))}
        >
          <b>{formatTimestamp(confirming.timestamp)}</b> &middot;{" "}
          {fmtEur(confirming.amount_eur)}
          {confirming.dry_run ? " (test run)" : ""} &mdash; removed from the history
          for good.
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

/**
 * One buy, as a card — the phone's row of the same table.
 *
 * It carries every column the table does, in the order they are actually read:
 * when it landed — with what asked for it underneath, on the two kinds of buy
 * that were not the weekly drip — and what it cost you, the exchange's fee
 * under the amount it came out of; then how hard the bot bought and whether the order went
 * through, then the price it paid and the bitcoin it got, and last the two
 * readings behind the score. The bitcoin amount follows the unit switch, like
 * every other quantity on the page.
 *
 * The whole card opens the receipt — a phone has no hover to reveal anything
 * with, so the target is the card and the icon beside the bin is what says so.
 */
function BuyCard({
  purchase,
  amount,
  busy,
  onOpen,
  onDelete,
}: {
  purchase: Purchase;
  /** Already formatted in the reader's unit — the row never picks one itself. */
  amount: string;
  busy: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const failed = purchase.order_id === ORDER_ID_ERROR;

  return (
    <li onClick={onOpen} className="flex flex-col gap-2.5 px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-sm font-bold text-ink">
          {formatTimestamp(purchase.timestamp)}
          {originNote(purchase.origin) && (
            <span className="mt-0.5 block text-2xs font-semibold text-ink-soft">
              {originNote(purchase.origin)}
            </span>
          )}
        </span>
        <span className="text-right">
          <span className="block font-display text-2xl font-semibold leading-none text-ink">
            {fmtEur(purchase.amount_eur)}
          </span>
          {purchase.fee_eur > 0 && (
            <span className="mt-1 block text-2xs text-ink-soft">
              {fmtEur(purchase.fee_eur)} fee
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScoreDrops multiplier={purchase.multiplier} size="text-base" />
          <span className="text-xs font-semibold text-ink-soft">
            &times;{purchase.multiplier}
          </span>
        </div>
        {failed ? (
          <Badge tone="rose">Error</Badge>
        ) : purchase.dry_run ? (
          <Badge tone="neutral">Dry run</Badge>
        ) : (
          <Badge tone="teal">Bought</Badge>
        )}
      </div>

      <div className="flex items-end justify-between gap-3 text-xs text-ink-soft">
        <div className="min-w-0 space-y-1">
          <div className="truncate">
            {fmtEur(purchase.price_eur, 0)} &middot;{" "}
            <span className="text-ink">{amount}</span>
          </div>
          <div>
            F&amp;G {purchase.fear_greed} &middot; RSI {purchase.rsi.toFixed(1)}
          </div>
        </div>
        <div className="-mb-1 -mr-1 flex flex-none items-center">
          <button
            onClick={onOpen}
            aria-label="What became of this buy"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition hover:bg-water-soft hover:text-teal"
          >
            <ReceiptIcon className="text-base" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={busy}
            aria-label="Delete entry"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition hover:bg-rose-soft hover:text-rose disabled:opacity-40"
          >
            <TrashIcon className="text-base" />
          </button>
        </div>
      </div>
    </li>
  );
}
