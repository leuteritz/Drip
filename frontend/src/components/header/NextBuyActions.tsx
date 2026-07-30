import CaretDownIcon from "~icons/ph/caret-down";
import ChartLineUpIcon from "~icons/ph/chart-line-up";
import DropHalfBottomIcon from "~icons/ph/drop-half-bottom";
import PlayIcon from "~icons/ph/play-fill";
import type { BotSettings, BotStatus, Indicators } from "../../api/client";
import { fmtEur, formatWeekdayTime, WEEKDAYS } from "../../lib/format";

const PILL =
  "flex flex-1 items-center justify-center gap-1.5 rounded-full py-[7px] text-[11px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60";
const ICON_BUTTON =
  "flex w-8 flex-none items-center justify-center rounded-full bg-teal/14 text-teal transition hover:bg-teal/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";

/**
 * Next scheduled buy — a button that opens the faucet control bar — plus the
 * dry-run test, manual buy and simulate actions. Buy uses the same simple
 * mechanic as the bot (a market buy for an amount) via ManualBuyDialog; in
 * live mode it turns rose to signal real money.
 */
export default function NextBuyActions({
  indicators,
  settings,
  status,
  onTestBuy,
  onSimulate,
  onBuy,
  onTogglePanel,
  panelOpen,
  running,
  buying,
}: {
  indicators: Indicators | null;
  settings: BotSettings | null;
  status: BotStatus | null;
  onTestBuy: () => void;
  onSimulate: () => void;
  onBuy: () => void;
  onTogglePanel: () => void;
  panelOpen: boolean;
  running: boolean;
  buying: boolean;
}) {
  const live = status != null && !status.dry_run;
  // Prefer the scheduler's own next-run time; fall back to the configured slot
  // while the status is still loading.
  const nextWhen = status?.next_run
    ? formatWeekdayTime(status.next_run)
    : settings
      ? `${WEEKDAYS[settings.schedule_weekday].slice(0, 3)} ${settings.schedule_time}`
      : "—";
  const nextAmount =
    settings && indicators
      ? fmtEur(settings.base_amount_eur * indicators.multiplier)
      : "—";

  return (
    <div className="flex w-[210px] flex-col items-center rounded-[18px] bg-cream px-[18px] py-[15px] text-center shadow-[0_18px_38px_-16px_rgba(0,0,0,.55)]">
      <div className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.1em] text-[#5c8a91]">
        Next buy &middot; {nextWhen}
      </div>
      <div className="mt-1 font-display text-3xl font-semibold leading-none text-[#2f5a63]">
        {nextAmount}
      </div>
      <div className="mt-3 flex gap-1.5 self-stretch">
        <button
          onClick={onTestBuy}
          disabled={running}
          className={`${PILL} bg-teal text-cream hover:bg-teal/90 focus-visible:outline-teal`}
        >
          <PlayIcon /> {running ? "Testing…" : "Test"}
        </button>
        <button
          onClick={onBuy}
          disabled={buying}
          className={`${PILL} ${
            live
              ? "bg-rose text-cream hover:opacity-90 focus-visible:outline-rose"
              : "bg-teal/14 text-teal hover:bg-teal/20 focus-visible:outline-teal"
          }`}
        >
          <DropHalfBottomIcon /> {buying ? "Buying…" : "Buy"}
        </button>
        <button
          onClick={onSimulate}
          aria-label="Simulate the strategy"
          title="Simulate"
          className={ICON_BUTTON}
        >
          <ChartLineUpIcon className="text-sm" />
        </button>
        <button
          type="button"
          onClick={onTogglePanel}
          aria-expanded={panelOpen}
          aria-label="Adjust the next buy"
          title="Adjust"
          className={ICON_BUTTON}
        >
          <CaretDownIcon
            className={`text-sm transition-transform duration-300 ${panelOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>
    </div>
  );
}
