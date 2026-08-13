import type { BotSettings, Indicators } from "../../api/client";
import { fmtEur } from "../../lib/format";
import { ScoreTable } from "../scoring";
import { Modal, Note } from "../ui";

/**
 * Why the next buy is the size it is.
 *
 * The hero has always shown the score and the multiplier it produces, but the
 * arithmetic between them lived three screens down in Research. This is that
 * arithmetic and nothing more: what each of the three indicators reads right
 * now, the points it put in, and the base amount multiplied out.
 *
 * The table itself is `components/scoring.tsx`, shared with the history's
 * receipt — the same three rows about a buy that has already happened. The
 * points come from the backend (`strategy.indicator_points`), which scores one
 * indicator at a time against neutral values, so no threshold is restated on
 * this side and the three rows always add up to the score in the footer.
 */
export default function SignalBreakdown({
  indicators,
  settings,
  onClose,
}: {
  indicators: Indicators;
  settings: BotSettings | null;
  onClose: () => void;
}) {
  const base = settings?.base_amount_eur ?? 0;
  const amount = base * indicators.multiplier;

  return (
    <Modal onClose={onClose} closeOnBackdrop className="w-full max-w-lg">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-2xl font-bold text-ink">
          Why {fmtEur(amount)}
        </h2>
        <span className="text-sm font-bold text-teal">{indicators.signal}</span>
      </div>

      <div className="mt-5">
        <ScoreTable
          readings={indicators}
          score={indicators.score}
          scoreMax={indicators.score_max}
          multiplier={indicators.multiplier}
          footer={`which buys at ×${indicators.multiplier}`}
        />
      </div>

      <p className="mt-4 text-center font-display text-lg font-semibold text-ink">
        {fmtEur(base, 0)} base &times; {indicators.multiplier} ={" "}
        <span className="text-teal">{fmtEur(amount)}</span>
      </p>

      <Note>
        Drip always buys — the score only sets the size. A cheap-looking market
        earns points and buys more of it; an expensive one loses them and buys
        less. Whether the score is worth anything is a different question, and
        the Research section is where it gets tested.
      </Note>
    </Modal>
  );
}
