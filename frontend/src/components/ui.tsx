import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
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
      className={`relative rounded-card border-2 border-sand bg-paper p-6 shadow-puff md:p-7 ${className}`}
    >
      {children}
    </div>
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
    <div className="flex flex-wrap items-end gap-x-5 gap-y-2 pb-1">
      <h2 className="flex items-center gap-3 font-display text-4xl font-bold leading-none text-ink">
        <span className="text-3xl text-teal">{icon}</span>
        {title}
      </h2>
      {subtitle && (
        <span className="max-w-prose text-base text-ink-soft">{subtitle}</span>
      )}
      {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Card header: title on the left, controls pushed right, and — where the card
 * needs one — the ⓘ that holds everything the card used to say in prose.
 *
 * The footnotes are not gone, they are one click away: `info` is exactly what
 * `Note` used to render under the card. Keeping them off the page is what lets
 * every figure above be set large enough to read from across a desk.
 */
export function CardHeader({
  title,
  info,
  children,
}: {
  title: string;
  info?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h3 className="font-display text-xl font-semibold leading-tight text-ink">
        {title}
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {info && <InfoButton label={`About “${title}”`}>{info}</InfoButton>}
      </div>
    </div>
  );
}

/**
 * The ⓘ that opens a card's footnote.
 *
 * A popover rather than an inline reveal: the text is long, and a card that
 * grows by six lines when you ask a question pushes everything below it down
 * the page. Escape and a click outside both close it, like every other
 * transient surface in the app.
 */
export function InfoButton({
  label = "What this shows",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`flex h-9 w-9 items-center justify-center rounded-full text-base transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
          open
            ? "bg-teal-deep text-cream"
            : "bg-sand-soft text-ink-soft hover:bg-water-soft hover:text-teal"
        }`}
      >
        <InfoIcon aria-hidden="true" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute right-0 top-[calc(100%+0.6rem)] z-20 w-[34rem] max-w-[min(34rem,80vw)] rounded-card border-2 border-sand bg-paper p-5 text-sm leading-relaxed text-ink-soft shadow-puff"
        >
          {children}
        </div>
      )}
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
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
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
    <dl className="min-w-[11rem] flex-1 rounded-xl bg-sand-soft/60 px-5 py-3.5">
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-soft">
        {label}
      </dt>
      <dd
        className={`mt-1 font-display text-3xl font-semibold leading-none ${toneText(tone)}`}
      >
        {children}
      </dd>
      {hint && <dd className="mt-1.5 text-xs text-ink-soft">{hint}</dd>}
    </dl>
  );
}

/**
 * The one line under a card: what the thing above it is telling you, in a
 * sentence. Anything longer belongs in the header's ⓘ — a card that has to be
 * read before it can be looked at is a card nobody reads.
 */
export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-sm leading-relaxed text-ink-soft">{children}</p>;
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

/** Profit/loss colouring, shared by every number that can go either way.
 *  Green up, rose down — and green only ever means this. `teal` is the brand's
 *  own colour and says nothing about whether a figure is good news. */
export function toneText(tone?: Tone): string {
  if (tone === "up") return "text-kelp";
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
          checked ? "left-[calc(100%-1.375rem)]" : "left-0.5"
        }`}
      />
    </button>
  );
}

/**
 * The bare ring. Reach for `Loading` instead unless there is genuinely
 * nothing to say about the wait.
 *
 * `on` is the ground it spins against: the tank is dark in both themes, so a
 * ring up there is cream and everything below it is teal on sand.
 */
export function Spinner({
  className = "h-8 w-8",
  on = "paper",
}: {
  className?: string;
  on?: Ground;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-spin rounded-full border-[3px] ${
        on === "water" ? "border-cream/25 border-t-cream" : "border-sand border-t-teal"
      } ${className}`}
    />
  );
}

/** Paper is every card in the page; water is the tank and the wall display. */
export type Ground = "paper" | "water";

const WAIT_TEXT: Record<Ground, { what: string; why: string; hint: string }> = {
  paper: { what: "text-ink", why: "text-ink-soft", hint: "text-teal" },
  water: { what: "text-cream", why: "text-cream/70", hint: "text-cream/85" },
};

/**
 * The wait's own clock: a ring with the seconds in the middle of it.
 *
 * The arc creeps around as the wait goes on and the ring turns slowly under it,
 * so a still frame still reads as "working" and a long wait *looks* long. It is
 * deliberately asymptotic and never closes: nothing here knows how long the
 * fetch will take, and a bar that fills to the end would be a promise the app
 * cannot keep. The number sits inside rather than beside — it costs no width,
 * moves no text, and four of them in a row read as four stopwatches instead of
 * four flickering labels.
 */
