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
    version: "1.11",
    date: "2026-07-31",
    changes: [
      "The weekly report now has its own badge in the top bar — reachable from anywhere, and it opens straight into the editor",
      "The badge fills up across the week, so you can see the next report coming without reading the time",
    ],
  },
  {
    version: "1.10",
    date: "2026-07-31",
    changes: [
      "The weekly report is yours to shape: choose the day, the time and exactly which parts it carries",
      "Twelve sections to pick from, four of them new — the week's price move, how well the week's buy was timed, your next sats milestone and your saving streak",
      "A live preview shows the Discord message as you tick boxes, and sends it on demand",
      "The report can be switched off without touching the buy schedule",
    ],
  },
  {
    version: "1.9",
    date: "2026-07-31",
    changes: [
      "Shorter README with a fresh dashboard screenshot — no change to the bot itself",
    ],
  },
  {
    version: "1.8",
    date: "2026-07-31",
    changes: [
      "A weekly digest on Discord every Sunday at 18:00 — your week in one message",
      "Sats stacked, your entry against the market, and where you stand versus plain DCA",
      "New button beside the Discord toggle sends this week's digest right now",
      "Research: download every scored day as a CSV, to answer questions Drip doesn't",
      "The score chart now marks the halving and the window's highest and lowest close",
    ],
  },
  {
    version: "1.7",
    date: "2026-07-31",
    changes: [
      "Research screens six signals by one test — the three in your score and three that are not",
      "New candidates measured before anything is changed: Mayer Multiple, drawdown from the high, cycle position",
      "A side-by-side of what a softer scoring, or an extra indicator, would have done over 105 windows",
      "Each variant shows its stake next to its edge, so buying more is not mistaken for buying better",
      "Nothing about your bot changed — every one of these is read-only",
    ],
  },
  {
    version: "1.6",
    date: "2026-07-31",
    changes: [
      "Overview now shows your cost basis: your average entry against what buying evenly would have paid",
      "Sats per euro for every buy, so a small stack still has a number that moves",
      "Holding periods: which lots have passed the one-year mark and when the next one does",
      "Buys recorded as failed orders are now named and counted, instead of only being left out",
      "Research: the daily score plotted against the price it was read from",
    ],
  },
  {
    version: "1.5",
    date: "2026-07-31",
    changes: [
      "New Research section — four ways of checking whether the score is worth its multiplier",
      "Where the edge comes from: splits the gap to plain DCA between Fear & Greed, RSI and the 350d MA",
      "How often it worked: the same backtest from every start date, so one lucky window can't flatter it",
      "Does the score see anything: what the price did 30, 90 and 180 days after each score",
      "Weekday against spread: a heatmap of what would have worked — read the warning before you tune anything",
    ],
  },
  {
    version: "1.4",
    date: "2026-07-31",
    changes: [
      "Search bar above the buy history — press / from anywhere to jump into it",
      "Search by date or status, or filter numbers: fg<30, rsi>70, x1.5, amount>=25",
      "One-click chips for real buys, dry runs, errors, fear buys and full drops",
      "The buy count and totals now follow whatever the search leaves on screen",
    ],
  },
  {
    version: "1.3",
    date: "2026-07-31",
    changes: [
      "Next buy is now a wide bar across the header with bigger buttons",
      "It shows how long until the next drip and what makes the amount",
      "A pipe along its bottom edge fills as the week runs down",
    ],
  },
  {
    version: "1.2",
    date: "2026-07-30",
    changes: [
      "Readme cut back to the essentials, with a current dashboard screenshot",
    ],
  },
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
