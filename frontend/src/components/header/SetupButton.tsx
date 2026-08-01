import GearIcon from "~icons/ph/gear-six";
import type { BotStatus } from "../../api/client";

/**
 * The way into Setup, in the sticky bar next to the report badge.
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
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-2xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
        missing
          ? "bg-rose-soft text-rose hover:opacity-80"
          : "bg-teal/10 text-teal hover:bg-teal/15"
      }`}
    >
      <GearIcon className="text-sm" />
      {missing && <span className="max-sm:hidden">No API keys</span>}
    </button>
  );
}