const CIRCUMFERENCE = 2 * Math.PI * 15.5; // r = 15.5 in the 36-unit viewBox
/** Seconds at which the arc is ~63% round; it approaches the cap from there. */
const CREEP = 9;
const ARC_CAP = 0.93;

function ClockRing({
  seconds,
  on,
  size = "md",
}: {
  seconds: number;
  on: Ground;
  size?: "sm" | "md";
}) {
  const filled = Math.min(ARC_CAP, 0.14 + (1 - Math.exp(-seconds / CREEP)) * 0.86);
  const water = on === "water";

  return (
    <div
      role="status"
      aria-label={`Loading, ${seconds} seconds`}
      className={`relative flex flex-none items-center justify-center ${
        size === "sm" ? "h-7 w-7" : "h-11 w-11"
      }`}
    >
      <svg
        viewBox="0 0 36 36"
        className="absolute inset-0 h-full w-full animate-spin"
        style={{ animationDuration: "3.2s" }}
      >
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          strokeWidth={size === "sm" ? 3.5 : 3}
          className={water ? "stroke-cream/20" : "stroke-sand"}
        />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          strokeWidth={size === "sm" ? 3.5 : 3}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - filled)}
          transform="rotate(-90 18 18)"
          className={`transition-[stroke-dashoffset] duration-500 ease-out ${
            water ? "stroke-cream" : "stroke-teal"
          }`}
        />
      </svg>
      {/* Under two seconds there is no number worth reading — and most calls
          never get one. Past a hundred it turns into minutes: three digits do
          not fit the small ring, and by then the minute is the news anyway. */}
      {seconds >= 2 && (
        <span
          className={`relative font-sans text-2xs font-bold leading-none tabular-nums ${
            water ? "text-cream/80" : "text-teal"
          }`}
        >
          {seconds < 100 ? seconds : `${Math.floor(seconds / 60)}m`}
        </span>
      )}
    </div>
  );
}

/** Seconds since this mounted. Half-second ticks so the first "1s" is not a
 *  whole second late; the value itself stays whole seconds. */
export function useElapsed(): number {
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
 * built, carries its own clock, and says why it is taking its time when it
 * drags on.
 *
 * The seconds live *inside* the ring (`ClockRing`), never beside the words: the
 * clock then costs no width wherever a wait fits at all, and a row of them
 * ticks in step instead of jostling the text next to each one.
 *
 * `slow` is the escalation, not a second sentence: keep it for what only
 * matters once the wait is already long.
 *
 * `on="water"` is the same wait in cream, for the tank and the wall display —
 * the one place in the app where type sits on the water rather than on paper.
 */
export function Loading({
  what,
  why,
  slow,
  slowAfter = 6,
  compact = false,
  on = "paper",
}: {
  what: string;
  why?: string;
  slow?: string;
  slowAfter?: number;
  compact?: boolean;
  on?: Ground;
}) {
  const seconds = useElapsed();
  const text = WAIT_TEXT[on];
  const hint = seconds >= slowAfter ? slow : undefined;

  if (compact) {
    return (
      <div className="flex items-center gap-3 py-1">
        <ClockRing seconds={seconds} on={on} size="sm" />
        <div className="min-w-0">
          <p className={`text-sm font-bold ${text.what}`}>{what}</p>
          {why && (
            <p className={`mt-1 text-xs leading-relaxed ${text.why}`}>{why}</p>
          )}
          {hint && (
            <p className={`mt-1 text-xs leading-relaxed ${text.hint}`}>{hint}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-12 text-center">
      <ClockRing seconds={seconds} on={on} />
      <div>
        <p className={`text-base font-bold ${text.what}`}>{what}</p>
        {why && (
          <p className={`mx-auto mt-1.5 max-w-md text-sm leading-relaxed ${text.why}`}>
            {why}
          </p>
        )}
        {hint && (
          <p className={`mx-auto mt-2 max-w-md text-sm leading-relaxed ${text.hint}`}>
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

  // `items-start` plus an auto block margin rather than `items-center`: a
  // centred flex child that outgrows its scroll container has its top clipped
  // with no way to scroll back to it, and at this type size the taller dialogs
  // do outgrow a 1080p screen.
  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-scrim p-4 ${
        align === "top" ? "pt-[12vh]" : ""
      }`}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`flex w-full justify-center ${align === "top" ? "" : "my-auto"}`}
      >
        <Card className={className} onClick={(e) => e.stopPropagation()}>
          {children}
        </Card>
      </div>
    </div>
  );
}
