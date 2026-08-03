/**
 * The hero's body of water: the tank gradient, rising bubbles and the rolling
 * waterline that breaks across its top edge.
 *
 * Purely decorative (`aria-hidden`, `pointer-events-none`) and entirely
 * self-contained, so the header above it stays about data. The wave tones are
 * shades of the water gradient rather than palette colors — they live in
 * index.css beside that gradient so the surface dims with the water when the
 * night theme comes on, instead of leaving a lit crest on a dark tank.
 */

import type { CSSProperties } from "react";

const WAVE_BACK = "var(--wave-back)";
const WAVE_FRONT = "var(--wave-front)";
const FOAM = "var(--wave-foam)";

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
 */
const BUBBLES: {
  left: string;
  from: string;
  rise: string;
  size: string;
  tone: string;
  drift: string;
  duration: string;
  delay: string;
}[] = [
  { left: "2%", from: "1%", rise: "92%", size: "0.45rem", tone: ".5", drift: "0.5rem", duration: "9.5s", delay: "0.6s" },
  { left: "6%", from: "8%", rise: "74%", size: "0.3rem", tone: ".52", drift: "-0.3rem", duration: "7.2s", delay: "4.8s" },
  { left: "10%", from: "3%", rise: "84%", size: "0.55rem", tone: ".44", drift: "-0.4rem", duration: "9s", delay: "2.1s" },
  { left: "14%", from: "0%", rise: "95%", size: "0.7rem", tone: ".4", drift: "0.75rem", duration: "11s", delay: "7.4s" },
  { left: "17%", from: "11%", rise: "70%", size: "0.35rem", tone: ".5", drift: "-0.35rem", duration: "6.8s", delay: "1.3s" },
  { left: "21%", from: "2%", rise: "89%", size: "0.5rem", tone: ".46", drift: "0.6rem", duration: "9.8s", delay: "5.5s" },
  { left: "25%", from: "6%", rise: "62%", size: "0.25rem", tone: ".55", drift: "-0.25rem", duration: "6.2s", delay: "3s" },
  { left: "28%", from: "1%", rise: "93%", size: "0.6rem", tone: ".42", drift: "0.45rem", duration: "10.6s", delay: "0.2s" },
  { left: "32%", from: "13%", rise: "72%", size: "0.4rem", tone: ".48", drift: "-0.55rem", duration: "8.6s", delay: "6.2s" },
  { left: "36%", from: "4%", rise: "86%", size: "0.35rem", tone: ".5", drift: "0.35rem", duration: "8.2s", delay: "2.6s" },
  { left: "39%", from: "2%", rise: "96%", size: "0.8rem", tone: ".36", drift: "0.5rem", duration: "12s", delay: "8.1s" },
  { left: "43%", from: "9%", rise: "66%", size: "0.3rem", tone: ".52", drift: "-0.3rem", duration: "6.6s", delay: "4.3s" },
  { left: "46%", from: "0%", rise: "90%", size: "0.45rem", tone: ".46", drift: "0.65rem", duration: "10.4s", delay: "1.6s" },
  { left: "50%", from: "5%", rise: "79%", size: "0.6rem", tone: ".42", drift: "-0.5rem", duration: "9.2s", delay: "6.9s" },
  { left: "53%", from: "16%", rise: "64%", size: "0.3rem", tone: ".5", drift: "0.3rem", duration: "7s", delay: "3.6s" },
  { left: "57%", from: "2%", rise: "94%", size: "0.4rem", tone: ".48", drift: "0.4rem", duration: "10.8s", delay: "0.9s" },
  { left: "61%", from: "10%", rise: "75%", size: "0.5rem", tone: ".44", drift: "-0.45rem", duration: "8.8s", delay: "5.8s" },
  { left: "64%", from: "3%", rise: "87%", size: "0.35rem", tone: ".5", drift: "0.3rem", duration: "8.4s", delay: "2.2s" },
  { left: "68%", from: "1%", rise: "91%", size: "0.7rem", tone: ".38", drift: "0.8rem", duration: "11.6s", delay: "7.7s" },
  { left: "71%", from: "7%", rise: "68%", size: "0.25rem", tone: ".55", drift: "-0.25rem", duration: "6.4s", delay: "4s" },
  { left: "75%", from: "0%", rise: "97%", size: "0.5rem", tone: ".44", drift: "0.5rem", duration: "11.2s", delay: "1.1s" },
  { left: "78%", from: "12%", rise: "73%", size: "0.4rem", tone: ".48", drift: "-0.4rem", duration: "8s", delay: "6.5s" },
  { left: "82%", from: "4%", rise: "83%", size: "0.6rem", tone: ".42", drift: "0.55rem", duration: "9.6s", delay: "3.2s" },
  { left: "85%", from: "6%", rise: "60%", size: "0.3rem", tone: ".52", drift: "-0.3rem", duration: "6.6s", delay: "0.4s" },
  { left: "88%", from: "2%", rise: "92%", size: "0.45rem", tone: ".46", drift: "0.6rem", duration: "10.2s", delay: "5.2s" },
  { left: "91%", from: "14%", rise: "71%", size: "0.35rem", tone: ".5", drift: "-0.35rem", duration: "7.6s", delay: "2.8s" },
  { left: "94%", from: "1%", rise: "88%", size: "0.65rem", tone: ".4", drift: "-0.7rem", duration: "10s", delay: "8.4s" },
  { left: "97%", from: "8%", rise: "78%", size: "0.35rem", tone: ".48", drift: "0.35rem", duration: "8.6s", delay: "1.9s" },
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

export default function TankBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 top-[5.5rem] z-0"
    >
      <div className="tank-water absolute inset-0 overflow-hidden">
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            className="bubble"
            style={
              {
                left: b.left,
                bottom: b.from,
                "--rise": b.rise,
                "--size": b.size,
                "--tone": b.tone,
                "--drift": b.drift,
                "--dur": b.duration,
                "--delay": b.delay,
              } as CSSProperties
            }
          />
        ))}
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
