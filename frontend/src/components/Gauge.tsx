// Halbkreis-Gauge fuer RSI / Fear & Greed (Wertebereich 0-100)

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
        opacity="0.85"
      />
    );
  };

  function polar(pct: number) {
    const rad = ((-180 + (pct / 100) * 180) * Math.PI) / 180;
    return { x: 50 + 40 * Math.cos(rad), y: 50 + 40 * Math.sin(rad) };
  }

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
          <line x1="50" y1="50" x2="50" y2="18" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <circle cx="50" cy="50" r="4" fill="#e2e8f0" />
      </svg>
      <div className="-mt-1 text-center">
        <div className="text-xl font-bold tabular-nums" style={{ color: zoneColor }}>
          {Math.round(clamped)}
        </div>
        <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</div>
        {sublabel && <div className="text-xs text-slate-500">{sublabel}</div>}
      </div>
    </div>
  );
}
