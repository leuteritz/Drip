import { useEffect, useMemo, useRef, useState } from "react";
import ArrowRightIcon from "~icons/ph/arrow-right";
import CheckIcon from "~icons/ph/check";
import DropFillIcon from "~icons/ph/drop-fill";
import MagnifyingGlassIcon from "~icons/ph/magnifying-glass";
import SigmaIcon from "~icons/ph/sigma";
import { ORDER_ID_ERROR, type Purchase } from "../../api/client";
import {
  filterCommands,
  groupCommands,
  type Command,
} from "../../lib/commands";
import { fmtEur, formatTimestamp } from "../../lib/format";
import { hasDataToken, QUERY_EXAMPLES } from "../../lib/query";
import { RESULT_LIMIT, searchPurchases, type MatchSummary } from "../../lib/search";
import { useStackAmount } from "../../lib/units";
import { Modal } from "../ui";

/**
 * One way into everything — and, since it also reads the buy history, one way
 * to *ask* about anything.
 *
 * Drip grew six dialogs reachable from three different corners of the header,
 * and a saver who opens the page once a week should not have to remember which
 * corner. Ctrl/Cmd-K lists the lot — the sections, every dialog, the actions
 * that can move money, and the display switches — and types to it.
 *
 * Typing a date or a number searches the buys instead: the field speaks the
 * same little language the history's own search bar does (lib/query.ts), so
 * "july price>60000" is one question here and the same question down there.
 * The matches arrive with the answer above them — how many, how much, over what
 * span — because "what did I spend in July?" is the question, and a list of
 * rows is only ever the evidence for it.
 *
 * Going *live* is deliberately not in here. It is the one action that starts
 * spending real money, and it keeps its two-step confirmation in the mode
 * toggle rather than becoming three keystrokes; coming back to dry run, the
 * safe direction, is listed.
 */
