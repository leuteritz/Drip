import MagnifyingGlassIcon from "~icons/ph/magnifying-glass";

/** Mac writes it ⌘K, everything else Ctrl K. Read once — nobody switches OS
 *  mid-session, and it is only ever a label. */
const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

export const PALETTE_SHORTCUT = MAC ? "⌘K" : "Ctrl K";

/**
 * The way into the command palette for anyone who does not already know the
 * shortcut — and the only place the shortcut is written down.
 */
export default function PaletteButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Search commands (${PALETTE_SHORTCUT})`}
      aria-label="Search commands"
      aria-keyshortcuts="Meta+K Control+K"
      className="flex items-center gap-1.5 rounded-full bg-teal/10 px-2.5 py-1.5 text-2xs font-bold text-teal transition hover:bg-teal/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
    >
      <MagnifyingGlassIcon className="text-sm" />
      <span className="max-lg:hidden">{PALETTE_SHORTCUT}</span>
    </button>
  );
}
