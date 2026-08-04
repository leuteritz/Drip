import ChartLineUpIcon from "~icons/ph/chart-line-up";
import { TRAY_ITEM } from "./chrome";

/**
 * The backtest, in the sticky bar's tools tray.
 *
 * It used to be a third icon button on the next-buy card, beside Test and Buy —
 * but that row is for what can move money this week, and a backtest spends
 * nothing: it replays the schedule and amount you already have over past
 * prices. So it sits with the other things that open a dialog, and is reachable
 * from anywhere in the scroll rather than only from the top of the page.
 */
export default function BacktestButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Backtest - replay your settings over past prices"
      aria-label="Backtest the strategy"
      className={TRAY_ITEM}
    >
      <ChartLineUpIcon className="text-sm max-sm:text-base" />
    </button>
  );
}
