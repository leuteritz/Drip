// The app's one route, and the only one it will ever need.
//
// No router: Drip is a single scroll, and its sections are reached by
// `scrollIntoView` rather than by anchors, so the hash is free. `#tank` claims
// it for the wall display — which means a Raspberry Pi kiosk can be pointed
// straight at `http://<pi>:8081/#tank` with no server-side route to add, and
// both build targets (FastAPI's SPA fallback and nginx) keep working untouched.

import { useEffect, useState } from "react";

export const TANK_HASH = "#tank";

/** True while the wall display is the thing on screen. */
export function useIsTank(): boolean {
  const [isTank, setIsTank] = useState(() => window.location.hash === TANK_HASH);

  useEffect(() => {
    const onHash = () => setIsTank(window.location.hash === TANK_HASH);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return isTank;
}

export function enterTank(): void {
  window.location.hash = TANK_HASH;
}

/** Leaves without pushing another history entry the back button has to chew. */
export function leaveTank(): void {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