export default function CommandPalette({
  commands,
  purchases,
  onSearchHistory,
  onClose,
}: {
  commands: Command[];
  purchases: Purchase[];
  /** Hands the query to the history section and scrolls it into view. */
  onSearchHistory: (query: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const stackAmount = useStackAmount();

  const matches = useMemo(() => filterCommands(commands, query), [commands, query]);
  const groups = useMemo(() => groupCommands(matches), [matches]);
  const found = useMemo(() => searchPurchases(purchases, query), [purchases, query]);

  const sections = useMemo<Section[]>(() => {
    const commandSections: Section[] = groups.map(({ group, commands: rows }) => ({
      title: group,
      rows: rows.map((command) => ({
        id: command.id,
        kind: "command" as const,
        command,
        run: command.run,
      })),
    }));

    if (!found.summary) return commandSections;

    const buys: Section = {
      title: "Matches",
      rows: [
        { id: "sum", kind: "summary", summary: found.summary, run: () => onSearchHistory(query) },
        ...found.rows.map((purchase) => ({
          id: `buy-${purchase.id}`,
          kind: "buy" as const,
          purchase,
          // One buy opens the history on that day alone — the row is the answer,
          // and the table around it is where the rest of that day lives.
          run: () => onSearchHistory(purchase.timestamp.slice(0, 10)),
        })),
      ],
    };

    if (found.total > RESULT_LIMIT) {
      buys.rows.push({
        id: "more",
        kind: "more",
        total: found.total,
        run: () => onSearchHistory(query),
      });
    }

    // A query carrying a date or a number was typed to find buys, so the buys
    // lead. Plain words were typed to find a command, so the commands keep the
    // top — and with them the first Enter.
    return hasDataToken(query)
      ? [buys, ...commandSections]
      : [...commandSections, buys];
  }, [found, groups, onSearchHistory, query]);

  /** The order the arrow keys walk, which is the order the sections render in. */
  const flat = useMemo(() => sections.flatMap((s) => s.rows), [sections]);

  // A new query means a new first result; never leave the cursor past the end.
  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const run = (row: PaletteRow) => {
    onClose();
    row.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (flat.length ? (c + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (flat.length ? (c - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = flat[cursor];
      if (picked) run(picked);
    }
  };

  let index = -1;

  return (
    <Modal onClose={onClose} closeOnBackdrop align="top" className="w-full max-w-xl !p-0">
      <div className="flex items-center gap-3 border-b-2 border-sand px-5 py-4">
        <MagnifyingGlassIcon className="shrink-0 text-lg text-teal" aria-hidden="true" />
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search your buys, or jump to anything…"
          aria-label="Search commands and buys"
          className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-soft"
        />
        {found.summary && (
          <span className="shrink-0 rounded-full bg-water-soft px-2 py-0.5 text-2xs font-bold text-teal">
            {found.total}
          </span>
        )}
        <kbd className="shrink-0 rounded-md bg-sand-soft px-2 py-1 text-2xs font-bold text-ink-soft max-sm:hidden">
          esc
        </kbd>
      </div>

      {/* On a blank field, what the language can do — the grammar is learned by
          using it, not by being written down somewhere nobody opens. */}
      {!query && (
        <div className="-mb-px flex items-center gap-1.5 overflow-x-auto border-b-2 border-sand bg-sand-soft/40 px-4 py-2.5">
          <span className="shrink-0 pr-1 text-2xs font-bold uppercase tracking-[0.14em] text-ink-soft">
            Try
          </span>
          {QUERY_EXAMPLES.map((example) => (
            <button
              key={example.token}
              type="button"
              title={example.means}
              onClick={() => {
                setQuery(example.token);
                inputRef.current?.focus();
              }}
              className="shrink-0 rounded-full border border-sand bg-paper px-2.5 py-1 font-sans text-2xs font-bold text-teal transition hover:border-water hover:bg-water-soft"
            >
              {example.token}
            </button>
          ))}
        </div>
      )}

      <div ref={listRef} className="max-h-[46vh] overflow-y-auto px-2 py-2">
        {flat.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-sm text-ink-soft">
              Nothing matches &ldquo;{query}&rdquo;.
            </p>
            <p className="mt-1 text-xs text-ink-soft/80">
              Buys can be asked for by date, price or signal — try{" "}
              <b className="text-ink">2026-03</b>, <b className="text-ink">30d</b> or{" "}
              <b className="text-ink">price&gt;60000</b>.
            </p>
          </div>
        ) : (
          sections.map(({ title, rows }) => (
            <div key={title} className="mb-1 last:mb-0">
              <div className="px-3 pb-1 pt-2 text-2xs font-bold uppercase tracking-[0.16em] text-ink-soft">
                {title}
              </div>
              {rows.map((row) => {
                index += 1;
                const at = index;
                return (
                  <Row
                    key={row.id}
                    row={row}
                    on={at === cursor}
                    amount={stackAmount}
                    onHover={() => setCursor(at)}
                    onRun={() => run(row)}
                  />
                );
              })}
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

type PaletteRow =
  | { id: string; kind: "command"; command: Command; run: () => void }
  | { id: string; kind: "summary"; summary: MatchSummary; run: () => void }
  | { id: string; kind: "buy"; purchase: Purchase; run: () => void }
  | { id: string; kind: "more"; total: number; run: () => void };

interface Section {
  title: string;
  rows: PaletteRow[];
}

/** One line of the list, whichever of the four kinds it is. */
function Row({
  row,
  on,
  amount,
  onHover,
  onRun,
}: {
  row: PaletteRow;
  on: boolean;
  amount: (btc: number) => string;
  onHover: () => void;
  onRun: () => void;
}) {
  return (
    <button
      type="button"
      data-active={on}
      onMouseMove={onHover}
      onClick={onRun}
      // A one-line row (a bare theme switch, "show all in the history") is
      // shorter than a fingertip on its own, so the floor is set rather than
      // the padding grown — a two-line buy row is already well past it.
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition max-sm:min-h-11 ${
        on ? "bg-water-soft" : ""
      }`}
    >
      {row.kind === "command" && <CommandBody command={row.command} on={on} />}
      {row.kind === "summary" && <SummaryBody summary={row.summary} amount={amount} />}
      {row.kind === "buy" && <BuyBody purchase={row.purchase} amount={amount} />}
      {row.kind === "more" && <MoreBody total={row.total} />}
    </button>
  );
}

function CommandBody({ command, on }: { command: Command; on: boolean }) {
  return (
    <>
      <command.Icon
        className={`shrink-0 text-base ${on ? "text-teal" : "text-ink-soft"}`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">{command.label}</span>
        {command.hint && (
          <span className="block truncate text-xs text-ink-soft">{command.hint}</span>
        )}
      </span>
      {command.active && (
        <CheckIcon className="shrink-0 text-sm text-teal" aria-hidden="true" />
      )}
    </>
  );
}

/**
 * The answer, above the evidence.
 *
 * It sums only the buys that went through, the same rule the history's heading
 * uses, and says so when it had to leave a failed order out — a set whose total
 * quietly disagrees with its own row count is worse than no total at all.
 */
function SummaryBody({
  summary,
  amount,
}: {
  summary: MatchSummary;
  amount: (btc: number) => string;
}) {
  return (
    <>
      <SigmaIcon className="shrink-0 text-base text-teal" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">
          {summary.count} {summary.count === 1 ? "buy" : "buys"} · {fmtEur(summary.eur)} ·{" "}
          {amount(summary.btc)}
        </span>
        <span className="block truncate text-xs text-ink-soft">
          {summary.span}
          {summary.avgPrice > 0 && ` · ${fmtEur(summary.avgPrice, 0)} average price paid`}
          {summary.failed > 0 &&
            ` · ${summary.failed} failed ${summary.failed === 1 ? "order" : "orders"} not counted`}
        </span>
      </span>
      <ArrowRightIcon className="shrink-0 text-sm text-teal" aria-hidden="true" />
    </>
  );
}

/**
 * One buy, at the palette's scale — the same four figures the phone's history
 * card leads with, since this is read in the same glance.
 */
function BuyBody({
  purchase,
  amount,
}: {
  purchase: Purchase;
  amount: (btc: number) => string;
}) {
  const failed = purchase.order_id === ORDER_ID_ERROR;
  const status = failed ? "Error" : purchase.dry_run ? "Dry run" : "Bought";

  return (
    <>
      <DropFillIcon
        className={`shrink-0 text-base ${
          failed ? "text-rose" : purchase.dry_run ? "text-ink-soft" : "text-teal"
        }`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-bold text-ink">
            {formatTimestamp(purchase.timestamp)}
          </span>
          <span className="shrink-0 text-sm font-bold text-ink">
            {fmtEur(purchase.amount_eur)}
          </span>
        </span>
        <span className="flex items-baseline justify-between gap-3 text-xs text-ink-soft">
          <span className="truncate">
            {fmtEur(purchase.price_eur, 0)} · {amount(purchase.btc_amount)} · {status}
          </span>
          <span className="shrink-0">&times;{purchase.multiplier}</span>
        </span>
      </span>
    </>
  );
}

function MoreBody({ total }: { total: number }) {
  return (
    <>
      <MagnifyingGlassIcon className="shrink-0 text-base text-ink-soft" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
        Show all {total} in the history
      </span>
      <ArrowRightIcon className="shrink-0 text-sm text-teal" aria-hidden="true" />
    </>
  );
}
