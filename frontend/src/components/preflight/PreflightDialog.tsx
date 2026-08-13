import ArrowClockwiseIcon from "~icons/ph/arrow-counter-clockwise";
import CheckIcon from "~icons/ph/check-circle-fill";
import QuestionIcon from "~icons/ph/question";
import WarningIcon from "~icons/ph/warning-fill";
import XCircleIcon from "~icons/ph/x-circle-fill";
import type { BotSettings, Preflight, PreflightStatus } from "../../api/client";
import { fmtEur, formatDayMonth, formatWeekdayTime } from "../../lib/format";
import { Loading, Modal, Note, Toggle } from "../ui";

/**
 * Will the next drip actually land.
 *
 * Every other card in this app reports on buys that have happened; `Pulse` goes
 * furthest and finds the weeks that were missed, but it finds them afterwards.
 * This is the same question pointed forwards, and it is the only screen here
 * that can be acted on before it costs anything: a key that expired, an account
 * that ran dry, a scheduler that came up without its job.
 *
 * The six checks arrive whole from `backend/app/preflight.py`, sentences and
 * all — only the backend knows what went wrong, and a second copy of that
 * reasoning over here would be a second thing to keep true. This file decides
 * what each answer *looks* like and nothing else.
 *
 * All six are always listed, including the ones that passed. The weekly report
 * is the opposite — it names only what has something to say — and the split is
 * deliberate: a message is read once and must lead with the problem, while a
 * page opened on purpose is being asked "what did you check?", and a list that
 * hides its passes cannot answer that.
 *
 * The between-buy watch is switched on and off here for the reason `Pulse`
 * carries the catch-up switch and `Custody` carries its threshold: a setting
 * belongs where the figure it judges is read. What that watch reports is this
 * list, so this is the screen it belongs to.
 */

/** What each answer looks like. `unknown` is a muted `ink` rather than `sand`
 *  for the same reason `Pulse`'s paused week is: sand is a surface colour here,
 *  and the palette has no hue meaning "not a question" — grey is the only
 *  honest reading left once rose is spoken for. */
const LOOK: Record<
  PreflightStatus,
  { Icon: typeof CheckIcon; tint: string; ring: string; word: string }
> = {
  pass: { Icon: CheckIcon, tint: "text-teal", ring: "bg-water-soft", word: "Ready" },
  warn: { Icon: WarningIcon, tint: "text-ink", ring: "bg-sand-soft", word: "Worth a look" },
  fail: { Icon: XCircleIcon, tint: "text-rose", ring: "bg-rose-soft", word: "Would fail" },
  unknown: {
    Icon: QuestionIcon,
    tint: "text-ink-soft",
    ring: "bg-sand-soft/60",
    word: "Not known",
  },
};

/** The one sentence at the top. Says what the *next run* would do, which is not
 *  the same as whether everything is configured — in dry run nothing is spent,
 *  so a missing key is a note about the day you go live and not a fault now. */
function headline(report: Preflight): string {
  if (report.ready) return "Everything is in place for the next drip.";
  if (report.status === "fail")
    return "Something would stop the next drip from landing.";
  if (report.status === "warn")
    return "The next drip would land, but something is worth a look.";
  return "Some of this could not be checked.";
}

export default function PreflightDialog({
  report,
  refreshing,
  settings,
  onSaveSettings,
  onRefresh,
  onClose,
}: {
  report: Preflight | null;
  refreshing: boolean;
  settings: BotSettings | null;
  onSaveSettings: (update: Partial<BotSettings>) => Promise<void>;
  onRefresh: () => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} closeOnBackdrop className="w-full max-w-xl">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-2xl font-bold text-ink">
          Before the next buy
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-full bg-sand-soft px-3 py-1.5 text-xs font-bold text-ink transition hover:opacity-80 disabled:opacity-40 max-sm:min-h-11 max-sm:px-4"
        >
          <ArrowClockwiseIcon className={refreshing ? "animate-spin" : ""} />
          Check again
        </button>
      </div>

      {report ? (
        <>
          <p className="mt-1 text-sm text-ink-soft">{headline(report)}</p>

          <ul className="mt-5 space-y-1.5">
            {report.checks.map((check) => {
              const look = LOOK[check.status];
              return (
                <li
                  key={check.key}
                  className="flex items-start gap-3 rounded-xl bg-sand-soft/50 px-3.5 py-3"
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${look.ring}`}
                  >
                    <look.Icon className={`text-sm ${look.tint}`} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink">
                      {check.label}
                      <span className={`ml-2 font-normal ${look.tint}`}>
                        {look.word}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                      {check.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          {report.next_run && (
            <p className="mt-4 text-center text-sm text-ink-soft">
              Next drip {formatWeekdayTime(report.next_run)} ·{" "}
              {formatDayMonth(report.next_run)} · about{" "}
              <span className="font-bold text-teal">
                {fmtEur(report.next_amount_eur)}
              </span>
            </p>
          )}

          {settings && (
            <label className="mt-4 flex items-start gap-3 rounded-xl bg-sand-soft/60 px-3.5 py-3">
              <Toggle
                checked={settings.watch}
                onChange={(v) => void onSaveSettings({ watch: v })}
              />
              <span className="min-w-0 text-sm leading-relaxed text-ink">
                <strong className="font-semibold">Tell me if this stops passing</strong>
                <span className="block text-xs text-ink-soft">
                  Drip checks this list once a day and sends one Discord message if
                  the next buy would fail, or if a drip went by with nothing to pick
                  it up. It says it once, not every day, and stays quiet when it
                  clears. Warnings never trigger it.
                </span>
              </span>
            </label>
          )}

          <Note>
            {report.dry_run
              ? "Drip is in dry run, so nothing here can cost you a week — no order is placed. These are the answers that will matter the day you switch to live."
              : "Checked against the account this bot actually spends from. Nothing here places, skips or resizes anything; it only asks the questions Monday would ask."}
          </Note>
        </>
      ) : (
        <div className="flex h-56 items-center justify-center">
          <Loading
            what="Checking the next buy"
            why="Asking Coinbase whether the key still works and what is left on the account."
            slow="The exchange is slow to answer — nothing is being spent while this waits."
          />
        </div>
      )}
    </Modal>
  );
}
