// The drop is Drip's signature: score shown as filled drops (like hearts
// in a game) and an ambient dripping animation in the dashboard hero.
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

export function ScoreDrops({
  multiplier,
  size = "text-2xl",
}: {
  multiplier: number;
  size?: string;
}) {
  const potency = potencyFromMultiplier(multiplier);
  return (
    <div
      className={`flex items-center gap-1 ${size}`}
      role="img"
      aria-label={`Buy strength ${potency} of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) =>
        i <= potency ? (
          <DropFill key={i} className="text-teal" />
        ) : (
          <DropOutline key={i} className="text-sand" />
        )
      )}
    </div>
  );
}

/** Ambient hero animation: a drop swells, falls into a rippling pool. */
export function DripAnimation() {
  return (
    <svg viewBox="0 0 80 96" className="h-24 w-20" aria-hidden="true">
      {/* faucet mouth */}
      <rect x="30" y="0" width="20" height="10" rx="4" fill="var(--color-sand)" />
      {/* the falling drop */}
      <g className="animate-drip">
        <path
          d="M40 14 C34 24 28 30 28 38 a12 12 0 0 0 24 0 c0-8-6-14-12-24Z"
          fill="var(--color-water)"
        />
      </g>
      {/* pool + ripple */}
      <ellipse
        cx="40"
        cy="82"
        rx="26"
        ry="7"
        fill="var(--color-water)"
        opacity="0.35"
      />
      <ellipse
        className="animate-ripple"
        cx="40"
        cy="82"
        rx="18"
        ry="4.5"
        fill="none"
        stroke="var(--color-teal)"
        strokeWidth="2"
      />
    </svg>
  );
}
