import { useCallback, useEffect, useState, type DependencyList } from "react";

/**
 * One fetched thing, and what to do when it did not arrive.
 *
 * The dashboard used to collapse six independent loads into a single `error`
 * string and one alert card at the top of the section. Two things were wrong
 * with that: a card whose own fetch fell over sat in its `Loading` branch for
 * ever with the clock ticking up, and the one card that failed took the whole
 * section's heading with it. A load is answered where it is read, so the state
 * belongs beside it.
 *
 * `data` and `error` are never both set: a retry clears the old figures rather
 * than leaving them under a button offering to fetch them again. That is
 * deliberate — a stale number with a "try again" beside it reads as though the
 * number might be the stale one, and there is no way for the reader to tell.
 *
 * **Not wired into `lib/loading.ts`.** `track` returns its promise untouched, so
 * `useResource(() => track("x", api.getX()), deps)` composes with no change to
 * either — but `LoadKey`/`LOAD_LABELS` are for the loads `App` owns and the
 * sticky bar names. The dashboard's are section-owned, the same split
 * `Research.tsx` has always had. The omission is a decision, not an oversight.
 *
 * `enabled` is the other half of the card-visibility setting: **a load nobody is
 * going to read is a request a Pi should not make.** Hiding the waterline stops
 * the backend walking the whole comparison series for it; hiding custody stops
 * the dashboard asking Coinbase at all. A disabled resource is not an error and
 * not a wait — it is `{data: null, error: null}`, which the card never sees,
 * because it is not rendered.
 */
export interface Resource<T> {
  data: T | null;
  /** The failure's own sentence, for `Failed`'s `why`. */
  error: string | null;
  /** Ask again. Puts the card back into its `Loading` branch first. */
  retry: () => void;
}

export function useResource<T>(
  load: () => Promise<T>,
  deps: DependencyList,
  enabled: boolean = true,
): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setData(null);
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // A response that lands after its dependencies moved on is a different
    // question's answer — most visibly when the dry-run filter is toggled twice
    // in a row and the slower first request settles last.
    let live = true;
    load()
      .then((value) => {
        if (!live) return;
        setData(value);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!live) return;
        setData(null);
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      live = false;
    };
    // `load` is a fresh closure every render, so it is deliberately not a
    // dependency — the caller's `deps` say when the question actually changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt, enabled]);

  return { data, error, retry };
}
