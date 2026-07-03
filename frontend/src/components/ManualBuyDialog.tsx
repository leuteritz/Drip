import { useEffect, useState } from "react";
import FlaskIcon from "~icons/ph/flask";
import WarningIcon from "~icons/ph/warning-fill";
import { fmtEur, type AccountBalance, type BotSettings, type BotStatus } from "../api/client";
import { Card } from "./ui";

const QUICK_AMOUNTS = [25, 50, 100, 250];
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 10_000;

/**
 * "Pour now" — manual buy with a chosen amount, opened from the Well card.
 * The dialog reflects the stored dry_run setting and never overrides it:
 * in live mode it *is* the real-money confirmation (LiveModeDialog styling),
 * in dry-run it clearly says no real order is placed.
 */
export default function ManualBuyDialog({
  settings,
  status,
  balance,
  buying,
  onCancel,
  onConfirm,
}: {
  settings: BotSettings;
  status: BotStatus;
  balance: AccountBalance | null;
  buying: boolean;
  onCancel: () => void;
  onConfirm: (amountEur: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState(String(settings.base_amount_eur));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const live = !status.dry_run;
  const parsed = Number(draft);
  const amount = Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : NaN;
  const validAmount =
    Number.isFinite(amount) && amount >= MIN_AMOUNT && amount <= MAX_AMOUNT;
  const available = balance?.configured ? balance.eur_available : null;
  // Only block on the well for real orders — a dry run spends nothing.
  const overWell = live && available != null && validAmount && amount > available;
  const canConfirm = validAmount && !overWell && !buying;

  const confirm = async () => {
    if (!canConfirm) return;
    await onConfirm(amount);
    onCancel();
  };

  const chip = (v: number) => (
    <button
      key={v}
      type="button"
      onClick={() => setDraft(String(v))}
      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
        amount === v
          ? live
            ? "bg-rose text-cream"
            : "bg-teal text-cream"
          : "bg-sand-soft text-ink hover:opacity-80"
      }`}
    >
      {fmtEur(v, 0)}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <Card className={`w-full max-w-md ${live ? "border-rose/60" : "border-teal/40"}`}>
        <h3
          className={`mb-2 flex items-center gap-2 font-display text-xl font-semibold ${
            live ? "text-rose" : "text-teal"
          }`}
        >
          {live ? (
            <>
              <WarningIcon /> Buy bitcoin now?
            </>
          ) : (
            <>
              <FlaskIcon /> Test pour
            </>
          )}
        </h3>
        <p className="text-sm text-ink">
          {live ? (
            <>
              This places a <b>real market order</b> on Coinbase, immediately —
              no schedule, no multiplier, just the amount you pour.
            </>
          ) : (
            <>
              Dry run — no real order will be placed. The pour is recorded as a
              test purchase so you can see how it lands in your reservoir.
            </>
          )}
        </p>

        <div className="mt-4">
          <label
            htmlFor="pour-amount"
            className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/60"
          >
            Amount
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-ink/50">
                &euro;
              </span>
              <input
                id="pour-amount"
                type="number"
                min={MIN_AMOUNT}
                max={MAX_AMOUNT}
                step={5}
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirm();
                }}
                className={`w-[120px] rounded-xl border bg-paper py-2 pl-7 pr-3 font-display text-lg font-bold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                  live ? "border-rose/40 focus:border-rose" : "border-teal/30 focus:border-teal"
                }`}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">{QUICK_AMOUNTS.map(chip)}</div>
          </div>
          {!validAmount && draft !== "" && (
            <p className="mt-2 text-xs font-bold text-rose">
              Enter an amount between {fmtEur(MIN_AMOUNT, 0)} and {fmtEur(MAX_AMOUNT, 0)}.
            </p>
          )}
          {overWell && (
            <p className="mt-2 text-xs font-bold text-rose">
              More than your well holds ({fmtEur(available!)} available).
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-full bg-sand-soft px-5 py-2.5 text-sm font-bold text-ink"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!canConfirm}
            className={`rounded-full px-5 py-2.5 text-sm font-bold text-cream transition hover:opacity-90 disabled:opacity-50 ${
              live ? "bg-rose" : "bg-teal"
            }`}
          >
            {buying
              ? "Pouring…"
              : live
                ? `Buy ${validAmount ? fmtEur(amount) : "…"} now`
                : `Pour ${validAmount ? fmtEur(amount) : "…"} (test)`}
          </button>
        </div>
      </Card>
    </div>
  );
}
