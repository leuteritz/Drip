import GearIcon from "~icons/ph/gear-six";
import type { BotStatus } from "../../api/client";
import { TRAY_ITEM, TRAY_ITEM_ALERT } from "./chrome";

/**
 * The way into Setup, closing the sticky bar's tools tray.
 *
 * It carries the one piece of setup state worth seeing from every scroll
 * position: whether the backend has what it needs to trade. A dot rather than
 * words, because the hero already says everything else — and the pill turns
 * into a plain gear the moment nothing is missing.
 */
export default function SetupButton({
  status,
  onOpen,
}: {
  status: BotStatus | null;
  onOpen: () => void;
}) {
  const missing = status ? !status.has_credentials : false;

  return (
    <button
      type="button"
      onClick={onOpen}
      title={missing ? "Setup - no Coinbase key stored yet" : "Setup - keys, Discord, system"}
      aria-label="Setup"
      className={missing ? TRAY_ITEM_ALERT : TRAY_ITEM}
    >
      <GearIcon className="text-sm max-sm:text-base" />
      {missing && <span className="max-sm:hidden">No API keys</span>}
    </button>
  );
}
