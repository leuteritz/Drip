import WarningIcon from "~icons/ph/warning-fill";
import type { Preflight } from "../../api/client";

/**
 * The one thing the preflight says without being asked.
 *
 * It sits on the *left* of the sticky bar, beside the build and the paused
 * pill, because that side is what Drip currently **is** — everything there
 * comes and goes on its own, and nothing you might be aiming at moves when it
 * does. The trays on the right are things you do; this is not one.
 *
 * It shows for `fail` and nothing else, and that threshold is the whole design.
 * A warning here would be permanent on most installs — no Discord webhook is a
 * fair way to run a bot — and a badge that is always lit is a badge nobody
 * reads by the week it means something. So the bar carries only the state that
 * costs a buy: the next drip would not land. Everything else waits in the
 * dialog behind it, where all six checks are listed whatever they say.
 *
 * In dry run this is silent by construction rather than by a rule of its own:
 * the backend softens a failure to a warning when no order would be placed, so
 * a test-mode install cannot show a blocked buy it was never going to make.
 */
export default function PreflightPill({
  report,
  onOpen,
}: {
  report: Preflight | null;
  onOpen: () => void;
}) {
  if (report?.status !== "fail") return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      title="Something would stop the next buy — open the check"
      /* `max-sm:h-11 min-w-11` is `chrome.ts`'s TOUCH, restated rather than
         imported: this is not a tray item, but a fingertip does not know that
         and the two sit in the same row. */
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-rose-soft px-3 py-1.5 text-2xs font-bold text-rose transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose max-sm:h-11 max-sm:min-w-11 max-sm:justify-center max-sm:px-2"
    >
      <WarningIcon className="text-sm" aria-hidden="true" />
      {/* The word gives way before the icon does, the same order the brand and
          the nav labels stand down in. */}
      <span className="max-sm:hidden">Next buy blocked</span>
      <span className="sr-only sm:hidden">Next buy blocked</span>
    </button>
  );
}
