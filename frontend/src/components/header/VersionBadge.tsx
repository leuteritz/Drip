import { useEffect, useRef, useState } from "react";
import { formatDayMonthYear } from "../../lib/format";
import { CHANGELOG, VERSION } from "../../version";

/** How many releases the popover lists before it starts scrolling. */
const VISIBLE_RELEASES = 4;

/**
 * The version chip next to the brand. Clicking it opens a compact popover with
 * what changed, newest release first — enough to answer "is my Pi running the
 * build I just deployed?" without turning into a release-notes page.
 */
export default function VersionBadge() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape or a click anywhere outside the chip and its popover.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    /* Dropped on a phone: the trays on the right are what the bar is for, and
       the build number is the one thing there you can also read in Setup. */
    <div ref={wrapRef} className="relative max-sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Version ${VERSION} — what's new`}
        className="rounded-full bg-teal/10 px-2 py-0.5 text-2xs font-bold leading-none text-teal transition hover:bg-teal/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      >
        v{VERSION}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="What's new"
          className="absolute left-0 top-full z-40 mt-2 max-h-[20rem] w-[18rem] overflow-y-auto rounded-2xl bg-paper p-3 text-left shadow-puff"
        >
          {CHANGELOG.slice(0, VISIBLE_RELEASES).map((release, i) => (
            <div key={release.version} className={i > 0 ? "mt-3 border-t border-sand pt-3" : ""}>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-sm font-semibold text-ink">
                  v{release.version}
                </span>
                <span className="text-2xs text-ink-soft">
                  {formatDayMonthYear(release.date)}
                </span>
              </div>
              <ul className="mt-1.5 space-y-1">
                {release.changes.map((change) => (
                  <li key={change} className="flex gap-1.5 text-xs text-ink-soft">
                    <span aria-hidden="true" className="text-teal">
                      &bull;
                    </span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
