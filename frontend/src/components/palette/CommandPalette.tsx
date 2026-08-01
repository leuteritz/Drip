import { useEffect, useMemo, useRef, useState } from "react";
import CheckIcon from "~icons/ph/check";
import MagnifyingGlassIcon from "~icons/ph/magnifying-glass";
import {
  filterCommands,
  groupCommands,
  type Command,
} from "../../lib/commands";
import { Modal } from "../ui";

/**
 * One way into everything.
 *
 * Drip grew six dialogs reachable from three different corners of the header,
 * and a saver who opens the page once a week should not have to remember which
 * corner. Ctrl/Cmd-K lists the lot — the sections, every dialog, the actions
 * that can move money, and the display switches — and types to it.
 *
 * Going *live* is deliberately not in here. It is the one action that starts
 * spending real money, and it keeps its two-step confirmation in the mode
 * toggle rather than becoming three keystrokes; coming back to dry run, the
 * safe direction, is listed.
 */
export default function CommandPalette({
  commands,
  onClose,
}: {
  commands: Command[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const matches = useMemo(() => filterCommands(commands, query), [commands, query]);
  const groups = useMemo(() => groupCommands(matches), [matches]);
  // The flat order the arrow keys walk, which is the order the groups render in.
  const flat = useMemo(() => groups.flatMap((g) => g.commands), [groups]);

  // A new query means a new first result; never leave the cursor past the end.
  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const run = (command: Command) => {
    onClose();
    command.run();
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

  return (
    <Modal onClose={onClose} closeOnBackdrop align="top" className="w-full max-w-xl !p-0">
      <div className="flex items-center gap-3 border-b-2 border-sand px-5 py-4">
        <MagnifyingGlassIcon className="shrink-0 text-lg text-teal" aria-hidden="true" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Jump to, open, or change something…"
          aria-label="Search commands"
          className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-soft"
        />
        <kbd className="shrink-0 rounded-md bg-sand-soft px-2 py-1 text-2xs font-bold text-ink-soft">
          esc
        </kbd>
      </div>

      <div ref={listRef} className="max-h-[46vh] overflow-y-auto px-2 py-2">
        {flat.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-ink-soft">
            Nothing matches &ldquo;{query}&rdquo;.
          </p>
        ) : (
          groups.map(({ group, commands: rows }) => (
            <div key={group} className="mb-1 last:mb-0">
              <div className="px-3 pb-1 pt-2 text-2xs font-bold uppercase tracking-[0.16em] text-ink-soft">
                {group}
              </div>
              {rows.map((command) => {
                const index = flat.indexOf(command);
                const on = index === cursor;
                return (
                  <button
                    key={command.id}
                    type="button"
                    data-active={on}
                    onMouseMove={() => setCursor(index)}
                    onClick={() => run(command)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      on ? "bg-water-soft" : ""
                    }`}
                  >
                    <command.Icon
                      className={`shrink-0 text-base ${on ? "text-teal" : "text-ink-soft"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">
                        {command.label}
                      </span>
                      {command.hint && (
                        <span className="block truncate text-xs text-ink-soft">
                          {command.hint}
                        </span>
                      )}
                    </span>
                    {command.active && (
                      <CheckIcon className="shrink-0 text-sm text-teal" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
