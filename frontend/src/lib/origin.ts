// Where a buy came from: the three words `Purchase.origin` can hold, and what
// the page calls them.
//
// The column exists because a row cannot be read backwards for it. A buy you
// clicked yourself is stored with multiplier 1.0 so it stays neutral in the DCA
// comparison — which makes it identical to a scheduled week that happened to
// score 1.0x — and a catch-up is the weekly drip turning up days late, which
// reads as a bug rather than as the Pi making good after a reboot.
//
// Kept out of the components because three of them read it: the table, the
// phone's card and the query language.

export const ORIGIN_SCHEDULE = "schedule";
export const ORIGIN_MANUAL = "manual";
export const ORIGIN_CATCHUP = "catchup";

/**
 * What a row says about itself under its date — and the two things it does not.
 *
 * The weekly drip is simply what Drip does, so a scheduled buy stays silent: a
 * caption on every row is a caption nobody reads. An unrecorded origin stays
 * silent for the stronger reason — an imported history, and every buy made
 * before this was written down, genuinely does not know, and "scheduled" would
 * be a guess. Both are asked for by name in the search (`scheduled`, `unknown`)
 * instead of being read off the table.
 */
export function originNote(origin: string): string | null {
  if (origin === ORIGIN_MANUAL) return "by hand";
  if (origin === ORIGIN_CATCHUP) return "caught up";
  return null;
}
