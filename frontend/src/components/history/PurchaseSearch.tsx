import { useEffect, useMemo, useRef, useState } from "react";
import MagnifyingGlassIcon from "~icons/ph/magnifying-glass";
import XIcon from "~icons/ph/x";
import type { Purchase } from "../../api/client";
import { buildFilter, hasToken, QUERY_CHIPS, toggleToken } from "../../lib/query";

const CHIP =
  "rounded-full px-3 py-1.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";

/**
 * The history's search bar: one field that speaks the little query language in
 * lib/query.ts, plus canned chips for the searches worth one click.
 *
 * The chips carry the count they would leave behind, so filtering never leads
 * into an empty table by surprise, and a chip already in the query removes
 * itself again — they are filters, not text insertion.
 */
export default function PurchaseSearch({
  purchases,
  query,
  onQuery,
  matched,
}: {
  purchases: Purchase[];
  query: string;
  onQuery: (query: string) => void;
  matched: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // "/" jumps into the field from anywhere on the page, the way every search
  // worth using does — unless the user is already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Each chip carries the count it would leave behind if clicked. A chip that
  // is already on can only be clicked off, so it shows what it holds now.
  const counts = useMemo(
    () =>
      QUERY_CHIPS.map((chip) =>
        hasToken(query, chip.token)
          ? matched
          : purchases.filter(buildFilter(toggleToken(query, chip.token))).length,
      ),
    [purchases, query, matched],
  );

  const active = query.trim().length > 0;

  return (
    <div className="flex flex-col gap-3 border-b-2 border-sand bg-sand-soft/50 px-4 py-3.5 md:flex-row md:items-center md:gap-4">
      <div className="relative md:w-[420px]">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onQuery("");
              e.currentTarget.blur();
            }
          }}
          aria-label="Search the buy history"
          placeholder="Search buys — try fg&lt;30 or x1.5"
          className={`h-11 w-full rounded-full border-2 bg-paper pl-11 pr-24 text-sm font-semibold text-ink outline-none transition placeholder:font-normal placeholder:text-ink-soft/70 focus:border-teal ${
            active ? "border-teal" : "border-sand"
          }`}
        />
        <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {active ? (
            <>
              <span className="rounded-full bg-water-soft px-2 py-0.5 text-[11px] font-bold text-teal">
                {matched}
              </span>
              <button
                type="button"
                aria-label="Clear the search"
                onClick={() => {
                  onQuery("");
                  inputRef.current?.focus();
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition hover:bg-sand-soft hover:text-ink"
              >
                <XIcon className="text-sm" />
              </button>
            </>
          ) : (
            !focused && (
              <kbd className="rounded-md border border-sand bg-sand-soft px-1.5 py-0.5 text-[11px] font-bold text-ink-soft">
                /
              </kbd>
            )
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {QUERY_CHIPS.map((chip, i) => {
          const on = hasToken(query, chip.token);
          const count = counts[i];
          return (
            <button
              key={chip.token}
              type="button"
              aria-pressed={on}
              disabled={!on && count === 0}
              onClick={() => onQuery(toggleToken(query, chip.token))}
              className={`${CHIP} ${
                on
                  ? "bg-teal text-cream"
                  : "border border-sand bg-paper text-ink-soft hover:border-water hover:text-ink disabled:opacity-40 disabled:hover:border-sand disabled:hover:text-ink-soft"
              }`}
            >
              {chip.label}
              <span className={`ml-1.5 ${on ? "text-cream/70" : "text-ink-soft/60"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
