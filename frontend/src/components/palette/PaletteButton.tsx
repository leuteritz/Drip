import MagnifyingGlassIcon from "~icons/ph/magnifying-glass";
import { TRAY_ITEM } from "../header/chrome";

/** Mac writes it ⌘K, everything else Ctrl K. Read once — nobody switches OS
 *  mid-session, and it is only ever a label. */
const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

export const PALETTE_SHORTCUT = MAC ? "⌘K" : "Ctrl K";

/**
 * The way into the command palette for anyone who does not already know the
 * shortcut — and the only place the shortcut is written down. It opens the
 * sticky bar's tools tray, since it is the way into everything else in it.
 *
 * It says "buys" first because that is the half people arrive looking for: the
 * commands are found by anyone who opens it, a date typed into it is not.
 */
export default function PaletteButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Search your buys, or jump to anything (${PALETTE_SHORTCUT})`}
      aria-label="Search buys and commands"
      aria-keyshortcuts="Meta+K Control+K"
      className={TRAY_ITEM}
    >
      <MagnifyingGlassIcon className="text-sm max-sm:text-base" />
      <span className="max-lg:hidden">{PALETTE_SHORTCUT}</span>
    </button>
  );
}
