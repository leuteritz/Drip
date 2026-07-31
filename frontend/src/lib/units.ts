// Whether a bitcoin amount reads as BTC or as sats.
//
// Only *quantities* of bitcoin follow this — the stack, the Coinbase balance,
// the lots in the holding report. Euro figures stay euros: converting a buy
// made three years ago into today's sats would be a number that never existed.
// The cost-basis card's "sats per euro" is a rate rather than a quantity, and
// is already sats in both settings, so it is deliberately left alone.
//
// This is the one piece of display state that reaches far enough down the tree
// to be worth a context rather than a prop: six components render a bitcoin
// amount, none of them near each other. App still owns the value, the same way
// it owns everything else.

import { createContext, useCallback, useContext, useState } from "react";

import { fmtBtc, fmtSats, SATS_PER_BTC } from "./format";

export type Unit = "btc" | "sats";

export const UNIT_KEY = "drip-unit";

const UnitContext = createContext<Unit>("btc");

export const UnitProvider = UnitContext.Provider;

export function useUnit(): Unit {
  return useContext(UnitContext);
}

/**
 * The formatter for a bitcoin amount, in whichever unit is on.
 *
 * Every quantity goes through this rather than `fmtBtc`, so the hero, the well,
 * the history totals and the holding report can never end up in two different
 * units at once.
 */
export function useStackAmount(): (btc: number) => string {
  const unit = useUnit();
  return useCallback(
    (btc: number) => (unit === "sats" ? fmtSats(btc * SATS_PER_BTC) : fmtBtc(btc)),
    [unit],
  );
}

function readUnit(): Unit {
  try {
    return localStorage.getItem(UNIT_KEY) === "sats" ? "sats" : "btc";
  } catch {
    // private mode / storage disabled - BTC is the default either way
    return "btc";
  }
}

/** The stored choice and a flip, for whoever owns the state (App). */
export function useUnitChoice(): { unit: Unit; toggleUnit: () => void } {
  const [unit, setUnit] = useState<Unit>(readUnit);

  const toggleUnit = useCallback(() => {
    setUnit((current) => {
      const next: Unit = current === "sats" ? "btc" : "sats";
      try {
        localStorage.setItem(UNIT_KEY, next);
      } catch {
        // the choice still applies for this session
      }
      return next;
    });
  }, []);

  return { unit, toggleUnit };
}
