import CalendarIcon from "~icons/ph/calendar-blank";
import ChartLineUpIcon from "~icons/ph/chart-line-up";
import CircleHalfTiltIcon from "~icons/ph/circle-half-tilt";
import CoinsIcon from "~icons/ph/coins";
import CurrencyBtcIcon from "~icons/ph/currency-btc";
import DropFillIcon from "~icons/ph/drop-fill";
import EyeIcon from "~icons/ph/eye";
import FlaskIcon from "~icons/ph/flask";
import GearIcon from "~icons/ph/gear-six";
import MonitorIcon from "~icons/ph/monitor";
import MoonStarsIcon from "~icons/ph/moon-stars";
import NewspaperIcon from "~icons/ph/newspaper";
import PauseIcon from "~icons/ph/pause";
import PlayIcon from "~icons/ph/play-fill";
import QuestionIcon from "~icons/ph/question";
import ShieldCheckIcon from "~icons/ph/shield-check";
import SlidersIcon from "~icons/ph/sliders-horizontal";
import SunIcon from "~icons/ph/sun";
import type { BotStatus, Indicators } from "../../api/client";
import {
  COINBASE_DEPOSIT_URL,
  HOST,
  openCoinbaseDeposit,
} from "../../lib/coinbase";
import type { Command } from "../../lib/commands";
import { enterTank } from "../../lib/route";
import type { ThemeChoice } from "../../lib/theme";
import type { Unit } from "../../lib/units";
import { NAV, type Section } from "../header/hooks";

/** How long "pause" pauses for from the palette — a week, one skipped drip. */
const PAUSE_DAYS = 7;

export interface CommandContext {
  indicators: Indicators | null;
  status: BotStatus | null;
  unit: Unit;
  themeChoice: ThemeChoice;
  includeDryRun: boolean;
  jumpTo: (id: Section) => void;
  openSetup: () => void;
  openSystem: () => void;
  openDigest: () => void;
  openPreflight: () => void;
  openBuy: () => void;
  openExplain: () => void;
  editAmount: () => void;
  editSchedule: () => void;
  onSimulate: () => void;
  onTestBuy: () => void;
  onPause: (days: number) => Promise<void>;
  onResume: () => Promise<void>;
  onSetDryRun: (dry: boolean) => void;
  onSetTheme: (choice: ThemeChoice) => void;
  onToggleUnit: () => void;
  onToggleDryRun: (v: boolean) => void;
}

/**
 * Everything the palette can do, assembled from what the header already holds.
 *
 * Two things are deliberately missing. **Going live** is not here: it is the
 * one action that starts spending real money and it keeps its confirmation
 * dialog in the mode toggle rather than becoming three keystrokes — coming
 * back to dry run, the safe direction, is listed. **Importing a CSV** is not
 * here either; it needs a file picker and lives with the history it writes to.
 */
