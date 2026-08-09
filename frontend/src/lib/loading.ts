/**
 * What the app is currently waiting for, in the app's own words.
 *
 * Every card explains its own wait where it stands, but a cold Pi keeps the
 * page busy long after you have scrolled past the tank — so the sticky bar
 * carries one chip that names what is still in the air. This is the register
 * behind it: `track` wraps a request, the key goes in while it runs and comes
 * out however it ends, and `inFlight` is what the chip reads.
 *
 * The labels are the point. "Loading…" says nothing a spinner has not already
 * said; "the 350-day average" says why the wait is worth it. They read as the
 * object of a sentence — the chip puts "Fetching" in front of the first one.
 */
import { useCallback, useMemo, useRef, useState } from "react";

export type LoadKey =
  | "status"
  | "settings"
  | "purchases"
  | "digest"
  | "performance"
  | "balance"
  | "preflight"
  | "indicators";

export const LOAD_LABELS: Record<LoadKey, string> = {
  status: "the schedule",
  settings: "your settings",
  purchases: "your buys",
  digest: "the weekly report",
  performance: "what your stack is worth",
  balance: "your Coinbase balance",
  preflight: "whether the next buy will land",
  indicators: "this week's signal",
};

/** The order they are named in, so the chip does not reshuffle as calls land. */
const ORDER: LoadKey[] = [
  "indicators",
  "performance",
  "balance",
  "preflight",
  "purchases",
  "status",
  "settings",
  "digest",
];

export interface LoadTracker {
  /** Runs, in the order above. Empty means the page is done. */
  inFlight: LoadKey[];
  /** Wraps a request so the bar knows about it; the promise is returned as-is. */
  track: <T>(key: LoadKey, promise: Promise<T>) => Promise<T>;
}

export function useLoadTracker(): LoadTracker {
  const [running, setRunning] = useState<Record<string, number>>({});
  // A ref as well as state: two calls for the same key can overlap (a refresh
  // fired while the first is still out), so the key leaves only on the last one.
  const counts = useRef<Record<string, number>>({});

  const bump = useCallback((key: LoadKey, by: number) => {
    const next = { ...counts.current, [key]: (counts.current[key] ?? 0) + by };
    if (next[key] <= 0) delete next[key];
    counts.current = next;
    setRunning(next);
  }, []);

  const track = useCallback(
    <T,>(key: LoadKey, promise: Promise<T>): Promise<T> => {
      bump(key, 1);
      return promise.finally(() => bump(key, -1));
    },
    [bump],
  );

  const inFlight = useMemo(
    () => ORDER.filter((key) => running[key] > 0),
    [running],
  );

  return { inFlight, track };
}
