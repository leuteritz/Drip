import type { MouseEvent, ReactNode } from "react";

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-card border-2 border-sand bg-paper p-6 shadow-puff ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
      {children}
    </h2>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "teal" | "rose" | "water" | "ink";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-sand-soft text-ink border border-sand",
    teal: "bg-water-soft text-teal border border-water",
    rose: "bg-rose-soft text-rose border border-rose/40",
    water: "bg-water-soft text-ink border border-water",
    ink: "bg-ink text-cream border border-ink",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down";
}) {
  const valueColor =
    tone === "up" ? "text-teal" : tone === "down" ? "text-rose" : "text-ink";
  return (
    <Card className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">
        {label}
      </span>
      <span className={`font-display text-3xl font-semibold ${valueColor}`}>{value}</span>
      {sub && <span className="text-sm text-ink-soft">{sub}</span>}
    </Card>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-13 shrink-0 rounded-full border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
        checked ? "border-teal bg-teal" : "border-sand bg-sand-soft"
      } ${disabled ? "opacity-50" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper shadow transition-all ${
          checked ? "left-[26px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-sand border-t-teal" />
    </div>
  );
}
