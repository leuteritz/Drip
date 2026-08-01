import { useState } from "react";
import CaretRightIcon from "~icons/ph/caret-right";
import GearIcon from "~icons/ph/gear-six";
import NewspaperIcon from "~icons/ph/newspaper";
import PaperPlaneIcon from "~icons/ph/paper-plane-tilt";
import PlayIcon from "~icons/ph/play-fill";
import XIcon from "~icons/ph/x";
import type { BotSettings, DigestSettings, Indicators } from "../../api/client";
import { fmtEur, formatDateNumeric, WEEKDAYS } from "../../lib/format";

const PAUSE_OPTIONS = [
  { label: "Running", days: 0 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "4 weeks", days: 28 },
];

const AMOUNT_MIN = 5;
const AMOUNT_MAX = 500;
const AMOUNT_STEP = 5;

const SAVED_FLASH_MS = 2200;
const WEBHOOK_FLASH_MS = 3000;

const FIELD =
  "rounded-xl border border-cream/30 bg-cream/15 px-3 py-2 text-xs font-bold text-cream outline-none [color-scheme:dark] focus:border-cream/70";
const STEP_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-xl bg-cream/15 text-lg leading-none text-cream transition hover:bg-cream/30";
const TILE =
  "flex flex-col items-center gap-2.5 rounded-2xl border border-cream/15 bg-cream/10 p-4 text-center";
const TILE_LABEL = "text-2xs font-bold uppercase tracking-[0.14em] text-cream/60";
/** The full-width rows at the foot of the Discord tile, each opening a dialog. */
const DRAWER_ROW =
  "flex w-full items-center gap-2 rounded-xl bg-cream/12 px-3 py-2 text-left text-xs font-bold text-cream transition hover:bg-cream/25";

/** Mirrors the backend's `bot.is_paused`: a pause covers today as well. */
function isPausedUntil(pausedUntil: string | null): boolean {
  if (pausedUntil == null) return false;
  return new Date(pausedUntil) >= new Date(new Date().toDateString());
}

const clampAmount = (v: number) =>
  Math.round(Math.max(AMOUNT_MIN, Math.min(AMOUNT_MAX, v)));

/**
 * The collapsible glass control bar that folds the old Settings page into the
 * hero: amount stepper, schedule, Discord and pause — each persisting on change
 * through App. Slides open/closed on `open` via a max-height/opacity transition.
 */
