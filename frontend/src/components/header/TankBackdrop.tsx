/**
 * The hero's body of water: the tank gradient, rising bubbles and the rolling
 * waterline that breaks across its top edge.
 *
 * Decorative (`aria-hidden`, `pointer-events-none`), but not arbitrary: how
 * hard the water fizzes is the signal. The wave tones are shades of the water
 * gradient rather than palette colors — they live in index.css beside that
 * gradient so the surface dims with the water when the night theme comes on,
 * instead of leaving a lit crest on a dark tank.
 */

import type { CSSProperties } from "react";

const WAVE_BACK = "var(--wave-back)";
const WAVE_FRONT = "var(--wave-front)";
const FOAM = "var(--wave-foam)";

/**
 * How lively the water is, 0 to 1, read off the multiplier the score produces.
 *
 * The ladder in `strategy.score_indicators` runs 0.5x to 1.5x, so the five
 * rungs land on 0, ¼, ½, ¾ and 1 — a strong buy signal is a tank going,
 * a weak one is a tank ticking over. Neither end is a state of its own: the
 * calm tank still has half its bubbles, and the busy one is a third busier
 * rather than a jacuzzi. Nothing is known yet is half, not still.
 */
const MIN_MULTIPLIER = 0.5;
const MAX_MULTIPLIER = 1.5;

/** Slower than written when calm, faster when the signal is strong. */
const CALM_TEMPO = 1.45;
const LIVELY_TEMPO = 0.72;

/** The same walk, applied to the cream's alpha — a busy tank reads brighter. */
const CALM_TONE = 0.9;
const LIVELY_TONE = 1.15;

function fizzOf(multiplier: number | null | undefined): number {
  if (multiplier == null) return 0.5;
  const share = (multiplier - MIN_MULTIPLIER) / (MAX_MULTIPLIER - MIN_MULTIPLIER);
  return Math.min(1, Math.max(0, share));
}

const mix = (from: number, to: number, fizz: number) => from + (to - from) * fizz;

/**
 * Rising bubbles.
 *
 * `from` is where one is born and `rise` how far it climbs — both a share of
 * the water's own height, which is what lets the same table look right in the
 * hero and on the full-screen wall display. The two add up to somewhere between
 * three quarters and just under the surface, so the tallest climbers vanish a
 * hair below the waterline and never punch through it. `drift` is the sideways
 * sway on the way up, `tone` the cream's alpha: the big ones sit fainter, the
 * way a bubble further back would. Sizes are in rem like everything else here,
 * so a 2560px monitor gets a bigger tank rather than the same specks in it.
 *
 * The delays are spread across the durations rather than bunched, so no two
 * neighbours leave the floor together and the tank is never briefly empty.
 *
 * `at` is the fizz this bubble joins at — every second one is `0` and always
 * there, so the calm tank keeps half the field, its full width and its whole
 * range of sizes. The rest fill in between their neighbours as the signal
 * strengthens: 14 bubbles at 0.5x, 21 at 1.0x, all 28 at 1.5x.
 */
