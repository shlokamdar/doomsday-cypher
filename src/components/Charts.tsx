import { useMemo, useRef, useState } from "react";
import { clockTime } from "./Bits";

export interface Series {
  id: string;
  name: string;
  color: string;
  points: { at: number; power: number }[];
}

/** Step chart of points over time. 2px lines, recessive grid, crosshair + tooltip on hover, legend below. */
export function StepChart({ series, start, end, height = 260 }: { series: Series[]; start: number; end: number; height?: number }) {
  const W = 760;
  const H = height;
  const pad = { l: 44, r: 16, t: 14, b: 28 };
  const rawMax = Math.max(10, ...series.flatMap((s) => s.points.map((p) => p.power)));
  const rawMin = Math.min(0, ...series.flatMap((s) => s.points.map((p) => p.power)));
  const step = niceStep((rawMax - rawMin) / 4);
  const max = Math.ceil(rawMax / step) * step;
  const min = Math.floor(rawMin / step) * step;
  const span = Math.max(1, end - start);
  const x = (t: number) => pad.l + ((Math.min(Math.max(t, start), end) - start) / span) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const paths = useMemo(
    () =>
      series.map((s) => {
        let d = `M${x(start)} ${y(0)}`;
        let last = 0;
        for (const p of s.points) {
          d += ` H${x(p.at)} V${y(p.power)}`;
          last = p.power;
        }
        d += ` H${x(end)}`;
        return { ...s, d, last };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, start, end, max, min],
  );
  const ticks: number[] = [];
  for (let v = min; v <= max; v += step) ticks.push(v);
  const valueAt = (s: Series, t: number) => {
    let v = 0;
    for (const p of s.points) if (p.at <= t) v = p.power;
    return v;
  };

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const t = start + ((px - pad.l) / (W - pad.l - pad.r)) * span;
    setHover(Math.min(end, Math.max(start, t)));
  };

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        role="img"
        aria-label="Points over time for the top teams"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#C9D2DC" strokeOpacity=".08" />
            <text x={pad.l - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#C9D2DC" fillOpacity=".55">
              {v}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 8} fontSize="11" fill="#C9D2DC" fillOpacity=".55">
          {clockTime(start)}
        </text>
        <text x={W - pad.r} y={H - 8} textAnchor="end" fontSize="11" fill="#C9D2DC" fillOpacity=".55">
          {clockTime(end)}
        </text>
        {paths.map((p) => (
          <path key={p.id} d={p.d} fill="none" stroke={p.color} strokeWidth="2" strokeLinejoin="round" />
        ))}
        {paths.map((p) => (
          <circle key={p.id + "e"} cx={x(end)} cy={y(p.last)} r="4" fill={p.color} stroke="#12161C" strokeWidth="2" />
        ))}
        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#C9D2DC" strokeOpacity=".35" strokeDasharray="3 3" />
            {series.map((s) => (
              <circle key={s.id} cx={x(hover)} cy={y(valueAt(s, hover))} r="4" fill={s.color} stroke="#12161C" strokeWidth="2" />
            ))}
          </>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[160px] rounded-md border border-white/10 bg-void/95 px-3 py-2 text-xs shadow-xl"
          style={{ left: `${Math.min(70, (x(hover) / W) * 100)}%` }}
        >
          <div className="mb-1 font-semibold text-white">{clockTime(hover)}</div>
          {[...series]
            .sort((a, b) => valueAt(b, hover) - valueAt(a, hover))
            .map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-steel">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                <span className="flex-1 truncate">{s.name}</span>
                <span className="tabular-nums text-white">{valueAt(s, hover)}</span>
              </div>
            ))}
        </div>
      )}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-steel" aria-label="Legend">
        {series.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function niceStep(raw: number) {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

/** Horizontal bars (e.g. solves by category). */
export function HBars({ rows }: { rows: { label: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[90px_1fr_36px] items-center gap-2 text-sm" title={`${r.label}: ${r.value}`}>
          <span className="truncate text-steel">{r.label}</span>
          <span className="h-3 rounded-r bg-white/5">
            <span className="block h-3 rounded-r" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </span>
          <span className="text-right tabular-nums text-white">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Column chart of counts per time bucket. */
export function Columns({ buckets, color = "#2BD67B", label }: { buckets: { label: string; value: number }[]; color?: string; label: string }) {
  const max = Math.max(1, ...buckets.map((b) => b.value));
  return (
    <div>
      <div className="flex h-36 items-end gap-[2px]" role="img" aria-label={label}>
        {buckets.map((b, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t-[3px]" style={{ height: `${(b.value / max) * 100}%`, minHeight: b.value ? 3 : 0, background: color }} />
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-void px-2 py-1 text-xs text-white group-hover:block">
              {b.label}: {b.value}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-steel/50">
        <span>{buckets[0]?.label}</span>
        <span>{buckets[buckets.length - 1]?.label}</span>
      </div>
    </div>
  );
}
