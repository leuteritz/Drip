import NewspaperIcon from "~icons/ph/newspaper";
import type { DigestSettings } from "../../api/client";
import { WEEKDAYS } from "../../lib/format";
import { TRAY_ITEM, TRAY_ITEM_MUTED } from "./chrome";
import { useNow, WEEK_MS } from "./hooks";

/**
 * The weekly report in the sticky bar's tools tray — reachable from anywhere in
 * the scroll, which is the point: it is the one thing Drip sends you rather
 * than shows you.
 *
 * The pill fills like the tank as the week runs down toward the next send, the
 * same mechanic (and the same `WEEK_MS`) as the pipe under the next buy. So it
 * reads as a countdown at a glance and only needs the exact slot spelled out
 * for the reader who looks twice.
 */
export default function ReportBadge({
  digest,
  onOpen,
}: {
  digest: DigestSettings;
  onOpen: () => void;
}) {
  const now = useNow();

  const remaining =
    digest.enabled && digest.next_run
      ? new Date(digest.next_run).getTime() - now
      : null;
  const filled =
    remaining == null ? 0 : Math.max(0, Math.min(1, 1 - remaining / WEEK_MS));

  const slot = `${WEEKDAYS[digest.weekday].slice(0, 3)} ${digest.send_time}`;
  const label = digest.enabled ? slot : "Off";

  return (
    <button
      type="button"
      onClick={onOpen}
      title={
        digest.enabled
          ? `Weekly report every ${WEEKDAYS[digest.weekday]} at ${digest.send_time} — edit what it carries or send it now`
          : "The weekly report is switched off — open to turn it back on"
      }
      aria-label={
        digest.enabled
          ? `Weekly report, next ${slot}. Open to edit or send it.`
          : "Weekly report, switched off. Open to turn it on."
      }
      className={`relative overflow-hidden ${digest.enabled ? TRAY_ITEM : TRAY_ITEM_MUTED}`}
    >
      {/* The week filling up behind the label — and, where the label has given
          way to make room (below `lg`, which is every phone), along the foot of
          the button instead: a block filling half an icon reads as a rendering
          fault rather than as a countdown. Same mechanic, same `WEEK_MS`. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-teal/18 transition-[width] duration-700 max-lg:inset-y-auto max-lg:bottom-0.5 max-lg:h-[2px] max-lg:rounded-full"
        style={{ width: `${filled * 100}%` }}
      />
      <NewspaperIcon className="relative text-sm max-sm:text-base" />
      <span className="relative max-lg:hidden">{label}</span>
    </button>
  );
}
