// Shared Recharts configuration.
//
// Colors are referenced as CSS custom properties so the `@theme` block in
// index.css stays the single source of truth for the palette — SVG resolves
// var() in stroke/fill just like CSS does. Never inline a hex here.

export const CHART_COLORS = {
  water: "var(--color-water)",
  teal: "var(--color-teal)",
  rose: "var(--color-rose)",
  sand: "var(--color-sand)",
  ink: "var(--color-ink)",
  inkSoft: "var(--color-ink-soft)",
  paper: "var(--color-paper)",
};

export const CHART_MARGIN = { top: 10, right: 8, left: 8, bottom: 0 };

export const GRID_PROPS = {
  stroke: CHART_COLORS.sand,
  strokeDasharray: "3 5",
  vertical: false,
  opacity: 0.6,
};

/** Shared date axis: "2026-07-30" is shown as "07-30" to keep ticks short. */
export const DATE_AXIS_PROPS = {
  dataKey: "date",
  tick: { fill: CHART_COLORS.inkSoft, fontSize: 11 },
  tickFormatter: (d: string) => d.slice(5),
  axisLine: { stroke: CHART_COLORS.sand },
  tickLine: false,
  minTickGap: 40,
};

/** BTC prices are plotted in thousands to keep the axis narrow. */
export const fmtThousands = (v: number) => `${Math.round(v / 1000)}k`;

/** The teardrop marking a buy on the price line. */
export const DROP_PATH = "M6 0 C4.2 3.2 2 5.4 2 8 a4 4 0 0 0 8 0 c0-2.6-2.2-4.8-4-8Z";
