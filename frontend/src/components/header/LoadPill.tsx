import { useEffect, useState } from "react";
import { LOAD_LABELS, type LoadKey } from "../../lib/loading";
import { Spinner } from "../ui";

/**
 * What the page is still waiting for, in the sticky bar.
 *
 * Every wait in the app explains itself where it stands — but those are all
 * below the fold once you have scrolled, and a cold Pi is still fetching a
 * year of daily candles while you are already reading the history. So the bar
 * carries one line that follows you: the thing being fetched, named, how many
 * are behind it, and how long it has been going. It is gone the moment the page
 * is complete, which is the other half of the job — a dashboard that never says
 * "done" is a dashboard you cannot trust to be current.
 *
 * The clock here is text rather than the ring-with-a-number the cards use: at
 * this size the ring is 12px across and nothing legible fits inside it.
 *
 * The bar it sits in is `text-teal` over a ground that goes from open water to
 * blurred paper as you scroll, so the pill borrows the same teal tint as the
 * chips beside it rather than bringing a colour of its own.
 */
/** A warm backend answers in a blink; nothing should flash for that. */
const GRACE_MS = 400;

export default function LoadPill({ loading }: { loading: LoadKey[] }) {
  const busy = loading.length > 0;
  const [shown, setShown] = useState(false);
  // Counted from when this run of fetching started, not from when the pill
  // appeared: the clock is about the wait, not about the pill.
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!busy) {
      setShown(false);
      setSeconds(0);
      return;
    }
    const started = Date.now();
    const grace = window.setTimeout(() => setShown(true), GRACE_MS);
    const tick = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      500,
    );
    return () => {
      window.clearTimeout(grace);
      window.clearInterval(tick);
    };
  }, [busy]);

  if (!busy || !shown) return null;

  const [first, ...rest] = loading;

  return (
    <div
      role="status"
      aria-live="polite"
      title={`Still fetching ${loading.map((key) => LOAD_LABELS[key]).join(", ")}`}
      className="flex items-center gap-2 rounded-full bg-teal/10 px-3 py-1.5 text-2xs font-bold text-teal"
    >
      <Spinner className="h-3 w-3 border-[1.5px]" />
      <span className="max-sm:hidden">
        Fetching {LOAD_LABELS[first]}
        {rest.length > 0 && (
          <span className="font-semibold text-teal/70"> · {rest.length} more</span>
        )}
        {seconds >= 2 && (
          <span className="font-semibold tabular-nums text-teal/70"> · {seconds}s</span>
        )}
      </span>
    </div>
  );
}