const BUBBLES: {
  left: string;
  from: string;
  rise: string;
  size: string;
  tone: number;
  drift: string;
  /** Seconds, before the tempo of the day is applied. */
  duration: number;
  delay: string;
  at: number;
}[] = [
  { left: "2%", from: "1%", rise: "92%", size: "0.45rem", tone: 0.5, drift: "0.5rem", duration: 9.5, delay: "0.6s", at: 0 },
  { left: "6%", from: "8%", rise: "74%", size: "0.3rem", tone: 0.52, drift: "-0.3rem", duration: 7.2, delay: "4.8s", at: 0.55 },
  { left: "10%", from: "3%", rise: "84%", size: "0.55rem", tone: 0.44, drift: "-0.4rem", duration: 9, delay: "2.1s", at: 0 },
  { left: "14%", from: "0%", rise: "95%", size: "0.7rem", tone: 0.4, drift: "0.75rem", duration: 11, delay: "7.4s", at: 0.2 },
  { left: "17%", from: "11%", rise: "70%", size: "0.35rem", tone: 0.5, drift: "-0.35rem", duration: 6.8, delay: "1.3s", at: 0 },
  { left: "21%", from: "2%", rise: "89%", size: "0.5rem", tone: 0.46, drift: "0.6rem", duration: 9.8, delay: "5.5s", at: 0.75 },
  { left: "25%", from: "6%", rise: "62%", size: "0.25rem", tone: 0.55, drift: "-0.25rem", duration: 6.2, delay: "3s", at: 0 },
  { left: "28%", from: "1%", rise: "93%", size: "0.6rem", tone: 0.42, drift: "0.45rem", duration: 10.6, delay: "0.2s", at: 0.35 },
  { left: "32%", from: "13%", rise: "72%", size: "0.4rem", tone: 0.48, drift: "-0.55rem", duration: 8.6, delay: "6.2s", at: 0 },
  { left: "36%", from: "4%", rise: "86%", size: "0.35rem", tone: 0.5, drift: "0.35rem", duration: 8.2, delay: "2.6s", at: 0.9 },
  { left: "39%", from: "2%", rise: "96%", size: "0.8rem", tone: 0.36, drift: "0.5rem", duration: 12, delay: "8.1s", at: 0 },
  { left: "43%", from: "9%", rise: "66%", size: "0.3rem", tone: 0.52, drift: "-0.3rem", duration: 6.6, delay: "4.3s", at: 0.15 },
  { left: "46%", from: "0%", rise: "90%", size: "0.45rem", tone: 0.46, drift: "0.65rem", duration: 10.4, delay: "1.6s", at: 0 },
  { left: "50%", from: "5%", rise: "79%", size: "0.6rem", tone: 0.42, drift: "-0.5rem", duration: 9.2, delay: "6.9s", at: 0.6 },
  { left: "53%", from: "16%", rise: "64%", size: "0.3rem", tone: 0.5, drift: "0.3rem", duration: 7, delay: "3.6s", at: 0 },
  { left: "57%", from: "2%", rise: "94%", size: "0.4rem", tone: 0.48, drift: "0.4rem", duration: 10.8, delay: "0.9s", at: 0.3 },
  { left: "61%", from: "10%", rise: "75%", size: "0.5rem", tone: 0.44, drift: "-0.45rem", duration: 8.8, delay: "5.8s", at: 0 },
  { left: "64%", from: "3%", rise: "87%", size: "0.35rem", tone: 0.5, drift: "0.3rem", duration: 8.4, delay: "2.2s", at: 0.85 },
  { left: "68%", from: "1%", rise: "91%", size: "0.7rem", tone: 0.38, drift: "0.8rem", duration: 11.6, delay: "7.7s", at: 0 },
  { left: "71%", from: "7%", rise: "68%", size: "0.25rem", tone: 0.55, drift: "-0.25rem", duration: 6.4, delay: "4s", at: 0.45 },
  { left: "75%", from: "0%", rise: "97%", size: "0.5rem", tone: 0.44, drift: "0.5rem", duration: 11.2, delay: "1.1s", at: 0 },
  { left: "78%", from: "12%", rise: "73%", size: "0.4rem", tone: 0.48, drift: "-0.4rem", duration: 8, delay: "6.5s", at: 0.7 },
  { left: "82%", from: "4%", rise: "83%", size: "0.6rem", tone: 0.42, drift: "0.55rem", duration: 9.6, delay: "3.2s", at: 0 },
  { left: "85%", from: "6%", rise: "60%", size: "0.3rem", tone: 0.52, drift: "-0.3rem", duration: 6.6, delay: "0.4s", at: 0.25 },
  { left: "88%", from: "2%", rise: "92%", size: "0.45rem", tone: 0.46, drift: "0.6rem", duration: 10.2, delay: "5.2s", at: 0 },
  { left: "91%", from: "14%", rise: "71%", size: "0.35rem", tone: 0.5, drift: "-0.35rem", duration: 7.6, delay: "2.8s", at: 0.95 },
  { left: "94%", from: "1%", rise: "88%", size: "0.65rem", tone: 0.4, drift: "-0.7rem", duration: 10, delay: "8.4s", at: 0 },
  { left: "97%", from: "8%", rise: "78%", size: "0.35rem", tone: 0.48, drift: "0.35rem", duration: 8.6, delay: "1.9s", at: 0.4 },
];

// Each wave path repeats every 120px so the marquee shift loops seamlessly.
const WAVE_BACK_PATH =
  "M-120 60 q15 -18 30 0 q15 14 30 0 q15 -24 30 0 q15 12 30 0 q15 -18 30 0 q15 14 30 0 q15 -24 30 0 q15 12 30 0 q15 -18 30 0 q15 14 30 0 q15 -24 30 0 q15 12 30 0 q15 -18 30 0 q15 14 30 0 q15 -24 30 0 q15 12 30 0 q15 -18 30 0 q15 14 30 0 q15 -24 30 0 q15 12 30 0 q15 -18 30 0 q15 14 30 0 q15 -24 30 0 q15 12 30 0 q15 -18 30 0 q15 14 30 0 q15 -24 30 0 q15 12 30 0 q15 -18 30 0 q15 14 30 0 q15 -24 30 0 q15 12 30 0 q15 -18 30 0 q15 14 30 0 q15 -24 30 0 q15 12 30 0 q15 -18 30 0 q15 14 30 0 q15 -24 30 0 q15 12 30 0 q15 -18 30 0 q15 14 30 0 q15 -24 30 0 q15 12 30 0 q15 -18 30 0 q15 14 30 0 q15 -24 30 0 q15 12 30 0 V120 H-120 Z";

