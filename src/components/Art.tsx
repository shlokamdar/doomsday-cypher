import { useId, type CSSProperties } from "react";
import { hashString } from "../core/logic";

/* ---------------- Portal ring (glowing, with sparks) ---------------- */

export function PortalRing({
  size = 240,
  color = "#2BD67B",
  sparks = 10,
  className = "",
  spin = true,
}: {
  size?: number;
  color?: string;
  sparks?: number;
  className?: string;
  spin?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={`pointer-events-none relative ${className}`} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 200 200" width={size} height={size} className="absolute inset-0 overflow-visible">
        <defs>
          <radialGradient id={`pg-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor={color} stopOpacity="0" />
            <stop offset="78%" stopColor={color} stopOpacity=".35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`pc-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#07090D" stopOpacity=".9" />
            <stop offset="70%" stopColor={color} stopOpacity=".08" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
          <filter id={`pb-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <circle cx="100" cy="100" r="96" fill={`url(#pg-${id})`} className="anim-glow" />
        <circle cx="100" cy="100" r="74" fill={`url(#pc-${id})`} />
        <g className={spin ? "anim-spin svg-spin" : ""}>
          <circle cx="100" cy="100" r="76" fill="none" stroke={color} strokeWidth="3" strokeDasharray="38 10 6 10" filter={`url(#pb-${id})`} />
          <circle cx="100" cy="100" r="76" fill="none" stroke={color} strokeWidth="1.6" strokeDasharray="38 10 6 10" />
        </g>
        <g className={spin ? "anim-spin-rev svg-spin" : ""}>
          <circle cx="100" cy="100" r="66" fill="none" stroke="#F2B33D" strokeOpacity=".7" strokeWidth="1" strokeDasharray="2 7" />
          <circle cx="100" cy="100" r="84" fill="none" stroke={color} strokeOpacity=".35" strokeWidth=".8" strokeDasharray="60 20 4 20" />
        </g>
      </svg>
      {Array.from({ length: sparks }).map((_, i) => (
        <span
          key={i}
          className="spark"
          style={
            {
              "--a": `${(360 / sparks) * i}deg`,
              "--r0": `${size * 0.38}px`,
              "--r1": `${size * 0.52}px`,
              "--d": `${1.2 + (i % 4) * 0.35}s`,
              "--delay": `${(i * 0.17) % 1.3}s`,
              background: i % 3 === 0 ? color : "#F2B33D",
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ---------------- The Sovereign's riveted iron mask (original, faceless) ---------------- */

export function SovereignMask({
  size = 160,
  cracked = false,
  facepalm = false,
  className = "",
  glow = "#2BD67B",
}: {
  size?: number;
  cracked?: boolean;
  facepalm?: boolean;
  className?: string;
  glow?: string;
}) {
  const id = useId().replace(/:/g, "");
  const rivets: [number, number][] = [
    [50, 46], [100, 30], [150, 46], [36, 92], [164, 92], [44, 150], [156, 150], [74, 196], [126, 196], [100, 214],
  ];
  return (
    <svg viewBox="0 0 200 240" width={size} height={(size * 240) / 200} className={className} aria-hidden>
      <defs>
        <linearGradient id={`iron-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4A525E" />
          <stop offset=".45" stopColor="#2A3038" />
          <stop offset="1" stopColor="#14181E" />
        </linearGradient>
        <linearGradient id={`edge-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9AA4B1" />
          <stop offset="1" stopColor="#3B424C" />
        </linearGradient>
        <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* outer helm */}
      <path
        d="M100 12 C140 12 172 30 178 70 L182 120 C182 150 170 178 148 200 L118 228 C108 236 92 236 82 228 L52 200 C30 178 18 150 18 120 L22 70 C28 30 60 12 100 12 Z"
        fill={`url(#iron-${id})`}
        stroke={`url(#edge-${id})`}
        strokeWidth="3"
      />
      {/* brow plate and central ridge */}
      <path d="M40 74 C60 60 140 60 160 74 L156 86 C130 78 70 78 44 86 Z" fill="#363D47" stroke="#5B6470" strokeWidth="1.5" />
      <path d="M100 18 L106 70 L100 226 L94 70 Z" fill="#3A414B" opacity=".8" />
      {/* cheek plates */}
      <path d="M34 122 C52 128 70 140 78 170 L66 200 C46 184 34 160 34 122 Z" fill="#232830" stroke="#4B5360" strokeWidth="1.2" />
      <path d="M166 122 C148 128 130 140 122 170 L134 200 C154 184 166 160 166 122 Z" fill="#232830" stroke="#4B5360" strokeWidth="1.2" />
      {/* visor slit: the only "face" */}
      <path d="M46 104 L154 104 L146 116 L54 116 Z" fill="#07090D" stroke="#5B6470" strokeWidth="1.5" />
      <path d="M58 109 L142 109" stroke={glow} strokeWidth="4" strokeLinecap="round" filter={`url(#glow-${id})`} className="anim-glow" />
      {/* vents */}
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M88 ${176 + i * 10} L112 ${176 + i * 10}`} stroke="#0B0E12" strokeWidth="3.5" strokeLinecap="round" />
      ))}
      {rivets.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="4.2" fill="#6B7480" />
          <circle cx={x - 1.2} cy={y - 1.2} r="1.4" fill="#C9D2DC" opacity=".7" />
        </g>
      ))}
      {cracked && (
        <g filter={`url(#glow-${id})`}>
          <path d="M100 30 L92 62 L108 84 L96 104 L110 132 L98 160" fill="none" stroke={glow} strokeWidth="3" className="anim-crack" />
          <path d="M108 84 L134 92 L150 82" fill="none" stroke={glow} strokeWidth="2" className="anim-crack" />
          <path d="M96 104 L70 126 L60 150" fill="none" stroke={glow} strokeWidth="2" className="anim-crack" />
          <path d="M110 132 L140 150" fill="none" stroke={glow} strokeWidth="1.6" className="anim-crack" />
        </g>
      )}
      {facepalm && (
        <g>
          {/* armoured gauntlet slapped across the visor */}
          <path d="M120 236 L136 168 C138 158 150 156 152 166 L150 180 Z" fill="#2A3038" stroke="#6B7480" strokeWidth="2" />
          <rect x="82" y="120" width="76" height="52" rx="18" fill="#353C46" stroke="#8B95A1" strokeWidth="2.5" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={40 + i * 6} y={88 + i * 9} width="70" height="15" rx="7.5" fill="#3E4650" stroke="#8B95A1" strokeWidth="2" transform={`rotate(-14 ${75 + i * 6} ${96 + i * 9})`} />
          ))}
          <circle cx="132" cy="146" r="5" fill="#6B7480" />
          <path d="M150 128 L172 116" stroke="#8B95A1" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

/* ---------------- Hexagonal squad emblem generated from the squad name ---------------- */

const GLYPHS = [
  "M0 -18 L14 10 L0 4 L-14 10 Z", // arrowhead
  "M0 -20 L5 -6 L20 -6 L8 3 L12 18 L0 9 L-12 18 L-8 3 L-20 -6 L-5 -6 Z", // star
  "M-4 -20 L10 -2 L2 -2 L6 20 L-10 0 L-2 0 Z", // bolt
  "M0 -18 A18 18 0 1 1 -0.1 -18 Z M0 -8 A8 8 0 1 0 0.1 -8 Z", // ring
  "M0 -20 L16 0 L0 20 L-16 0 Z", // diamond
  "M-14 -16 L-14 4 L0 18 L14 4 L14 -16 L7 -8 L0 -18 L-7 -8 Z", // crown-shield
  "M-16 -6 L0 -18 L16 -6 L16 6 L0 18 L-16 6 Z M-8 0 L8 0", // cell
  "M0 -20 L4 -4 L20 0 L4 4 L0 20 L-4 4 L-20 0 L-4 -4 Z", // compass
];

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function Emblem({ name, color, size = 48, className = "" }: { name: string; color: string; size?: number; className?: string }) {
  const h = hashString(name);
  const glyph = GLYPHS[h % GLYPHS.length];
  const rot = ((h >> 4) % 6) * 60;
  const id = useId().replace(/:/g, "");
  const hex = "M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z";
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label={`${name} emblem`}>
      <defs>
        <linearGradient id={`em-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".45" />
          <stop offset="1" stopColor="#07090D" stopOpacity=".95" />
        </linearGradient>
      </defs>
      <path d={hex} fill={`url(#em-${id})`} stroke={color} strokeWidth="4" strokeLinejoin="round" />
      <path d="M50 14 L81 32 L81 68 L50 86 L19 68 L19 32 Z" fill="none" stroke={color} strokeOpacity=".35" strokeWidth="1.5" />
      <g transform={`translate(50 50) rotate(${rot}) scale(1.35)`} opacity=".35">
        <path d={glyph} fill={color} fillRule="evenodd" />
      </g>
      <text
        x="50"
        y="51"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Bebas Neue', Impact, sans-serif"
        fontSize="34"
        fill="#fff"
        style={{ letterSpacing: 1 }}
      >
        {initials(name)}
      </text>
    </svg>
  );
}

/* ---------------- Cracked metal plate with green light leaking through ---------------- */

export function CrackedPlate({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="none" className={`pointer-events-none ${className}`} aria-hidden>
      <path d="M0 64 L60 58 L96 72 L150 50 L200 66 L240 54 L300 70 L340 58 L400 62" fill="none" stroke="#2BD67B" strokeWidth="2.5" opacity=".75" />
      <path d="M150 50 L160 20 L178 6 M240 54 L250 90 L238 120 M96 72 L84 100" fill="none" stroke="#2BD67B" strokeWidth="1.4" opacity=".55" />
    </svg>
  );
}
