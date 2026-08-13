import type { ReactNode } from "react";
import WarningIcon from "~icons/ph/warning-fill";
import { Modal, Spinner } from "./ui";

/**
 * The one way Drip asks "are you sure?".
 *
 * It exists because two places still used `window.confirm`, which is the one
 * spot where the design system dropped out entirely: a browser chrome box in a
 * system font, unstyled in either theme, and — worse — a question with no object
 * in it. "Delete this entry from the history?" names nothing, so there is no way
 * to tell from the dialog itself *which* entry is about to go.
 *
 * That is the rule this carries over from `setup/Maintenance.tsx`, whose own
 * two-step buttons stay as they are: **the question carries its object**. The
 * date and the amount of the buy, the number of test runs — in front of you,
 * inside the sentence. A confirmation without one is a habit people learn to
 * click past; with one it is a real question.
 *
 * `closeOnBackdrop` stays off (`Modal`'s default) so a stray click cannot answer
 * it, and Escape still cancels because `Modal` owns that for every dialog.
 */
export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  /** The object of the question — the row, the count, the filename. */
  children: ReactNode;
  confirmLabel: string;
  /** `plain` is for something merely irreversible rather than destructive. */
  tone?: "danger" | "plain";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const danger = tone === "danger";
  return (
    <Modal onClose={onCancel} className={`w-full max-w-md ${danger ? "ring-2 ring-rose/60" : ""}`}>
      <h3
        className={`mb-2 flex items-center gap-2 font-display text-xl font-semibold ${
          danger ? "text-rose" : "text-ink"
        }`}
      >
        {danger && <WarningIcon aria-hidden="true" />} {title}
      </h3>
      <div className="text-sm leading-relaxed text-ink">{children}</div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={busy}
          className="rounded-full bg-sand-soft px-5 py-3 text-sm font-bold text-ink transition hover:bg-water-soft disabled:opacity-40 max-sm:flex-1 sm:py-2.5"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-cream transition hover:opacity-90 disabled:opacity-40 max-sm:flex-1 sm:py-2.5 ${
            danger ? "bg-rose-deep" : "bg-teal-deep"
          }`}
        >
          {busy && <Spinner className="h-4 w-4" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
