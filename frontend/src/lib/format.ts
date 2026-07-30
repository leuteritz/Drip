// Every user-facing number and date passes through here, so the dashboard,
// the header and the history table can never drift apart in how they read.

export const fmtEur = (v: number, digits = 2) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 2 ? 2 : digits,
  }).format(v);

export const fmtBtc = (v: number) => `${v.toFixed(8)} BTC`;

export const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** "4 Aug" — the compact form used by the header's pause pill. */
export const formatDayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** "04/08/2026" — numeric date, used where space is tightest. */
export const formatDateNumeric = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB");

/** "30 Jul 2026" — release dates in the version popover. */
export const formatDayMonthYear = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** "4 Aug 2026, 09:00" — the history table's full timestamp. */
export const formatTimestamp = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

/** "Mon 09:00" — the next scheduled run. JS weeks start on Sunday, WEEKDAYS on
 *  Monday, hence the shift. */
export function formatWeekdayTime(iso: string): string {
  const d = new Date(iso);
  const weekday = WEEKDAYS[(d.getDay() + 6) % 7].slice(0, 3);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${weekday} ${time}`;
}
