import type { ReactNode } from "react";
import InfoIcon from "~icons/ph/info";
import { toneText, type Tone } from "../ui";

/** The range switcher every research card carries in its own header. */
export function RangePills<T extends number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3 py-1 text-xs font-bold transition ${
            value === option.value
              ? "bg-ink text-cream"
              : "bg-sand-soft text-ink-soft hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A headline figure. Same shape as the overview's KPI so the page reads as one. */
export function Stat({
  label,
  tone = "plain",
  hint,
  children,
}: {
  label: string;
  tone?: Tone;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <dl className="min-w-[130px] flex-1 rounded-xl bg-sand-soft/60 px-4 py-2.5">
      <dt className="text-xs font-medium text-ink-soft">{label}</dt>
      <dd className={`font-display text-xl font-semibold ${toneText(tone)}`}>
        {children}
      </dd>
      {hint && <dd className="mt-0.5 text-xs text-ink-soft">{hint}</dd>}
    </dl>
  );
}

/** The explanatory footnote under a research card. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-ink-soft">
      <InfoIcon className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** Card header: title on the left, controls pushed right. */
export function CardHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
        {title}
      </h3>
      {children}
    </div>
  );
}

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
