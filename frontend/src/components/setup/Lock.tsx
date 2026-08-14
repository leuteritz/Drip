import { useState } from "react";
import LockIcon from "~icons/ph/lock-simple";
import LockOpenIcon from "~icons/ph/lock-simple-open";
import { api, type AuthState } from "../../api/client";
import ConfirmDialog from "../ConfirmDialog";

const FIELD =
  "w-full rounded-xl border border-sand bg-paper px-3 py-2.5 text-sm font-bold text-ink outline-none focus:border-teal";

/**
 * The password, set, changed or removed — and nothing else.
 *
 * It sits on the **System** tab, between what the install is doing and what
 * cannot be undone, and that placement is the doctrine's own rule: a setting
 * belongs where the figure it judges is read. What this password most guards —
 * the backup download, the restore, "delete the whole history" — is three rows
 * below it, so the tab reads as: here is what the install is doing, here is who
 * may reach it, here is what cannot be taken back.
 *
 * It is deliberately **not** a `credentials.FIELDS` row. Those are the secrets
 * Drip hands to somebody else; this is the secret that guards Drip itself, and
 * a masked scrypt hash would say nothing anyway.
 *
 * Removing the lock asks twice, through `ConfirmDialog`, with what it costs in
 * the question — the rule that a confirmation carries its object.
 */
export default function LockPanel({
  auth,
  onChanged,
}: {
  auth: AuthState | null;
  onChanged: (state: AuthState) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!auth) return null;
  const locked = auth.required;
  const fromEnv = auth.source === "env";

  const save = async (removing: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const state = await api.setPassword(current, removing ? "" : next);
      onChanged(state);
      setCurrent("");
      setNext("");
      setSaved(removing ? "Password removed." : "Password saved.");
      window.setTimeout(() => setSaved(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setConfirmRemove(false);
    }
  };

  return (
    <section className="rounded-card bg-sand-soft/50 p-4">
      <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
        {locked ? <LockIcon /> : <LockOpenIcon />} Who may reach this
      </h4>

      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        {locked ? (
          <>
            A password is set. Anyone on your network needs it before they can
            reach the backup, the history or the buy button.
          </>
        ) : (
          <>
            There is no password. Anyone who can reach this address can download
            your database — <strong className="text-ink">keys included</strong> —
            empty your history, or spend money. Set one if this Pi shares a
            network with anything you do not control.
          </>
        )}
      </p>

      {fromEnv && (
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          This one comes from <code>backend/.env</code>. Setting a password here
          replaces it; clearing it here hands the question back to the file.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {locked && (
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Current password"
            aria-label="Current password"
            className={FIELD}
          />
        )}
        <input
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder={locked ? "New password" : "Choose a password"}
          aria-label={locked ? "New password" : "Choose a password"}
          className={FIELD}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => save(false)}
          disabled={busy || !next || (locked && !current)}
          className="min-h-11 rounded-full bg-teal-deep px-5 text-sm font-bold text-cream transition hover:opacity-90 disabled:opacity-40 sm:min-h-9"
        >
          {locked ? "Change password" : "Set password"}
        </button>
        {locked && (
          <button
            onClick={() => setConfirmRemove(true)}
            disabled={busy || !current}
            className="min-h-11 rounded-full bg-sand-soft px-5 text-sm font-bold text-rose transition hover:opacity-80 disabled:opacity-40 sm:min-h-9"
          >
            Remove it
          </button>
        )}
        {saved && <span className="text-xs font-bold text-teal">{saved}</span>}
        {error && <span className="text-xs font-bold text-rose">{error}</span>}
      </div>

      <p className="mt-3 text-2xs leading-relaxed text-ink-soft">
        Changing it signs every other browser out, the wall display included.
        Locked out? Set <code>DRIP_PASSWORD</code> in <code>backend/.env</code>{" "}
        and restart the backend.
      </p>

      {confirmRemove && (
        <ConfirmDialog
          title="Remove the password?"
          confirmLabel="Remove it"
          busy={busy}
          onConfirm={() => save(true)}
          onCancel={() => setConfirmRemove(false)}
        >
          Anyone who can reach this address will then be able to download this
          database &mdash; <strong className="font-semibold">your Coinbase keys are
          in it</strong> &mdash; empty the buy history, or spend money.
        </ConfirmDialog>
      )}
    </section>
  );
}
