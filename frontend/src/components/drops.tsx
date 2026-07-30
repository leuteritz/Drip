// The drop is Drip's signature: the score shown as filled drops, like hearts
// in a game.
import DropFill from "~icons/ph/drop-fill";
import DropOutline from "~icons/ph/drop";

/** Maps the buy multiplier to a 1-5 "potency" (how hard the bot buys). */
export function potencyFromMultiplier(multiplier: number): number {
  if (multiplier >= 1.5) return 5;
  if (multiplier >= 1.25) return 4;
  if (multiplier >= 1.0) return 3;
  if (multiplier >= 0.75) return 2;
  return 1;
}

/**
 * The five potency drops.
 *
 * `outline` is the default on paper surfaces (teal drops, sand outlines);
 * `solid` is the submerged variant for the header's frosted cards, where an
 * outline would disappear against the water.
 */
export function ScoreDrops({
  multiplier,
  size = "text-2xl",
  variant = "outline",
  className = "",
}: {
  multiplier: number;
  size?: string;
  variant?: "outline" | "solid";
  className?: string;
}) {
  const potency = potencyFromMultiplier(multiplier);
  return (
    <div
      className={`flex items-center gap-1 ${size} ${className}`}
      role="img"
      aria-label={`Buy strength ${potency} of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const on = i <= potency;
        if (variant === "solid") {
          return (
            <DropFill key={i} className={on ? "text-cream" : "text-cream/25"} />
          );
        }
        return on ? (
          <DropFill key={i} className="text-teal" />
        ) : (
          <DropOutline key={i} className="text-sand" />
        );
      })}
    </div>
  );
}
