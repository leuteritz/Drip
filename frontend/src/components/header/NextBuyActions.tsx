import { useEffect, useRef, useState } from "react";
import CheckIcon from "~icons/ph/check";
import DropIcon from "~icons/ph/drop";
import DropFillIcon from "~icons/ph/drop-fill";
import PauseIcon from "~icons/ph/pause";
import PencilIcon from "~icons/ph/pencil-simple";
import PlayIcon from "~icons/ph/play-fill";
import QuestionIcon from "~icons/ph/question";
import type { BotSettings, BotStatus, Indicators } from "../../api/client";
import { fmtEur, formatDayMonth, formatWeekdayTime, WEEKDAYS } from "../../lib/format";
import { ScoreDrops } from "../drops";
import { Loading } from "../ui";
import { useNow, WEEK_MS } from "./hooks";

/** Which value on the card is being edited. Owned by SiteHeader, so the command
 *  palette can open one from anywhere in the scroll. */
export type SpoutEdit = "amount" | "when";

const AMOUNT_MIN = 5;
const AMOUNT_MAX = 500;
const AMOUNT_STEP = 5;

const PAUSE_OPTIONS = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "4 weeks", days: 28 },
];

const SAVED_FLASH_MS = 1800;

const ACTION =
  "flex h-14 items-center justify-center gap-2 rounded-2xl px-7 text-base font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60";
const CAPTION = "text-2xs font-bold uppercase tracking-[0.18em] text-teal/60";

/** A value you can click to change it — the pencil only surfaces on hover, so
 *  the row still reads as a figure rather than as a form. */
const VALUE_CHIP =
  "group inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-2.5 py-0.5 tracking-[0.1em] text-teal/80 transition hover:bg-teal/20 hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";
const PENCIL = "text-2xs opacity-0 transition-opacity group-hover:opacity-100";

const STEP_BUTTON =
  "flex h-9 w-9 flex-none items-center justify-center rounded-full bg-teal/12 text-xl leading-none text-teal transition hover:bg-teal/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";
const SMALL_PILL =
  "rounded-full px-3 py-1 text-2xs font-bold uppercase tracking-[0.14em] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";
const DONE =
  "flex items-center gap-1 rounded-full bg-teal-deep px-3 py-1 text-2xs font-bold uppercase tracking-[0.14em] text-cream transition hover:opacity-90";
const TIME_FIELD =
  "rounded-full bg-teal/12 px-3 py-1 font-sans text-sm font-bold text-teal outline-none transition hover:bg-teal/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";

const clampAmount = (v: number) =>
  Math.round(Math.max(AMOUNT_MIN, Math.min(AMOUNT_MAX, v)));