export function buildCommands(ctx: CommandContext): Command[] {
  const paused = ctx.status?.paused === true;
  const live = ctx.status != null && !ctx.status.dry_run;

  const commands: Command[] = NAV.map(({ id, label, Icon }) => ({
    id: `go-${id}`,
    label,
    hint: `Jump to the ${label.toLowerCase()} section`,
    group: "Go to" as const,
    Icon,
    run: () => ctx.jumpTo(id),
  }));

  commands.push(
    {
      id: "open-setup",
      label: "Setup — keys & Discord",
      hint: "Coinbase key, webhook, and what the backend is doing",
      group: "Open",
      Icon: GearIcon,
      run: ctx.openSetup,
    },
    {
      id: "open-system",
      label: "System & maintenance",
      hint: "Scheduler jobs, caches, database backup",
      group: "Open",
      Icon: GearIcon,
      run: ctx.openSystem,
    },
    {
      id: "open-digest",
      label: "Weekly report",
      hint: "When it sends and what it carries",
      group: "Open",
      Icon: NewspaperIcon,
      run: ctx.openDigest,
    },
    // The only way in when nothing is wrong: the bar's pill shows for a blocked
    // buy alone, so this is where "is my bot actually fine?" gets asked.
    {
      id: "open-preflight",
      label: "Check the next buy",
      hint: "Key, balance, price feed and schedule — before Monday, not after",
      group: "Open",
      Icon: ShieldCheckIcon,
      run: ctx.openPreflight,
    },
    {
      id: "open-buy",
      label: "Buy now",
      hint: live ? "A real market buy for an amount you pick" : "A dry-run buy for an amount you pick",
      group: "Open",
      Icon: DropFillIcon,
      run: ctx.openBuy,
    },
    // Listed even though it leaves the app: it opens a page, it does not move
    // money — the deposit itself is made at Coinbase, under Coinbase's login.
    // `away` is what makes the row say that before Enter does it.
    {
      id: "open-topup",
      label: "Deposit at Coinbase",
      hint: "Add money to the account Drip buys from",
      group: "Open",
      Icon: CoinsIcon,
      away: HOST[COINBASE_DEPOSIT_URL],
      run: openCoinbaseDeposit,
    },
    {
      id: "open-sim",
      label: "Backtest the strategy",
      hint: "Replay this schedule over past prices",
      group: "Open",
      Icon: ChartLineUpIcon,
      run: ctx.onSimulate,
    },
    {
      id: "open-tank",
      label: "Wall display",
      hint: "The reservoir, the price and the next buy, big enough to read across a room",
      group: "Open",
      Icon: MonitorIcon,
      run: enterTank,
    },
    // Both land on the next-buy card itself: the palette scrolls back to it and
    // opens the figure for typing, rather than holding a settings panel of its
    // own that could word the same number differently.
    {
      id: "edit-amount",
      label: "Set the buy amount",
      hint: "The base the signal multiplies",
      group: "Open",
      Icon: SlidersIcon,
      run: ctx.editAmount,
    },
    {
      id: "edit-schedule",
      label: "Change the schedule",
      hint: "How often the drip lands, which day and time — and pausing it",
      group: "Open",
      Icon: CalendarIcon,
      run: ctx.editSchedule,
    },
  );

  if (ctx.indicators) {
    commands.push({
      id: "open-explain",
      label: "Why this amount?",
      hint: "What each indicator reads, and the points it put in",
      group: "Open",
      Icon: QuestionIcon,
      run: ctx.openExplain,
    });
  }

  commands.push({
    id: "do-test",
    label: "Run a test buy",
    hint: "Scores the market and records a dry run — spends nothing",
    group: "Do",
    Icon: PlayIcon,
    run: ctx.onTestBuy,
  });

  commands.push(
    paused
      ? {
          id: "do-resume",
          label: "Resume the drip",
          hint: "Start buying on schedule again",
          group: "Do",
          Icon: PlayIcon,
          run: () => void ctx.onResume(),
        }
      : {
          id: "do-pause",
          label: "Pause for a week",
          hint: "Skip the next scheduled buy",
          group: "Do",
          Icon: PauseIcon,
          run: () => void ctx.onPause(PAUSE_DAYS),
        },
  );

  // Only the safe direction. Going live stays in the mode toggle, behind its
  // own confirmation.
  if (live) {
    commands.push({
      id: "do-dry",
      label: "Back to dry run",
      hint: "Stop trading real money",
      group: "Do",
      Icon: FlaskIcon,
      run: () => ctx.onSetDryRun(true),
    });
  }

  commands.push(
    {
      id: "show-unit",
      label: ctx.unit === "sats" ? "Read amounts in BTC" : "Read amounts in sats",
      hint: "Every bitcoin quantity on the page",
      group: "Show",
      Icon: CurrencyBtcIcon,
      run: ctx.onToggleUnit,
    },
    {
      id: "show-dry-runs",
      label: ctx.includeDryRun ? "Hide dry runs from the charts" : "Include dry runs in the charts",
      hint: "Whether test buys count towards the reservoir and the comparison",
      group: "Show",
      Icon: EyeIcon,
      run: () => ctx.onToggleDryRun(!ctx.includeDryRun),
    },
    {
      id: "show-day",
      label: "Day theme",
      group: "Show",
      Icon: SunIcon,
      active: ctx.themeChoice === "light",
      run: () => ctx.onSetTheme("light"),
    },
    {
      id: "show-night",
      label: "Night theme",
      group: "Show",
      Icon: MoonStarsIcon,
      active: ctx.themeChoice === "dark",
      run: () => ctx.onSetTheme("dark"),
    },
    {
      id: "show-system-theme",
      label: "Follow the device theme",
      hint: "Day or night, whichever your phone or laptop is on",
      group: "Show",
      Icon: CircleHalfTiltIcon,
      active: ctx.themeChoice === "system",
      run: () => ctx.onSetTheme("system"),
    },
  );

  return commands;
}
