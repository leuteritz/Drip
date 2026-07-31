import { useEffect, useMemo, useState } from "react";
import CheckIcon from "~icons/ph/check";
import NewspaperIcon from "~icons/ph/newspaper";
import PaperPlaneIcon from "~icons/ph/paper-plane-tilt";
import WarningIcon from "~icons/ph/warning-circle";
import { api, type DigestPreview, type DigestSettings, type DigestUpdate } from "../../api/client";
import { formatWeekdayTime, WEEKDAYS } from "../../lib/format";
import { Loading, Modal, Toggle } from "../ui";
import EmbedPreview from "./EmbedPreview";

const SAVED_FLASH_MS = 2200;
const SENT_FLASH_MS = 3500;

const FIELD =
  "rounded-xl border border-sand bg-paper px-3 py-2 text-sm font-bold text-ink outline-none focus:border-teal";

/**
 * The weekly report, in one dialog: when it goes out, what it carries, and a
 * live preview of the message that produces.
 *
 * Edits persist the moment they are made — the same behaviour as the faucet
 * controls, so there is no save button to forget. The preview is fetched once
 * with *every* block rendered and filtered here, which is what makes ticking a
 * box instant instead of a round trip per click.
 */
export default function DigestDialog({
  digest,
  onSave,
  onSend,
  onClose,
}: {
  digest: DigestSettings;
  onSave: (update: DigestUpdate) => Promise<void>;
  onSend: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<DigestPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getDigestPreview()
      .then((p) => alive && setPreview(p))
      .catch((e: unknown) =>
        alive && setPreviewError(e instanceof Error ? e.message : String(e)),
      );
    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(
    () => new Set(digest.blocks.filter((b) => b.enabled).map((b) => b.key)),
    [digest.blocks],
  );

  const save = async (update: DigestUpdate) => {
    await onSave(update);
    setSaved(true);
    window.setTimeout(() => setSaved(false), SAVED_FLASH_MS);
  };

  const sendNow = async () => {
    setSending(true);
    setSent(null);
    try {
      setSent(await onSend());
      window.setTimeout(() => setSent(null), SENT_FLASH_MS);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      closeOnBackdrop
      className="max-h-[88vh] w-full max-w-4xl overflow-y-auto border-teal/40"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-teal">
          <NewspaperIcon /> Weekly report
        </h3>
        {saved && (
          <span className="inline-flex items-center gap-1 rounded-full bg-water-soft px-2.5 py-0.5 text-[11px] font-bold text-teal">
            <CheckIcon /> Saved
          </span>
        )}
        <span className="ml-auto text-xs text-ink-soft">
          {digest.enabled && digest.next_run
            ? `Next: ${formatWeekdayTime(digest.next_run)}`
            : "Not scheduled"}
        </span>
      </div>

      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Left: when it goes out, and what it carries */}
        <div>
          <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-sand-soft/60 px-3.5 py-3">
            <Toggle
              checked={digest.enabled}
              onChange={(v) => save({ enabled: v })}
            />
            <span className="text-sm font-bold text-ink">Send every week</span>
            <div className="ml-auto flex items-center gap-1.5">
              <select
                aria-label="Day of the week"
                value={digest.weekday}
                onChange={(e) => save({ weekday: Number(e.target.value) })}
                className={`${FIELD} cursor-pointer`}
              >
                {WEEKDAYS.map((day, idx) => (
                  <option key={day} value={idx}>
                    {day.slice(0, 3)}
                  </option>
                ))}
              </select>
              <input
                type="time"
                aria-label="Time of day"
                value={digest.send_time}
                onChange={(e) => save({ send_time: e.target.value })}
                className={FIELD}
              />
            </div>
          </div>

          <div className="mb-2 mt-4 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
              What it carries
            </h4>
            <span className="text-xs text-ink-soft">
              {visible.size} of {digest.blocks.length}
            </span>
          </div>

          {/* No scrollbox of its own: the dialog scrolls as one, and the
              preview beside it stays pinned, so a half-cut row never reads as
              the end of the list. */}
          <div className="space-y-1">
            {digest.blocks.map((block) => (
              <button
                key={block.key}
                type="button"
                role="checkbox"
                aria-checked={block.enabled}
                onClick={() => save({ blocks: { [block.key]: !block.enabled } })}
                className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition ${
                  block.enabled ? "bg-water-soft/50" : "bg-sand-soft/40 opacity-70"
                } hover:opacity-100`}
              >
                <span
                  className={`mt-0.5 flex h-4.5 w-4.5 flex-none items-center justify-center rounded-md border-2 text-[10px] transition ${
                    block.enabled
                      ? "border-teal bg-teal text-cream"
                      : "border-sand bg-paper text-transparent"
                  }`}
                >
                  <CheckIcon />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-ink">
                    {block.label}
                  </span>
                  <span className="block text-xs leading-snug text-ink-soft">
                    {block.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: the message itself */}
        <div className="md:sticky md:top-0">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
              Preview
            </h4>
            <span className="text-xs text-ink-soft">as Discord shows it</span>
          </div>

          {preview ? (
            <div className={digest.enabled ? "" : "opacity-60"}>
              <EmbedPreview preview={preview} visible={visible} />
            </div>
          ) : previewError ? (
            <p className="rounded-xl bg-rose-soft px-3.5 py-3 text-xs font-bold text-rose">
              Could not build the preview: {previewError}
            </p>
          ) : (
            <Loading
              what="Building this week's report"
              why="The same numbers the scheduled send gathers: your week, your whole stack, and the signal right now."
              slow="Still going — after a restart this also warms the candle cache the price lines read."
            />
          )}
        </div>
      </div>

      {!digest.discord_configured && (
        <p className="mt-4 flex items-start gap-1.5 text-xs text-rose">
          <WarningIcon className="mt-0.5 shrink-0" />
          <span>
            No Discord webhook stored — add one under Setup, and nothing here
            can be sent until you do.
          </span>
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {sent !== null && (
          <span
            className={`mr-auto text-xs font-bold ${sent ? "text-teal" : "text-rose"}`}
          >
            {sent ? "Sent to Discord ✓" : "Discord did not accept it — check the webhook"}
          </span>
        )}
        <button
          onClick={onClose}
          className="rounded-full bg-sand-soft px-5 py-2.5 text-sm font-bold text-ink transition hover:opacity-80"
        >
          Close
        </button>
        <button
          onClick={sendNow}
          disabled={sending || !digest.discord_configured || visible.size === 0}
          title="Send this week's report now, whatever the schedule says"
          className="flex items-center gap-2 rounded-full bg-teal px-5 py-2.5 text-sm font-bold text-cream transition hover:opacity-90 disabled:opacity-50"
        >
          <PaperPlaneIcon /> {sending ? "Sending…" : "Send now"}
        </button>
      </div>
    </Modal>
  );
}
