import {
  Children,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import ArrowSquareOutIcon from "~icons/ph/arrow-square-out";
import InfoIcon from "~icons/ph/info";

/**
 * How much of the page a card is asking for. Four weights, because six cards
 * all shouting in the same voice is a list, not a composition.
 *
 * - `panel` — the default, and what every card used to be: a surface floating
 *   on the page.
 * - `lead` — the section's one thesis, on the page ground itself. No fill and
 *   no rim, so it reads as the page talking rather than as one card among six.
 *   **At most one per section**; the moment there are two, neither leads.
 * - `strip` — status rather than analysis (`Pulse`, `Custody`). It keeps the
 *   rim and gives up the lift, so it is present without competing.
 * - `alert` — something went wrong. It is a weight rather than a `className`
 *   because the rim is drawn by `--shadow-card` now, and a passed-in
 *   `border-rose/50` has no border width left to colour.
 */
export type CardTone = "panel" | "lead" | "strip" | "alert";

const CARD_TONE: Record<CardTone, string> = {
  panel: "bg-paper shadow-card",
  lead: "",
  strip: "bg-paper/70 shadow-card-flat",
  alert: "bg-paper shadow-card ring-2 ring-rose/50",
};

/**
 * The one surface in the app.
 *
 * It is a **container**, and everything laid out inside it says `@`: since the
 * page body took a fixed measure (`max-w-shell`), a card's width no longer
 * follows the window — a half-width card on a 2560px monitor is the same
 * ~33rem it is on a 1400px one. A KPI row keyed to the *viewport* therefore
 * asked for three columns in a card with room for two, and broke its own
 * figures across lines. Reach for `@lg:`/`@4xl:` inside a card, never `sm:`,
 * for anything whose room comes from the card rather than from the screen.
 *
 * A `lead` keeps the same padding as the others on purpose: with no box of its
 * own it would otherwise sit flush to the measure while every card below it
 * held an inset, and the column would read as ragged.
 */
export function Card({
  children,
  className = "",
  tone = "panel",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  tone?: CardTone;
  onClick?: (e: MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`relative @container rounded-card p-4 sm:p-6 md:p-7 ${CARD_TONE[tone]} ${className}`}
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
      <h2 className="flex items-center gap-2.5 font-display text-3xl font-bold leading-none text-ink sm:gap-3 sm:text-4xl">
        <span className="text-2xl text-teal sm:text-3xl">{icon}</span>
        {title}
      </h2>
      {/* `w-full` on a phone rather than a flex item that sizes to its own
          content: a subtitle listing three figures has a max-content width
          wider than the glass, and as its own line it simply wraps. */}
      {subtitle && (
        <span className="w-full min-w-0 max-w-prose text-sm text-ink-soft sm:w-auto sm:text-base">
          {subtitle}
        </span>
      )}
      {/* The actions sit at the far end of the heading where there is room for
          them, and become their own full-width row where there is not — a
          right-aligned tail of four buttons on a phone is a column of orphans. */}
      {actions && (
        <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">{actions}</div>
      )}
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
        className={`flex h-10 w-10 items-center justify-center rounded-full text-base transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:h-9 sm:w-9 ${
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
          className="absolute right-0 top-[calc(100%+0.6rem)] z-20 max-h-[60vh] w-[34rem] max-w-[min(34rem,88vw)] overflow-y-auto rounded-card bg-paper p-4 text-sm leading-relaxed text-ink-soft shadow-card sm:p-5"
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
          className={`rounded-full px-4 py-2.5 text-xs font-bold transition sm:py-1.5 ${
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
    /* No width of its own: `StatRow` owns how many share a line. A tile that
       set its own minimum used to win that argument and push a six-figure euro
       amount out of its own box. */
    <dl className="rounded-xl bg-sand-soft/60 px-5 py-3.5">
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
 * The row a card's KPI tiles sit in — the only way to lay `Stat`s out.
 *
 * It exists because there used to be two ways and neither knew how wide the
 * card was: seven rows were a `flex-wrap` (which let `flex-1` stretch the last
 * tile of a wrapped row across the whole card) and four were a grid keyed to
 * the *viewport* (which asked for three columns in a half-width card and broke
 * its own figures across lines). Both are one thing now, and it measures the
 * **card** rather than the window — see `Card`.
 *
 * How many share a line follows from how many there are: five tiles read best
 * as 3+2, four as one line of four, three as a line of three. Below `@4xl` it
 * is two, and in a card narrower than `@lg` it is one.
 *
 * `@lg` (32rem) rather than `@md` is measured, not chosen: a phone card holds
 * about 28rem and a half-width card on a desk about 33rem, so that is the only
 * step that separates them. Two tiles at phone width leaves each about eleven
 * characters — `3.27640569 BTC` breaks across two lines — and a KPI that has to
 * be reassembled by the reader is not one.
 */
export function StatRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  // `toArray` rather than `Children.count`: a tile rendered conditionally comes
  // through as `false`, and a row of "four" that is really three would pick the
  // wrong column count.
  const n = Children.toArray(children).length;
  const wide = n >= 5 ? "@4xl:grid-cols-3" : n === 4 ? "@4xl:grid-cols-4" : n === 3 ? "@4xl:grid-cols-3" : "";
  return (
    <div className={`grid grid-cols-1 gap-2 @lg:grid-cols-2 ${wide} ${className}`}>
      {children}
    </div>
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

/**
 * The one way Drip says "this leaves the page".
 *
 * Three things say it, and they say it the same way everywhere: the mark
 * (`arrow-square-out`, the web's own sign for it), the **host named out loud**
 * in the tooltip and to a screen reader, and a new tab — the dashboard may be
 * mid-buy, and a link that only shows you something elsewhere may never
 * navigate this page away.
 *
 * It carries no look of its own: an out-link is a plain row in a dialog, a
 * pill on the water, a line in a list, and each is styled where it lives. What
 * cannot be restyled is the promise — so it is this component that makes it,
 * and a raw `<a target="_blank">` anywhere else is a link that forgot to say
 * where it goes.
 */
export function OutLink({
  href,
  host,
  children,
  className = "",
  markClassName = "text-sm",
}: {
  href: string;
  /** The bare hostname, read out loud. `lib/coinbase.ts`'s `HOST` holds ours. */
  host: string;
  children: ReactNode;
  className?: string;
  /** The mark is sized by whatever it rides in, so its classes come from there. */
  markClassName?: string;
}) {
  const says = `Opens ${host} in a new tab`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={says}
      className={className}
    >
      {children}
      <ArrowSquareOutIcon className={`shrink-0 ${markClassName}`} aria-hidden="true" />
      <span className="sr-only">{says}</span>
    </a>
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
  //
  // On a phone it is a sheet instead: full width, along the bottom edge, its
  // lower corners squared off against it. That is where a thumb is, it is the
  // shape a phone has taught everyone to expect a dialog to have, and it means
  // the widest thing in every dialog gets the whole glass rather than the
  // glass minus two gutters. `max-sm:mt-14` keeps the sheet clear of the
  // sticky bar, so there is always something of the page left behind it.
  // The palette is the exception to the sheet: it is a search field with a
  // keyboard about to cover the lower half of the screen, so it stays at the
  // top on a phone as it does everywhere else.
  const sheet = align === "center";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-scrim p-4 ${
        sheet ? "max-sm:items-end max-sm:p-0" : "pt-[12vh] max-sm:px-2 max-sm:pt-4"
      }`}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`flex w-full justify-center ${
          sheet ? "my-auto max-sm:mb-0 max-sm:mt-14" : ""
        }`}
      >
        <Card
          className={`max-sm:!w-full max-sm:!max-w-none ${
            sheet
              ? "max-sm:rounded-b-none max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]"
              : ""
          } ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </Card>
      </div>
    </div>
  );
}
