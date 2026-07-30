// Drip's version and its short changelog.
//
// Single source of truth for both — the header badge reads VERSION, the popover
// reads CHANGELOG. Newest release first; `VERSION` is always CHANGELOG[0].
//
// Keep entries short: one line per change, written for the person running the
// bot, not for the person who wrote the code. Bump minor for features and
// refactors, major for a change that alters how Drip is operated or deployed.
// `package.json` mirrors the same number.

export interface Release {
  version: string;
  /** ISO date, formatted for display by the badge. */
  date: string;
  changes: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: "1.1",
    date: "2026-07-30",
    changes: [
      "Overview chart split in two: euros on top, BTC price and your buys below",
      "Taller chart with bigger labels and a legend that matches the lines",
      "Dropped the second price axis that made the old chart hard to read",
      "Hovering either half reads out the same day in both",
    ],
  },
  {
    version: "1.0",
    date: "2026-07-30",
    changes: [
      "First versioned release",
      "Header split into modules, dead code removed",
      "Backend split into market data and trading",
      "Typed API responses shared with the dashboard",
      "Escape closes every dialog, API errors are shown",
    ],
  },
];

export const VERSION = CHANGELOG[0].version;