const WAVE_MID_PATH =
  "M-120 60 q15 20 30 0 q15 -28 30 0 q15 16 30 0 q15 -22 30 0 q15 20 30 0 q15 -28 30 0 q15 16 30 0 q15 -22 30 0 q15 20 30 0 q15 -28 30 0 q15 16 30 0 q15 -22 30 0 q15 20 30 0 q15 -28 30 0 q15 16 30 0 q15 -22 30 0 q15 20 30 0 q15 -28 30 0 q15 16 30 0 q15 -22 30 0 q15 20 30 0 q15 -28 30 0 q15 16 30 0 q15 -22 30 0 q15 20 30 0 q15 -28 30 0 q15 16 30 0 q15 -22 30 0 q15 20 30 0 q15 -28 30 0 q15 16 30 0 q15 -22 30 0 q15 20 30 0 q15 -28 30 0 q15 16 30 0 q15 -22 30 0 q15 20 30 0 q15 -28 30 0 q15 16 30 0 q15 -22 30 0 q15 20 30 0 q15 -28 30 0 q15 16 30 0 q15 -22 30 0 q15 20 30 0 q15 -28 30 0 q15 16 30 0 q15 -22 30 0 V120 H-120 Z";

// The front crest, drawn twice: filled as the swell, stroked as the foam line.
const WAVE_FRONT_CREST =
  "M-120 60 q15 -34 30 0 q15 22 30 0 q15 -26 30 0 q15 18 30 0 q15 -34 30 0 q15 22 30 0 q15 -26 30 0 q15 18 30 0 q15 -34 30 0 q15 22 30 0 q15 -26 30 0 q15 18 30 0 q15 -34 30 0 q15 22 30 0 q15 -26 30 0 q15 18 30 0 q15 -34 30 0 q15 22 30 0 q15 -26 30 0 q15 18 30 0 q15 -34 30 0 q15 22 30 0 q15 -26 30 0 q15 18 30 0 q15 -34 30 0 q15 22 30 0 q15 -26 30 0 q15 18 30 0 q15 -34 30 0 q15 22 30 0 q15 -26 30 0 q15 18 30 0 q15 -34 30 0 q15 22 30 0 q15 -26 30 0 q15 18 30 0 q15 -34 30 0 q15 22 30 0 q15 -26 30 0 q15 18 30 0 q15 -34 30 0 q15 22 30 0 q15 -26 30 0 q15 18 30 0 q15 -34 30 0 q15 22 30 0 q15 -26 30 0 q15 18 30 0";

const WAVE_FRONT_PATH = `${WAVE_FRONT_CREST} V120 H-120 Z`;

/** `multiplier` is the score's own output; leave it off and the tank sits at half. */
export default function TankBackdrop({ multiplier }: { multiplier?: number | null }) {
  const fizz = fizzOf(multiplier);
  const tempo = mix(CALM_TEMPO, LIVELY_TEMPO, fizz);
  const lift = mix(CALM_TONE, LIVELY_TONE, fizz);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 top-[5.5rem] z-0"
    >
      <div className="tank-water absolute inset-0 overflow-hidden">
        {BUBBLES.map((b, i) =>
          b.at > fizz ? null : (
            <span
              key={i}
              className="bubble"
              style={
                {
                  left: b.left,
                  bottom: b.from,
                  "--rise": b.rise,
                  "--size": b.size,
                  "--tone": (b.tone * lift).toFixed(3),
                  "--drift": b.drift,
                  "--dur": `${(b.duration * tempo).toFixed(2)}s`,
                  "--delay": b.delay,
                } as CSSProperties
              }
            />
          ),
        )}
      </div>

      {/* The waving surface, painted over the water's top edge: baseline at the
          waterline, asymmetric sine swells crossing above and below it. Painted
          after the water so it is never covered. */}
      <svg
        viewBox="0 0 1080 120"
        preserveAspectRatio="none"
        className="animate-swell absolute inset-x-0 -top-[3.75rem] h-[7.5rem] w-full"
      >
        {/* Each layer's fill fades to transparent toward the svg bottom so the
            surface melts into the tank-water gradient — no hard seam, even
            while the swell bobs. */}
        <defs>
          <linearGradient id="waveFillBack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={WAVE_BACK} stopOpacity="0.35" />
            <stop offset="0.55" stopColor={WAVE_BACK} stopOpacity="0.35" />
            <stop offset="1" stopColor={WAVE_BACK} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="waveFillMid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={WAVE_BACK} stopOpacity="0.55" />
            <stop offset="0.55" stopColor={WAVE_BACK} stopOpacity="0.55" />
            <stop offset="1" stopColor={WAVE_BACK} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="waveFillFront" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={WAVE_FRONT} stopOpacity="1" />
            <stop offset="0.6" stopColor={WAVE_FRONT} stopOpacity="1" />
            <stop offset="1" stopColor={WAVE_FRONT} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Back — faint, slow, gentle uneven swell */}
        <g className="animate-wave-slow">
          <path d={WAVE_BACK_PATH} fill="url(#waveFillBack)" />
        </g>
        {/* Mid — phase-offset so the layers never align */}
        <g className="animate-wave">
          <path d={WAVE_MID_PATH} fill="url(#waveFillMid)" />
        </g>
        {/* Front — solid rolling swell with a sunlit foam line riding the crest */}
        <g className="animate-wave-fast">
          <path d={WAVE_FRONT_PATH} fill="url(#waveFillFront)" />
          <path
            d={WAVE_FRONT_CREST}
            fill="none"
            stroke={FOAM}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}
