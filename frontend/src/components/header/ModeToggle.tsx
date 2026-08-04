import { useState } from "react";
import FlaskIcon from "~icons/ph/flask";
import LightningIcon from "~icons/ph/lightning-fill";
import type { BotSettings, BotStatus } from "../../api/client";
import LiveModeDialog from "../LiveModeDialog";
import { SEGMENT, SEGMENT_OFF, SEGMENT_ON, SEGMENT_ON_LIVE, TRAY } from "./chrome";

/**
 * Interactive Dry run / Live segmented switch — the first tray in the sticky
 * bar, and the only one that can change what a buy costs.
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

  return (
    <>
      <div role="group" aria-label="Trading mode" className={TRAY}>
        <button
          type="button"
          aria-pressed={dry}
          onClick={() => !dry && onSetDryRun(true)}
          className={`${SEGMENT} ${dry ? SEGMENT_ON : SEGMENT_OFF}`}
        >
          <FlaskIcon /> <span className="max-sm:hidden">Dry run</span>
        </button>
        <button
          type="button"
          aria-pressed={!dry}
          onClick={() => dry && setConfirmLive(true)}
          className={`${SEGMENT} ${!dry ? SEGMENT_ON_LIVE : SEGMENT_OFF}`}
        >
          <LightningIcon /> <span className="max-sm:hidden">Live</span>
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
