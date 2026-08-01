import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import InfoIcon from "~icons/ph/info";

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

/** Section divider used to introduce each block of the single-page app. */
export function SectionHeading({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-lg text-teal">{icon}</span>
      <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
      {subtitle && <span className="text-sm text-ink-soft">{subtitle}</span>}
      {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
    </div>
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

/** The range switcher a card carries in its own header. */
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
              ? "bg-ink-solid text-cream"
              : "bg-sand-soft text-ink-soft hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** One headline figure. Every KPI on the page is one of these, so a number in
 *  the overview and the same number in research can never look like two
 *  different kinds of thing. */
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

/** The explanatory footnote under a card. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-ink-soft">
      <InfoIcon className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
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
    ink: "bg-ink-solid text-cream border border-ink-solid",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export type Tone = "up" | "down" | "plain";

/** Profit/loss colouring, shared by every number that can go either way. */
export function toneText(tone?: Tone): string {
  if (tone === "up") return "text-teal";
  if (tone === "down") return "text-rose";
  return "text-ink";
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

/** The bare ring. Reach for `Loading` instead unless there is genuinely
 *  nothing to say about the wait. */
export function Spinner({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-spin rounded-full border-[3px] border-sand border-t-teal ${className}`}
    />
  );
}

/** Seconds since this mounted. Half-second ticks so the first "1s" is not a
 *  whole second late; the value itself stays whole seconds. */
function useElapsed(): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      500,
    );
    return () => window.clearInterval(id);
  }, []);

  return seconds;
}

/**
 * A wait that explains itself.
 *
 * A bare spinner says "something is happening" and nothing more, which is the
 * wrong answer here: Drip's slow calls are slow for a *reason* a saver can
 * understand — a cold cache means Coinbase is being paged 300 days at a time,
 * a backtest re-scores a thousand days. So every wait names what is being
 * built, shows the seconds once there are enough of them to be worth reading,
 * and says why it is taking its time when it drags on.
 *
 * `slow` is the escalation, not a second sentence: keep it for what only
 * matters once the wait is already long.
 */
export function Loading({
  what,
  why,
  slow,
  slowAfter = 6,
  compact = false,
}: {
  what: string;
  why?: string;
  slow?: string;
  slowAfter?: number;
  compact?: boolean;
}) {
  const seconds = useElapsed();
  // Below two seconds the number is noise — most calls never reach it.
  const clock = seconds >= 2 && (
    <span className="ml-2 font-medium tabular-nums text-ink-soft">{seconds}s</span>
  );
  const hint = seconds >= slowAfter ? slow : undefined;

  if (compact) {
    return (
      <div className="flex items-start gap-2.5 py-1">
        <Spinner className="mt-0.5 h-4 w-4 border-2" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-ink">
            {what}
            {clock}
          </p>
          {why && (
            <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{why}</p>
          )}
          {hint && (
            <p className="mt-0.5 text-xs leading-relaxed text-teal">{hint}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
      <Spinner />
      <div>
        <p className="text-sm font-bold text-ink">
          {what}
          {clock}
        </p>
        {why && (
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-soft">
            {why}
          </p>
        )}
        {hint && (
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-teal">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The shared overlay for every dialog in the app.
 *
 * Escape always closes — that is the one interaction users expect from any
 * modal. Dismissing by clicking the backdrop is opt-in via `closeOnBackdrop`,
 * so a confirmation ("delete everything", "trade live") can't be dismissed by
 * a stray click while the browsing dialogs still feel light.
 */
export function Modal({
  children,
  onClose,
  className = "",
  closeOnBackdrop = false,
  align = "center",
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  closeOnBackdrop?: boolean;
  /** "top" is for the command palette, which wants to sit under the pointer
   *  rather than in the middle of a page it is about to jump you around. */
  align?: "center" | "top";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-scrim p-4 ${
        align === "top" ? "items-start pt-[12vh]" : "items-center"
      }`}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <Card className={className} onClick={(e) => e.stopPropagation()}>
        {children}
      </Card>
    </div>
  );
}
