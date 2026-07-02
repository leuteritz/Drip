// Semicircle gauge for RSI / Fear & Greed (0-100 range)

interface Zone {
  to: number;
  color: string;
}

export default function Gauge({
  value,
  label,
  sublabel,
  zones,
}: {
  value: number;
  label: string;
  sublabel?: string;
  zones: Zone[];
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const angle = -180 + (clamped / 100) * 180;

  function polar(pct: number) {
    const rad = ((-180 + (pct / 100) * 180) * Math.PI) / 180;
    return { x: 50 + 40 * Math.cos(rad), y: 50 + 40 * Math.sin(rad) };
  }

  const arc = (from: number, to: number, color: string) => {
    const start = polar(from);
    const end = polar(to);
    const largeArc = to - from > 50 ? 1 : 0;
    return (
      <path
        key={`${from}-${to}`}
        d={`M ${start.x} ${start.y} A 40 40 0 ${largeArc} 1 ${end.x} ${end.y}`}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="butt"
      />
    );
  };

  let prev = 0;
  const arcs = zones.map((z) => {
    const el = arc(prev, z.to, z.color);
    prev = z.to;
    return el;
  });

  const zoneColor =
    zones.find((z) => clamped <= z.to)?.color ?? zones[zones.length - 1].color;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 58" className="w-full max-w-[180px]">
        {arcs}
        <g transform={`rotate(${angle + 90} 50 50)`}>
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="18"
            stroke="var(--color-ink)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
        <circle cx="50" cy="50" r="4.5" fill="var(--color-ink)" />
      </svg>
      <div className="-mt-1 text-center">
        <div className="font-display text-2xl font-semibold" style={{ color: zoneColor }}>
          {Math.round(clamped)}
        </div>
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">
          {label}
        </div>
        {sublabel && <div className="text-xs text-ink-soft">{sublabel}</div>}
      </div>
    </div>
  );
}
