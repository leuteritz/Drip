import { useRef, useState, type ReactNode } from "react";
import BroomIcon from "~icons/ph/broom";
import DownloadIcon from "~icons/ph/download-simple";
import HardDrivesIcon from "~icons/ph/hard-drives";
import TableIcon from "~icons/ph/table";
import TrashIcon from "~icons/ph/trash";
import UploadIcon from "~icons/ph/upload-simple";
import { api } from "../../api/client";

/**
 * The things that used to need a shell on the Pi: dropping a cache, clearing
 * the test runs out of the history, taking a copy of the database.
 *
 * Anything that cannot be undone by waiting asks twice — the second click is
 * the confirmation, so a slip never costs the history. Nothing here can touch
 * a real buy: the caches refill themselves from Coinbase's public API, and the
 * only rows this deletes are dry runs.
 */
export default function Maintenance({ onChanged }: { onChanged: () => void }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
        Maintenance
      </h4>
      <div className="space-y-1.5">
        <Action
          icon={<BroomIcon />}
          title="Rebuild the research numbers"
          description="Forces the scored-day table and the Fear & Greed history to be built again instead of waiting out the hour."
          label="Rebuild"
          run={() => api.clearResearchCache().then((r) => r.detail)}
        />
        <Action
          icon={<HardDrivesIcon />}
          title="Refetch the price history"
          description="Empties the cached daily candles. Safe — they are a cache, not your history — but the next chart will page three years back out of Coinbase and take a while."
          label="Refetch"
          confirm="Empty the candle cache?"
          run={() => api.clearCandleCache().then((r) => r.detail)}
        />
        <Action
          icon={<TrashIcon />}
          title="Delete every test run"
          description="Removes the dry-run rows from the history. Real buys are never touched."
          label="Delete"
          tone="danger"
          confirm="Delete all dry-run entries?"
          run={async () => {
            const { deleted } = await api.clearTestRuns();
            onChanged();
            return `${deleted} test ${deleted === 1 ? "run" : "runs"} deleted.`;
          }}
        />
        <Download
          icon={<DownloadIcon />}
          title="Download a backup"
          description="The whole SQLite database in one file — settings, history and the keys stored here. Treat it like the keys themselves."
          label="Backup"
          href={api.backupUrl}
        />
        {/* Directly under the backup, because it is the same object pointing
            the other way: a copy you cannot put back is not a backup. */}
        <Restore />
        <Download
          icon={<TableIcon />}
          title="Export the history"
          description="Every buy as a CSV that re-imports cleanly into another Drip."
          label="CSV"
          href={api.exportUrl}
        />
      </div>
    </div>
  );
}

const ROW =
  "flex flex-wrap items-center gap-3 rounded-xl bg-sand-soft/50 px-3.5 py-2.5";
const BUTTON =
  "ml-auto flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition disabled:opacity-40";

function Body({
  icon,
  title,
  description,
  result,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  result?: string | null;
}) {
  return (
    <>
      <span className="text-lg text-teal" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-ink">{title}</span>
        <span className="block text-xs leading-snug text-ink-soft">
          {result ?? description}
        </span>
      </span>
    </>
  );
}

/** One button that does something on the backend and reports what it did. */
function Action({
  icon,
  title,
  description,
  label,
  run,
  confirm,
  tone = "quiet",
}: {
  icon: ReactNode;
  title: string;
  description: string;
  label: string;
  run: () => Promise<string>;
  confirm?: string;
  tone?: "quiet" | "danger";
}) {
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const go = async () => {
    if (confirm && !asked) {
      setAsked(true);
      return;
    }
    setAsked(false);
    setBusy(true);
    setResult(null);
    try {
      setResult(await run());
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={ROW}>
      <Body icon={icon} title={title} description={description} result={result} />
      <button
        type="button"
        onClick={go}
        onBlur={() => setAsked(false)}
        disabled={busy}
        className={`${BUTTON} ${
          asked
            ? "bg-rose-deep text-cream"
            : tone === "danger"
              ? "bg-rose-soft text-rose hover:opacity-80"
              : "bg-sand-soft text-ink hover:opacity-80"
        }`}
      >
        {busy ? "Working…" : asked ? confirm : label}
      </button>
    </div>
  );
}

/** How long the result is left on screen before the page reloads itself. */
const RELOAD_AFTER_MS = 3000;

/**
 * Putting a backup back — the only thing in this app that replaces everything.
 *
 * Two steps rather than one, and they are the two questions: *which file*, then
 * *are you sure*. The picker comes first because a confirmation asked before
 * there is anything to confirm is a click people learn to get past; asked with
 * the filename in front of them, it is a real question.
 *
 * It reloads the page afterwards instead of refreshing what it can reach. The
 * settings, the history, the keys and the schedule all just became a different
 * database's, and `App` holds every one of them — a partial refresh would leave
 * some corner of the page describing an install that no longer exists.
 */
function Restore() {
  const input = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const go = async () => {
    if (!file) {
      input.current?.click();
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const { detail } = await api.restoreBackup(file);
      setResult(`${detail} Reloading…`);
      window.setTimeout(() => window.location.reload(), RELOAD_AFTER_MS);
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
      setBusy(false);
      setFile(null);
    }
  };

  return (
    <div className={ROW}>
      <Body
        icon={<UploadIcon />}
        title="Restore a backup"
        description="Replaces the whole database with a backup file — every buy, setting and key in it. There is no undo."
        result={result ?? (file ? `${file.name} — this replaces everything.` : null)}
      />
      <input
        ref={input}
        type="file"
        accept=".db,application/vnd.sqlite3,application/octet-stream"
        className="hidden"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setResult(null);
          // Cleared so picking the same file twice still fires a change.
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className={`${BUTTON} ${
          file ? "bg-rose-deep text-cream" : "bg-rose-soft text-rose hover:opacity-80"
        }`}
      >
        {busy ? "Restoring…" : file ? "Replace everything" : <><UploadIcon /> Restore</>}
      </button>
    </div>
  );
}

/** A plain download; the browser does the work, so there is nothing to report. */
function Download({
  icon,
  title,
  description,
  label,
  href,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  label: string;
  href: string;
}) {
  return (
    <div className={ROW}>
      <Body icon={icon} title={title} description={description} />
      <a
        href={href}
        download
        className={`${BUTTON} bg-sand-soft text-ink hover:opacity-80`}
      >
        <DownloadIcon /> {label}
      </a>
    </div>
  );
}
