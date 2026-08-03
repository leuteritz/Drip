import { useEffect, useState } from "react";
import { LOAD_LABELS, type LoadKey } from "../../lib/loading";
import { Spinner } from "../ui";

/**
 * What the page is still waiting for, in the sticky bar.
 *
 * Every wait in the app explains itself where it stands — but those are all
 * below the fold once you have scrolled, and a cold Pi is still fetching a
 * year of daily candles while you are already reading the history. So the bar
 * carries one line that follows you: the thing being fetched, named, and how
 * many are behind it. It is gone the moment the page is complete, which is the
 * other half of the job — a dashboard that never says "done" is a dashboard
 * you cannot trust to be current.
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

  useEffect(() => {
    if (!busy) {
      setShown(false);
      return;
    }
    const id = window.setTimeout(() => setShown(true), GRACE_MS);
    return () => window.clearTimeout(id);
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
      </span>
    </div>
  );
}
