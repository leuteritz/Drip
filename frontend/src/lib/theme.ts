// Day or night, and who decides.
//
// The whole flip is one attribute on <html>: every palette utility in the app
// resolves a `--color-*` custom property, and index.css redefines those under
// `:root[data-theme="dark"]`. Nothing else needs to know which theme is on.
//
// The same three lines run as an inline script in index.html so the stamp is on
// the element before first paint — without it the page flashes cream on a Pi
// that takes a moment to parse 700 kB of JavaScript. Keep the two in step.

import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export const THEME_KEY = "drip-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function prefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** The stored choice, or "system" — an unreadable store is not worth an error. */
export function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // private mode / storage disabled - fall through to the default
  }
  return "system";
}

export function resolveTheme(choice: ThemeChoice): Theme {
  if (choice === "system") return prefersDark() ? "dark" : "light";
  return choice;
}

export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.dataset.theme = resolveTheme(choice);
}

/**
 * The choice, the theme it currently resolves to, and a setter that persists.
 *
 * While the choice is "system" the OS switch is live: a Pi left open across
 * sunset follows it without a reload.
 */
export function useTheme(): {
  choice: ThemeChoice;
  theme: Theme;
  setChoice: (choice: ThemeChoice) => void;
} {
  const [choice, setStoredChoice] = useState<ThemeChoice>(readChoice);
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(choice));

  const setChoice = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // the choice still applies for this session
    }
    setStoredChoice(next);
  }, []);

  useEffect(() => {
    applyTheme(choice);
    setTheme(resolveTheme(choice));
    if (choice !== "system") return;

    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      applyTheme("system");
      setTheme(resolveTheme("system"));
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  return { choice, theme, setChoice };
}
