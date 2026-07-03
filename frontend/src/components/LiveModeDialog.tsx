import WarningIcon from "~icons/ph/warning-fill";
import { fmtEur, WEEKDAYS, type BotSettings } from "../api/client";
import { Card } from "./ui";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <Card className="max-w-md border-rose/60">
        <h3 className="mb-2 flex items-center gap-2 font-display text-xl font-semibold text-rose">
          <WarningIcon /> Turn on live trading?
        </h3>
        <p className="text-sm text-ink">
          Drip will buy <b>with real money</b> through your Coinbase API - every{" "}
          {WEEKDAYS[settings.schedule_weekday]} at {settings.schedule_time}, base amount{" "}
          {fmtEur(settings.base_amount_eur)} (times the market multiplier).
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-full bg-sand-soft px-5 py-2.5 text-sm font-bold text-ink"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-full bg-rose px-5 py-2.5 text-sm font-bold text-cream transition hover:opacity-90"
          >
            Trade live
          </button>
        </div>
      </Card>
    </div>
  );
}
