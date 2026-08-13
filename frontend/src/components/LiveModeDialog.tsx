import type { BotSettings } from "../api/client";
import { scheduleSentence } from "../lib/cadence";
import { fmtEur } from "../lib/format";
import ConfirmDialog from "./ConfirmDialog";

/**
 * The single source of truth for the "turn on live trading" confirmation — the
 * real-money guard shared by the Settings toggle and the header ModeToggle.
 * Never weaken this: switching to live must always route through it.
 *
 * It sits on `ConfirmDialog` rather than building its own box, which is the same
 * rule it has always followed pointed at the shape instead of the flow: there is
 * one way to ask "are you sure?", so this guard cannot quietly drift into
 * looking softer than the deletions do. What stays its own is the *sentence* —
 * `scheduleSentence` rather than a weekday and a time, because this is the last
 * thing read before real money starts moving and "every Monday at 09:00" on an
 * install that buys daily would be the worst sentence in the app to get wrong.
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
    <ConfirmDialog
      title="Turn on live trading?"
      confirmLabel="Trade live"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      Drip will buy <b>with real money</b> through your Coinbase API -{" "}
      {scheduleSentence(settings)}, base amount {fmtEur(settings.base_amount_eur)}{" "}
      (times the market multiplier).
    </ConfirmDialog>
  );
}