export default function FaucetControls({
  open,
  settings,
  digest,
  indicators,
  onClose,
  onSave,
  onPause,
  onResume,
  onTestWebhook,
  onOpenDigest,
  onOpenSetup,
}: {
  open: boolean;
  settings: BotSettings | null;
  digest: DigestSettings | null;
  indicators: Indicators | null;
  onClose: () => void;
  onSave: (update: Partial<BotSettings>) => Promise<void>;
  onPause: (days: number) => Promise<void>;
  onResume: () => Promise<void>;
  onTestWebhook: () => Promise<boolean>;
  onOpenDigest: () => void;
  onOpenSetup: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [sent, setSent] = useState(false);
  const [testing, setTesting] = useState(false);
  // Draft for the typed amount; committed (clamped) on blur or Enter.
  const [amountDraft, setAmountDraft] = useState<string | null>(null);

  const save = async (update: Partial<BotSettings>) => {
    await onSave(update);
    setSaved(true);
    window.setTimeout(() => setSaved(false), SAVED_FLASH_MS);
  };

  const testWebhook = async () => {
    setTesting(true);
    setSent(false);
    try {
      if (!(await onTestWebhook())) return;
      setSent(true);
      window.setTimeout(() => setSent(false), WEBHOOK_FLASH_MS);
    } finally {
      setTesting(false);
    }
  };

  const commitAmount = () => {
    if (amountDraft == null || !settings) return;
    const parsed = Number(amountDraft);
    setAmountDraft(null);
    if (!Number.isFinite(parsed)) return;
    const clamped = clampAmount(parsed);
    if (clamped !== settings.base_amount_eur) save({ base_amount_eur: clamped });
  };

  const stepAmount = (delta: number) => {
    if (!settings) return;
    setAmountDraft(null);
    save({ base_amount_eur: clampAmount(settings.base_amount_eur + delta) });
  };

  const paused = isPausedUntil(settings?.paused_until ?? null);

  return (
    <div
      className={`overflow-hidden transition-[max-height,opacity,margin-top] duration-400 ${
        open ? "mt-4 max-h-[48rem] opacity-100" : "mt-0 max-h-0 opacity-0"
      }`}
    >
      <div className="mx-auto max-w-spout rounded-3xl border border-cream/20 bg-teal/95 p-4 text-cream shadow-[0_24px_60px_-24px_rgba(0,0,0,.45)] backdrop-blur-md md:p-5">
        {/* Header: title · saved feedback · close */}
        <div className="mb-3.5 flex items-center gap-2.5">
          <span className="text-2xs font-bold uppercase tracking-[0.18em] text-cream/70">
            Adjust your drip
          </span>
          {saved && (
            <span className="inline-flex items-center rounded-full bg-cream/90 px-2.5 py-0.5 text-2xs font-bold text-teal-deep">
              Saved &#10003;
            </span>
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-cream/15 text-cream transition hover:bg-cream/30"
          >
            <XIcon className="text-sm" />
          </button>
        </div>

        {settings ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Amount & Discord */}
            <div className={TILE}>
              <span className={TILE_LABEL}>Amount</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Less"
                  onClick={() => stepAmount(-AMOUNT_STEP)}
                  className={STEP_BUTTON}
                >
                  &minus;
                </button>
                <input
                  type="number"
                  min={AMOUNT_MIN}
                  max={AMOUNT_MAX}
                  step={AMOUNT_STEP}
                  aria-label="Amount in euros"
                  value={amountDraft ?? settings.base_amount_eur}
                  onChange={(e) => setAmountDraft(e.target.value)}
                  onBlur={commitAmount}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className={`${FIELD} w-[5rem] text-center font-display text-lg [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                />
                <button
                  type="button"
                  aria-label="More"
                  onClick={() => stepAmount(AMOUNT_STEP)}
                  className={STEP_BUTTON}
                >
                  +
                </button>
              </div>
              {indicators && (
                <span className="text-xs text-cream/72">
                  &times; {indicators.multiplier} &rarr;{" "}
                  <b>{fmtEur(settings.base_amount_eur * indicators.multiplier)}</b>
                </span>
              )}
              <div className="h-px w-full bg-cream/15" />
              <div className="flex items-center gap-2.5">
                <span className={TILE_LABEL}>Discord</span>
                <MiniToggle
                  checked={settings.discord_enabled}
                  onChange={(v) => save({ discord_enabled: v })}
                />
                <button
                  type="button"
                  aria-label="Send test message"
                  title="Send test message"
                  onClick={testWebhook}
                  disabled={testing}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-cream/15 text-cream transition hover:bg-cream/30 disabled:opacity-50"
                >
                  <PaperPlaneIcon className="text-sm" />
                </button>
                {sent && (
                  <span className="text-2xs font-bold text-cream">
                    Sent &#10003;
                  </span>
                )}
              </div>

              {/* The weekly report gets its own row rather than a bare icon:
                  its schedule is a second timetable next to the buy above, and
                  reading it here is half the reason to open this drawer. */}
              <button type="button" onClick={onOpenDigest} className={DRAWER_ROW}>
                <NewspaperIcon className="text-sm" />
                <span>Weekly report</span>
                <span className="ml-auto font-semibold text-cream/70">
                  {digest
                    ? digest.enabled
                      ? `${WEEKDAYS[digest.weekday].slice(0, 3)} ${digest.send_time}`
                      : "Off"
                    : "…"}
                </span>
                <CaretRightIcon className="text-2xs text-cream/60" />
              </button>

              {/* The keys themselves are a dialog away rather than in here: the
                  drawer is for the weekly rhythm, Setup is for the install. */}
              <button type="button" onClick={onOpenSetup} className={DRAWER_ROW}>
                <GearIcon className="text-sm" />
                <span>Keys &amp; system</span>
                <span className="ml-auto font-semibold text-cream/70">Setup</span>
                <CaretRightIcon className="text-2xs text-cream/60" />
              </button>
            </div>

            {/* Schedule & Pause */}
            <div className={TILE}>
              <span className={TILE_LABEL}>Schedule</span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <select
                  value={settings.schedule_weekday}
                  onChange={(e) => save({ schedule_weekday: Number(e.target.value) })}
                  className={`${FIELD} faucet-select cursor-pointer`}
                >
                  {WEEKDAYS.map((day, idx) => (
                    <option key={day} value={idx}>
                      {day}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-cream/60">at</span>
                <input
                  type="time"
                  value={settings.schedule_time}
                  onChange={(e) => save({ schedule_time: e.target.value })}
                  className={FIELD}
                />
              </div>
              <div className="h-px w-full bg-cream/15" />
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <span className={TILE_LABEL}>Pause</span>
                {paused ? (
                  <>
                    <span className="inline-flex items-center rounded-full bg-rose-deep/60 px-2.5 py-1 text-xs font-bold text-cream">
                      until {formatDateNumeric(settings.paused_until!)}
                    </span>
                    <button
                      type="button"
                      onClick={onResume}
                      className="flex items-center gap-1 rounded-xl bg-cream px-3 py-1.5 text-xs font-bold text-teal-deep transition hover:bg-white"
                    >
                      <PlayIcon /> Resume
                    </button>
                  </>
                ) : (
                  <select
                    value={0}
                    onChange={(e) => {
                      const days = Number(e.target.value);
                      if (days > 0) onPause(days);
                    }}
                    className={`${FIELD} faucet-select cursor-pointer`}
                  >
                    {PAUSE_OPTIONS.map((p) => (
                      <option key={p.days} value={p.days}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 text-center text-xs font-bold text-cream/70">
            Loading settings…
          </div>
        )}
      </div>
    </div>
  );
}

/** A compact cream-on-glass switch for the faucet control bar. */
function MiniToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 flex-none rounded-full border-2 transition ${
        checked ? "border-cream bg-cream/80" : "border-cream/50 bg-cream/15"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper shadow-sm transition-all ${
          checked ? "left-[calc(100%-1.125rem)]" : "left-0.5"
        }`}
      />
    </button>
  );
}
