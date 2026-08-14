import { useState, type FormEvent } from "react";
import DropFillIcon from "~icons/ph/drop-fill";
import TankBackdrop from "../components/header/TankBackdrop";
import { Failed, Spinner } from "../components/ui";
import { api } from "../api/client";

/**
 * The screen in front of everything, when a password has been set.
 *
 * **A whole screen and not a `Modal`**, and that is the same argument
 * `FirstRun` makes. A login modal implies a page behind it you may read; there
 * is none — every fetch behind this 401s, so what would sit under the dialog is
 * a wall of nine `Failed` cards each saying "not authorised" in its own voice.
 * One thing that says one thing.
 *
 * It is Drip's own face rather than a form on a blank page: the tank, the
 * bubbles, the brand's drop. `TankBackdrop` takes no multiplier here and so
 * fizzes at half, which is already what it does before the indicators land —
 * nothing is invented for this screen and no palette hex is written into it.
 * `rose-pale` is the red of a figure on the water, which is what a wrong
 * password is.
 *
 * On success the page **reloads** rather than choreographing state, exactly as
 * the restore flow does: `App` holds settings, history, keys and schedule, and
 * all four are about to exist for the first time. It also keeps `#tank` in the
 * hash, so a kiosk pointed at the wall display signs in and lands on it.
 */
export default function Lock({ onIn }: { onIn: () => void }) {
  const [password, setPassword] = useState("");
  const [stay, setStay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.login(password, stay);
      onIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tank-water relative h-full w-full overflow-hidden text-cream">
      <TankBackdrop />

      {/* The field sits in the upper third rather than the middle: on a phone
          the keyboard takes the lower half, and a field it covers is the same
          bug `Modal`'s `align="top"` exists for. */}
      <div className="pad-safe-x relative z-10 flex h-full flex-col items-center justify-center px-5 max-sm:justify-start max-sm:pt-[18vh]">
        <div className="flex items-center gap-2.5 font-display text-3xl font-semibold">
          <DropFillIcon className="text-water" aria-hidden="true" />
          Drip
        </div>
        <p className="mt-2 text-center text-sm text-cream/70">
          This bot is locked. Your buys keep running either way.
        </p>

        <form onSubmit={submit} className="mt-7 w-full max-w-xs">
          <label className="sr-only" htmlFor="drip-password">
            Password
          </label>
          <input
            id="drip-password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            /* `text-base` rather than the app's small type: iOS zooms the page
               in on anything under 16px and leaves you there, which on the one
               screen you cannot navigate away from would be a trap. */
            className="w-full rounded-full border border-cream/25 bg-cream/10 px-5 py-3 text-center text-base font-bold text-cream placeholder:font-normal placeholder:text-cream/40 outline-none backdrop-blur-xl transition focus:border-cream/60"
          />

          <button
            type="submit"
            disabled={!password || busy}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-cream px-5 py-3 text-sm font-bold text-ink-solid transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <Spinner className="h-4 w-4" /> : null}
            {busy ? "Signing in…" : "Sign in"}
          </button>

          {/* The wall display's whole answer: a monitor nobody sits at cannot
              type a password, so it signs in once. Deliberately the same signed
              token with a longer life rather than an exempt endpoint — and it
              says what that costs, because "until you change the password" is
              the honest length of it. */}
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-left text-xs text-cream/70">
            <input
              type="checkbox"
              checked={stay}
              onChange={(e) => setStay(e.target.checked)}
              /* `color-scheme: dark` is what stops the browser drawing its own
                 light-mode box here: the tank is dark in both themes, so the
                 native rim came out a muddy brown against the water. */
              className="mt-0.5 h-4 w-4 flex-none accent-cream [color-scheme:dark]"
            />
            <span>
              <span className="block font-bold text-cream/90">
                Stay signed in on this screen
              </span>
              For a wall display. It stays signed in until you change the
              password.
            </span>
          </label>

          {error && (
            <div className="mt-5">
              <Failed compact what="Not signed in" why={error} on="water" />
            </div>
          )}
        </form>

        <p className="mt-8 max-w-xs text-center text-2xs leading-relaxed text-cream/45">
          Locked yourself out? Set <code>DRIP_PASSWORD</code> in{" "}
          <code>backend/.env</code> and restart the backend.
        </p>
      </div>
    </div>
  );
}
