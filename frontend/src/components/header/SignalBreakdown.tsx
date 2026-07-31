import type { BotSettings, Indicators } from "../../api/client";
import { fmtEur, fmtPct } from "../../lib/format";
import { ScoreDrops } from "../drops";
import { Modal, Note } from "../ui";

/** One row per indicator, in the order `score_indicators` adds them. */
const ROWS: {
  key: "fng" | "rsi" | "ma";
  label: string;
  reading: (i: Indicators) => string;
}[] = [
  {
    key: "fng",
    label: "Fear & Greed",
    reading: (i) => `${i.fear_greed} · ${i.fng_classification}`,
  },
  {
    key: "rsi",
    label: "RSI, 14 days",
    reading: (i) =>
      `${i.rsi.toFixed(1)} · ${
        i.rsi < 30 ? "strongly oversold" : i.rsi < 45 ? "slightly oversold" : i.rsi > 70 ? "overbought" : "neutral"
      }`,
  },
  {
    key: "ma",
    label: "Price vs. 350-day average",
    reading: (i) =>
      `${fmtPct(i.ma_distance_pct)} · ${i.current_price < i.ma_350 ? "below it" : "above it"}`,
  },
];

/** "+2" / "0" / "-2" — the sign is the whole message, so zero stays unsigned. */
const fmtPoints = (points: number) => (points > 0 ? `+${points}` : String(points));

function toneFor(points: number): string {
  if (points > 0) return "bg-water-soft text-teal";
  if (points < 0) return "bg-rose-soft text-rose";
  return "bg-sand-soft text-ink-soft";
}

/**
 * Why the next buy is the size it is.
 *
 * The hero has always shown the score and the multiplier it produces, but the
 * arithmetic between them lived three screens down in Research. This is that
 * arithmetic and nothing more: what each of the three indicators reads right
 * now, the points it put in, and the base amount multiplied out.
 *
 * The points come from the backend (`strategy.indicator_points`), which scores
 * one indicator at a time against neutral inputs — so no threshold is restated
 * here and the three rows always add up to the score in the footer.
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

      <div className="mt-5 overflow-hidden rounded-xl border border-sand">
        {ROWS.map((row, i) => {
          const points = indicators.points[row.key];
          return (
            <div
              key={row.key}
              className={`flex items-center gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-sand" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-ink">{row.label}</div>
                <div className="mt-0.5 text-xs text-ink-soft">
                  {row.reading(indicators)}
                </div>
              </div>
              <span
                className={`w-10 shrink-0 rounded-lg py-1 text-center font-display text-sm font-semibold ${toneFor(points)}`}
              >
                {fmtPoints(points)}
              </span>
            </div>
          );
        })}

        <div className="flex items-center gap-3 border-t-2 border-sand bg-sand-soft/60 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-ink">
              Score {indicators.score} of {indicators.score_max}
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">
              which buys at &times;{indicators.multiplier}
            </div>
          </div>
          <ScoreDrops multiplier={indicators.multiplier} size="text-base" />
        </div>
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
