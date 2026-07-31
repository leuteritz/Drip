import ArrowClockwiseIcon from "~icons/ph/arrow-counter-clockwise";
import ClockIcon from "~icons/ph/clock-countdown";
import type { SystemInfo } from "../../api/client";
import {
  fmtBytes,
  fmtDuration,
  formatDayMonth,
  formatWeekdayTime,
} from "../../lib/format";
import { Note, Stat } from "../ui";

/**
 * The machine, not the money: what the backend is doing right now.
 *
 * Everything here used to require an SSH session and `docker logs` — whether
 * the scheduler survived the last restart, which timezone its cron actually
 * runs in, how much history is cached. It is read-only on purpose; the things
 * that can be changed live one tab over, or in the faucet drawer.
 */
export default function SystemPanel({
  system,
  onRefresh,
  refreshing,
}: {
  system: SystemInfo;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const cache = system.research_cache_age_seconds;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
          Scheduled jobs
        </h4>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
            system.scheduler_running
              ? "bg-water-soft text-teal"
              : "bg-rose-soft text-rose"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              system.scheduler_running ? "bg-teal" : "bg-rose"
            }`}
          />
          {system.scheduler_running ? "Scheduler running" : "Scheduler stopped"}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-sand-soft px-3 py-1 text-xs font-bold text-ink transition hover:opacity-80 disabled:opacity-40"
        >
          <ArrowClockwiseIcon className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {system.jobs.length ? (
        <ul className="space-y-1.5">
          {system.jobs.map((job) => (
            <li
              key={job.id}
              className="flex flex-wrap items-center gap-2 rounded-xl bg-sand-soft/50 px-3.5 py-2.5"
            >
              <ClockIcon className="text-teal" aria-hidden="true" />
              <span className="text-[13px] font-bold text-ink">{job.label}</span>
              <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">
                {job.id}
              </code>
              <span className="ml-auto text-xs font-bold text-teal">
                {job.next_run
                  ? `${formatWeekdayTime(job.next_run)} · ${formatDayMonth(job.next_run)}`
                  : "Not scheduled"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-rose-soft px-3.5 py-3 text-xs font-bold text-rose">
          No jobs registered — nothing will buy and nothing will report until the
          backend is restarted.
        </p>
      )}

      <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
        This install
      </h4>
      <div className="flex flex-wrap gap-2">
        <Stat label="Backend up" hint={`Python ${system.python_version}`}>
          {fmtDuration(system.uptime_seconds)}
        </Stat>
        <Stat
          label="Timezone"
          hint={new Date(system.now).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        >
          <span className="text-base">{system.timezone}</span>
        </Stat>
        <Stat label="Database" hint={`${system.purchase_count} buys recorded`}>
          {fmtBytes(system.database_bytes)}
        </Stat>
        <Stat
          label="Price history"
          hint={
            system.candle_from && system.candle_to
              ? `${formatDayMonth(system.candle_from)} → ${formatDayMonth(system.candle_to)}`
              : "nothing cached yet"
          }
        >
          {system.candle_count.toLocaleString("en-IE")} days
        </Stat>
        <Stat
          label="Research table"
          hint={
            cache == null
              ? "builds on the next visit"
              : `built ${fmtDuration(cache)} ago`
          }
        >
          {cache == null ? "Cold" : "Warm"}
        </Stat>
      </div>

      <Note>
        The scheduler runs in the container's own timezone, set by <code>TZ</code>{" "}
        in <code>docker-compose.yml</code> — a buy at 09:00 means 09:00 there, not
        in your browser.
      </Note>
    </div>
  );
}
