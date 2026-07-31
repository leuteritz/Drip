import { useState } from "react";
import CheckIcon from "~icons/ph/check";
import LockKeyIcon from "~icons/ph/lock-key";
import PencilIcon from "~icons/ph/pencil-simple";
import TrashIcon from "~icons/ph/trash";
import XIcon from "~icons/ph/x";
import type { CredentialField, CredentialsUpdate } from "../../api/client";

const FIELD =
  "w-full rounded-xl border border-sand bg-paper px-3 py-2 font-mono text-xs text-ink outline-none focus:border-teal";

/** Where the value in effect came from. `.env` still wins nothing — it is the
 *  fallback — but saying so is what stops a key looking lost when the dashboard
 *  field is empty and the bot is trading happily. */
const SOURCE: Record<string, { label: string; className: string }> = {
  dashboard: { label: "Set here", className: "bg-water-soft text-teal" },
  env: { label: "From backend/.env", className: "bg-sand-soft text-ink-soft" },
  none: { label: "Not set", className: "bg-rose-soft text-rose" },
};

/**
 * One secret, in the only two states it can honestly have: a mask of what is
 * stored, or a box to put a new value in.
 *
 * There is deliberately no reveal button. The backend never sends the value
 * back — a stored key can be replaced or removed, never read — so the dialog
 * cannot leak what someone else configured, and nothing on screen is worth
 * shoulder-surfing.
 */
export default function CredentialRow({
  field,
  onSave,
}: {
  field: CredentialField;
  onSave: (update: CredentialsUpdate) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const source = SOURCE[field.source] ?? SOURCE.none;
  const open = editing || !field.configured;

  const write = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      await onSave({ [field.key]: value });
      setDraft("");
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-sand bg-sand-soft/40 p-3.5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-bold text-ink">{field.label}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${source.className}`}
        >
          {source.label}
        </span>
      </div>

      {open ? (
        <>
          {field.multiline ? (
            <textarea
              value={draft}
              rows={4}
              spellCheck={false}
              placeholder={field.placeholder}
              onChange={(e) => setDraft(e.target.value)}
              className={`${FIELD} resize-y leading-relaxed`}
            />
          ) : (
            <input
              type="text"
              value={draft}
              spellCheck={false}
              autoComplete="off"
              placeholder={field.placeholder}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) write(draft);
              }}
              className={FIELD}
            />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => write(draft)}
              disabled={busy || !draft.trim()}
              className="flex items-center gap-1.5 rounded-full bg-teal-deep px-4 py-1.5 text-xs font-bold text-cream transition hover:opacity-90 disabled:opacity-40"
            >
              <CheckIcon /> {busy ? "Saving…" : "Save"}
            </button>
            {field.configured && (
              <button
                type="button"
                onClick={() => {
                  setDraft("");
                  setEditing(false);
                }}
                className="flex items-center gap-1.5 rounded-full bg-sand-soft px-4 py-1.5 text-xs font-bold text-ink transition hover:opacity-80"
              >
                <XIcon /> Cancel
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 truncate rounded-xl bg-paper px-3 py-2 font-mono text-xs text-ink-soft">
            <LockKeyIcon className="shrink-0 text-teal" aria-hidden="true" />
            <span className="truncate">{field.masked}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-full bg-sand-soft px-4 py-1.5 text-xs font-bold text-ink transition hover:opacity-80"
            >
              <PencilIcon /> Replace
            </button>
            {field.source === "dashboard" && (
              <button
                type="button"
                onClick={() => write("")}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-rose transition hover:bg-rose-soft disabled:opacity-40"
              >
                <TrashIcon /> Remove
              </button>
            )}
          </div>
        </>
      )}

      <p className="mt-2 text-xs leading-relaxed text-ink-soft">{field.hint}</p>
      {error && <p className="mt-1.5 text-xs font-bold text-rose">{error}</p>}
    </div>
  );
}
