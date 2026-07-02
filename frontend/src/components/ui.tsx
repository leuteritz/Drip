import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface p-5 shadow-lg shadow-black/20 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </h2>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "red" | "orange" | "gray";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-slate-700/60 text-slate-200",
    green: "bg-up/15 text-up border border-up/40",
    red: "bg-down/15 text-down border border-down/40",
    orange: "bg-btc/15 text-btc border border-btc/40",
    gray: "bg-slate-700/40 text-slate-400 border border-slate-600/40",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
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
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-slate-100";
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
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
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-btc" : "bg-slate-600"
      } ${disabled ? "opacity-50" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-btc" />
    </div>
  );
}
