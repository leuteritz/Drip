import { useEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import XIcon from "~icons/ph/x";
import UploadSimpleIcon from "~icons/ph/upload-simple";
import FileCsvIcon from "~icons/ph/file-csv";
import CheckCircleIcon from "~icons/ph/check-circle-fill";
import WarningIcon from "~icons/ph/warning-fill";
import { api, type ImportResult } from "../api/client";
import { Card, Spinner, Toggle } from "./ui";

const EXPECTED_HEADER =
  "Timestamp,BTC_Preis_EUR,Betrag_EUR,BTC_Menge,Fear_Greed,RSI,MA_350d,Score,Order_ID,Status";

type Picked = {
  file: File;
  rowCount: number;
  headerOk: boolean;
};

export default function ImportModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [includeErrors, setIncludeErrors] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const inspect = async (file: File) => {
    setError(null);
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const header = (lines[0] ?? "").trim().replace(/^﻿/, "");
    const headerOk =
      header.toLowerCase().replace(/\s/g, "") ===
      EXPECTED_HEADER.toLowerCase().replace(/\s/g, "");
    setPicked({ file, rowCount: Math.max(0, lines.length - 1), headerOk });
  };

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setError("Please choose a .csv file.");
      return;
    }
    void inspect(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onFiles(e.dataTransfer.files);
  };

  const runImport = async () => {
    if (!picked) return;
    setUploading(true);
    setError(null);
    try {
      setResult(await api.importPurchases(picked.file, includeErrors));
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={onClose}
    >
      <Card
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto"
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Import buy history</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Upload a legacy <b className="text-ink">bitcoin_purchases.csv</b> to backfill
              your history. Existing entries (same timestamp) are skipped.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full bg-sand-soft p-2 text-ink-soft transition hover:text-ink"
          >
            <XIcon />
          </button>
        </div>

        {/* Result state */}
        {result ? (
          <div className="mt-5">
            <div className="grid grid-cols-3 gap-3">
              <ResultStat label="Imported" value={result.imported} tone="teal" />
              <ResultStat label="Skipped" value={result.skipped} tone="neutral" />
              <ResultStat
                label="Errors"
                value={result.errors.length}
                tone={result.errors.length ? "rose" : "neutral"}
              />
            </div>
            {result.errors.length > 0 && (
              <div className="mt-4 rounded-xl border-2 border-rose/40 bg-rose-soft p-3">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-rose">
                  Rows that could not be imported
                </div>
                <ul className="mt-2 space-y-1 text-sm text-ink">
                  {result.errors.slice(0, 5).map((err) => (
                    <li key={err.line}>
                      <span className="font-bold">Line {err.line}:</span> {err.message}
                    </li>
                  ))}
                  {result.errors.length > 5 && (
                    <li className="text-ink-soft">
                      …and {result.errors.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}
            <button
              onClick={onDone}
              className="mt-5 w-full rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-cream transition hover:bg-ink/90"
            >
              Done
            </button>
          </div>
        ) : uploading ? (
          <div className="mt-2">
            <Spinner />
            <p className="text-center text-sm text-ink-soft">Importing…</p>
          </div>
        ) : (
          <>
            {/* Dropzone / picked file */}
            {!picked ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`mt-5 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                  dragging
                    ? "border-teal bg-water-soft"
                    : "border-sand bg-sand-soft/40 hover:border-water hover:bg-water-soft/50"
                }`}
              >
                <UploadSimpleIcon className="text-3xl text-teal" />
                <span className="text-sm font-bold text-ink">
                  Drop a CSV here or click to browse
                </span>
                <span className="text-xs text-ink-soft">.csv from the legacy Drip bot</span>
              </button>
            ) : (
              <div className="mt-5 flex items-center gap-3 rounded-xl border-2 border-sand bg-paper p-3">
                <FileCsvIcon className="shrink-0 text-2xl text-teal" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-ink">
                    {picked.file.name}
                  </div>
                  <div className="text-xs text-ink-soft">
                    {picked.rowCount} row{picked.rowCount === 1 ? "" : "s"} ·{" "}
                    {(picked.file.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPicked(null);
                    setError(null);
                  }}
                  className="rounded-full px-3 py-1 text-xs font-bold text-ink-soft transition hover:text-ink"
                >
                  Change
                </button>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />

            {/* Header validation hint */}
            {picked &&
              (picked.headerOk ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-teal">
                  <CheckCircleIcon /> Columns match the expected format.
                </p>
              ) : (
                <p className="mt-3 flex items-start gap-2 text-sm text-rose">
                  <WarningIcon className="mt-0.5 shrink-0" />
                  <span>
                    Header doesn't match the expected columns. You can still try — the
                    server validates each row.
                  </span>
                </p>
              ))}

            {error && (
              <div className="mt-4 rounded-xl border-2 border-rose/50 bg-rose-soft p-3 text-sm font-bold text-rose">
                {error}
              </div>
            )}

            {/* Include-errors toggle */}
            <label className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-sand-soft/60 p-3">
              <span className="text-sm">
                <span className="font-bold text-ink">Include error rows</span>
                <span className="mt-0.5 block text-xs text-ink-soft">
                  Import failed/ERROR entries too (shown as “Error” in the history).
                </span>
              </span>
              <Toggle checked={includeErrors} onChange={setIncludeErrors} />
            </label>

            {/* Expected format hint */}
            <p className="mt-4 text-xs text-ink-soft">Expected header:</p>
            <code className="mt-1 block overflow-x-auto whitespace-nowrap rounded-lg bg-ink/5 px-3 py-2 font-mono text-[11px] text-ink-soft">
              {EXPECTED_HEADER}
            </code>

            <div className="mt-5 flex gap-2">
              <button
                onClick={runImport}
                disabled={!picked}
                className="flex-1 rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-cream transition hover:bg-ink/90 disabled:opacity-40"
              >
                Import
              </button>
              <button
                onClick={onClose}
                className="rounded-full bg-sand-soft px-5 py-2.5 text-sm font-bold text-ink-soft transition hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function ResultStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "teal" | "rose" | "neutral";
}) {
  const styles =
    tone === "teal"
      ? "border-teal bg-water-soft text-teal"
      : tone === "rose"
        ? "border-rose/50 bg-rose-soft text-rose"
        : "border-sand bg-paper text-ink";
  return (
    <div className={`rounded-xl border-2 p-3 text-center ${styles}`}>
      <div className="font-display text-2xl font-semibold">{value}</div>
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </div>
    </div>
  );
}
