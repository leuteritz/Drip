// Shared Recharts configuration.
//
// Colors are referenced as CSS custom properties so the `@theme` block in
// index.css stays the single source of truth for the palette — SVG resolves
// var() in stroke/fill just like CSS does. Never inline a hex here.

import { formatDayMonth } from "./format";

export const CHART_COLORS = {
  water: "var(--color-water)",
  teal: "var(--color-teal)",
  rose: "var(--color-rose)",
  sand: "var(--color-sand)",
  ink: "var(--color-ink)",
  inkSoft: "var(--color-ink-soft)",
  paper: "var(--color-paper)",
};

export const CHART_MARGIN = { top: 10, right: 12, left: 8, bottom: 0 };

/**
 * The root font size the page is currently sized at — `index.css` clamps it
 * between 15px on a laptop and 24px on a 2560px monitor.
 *
 * Recharts wants plain pixel numbers for the axis gutters, so the one thing in
 * the app that cannot be written in rem reads the rem instead. Sampled once at
 * module load: a mid-session resize leaves the gutter slightly wide or narrow,
 * which is invisible, and both stacked charts read the same constant either
 * way — that is the part that has to hold.
 */
const ROOT_PX =
  typeof document !== "undefined"
    ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    : 16;

/**
 * Width reserved for the value axis. The overview stacks two charts that share
 * one x-axis, so their plot areas only line up while this (and the left/right
 * margins) is identical in both — change it in one place or not at all.
 */
export const Y_AXIS_WIDTH = Math.round(ROOT_PX * 4.4);

/** The narrow right-hand axis the score history hangs its bars off. */
export const Y_AXIS_WIDTH_NARROW = Math.round(ROOT_PX * 2.6);

/** Recharts links charts with the same syncId: one hover moves both cursors. */
export const SYNC_ID = "drip-overview";

/**
 * One tick size for every chart. In rem, like the rest of the page: SVG
 * resolves the unit against the root exactly as CSS does, so the axes grow
 * with the monitor instead of staying at a laptop's 12px.
 */
export const AXIS_TICK = { fill: CHART_COLORS.inkSoft, fontSize: "0.8rem" };

/** Labels drawn onto the plot itself (halvings, extremes) sit a notch under it. */
export const PLOT_LABEL_SIZE = "0.72rem";

export const GRID_PROPS = {
  stroke: CHART_COLORS.sand,
  strokeDasharray: "3 5",
  vertical: false,
  opacity: 0.6,
};

/** Shared date axis: "2026-07-30" is shown as "30 Jul". */
export const DATE_AXIS_PROPS = {
  dataKey: "date",
  tick: AXIS_TICK,
  tickFormatter: formatDayMonth,
  axisLine: { stroke: CHART_COLORS.sand },
  tickLine: false,
  minTickGap: Math.round(ROOT_PX * 3.6),
};

/** The dashed crosshair both overview charts drop under the pointer. */
export const CURSOR_PROPS = {
  stroke: CHART_COLORS.ink,
  strokeWidth: 1,
  strokeDasharray: "4 4",
  opacity: 0.35,
};

/**
 * The two compared lines, described once so the chart and the legend swatches
 * beside it can never drift apart. `dash` undefined means solid.
 *
 * Both are profit, not portfolio value, and that is deliberate: plain DCA
 * deploys only the base amount (see portfolio.py) so its *value* is a smaller
 * number for a reason that has nothing to do with which strategy did better.
 * Measured from what each side paid in, the two are comparable, and the gap
 * between them is exactly the "vs. plain DCA" figure above the chart.
 *
 * Rose is deliberately absent here: in the overview it means "at a loss" and
 * marks a buy, and nothing else, so no line competes for that meaning.
 */
export const SERIES = {
  drip: {
    key: "bot_profit",
    label: "Drip strategy",
    color: CHART_COLORS.teal,
    width: 3,
    dash: undefined as string | undefined,
  },
  dca: {
    key: "dca_profit",
    label: "Plain DCA",
    color: CHART_COLORS.inkSoft,
    width: 2,
    dash: "7 5" as string | undefined,
  },
};

/**
 * Not a series, but drawn and listed like one: the zero line both are read
 * from. Its dash is deliberately longer than GRID_PROPS' — at zero it sits on
 * a grid line, and the two must not read as the same thing.
 */
export const BREAK_EVEN = {
  label: "Break-even",
  color: CHART_COLORS.water,
  width: 2,
  dash: "9 4" as string | undefined,
};

/** BTC prices are plotted in thousands to keep the axis narrow. */
export const fmtThousands = (v: number) => `${Math.round(v / 1000)}k`;

/** The teardrop marking a buy on the price line. */
export const DROP_PATH = "M6 0 C4.2 3.2 2 5.4 2 8 a4 4 0 0 0 8 0 c0-2.6-2.2-4.8-4-8Z";

/**
 * A cell tint from the fixed palette: teal for good, rose for bad, mixed into
 * the paper surface by magnitude. `color-mix` on the CSS custom properties
 * keeps the `@theme` block the single source of truth — no hex reaches here.
 *
 * The mix tops out well short of the full hue on purpose. Both teal and rose
 * land mid-tone, where neither ink nor paper text has much contrast left, so
 * the scale stays light enough for ink to stay readable in every cell rather
 * than flipping to paper at the dark end and being worse at both.
 */
export function tintFor(value: number, maxAbs: number) {
  const share = maxAbs > 0 ? Math.min(Math.abs(value) / maxAbs, 1) : 0;
  const strength = Math.round(8 + share * 52);
  const hue = value >= 0 ? "var(--color-teal)" : "var(--color-rose)";
  return {
    background: `color-mix(in srgb, ${hue} ${strength}%, var(--color-paper))`,
    color: "var(--color-ink)",
  };
}
