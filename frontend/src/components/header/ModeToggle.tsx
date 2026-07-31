import { useState } from "react";
import FlaskIcon from "~icons/ph/flask";
import LightningIcon from "~icons/ph/lightning-fill";
import type { BotSettings, BotStatus } from "../../api/client";
import LiveModeDialog from "../LiveModeDialog";

/**
 * Interactive Dry run / Live segmented switch, living in the sticky bar.
 * Going Live is guarded by the shared LiveModeDialog (real-money confirmation);
 * going back to Dry run — the safe direction — applies immediately.
 */
export default function ModeToggle({
  status,
  settings,
  onSetDryRun,
}: {
  status: BotStatus;
  settings: BotSettings | null;
  onSetDryRun: (dry: boolean) => void;
}) {
  const [confirmLive, setConfirmLive] = useState(false);
  const dry = status.dry_run;
  const seg =
    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";

  return (
    <>
      <div
        role="group"
        aria-label="Trading mode"
        className="flex items-center gap-0.5 rounded-full bg-teal/12 p-0.5"
      >
        <button
          type="button"
          aria-pressed={dry}
          onClick={() => !dry && onSetDryRun(true)}
          className={`${seg} ${dry ? "bg-cream text-teal-deep shadow-sm" : "text-teal/70 hover:text-teal"}`}
        >
          <FlaskIcon /> Dry run
        </button>
        <button
          type="button"
          aria-pressed={!dry}
          onClick={() => dry && setConfirmLive(true)}
          className={`${seg} ${!dry ? "bg-rose-deep text-cream shadow-sm" : "text-teal/70 hover:text-teal"}`}
        >
          <LightningIcon /> Live
        </button>
      </div>
      {confirmLive && settings && (
        <LiveModeDialog
          settings={settings}
          onCancel={() => setConfirmLive(false)}
          onConfirm={() => {
            setConfirmLive(false);
            onSetDryRun(false);
          }}
        />
      )}
    </>
  );
}
