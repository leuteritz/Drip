/**
 * The drop landing.
 *
 * A buy is the one thing Drip does, and until now it announced itself with a
 * small pill of text. This is the tank reacting: three rings spreading from the
 * waterline under the reservoir figure, once, then gone.
 *
 * Purely decorative — `aria-hidden`, `pointer-events-none`, and off entirely
 * under `prefers-reduced-motion`, where the result pill still says what
 * happened. Remounted by its key so a second buy replays it.
 */
const RINGS = [
  { size: 90, delay: "0ms" },
  { size: 160, delay: "170ms" },
  { size: 240, delay: "340ms" },
];

export default function Splash() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-[150px] z-0 flex justify-center"
    >
      {RINGS.map((ring) => (
        <span
          key={ring.size}
          className="animate-splash absolute rounded-full border-2 border-cream/70"
          style={{
            width: ring.size,
            height: ring.size,
            animationDelay: ring.delay,
          }}
        />
      ))}
    </div>
  );
}
