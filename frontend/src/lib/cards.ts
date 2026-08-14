/**
 * What the Overview can show, and what it shows by default.
 *
 * This is the registry, and it is on this side deliberately. `digest.BLOCKS`
 * lives on the backend because the backend *renders* the weekly message — a
 * reason about rendering, not about backends. These are rendered by React, so:
 *
 *     the registry lives on the side that renders
 *
 * One rule, applied twice, landing on different sides. `backend/app/cards.py`
 * stores the blob and checks its shape and holds no list at all; its docstring
 * says why, including why it keeps keys it does not recognise where `digest`
 * drops them.
 *
 * Two things are **not** in here, and the omissions are the design:
 *
 * - **The strategy chart**, because it is the section's one `lead`. Hiding it
 *   promotes nothing — `Pulse` is a `strip` — so it would leave a section with
 *   no lead at all, which is a shape the design system does not have. It is
 *   also the question `Method` asks; letting the answer go while the question
 *   stays is backwards.
 * - **`Pulse`**, because it is the only thing on the page that reports a
 *   *fault*. An overdue drip is stated in exactly one place in the whole UI —
 *   the header's pill fires on preflight `fail`, which overdue is not, and
 *   `watch.py` says it on Discord, which is not the page. Hiding the one card
 *   that can tell you a buy never landed is hiding the smoke alarm on a bot
 *   whose entire failure mode is a week nobody noticed. It carries the catch-up
 *   switch besides, which is the setting that fixes the problem it reports.
 *
 * `Method` *is* here, and it is the one most people will turn off: it is the
 * only block on the page that by its own design carries no live figure, and a
 * block that never changes is a block you have read. `FirstRun` ignores this
 * setting and always renders it — somebody with no buys cannot have formed an
 * opinion about it yet.
 */

export interface CardSpec {
  key: string;
  /** What the dialog calls it. Not necessarily the card's own heading. */
  label: string;
  description: string;
  /** What an install that has never chosen sees, and what a *new* card gets. */
  default: boolean;
}

/** Page order, so ticking a row reads top to bottom like the page. */
export const CARDS: CardSpec[] = [
  {
    key: "method",
    label: "What Drip does",
    description: "The three steps before a buy: what it reads, the score, the five rungs",
    default: true,
  },
  {
    key: "basis",
    label: "What you paid",
    description: "Your average price against the market's own average over the same days",
    default: true,
  },
  {
    key: "ages",
    label: "One-year rule",
    description: "Which buys are past the German holding period, and when the rest ripen",
    default: true,
  },
  {
    key: "waterline",
    label: "Under water",
    description: "How deep the stack has been, and the buys you made down there",
    default: true,
  },
  {
    key: "years",
    label: "Year by year",
    description: "The same history a year at a time, rather than all-time",
    default: true,
  },
  {
    key: "custody",
    label: "Where it is kept",
    description: "How much of what you bought is still sitting on the exchange",
    default: true,
  },
  {
    key: "outlook",
    label: "Where it is going",
    description: "The rate you are stacking at, and the next round number",
    default: true,
  },
];

/**
 * The stored blob resolved against the defaults. Never throws.
 *
 * A key that is missing falls back to that card's own `default`, which is what
 * makes a card added in a later version arrive switched **on** — the rule
 * `digest.selection` states, and the reason the backend stores `"{}"` rather
 * than a written-out list. A corrupted blob means every card falls back the
 * same way: the page that would let you fix it is the page this would break.
 *
 * This is the only thing in the app that parses that string.
 */
export function selection(stored: string | null | undefined): Record<string, boolean> {
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(stored || "{}");
  } catch {
    parsed = {};
  }
  const raw =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  const out: Record<string, boolean> = {};
  for (const card of CARDS) {
    out[card.key] = card.key in raw ? Boolean(raw[card.key]) : card.default;
  }
  return out;
}

/** The keys that are on, for a `show(key)` that reads as one. */
export function visible(stored: string | null | undefined): Set<string> {
  return new Set(
    Object.entries(selection(stored))
      .filter(([, on]) => on)
      .map(([key]) => key),
  );
}

/**
 * One card flipped, as the object to PUT.
 *
 * The whole resolved selection goes up rather than the single change, so the
 * column ends up holding what is actually on screen instead of accumulating
 * only the keys somebody happened to touch. The backend merges either way.
 */
export function merged(
  stored: string | null | undefined,
  key: string,
  on: boolean,
): Record<string, boolean> {
  return { ...selection(stored), [key]: on };
}