/** "in 3 days" / "in 5 h" / "in 20 min" — how far off the next drip is. */
function untilLabel(ms: number): string {
  if (ms <= 0) return "due now";
  if (ms < 60 * 60 * 1000) return `in ${Math.max(1, Math.round(ms / 60_000))} min`;
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 24) return `in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  return `in ${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * The spout of the tank: a full-width bar under the read-outs carrying the
 * next scheduled buy — when it lands and how big it is — plus every action
 * that can move money, and only those: the dry-run test and a manual buy. The
 * backtest used to sit here as a third button; it spends nothing and answers a
 * question about the strategy rather than about this week, so it lives in the
 * sticky bar's tools tray now, with the other things that only open a dialog.
 *
 * It is also where the drip is *set*. There used to be a sliders button here
 * opening a settings drawer under the card; the numbers it held are the same
 * numbers this card already states, so they are edited where they are read
 * instead: click the schedule chip to change the day, the time or to pause,
 * click the amount to change the base. Nothing here is a second copy of a
 * figure shown above it, and there is no panel to open and close.
 *
 * Buy uses the same simple mechanic as the bot (a market buy for an amount) via
 * ManualBuyDialog; in live mode it turns rose to signal real money. The pipe
 * along the bottom edge fills as the week runs down toward the next drip.
 */
export default function NextBuyActions({
  indicators,
  settings,
  status,
  editing,
  onEdit,
  onSaveSettings,
  onPause,
  onResume,
  onTestBuy,
  onBuy,
  onExplain,
  running,
  buying,
}: {
  indicators: Indicators | null;
  settings: BotSettings | null;
  status: BotStatus | null;
  editing: SpoutEdit | null;
  onEdit: (target: SpoutEdit | null) => void;
  onSaveSettings: (update: Partial<BotSettings>) => Promise<void>;
  onPause: (days: number) => Promise<void>;
  onResume: () => Promise<void>;
  onTestBuy: () => void;
  onBuy: () => void;
  onExplain: () => void;
  running: boolean;
  buying: boolean;
}) {
  const now = useNow();
  const live = status != null && !status.dry_run;
  const paused = status?.paused === true;

  const cardRef = useRef<HTMLDivElement | null>(null);
  const amountRef = useRef<HTMLInputElement | null>(null);
  // The typed base amount, committed (clamped) on Enter, on blur and on any
  // click outside the card. Null means "show the saved value".
  const [amountDraft, setAmountDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Prefer the scheduler's own next-run time; fall back to the configured slot
  // while the status is still loading.
  const nextWhen = status?.next_run
    ? formatWeekdayTime(status.next_run)
    : settings
      ? `${WEEKDAYS[settings.schedule_weekday].slice(0, 3)} ${settings.schedule_time}`
      : "—";
  const remaining = status?.next_run
    ? new Date(status.next_run).getTime() - now
    : null;
  // The pipe fills as the week drains toward the next buy.
  const filled =
    remaining == null ? 0 : Math.max(0, Math.min(1, 1 - remaining / WEEK_MS));

  const editingAmount = editing === "amount" && settings != null;
  const editingWhen = editing === "when" && settings != null;

  // What the card shows while the base is being typed: the draft if it parses,
  // the saved value otherwise, so the preview underneath never reads NaN.
  const draftNumber = Number((amountDraft ?? "").replace(",", "."));
  const baseAmount = settings
    ? amountDraft != null && Number.isFinite(draftNumber)
      ? clampAmount(draftNumber)
      : settings.base_amount_eur
    : 0;

  const amount =
    settings && indicators
      ? fmtEur(settings.base_amount_eur * indicators.multiplier)
      : "—";
  const dot = amount.lastIndexOf(".");
  const amountMain = dot >= 0 ? amount.slice(0, dot) : amount;
  const amountCents = dot >= 0 ? amount.slice(dot) : "";

  const save = async (update: Partial<BotSettings>) => {
    await onSaveSettings(update);
    setSaved(true);
    window.setTimeout(() => setSaved(false), SAVED_FLASH_MS);
  };

  const commitAmount = () => {
    const raw = amountDraft;
    setAmountDraft(null);
    if (raw == null || !settings) return;
    const parsed = Number(raw.replace(",", "."));
    if (!Number.isFinite(parsed)) return;
    const clamped = clampAmount(parsed);
    if (clamped !== settings.base_amount_eur) void save({ base_amount_eur: clamped });
  };

  const setAmount = (value: number) => {
    if (!settings) return;
    const clamped = clampAmount(value);
    setAmountDraft(String(clamped));
    if (clamped !== settings.base_amount_eur) void save({ base_amount_eur: clamped });
  };

  const startEdit = (target: SpoutEdit) => {
    if (!settings) return;
    setAmountDraft(target === "amount" ? String(settings.base_amount_eur) : null);
    onEdit(target);
  };

  const closeEdit = () => {
    commitAmount();
    onEdit(null);
  };

  // The amount input takes focus however the editor was opened — clicking the
  // figure, or the command palette from three sections down the page.
  useEffect(() => {
    if (editing !== "amount") return;
    amountRef.current?.focus();
    amountRef.current?.select();
  }, [editing]);

  // Escape abandons the draft, a click anywhere outside the card keeps it —
  // the same bargain as every other inline field in the app.
  useEffect(() => {
    if (editing == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAmountDraft(null);
      onEdit(null);
    };
    const onDown = (e: MouseEvent) => {
      if (cardRef.current?.contains(e.target as Node)) return;
      commitAmount();
      onEdit(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
    // Re-registered whenever the draft changes: the handlers commit it, so they
    // have to close over the current one.
  }, [editing, amountDraft, settings, onEdit]);

  const savedFlash = saved && (
    <span className="inline-flex items-center gap-1 rounded-full bg-teal-deep px-2.5 py-0.5 tracking-[0.1em] text-cream">
      <CheckIcon className="text-2xs" /> Saved
    </span>
  );

  return (
    <div
      ref={cardRef}
      className="relative mx-auto mt-8 w-full max-w-spout overflow-hidden rounded-[2rem] bg-spout pb-2.5 shadow-[0_28px_64px_-26px_rgba(0,0,0,.62)]"
    >
      {/* A pool of water around the drop, so the bar reads as the tank's spout
          rather than a white slab dropped onto it */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(16rem_11rem_at_5rem_50%,rgba(147,183,190,.22),transparent_72%)]"
      />

      <div className="relative flex flex-col gap-6 px-6 py-6 md:flex-row md:flex-wrap md:items-center md:gap-7 md:px-8 md:py-7">
        {/* Left: the drop, the amount, and what makes it that size — every
            figure here doubling as the way to change it */}
        <div className="flex min-w-0 flex-1 items-center gap-5">
          <span
            className={`relative flex h-16 w-16 flex-none items-center justify-center rounded-full text-3xl text-cream shadow-[0_10px_22px_-10px_rgba(47,90,99,.9)] ${
              paused ? "bg-rose-deep" : "bg-teal-deep"
            }`}
          >
            <span className="absolute inset-0 rounded-full ring-8 ring-teal/8" />
            {paused ? <PauseIcon /> : <DropFillIcon />}
          </span>

          <div className="min-w-0 flex-1">
            {/* Row one: when the drip lands — or, open, the day and time it
                lands on and how long it is switched off for */}
            {editingWhen ? (
              <div className={`flex flex-wrap items-center gap-x-2 gap-y-2 ${CAPTION}`}>
                <span>Every</span>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map((day, idx) => (
                    <button
                      key={day}
                      type="button"
                      title={day}
                      aria-pressed={settings.schedule_weekday === idx}
                      onClick={() => void save({ schedule_weekday: idx })}
                      className={`h-8 w-10 rounded-full text-xs font-bold transition ${
                        settings.schedule_weekday === idx
                          ? "bg-teal-deep text-cream"
                          : "bg-teal/10 text-teal/70 hover:bg-teal/25 hover:text-teal"
                      }`}
                    >
                      {day.slice(0, 2)}
                    </button>
                  ))}
                </div>
                {/* "at" and the clock stay one token: split across a wrap they
                    leave a stranded preposition at the end of the line. */}
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  at
                  <input
                    type="time"
                    aria-label="Time of day"
                    value={settings.schedule_time}
                    onChange={(e) => void save({ schedule_time: e.target.value })}
                    className={TIME_FIELD}
                  />
                </span>
                <button type="button" onClick={() => onEdit(null)} className={DONE}>
                  <CheckIcon /> Done
                </button>
                {savedFlash}
              </div>
            ) : editingAmount ? (
              /* The big figure below is the base while it is being typed, not
                 the buy it produces — so the caption says which is which. */
              <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 ${CAPTION}`}>
                <span>Base amount</span>
                <span className="normal-case tracking-normal text-teal/50">
                  &euro;{AMOUNT_MIN}&ndash;&euro;{AMOUNT_MAX}
                </span>
              </div>
            ) : (
              <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 ${CAPTION}`}>
                <span>Next buy</span>
                <button
                  type="button"
                  disabled={!settings}
                  onClick={() => startEdit("when")}
                  title="Change the day, the time or pause the drip"
                  className={VALUE_CHIP}
                >
                  {nextWhen}
                  <PencilIcon className={PENCIL} />
                </button>
                {paused && status?.paused_until ? (
                  <button
                    type="button"
                    onClick={() => void onResume()}
                    title="Resume the drip"
                    className="group inline-flex items-center gap-1.5 rounded-full bg-rose/12 px-2.5 py-0.5 tracking-[0.1em] text-rose transition hover:bg-rose/25"
                  >
                    Paused until {formatDayMonth(status.paused_until)}
                    <PlayIcon className={PENCIL} />
                  </button>
                ) : (
                  remaining != null && (
                    <span className="normal-case tracking-normal text-teal/50">
                      {untilLabel(remaining)}
                    </span>
                  )
                )}
                {savedFlash}
              </div>
            )}

            {/* Row two: the figure itself — read, or typed into */}
            {editingAmount ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <button
                  type="button"
                  aria-label="Less"
                  onClick={() => setAmount(baseAmount - AMOUNT_STEP)}
                  className={STEP_BUTTON}
                >
                  &minus;
                </button>
                <span className="flex items-baseline font-display text-5xl font-semibold leading-none text-teal md:text-6xl">
                  <span className="text-teal/45">&euro;</span>
                  <input
                    ref={amountRef}
                    type="text"
                    inputMode="decimal"
                    aria-label="Base amount in euros"
                    value={amountDraft ?? String(settings.base_amount_eur)}
                    onChange={(e) => setAmountDraft(e.target.value)}
                    onBlur={commitAmount}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") closeEdit();
                    }}
                    className="w-[2.8em] bg-transparent outline-none"
                  />
                </span>
                <button
                  type="button"
                  aria-label="More"
                  onClick={() => setAmount(baseAmount + AMOUNT_STEP)}
                  className={STEP_BUTTON}
                >
                  +
                </button>
                <button type="button" onClick={closeEdit} className={DONE}>
                  <CheckIcon /> Done
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!settings}
                onClick={() => startEdit("amount")}
                title="Set the base amount"
                className="group -mx-2 mt-1.5 flex items-center gap-3 rounded-2xl px-2 font-display text-5xl font-semibold leading-none text-teal transition hover:bg-teal/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal md:text-6xl"
              >
                <span>
                  {amountMain}
                  <span className="text-teal/45">{amountCents}</span>
                </span>
                <PencilIcon className="text-base opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )}

            {/* Row three: the arithmetic behind the figure — while an editor is
                open it becomes that editor's own controls, so the card keeps
                one shape whatever is being changed */}
            {editingAmount && indicators ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <input
                  type="range"
                  aria-label="Base amount"
                  min={AMOUNT_MIN}
                  max={AMOUNT_MAX}
                  step={AMOUNT_STEP}
                  value={baseAmount}
                  onChange={(e) => setAmountDraft(e.target.value)}
                  onPointerUp={commitAmount}
                  onKeyUp={commitAmount}
                  className="w-full max-w-[18rem] cursor-pointer accent-teal"
                />
                <span className="text-sm font-semibold text-teal/60">
                  &times; {indicators.multiplier} &rarr;{" "}
                  <b className="text-teal">
                    {fmtEur(baseAmount * indicators.multiplier)}
                  </b>{" "}
                  this week
                </span>
                {savedFlash && <span className={CAPTION}>{savedFlash}</span>}
              </div>
            ) : editingWhen ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
                <span className={CAPTION}>Pause</span>
                {paused ? (
                  <button
                    type="button"
                    onClick={() => void onResume()}
                    className={`${SMALL_PILL} flex items-center gap-1 bg-teal-deep text-cream hover:opacity-90`}
                  >
                    <PlayIcon /> Resume now
                  </button>
                ) : (
                  PAUSE_OPTIONS.map((option) => (
                    <button
                      key={option.days}
                      type="button"
                      onClick={() => void onPause(option.days)}
                      className={`${SMALL_PILL} bg-teal/10 text-teal/70 hover:bg-rose/20 hover:text-rose`}
                    >
                      {option.label}
                    </button>
                  ))
                )}
              </div>
            ) : settings && indicators ? (
              <button
                type="button"
                onClick={onExplain}
                title="What makes the next buy this size"
                className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg text-sm font-semibold text-teal/60 transition hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              >
                <ScoreDrops multiplier={indicators.multiplier} size="text-base" />
                <span>
                  {fmtEur(settings.base_amount_eur, 0)} base &times;{" "}
                  {indicators.multiplier}
                </span>
                <QuestionIcon className="text-base opacity-70" />
              </button>
            ) : (
              // The dash above is a figure that cannot be worked out yet, so
              // this row says which half is missing instead of leaving it to
              // look like a bot with nothing scheduled.
              <div className="mt-3">
                <Loading
                  compact
                  what={settings ? "Scoring this week" : "Reading your settings"}
                  why={
                    settings
                      ? "Your base amount is set — the multiplier needs 350 days of prices."
                      : "The base amount and the schedule behind the next buy."
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: everything that can move money. Both wear the brand's drop —
            the same mark as the header's — hollow for a run that spends nothing,
            filled for one that does. */}
        <div className="flex flex-none items-center gap-2.5 max-md:justify-end md:ml-auto md:border-l md:border-teal/12 md:pl-7">
          <button
            onClick={onTestBuy}
            disabled={running}
            title="Run the strategy once without spending anything"
            className={`${ACTION} flex-1 bg-teal/12 text-teal hover:bg-teal/20 focus-visible:outline-teal md:flex-none`}
          >
            <DropIcon className="text-lg" /> {running ? "Testing…" : "Test"}
          </button>
          <button
            onClick={onBuy}
            disabled={buying}
            title={live ? "Place a real market buy" : "Place a dry-run buy"}
            className={`${ACTION} flex-1 md:flex-none ${
              live
                ? "bg-rose-deep text-cream hover:opacity-90 focus-visible:outline-rose"
                : "bg-teal-deep text-cream hover:bg-teal-deep/90 focus-visible:outline-teal"
            }`}
          >
            <DropFillIcon className="text-lg" />
            {buying ? "Buying…" : "Buy"}
          </button>
        </div>
      </div>

      {/* The pipe: fills across the week as the next drip approaches */}
      <div className="absolute inset-x-0 bottom-0 h-2.5 bg-teal/10">
        <div
          className={`h-full rounded-r-full transition-[width] duration-700 ${
            paused ? "bg-rose/45" : "bg-teal/45"
          }`}
          style={{ width: `${filled * 100}%` }}
        />
      </div>
    </div>
  );
}
