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

const WAVE_BACK = "var(--wave-back)";
const WAVE_FRONT = "var(--wave-front)";
const FOAM = "var(--wave-foam)";

/** Rising bubbles — position, size, tempo, delay and climb height. */
const BUBBLES: {
  left: string;
  bottom: string;
  size: string;
  color: string;
  duration: string;
  delay: string;
  kind?: "short" | "tall";
}[] = [
  { left: "4%", bottom: "10px", size: "7px", color: "rgba(241,255,250,.48)", duration: "6.2s", delay: "2.8s" },
  { left: "12%", bottom: "12px", size: "9px", color: "rgba(241,255,250,.5)", duration: "6.5s", delay: ".2s" },
  { left: "19%", bottom: "5px", size: "5px", color: "rgba(241,255,250,.45)", duration: "7.6s", delay: "1.1s", kind: "tall" },
  { left: "26%", bottom: "6px", size: "6px", color: "rgba(241,255,250,.45)", duration: "5s", delay: "1.4s", kind: "short" },
  { left: "34%", bottom: "14px", size: "11px", color: "rgba(241,255,250,.38)", duration: "8s", delay: "3.2s", kind: "tall" },
  { left: "41%", bottom: "8px", size: "4px", color: "rgba(241,255,250,.5)", duration: "4.5s", delay: ".7s", kind: "short" },
  { left: "47%", bottom: "10px", size: "12px", color: "rgba(241,255,250,.4)", duration: "7.4s", delay: ".9s" },
  { left: "55%", bottom: "4px", size: "8px", color: "rgba(241,255,250,.44)", duration: "6.8s", delay: "2.4s", kind: "tall" },
  { left: "63%", bottom: "4px", size: "7px", color: "rgba(241,255,250,.5)", duration: "5.6s", delay: "2.1s", kind: "short" },
  { left: "70%", bottom: "12px", size: "5px", color: "rgba(241,255,250,.46)", duration: "5.4s", delay: "3.5s" },
  { left: "78%", bottom: "14px", size: "10px", color: "rgba(241,255,250,.42)", duration: "6.9s", delay: ".5s" },
  { left: "84%", bottom: "6px", size: "13px", color: "rgba(241,255,250,.35)", duration: "7.8s", delay: "1.6s", kind: "tall" },
  { left: "90%", bottom: "8px", size: "5px", color: "rgba(241,255,250,.5)", duration: "4.6s", delay: "1.8s", kind: "short" },
  { left: "96%", bottom: "10px", size: "6px", color: "rgba(241,255,250,.48)", duration: "5.8s", delay: ".4s" },
  { left: "8%", bottom: "6px", size: "8px", color: "rgba(241,255,250,.42)", duration: "8.4s", delay: "1.9s", kind: "tall" },
  { left: "30%", bottom: "10px", size: "6px", color: "rgba(241,255,250,.46)", duration: "7.9s", delay: ".3s", kind: "tall" },
  { left: "51%", bottom: "8px", size: "9px", color: "rgba(241,255,250,.4)", duration: "8.6s", delay: "2.7s", kind: "tall" },
  { left: "59%", bottom: "12px", size: "5px", color: "rgba(241,255,250,.5)", duration: "6.4s", delay: "1.2s" },
  { left: "74%", bottom: "6px", size: "10px", color: "rgba(241,255,250,.38)", duration: "8.2s", delay: "3.9s", kind: "tall" },
  { left: "87%", bottom: "10px", size: "7px", color: "rgba(241,255,250,.44)", duration: "7.7s", delay: "2.2s", kind: "tall" },
];

const BUBBLE_ANIMATION = {
  short: "animate-bubble-short",
  tall: "animate-bubble-tall",
} as const;

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
            className={`absolute rounded-full ${
              b.kind ? BUBBLE_ANIMATION[b.kind] : "animate-bubble"
            }`}
            style={{
              left: b.left,
              bottom: b.bottom,
              width: b.size,
              height: b.size,
              backgroundColor: b.color,
              animationDuration: b.duration,
              animationDelay: b.delay,
            }}
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
