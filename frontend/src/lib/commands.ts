// The command palette's vocabulary and its search.
//
// Kept out of the component for the same reason `query.ts` is: the matching
// rule is a decision, not a rendering detail. A command is a label, the group
// it files under and something to run — nothing about how it looks.

import type { FunctionComponent, SVGProps } from "react";

export type IconComponent = FunctionComponent<SVGProps<SVGSVGElement>>;

/** The order groups appear in, which is also roughly least to most destructive. */
export const COMMAND_GROUPS = ["Go to", "Open", "Do", "Show"] as const;

export type CommandGroup = (typeof COMMAND_GROUPS)[number];

export interface Command {
  id: string;
  label: string;
  /** Secondary line — what it does, or what it would change. */
  hint?: string;
  group: CommandGroup;
  Icon: IconComponent;
  run: () => void;
  /** True for a setting that is already on, so the palette can tick it. */
  active?: boolean;
}

/**
 * Every word in the query has to appear somewhere in the command.
 *
 * Deliberately a plain AND over substrings rather than a fuzzy matcher: the
 * vocabulary is twenty entries the owner wrote, so "we" finding "Weekly report"
 * is worth more than character-skipping ever would be, and a wrong first hit is
 * worse here than a missed one — Enter runs it.
 */
export function filterCommands(commands: Command[], query: string): Command[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return commands;

  return commands.filter((command) => {
    const haystack = `${command.label} ${command.hint ?? ""} ${command.group}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/** The filtered list split into its groups, empty groups dropped. */
export function groupCommands(
  commands: Command[],
): { group: CommandGroup; commands: Command[] }[] {
  return COMMAND_GROUPS.map((group) => ({
    group,
    commands: commands.filter((c) => c.group === group),
  })).filter((entry) => entry.commands.length > 0);
}

/** True for the Ctrl/Cmd-K that opens the palette from anywhere. */
export function isPaletteShortcut(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
}
