// How three readings become a multiplier, as a table.
//
// Two places ask it: the hero's `SignalBreakdown`, about the buy that is coming,
// and the history's `BuyReceipt`, about one that has already happened. The
// arithmetic is the same arithmetic and it may only be laid out once — a second
// copy is a second thing to keep in step with `strategy.score_indicators`.
//
// The points themselves always come from the backend (`strategy.indicator_points`,
// which scores one indicator at a time against neutral inputs), so no threshold
// is restated here. What *is* restated is the wording beside each reading —
// "slightly oversold", "below it" — and that is why it lives in one file.
import { fmtPct } from "../lib/format";
import { ScoreDrops } from "./drops";

export interface ScoreReadings {
  points: { fng: number; rsi: number; ma: number };
  fear_greed: number;
  /** Absent on a stored buy: the row keeps the number, never the word. */
  fng_classification?: string;
  rsi: number;
  ma_350: number;
  ma_distance_pct: number;
  price_eur: number;
}

/** One row per indicator, in the order `score_indicators` adds them. */
const ROWS: {
  key: "fng" | "rsi" | "ma";
  label: string;
  reading: (r: ScoreReadings) => string;
}[] = [
  {
    key: "fng",
    label: "Fear & Greed",
    reading: (r) =>
      r.fng_classification ? `${r.fear_greed} · ${r.fng_classification}` : `${r.fear_greed}`,
  },
  {
    key: "rsi",
    label: "RSI, 14 days",
    reading: (r) =>
      `${r.rsi.toFixed(1)} · ${
        r.rsi < 30
          ? "strongly oversold"
          : r.rsi < 45
            ? "slightly oversold"
            : r.rsi > 70
              ? "overbought"
              : "neutral"
      }`,
  },
  {
    key: "ma",
    label: "Price vs. 350-day average",
    reading: (r) =>
      `${fmtPct(r.ma_distance_pct)} · ${r.price_eur < r.ma_350 ? "below it" : "above it"}`,
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
 * The three indicators, their points, and the score they add up to.
 *
 * `footer` is the score line's own caption, because the two callers say
 * different things there: the hero says what the score *will* buy, the receipt
 * what it *did*.
 */
export function ScoreTable({
  readings,
  score,
  scoreMax,
  multiplier,
  footer,
}: {
  readings: ScoreReadings;
  score: number;
  scoreMax: number;
  multiplier: number;
  footer: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-sand">
      {ROWS.map((row, i) => {
        const points = readings.points[row.key];
        return (
          <div
            key={row.key}
            className={`flex items-center gap-3 px-4 py-3 ${
              i > 0 ? "border-t border-sand" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-ink">{row.label}</div>
              <div className="mt-0.5 text-xs text-ink-soft">{row.reading(readings)}</div>
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
            Score {score} of {scoreMax}
          </div>
          <div className="mt-0.5 text-xs text-ink-soft">{footer}</div>
        </div>
        <ScoreDrops multiplier={multiplier} size="text-base" />
      </div>
    </div>
  );
}
