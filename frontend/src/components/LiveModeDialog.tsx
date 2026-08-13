import WarningIcon from "~icons/ph/warning-fill";
import type { BotSettings } from "../api/client";
import { scheduleSentence } from "../lib/cadence";
import { fmtEur } from "../lib/format";
import { Modal } from "./ui";

/**
 * The single source of truth for the "turn on live trading" confirmation — the
 * real-money guard shared by the Settings toggle and the header ModeToggle.
 * Never weaken this: switching to live must always route through it.
 */
export default function LiveModeDialog({
  settings,
  onCancel,
  onConfirm,
}: {
  settings: BotSettings;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={onCancel} className="w-full max-w-md ring-2 ring-rose/60">
      <h3 className="mb-2 flex items-center gap-2 font-display text-xl font-semibold text-rose">
        <WarningIcon /> Turn on live trading?
      </h3>
      <p className="text-sm text-ink">
        Drip will buy <b>with real money</b> through your Coinbase API -{" "}
        {scheduleSentence(settings)}, base amount {fmtEur(settings.base_amount_eur)}{" "}
        (times the market multiplier).
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-full bg-sand-soft px-5 py-3 text-sm font-bold text-ink max-sm:flex-1 sm:py-2.5"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="rounded-full bg-rose-deep px-5 py-3 text-sm font-bold text-cream transition hover:opacity-90 max-sm:flex-1 sm:py-2.5"
        >
          Trade live
        </button>
      </div>
    </Modal>
  );
}
