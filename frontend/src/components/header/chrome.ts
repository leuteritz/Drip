/**
 * The sticky bar's own vocabulary — two shapes, and nothing else.
 *
 * The bar used to be a row of eight free-floating pills that all looked alike:
 * a mode switch, a report, three chrome buttons and three nav links, every one
 * of them its own island in the same teal tint. Nothing said which of them
 * belonged together, so the bar read as an accumulation rather than a design.
 *
 * It is now three **trays**. A tray is the capsule; the buttons inside it are
 * transparent until you touch them, so the group is the shape and the items are
 * its contents. `SEGMENT` is for a tray whose items are mutually exclusive (the
 * mode switch, the jump-nav) — exactly one of them wears `SEGMENT_ON`.
 *
 * Everything in the bar is `text-xs`: one size, so the three trays share a
 * baseline and a height whatever they carry. Keep new bar pieces on these
 * constants rather than inventing a ninth pill.
 *
 * On a phone every item grows to a 2.75rem square (`TOUCH`). A cursor lands on
 * a 27px pill; a fingertip is nine millimetres across and lands near it, so the
 * bar keeps its shapes and only changes the size of the thing you aim at. The
 * icons inside step up with it — see the `text-sm max-sm:text-base` each of
 * them carries.
 */

/** The capsule. Put items straight inside it — it brings its own padding. */
export const TRAY = "flex shrink-0 items-center gap-0.5 rounded-full bg-teal/10 p-1";

/** What a fingertip needs, and only where there is one. */
const TOUCH = "max-sm:h-11 max-sm:min-w-11 max-sm:justify-center max-sm:text-sm";

/** Shared by every item in a tray; the variants below add the padding and the
 *  colour, never twice, so no two conflicting utilities meet in one string. */
const ITEM =
  `flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${TOUCH}`;

/** A button in a tray — a way in, not a state. */
export const TRAY_ITEM = `${ITEM} px-2.5 py-1.5 text-xs text-teal hover:bg-teal/15`;
/** The same button when the thing behind it is switched off. */
export const TRAY_ITEM_MUTED = `${ITEM} px-2.5 py-1.5 text-xs text-teal/50 hover:bg-teal/15 hover:text-teal`;
/** The same button when it wants attention — a missing key, and nothing else. */
export const TRAY_ITEM_ALERT = `${ITEM} px-2.5 py-1.5 text-xs bg-rose-soft text-rose hover:opacity-80`;

/** One choice of a segmented tray. Wears exactly one of the two states below. */
export const SEGMENT = `${ITEM} px-3 py-1.5 text-xs`;
/** The chosen segment: cream on a solid fill, so it reads as pressed. */
export const SEGMENT_ON = "bg-teal-deep text-cream shadow-sm";
/** The chosen segment of the one switch that spends real money. */
export const SEGMENT_ON_LIVE = "bg-rose-deep text-cream shadow-sm";
export const SEGMENT_OFF = "text-teal/70 hover:bg-teal/12 hover:text-teal";
