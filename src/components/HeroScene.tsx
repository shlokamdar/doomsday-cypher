import type { CSSProperties } from "react";
import { PortalRing, SovereignMask } from "./Art";

/** Small original hero silhouette (caped figure mid-leap). */
function Leaper({ color = "#C9D2DC" }: { color?: string }) {
  return (
    <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden>
      <path d="M22 6a3.4 3.4 0 1 1-.1 0z" fill={color} />
      <path d="M20 11 L14 19 L8 17 M20 11 L26 18 L33 15 M20 11 L19 23 L13 31 M19 23 L27 28 L30 35" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M20 11 C10 14 6 24 2 30 C10 26 14 24 19 22 Z" fill="#E0408A" opacity=".8" />
    </svg>
  );
}

function Skyline({ y, color, seed, opacity = 1 }: { y: number; color: string; seed: number; opacity?: number }) {
  let x = 0;
  const parts: string[] = [`M0 400 L0 ${y}`];
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  while (x < 1200) {
    const w = 30 + rnd() * 60;
    const h = 30 + rnd() * 140;
    parts.push(`L${x} ${y - h} L${x + w * 0.3} ${y - h - (rnd() > 0.7 ? 18 : 0)} L${x + w * 0.6} ${y - h} L${x + w} ${y - h}`);
    x += w;
    parts.push(`L${x} ${y - 10}`);
  }
  parts.push("L1200 400 Z");
  return <path d={parts.join(" ")} fill={color} opacity={opacity} />;
}

/** Home hero: a multiverse skyline split by a glowing fracture, drifting portals, shards and leaping heroes. */
export function HeroScene() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* storm clouds with the Sovereign's mask faintly inside */}
      <div className="absolute left-1/2 top-[-4%] -translate-x-1/2 anim-flicker">
        <SovereignMask size={420} glow="#E0408A" />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_10%,rgba(224,64,138,0.12),transparent_60%)]" />

      {/* portals at different depths */}
      <div className="absolute left-[6%] top-[14%] opacity-40 anim-drift-slow">
        <PortalRing size={120} sparks={4} color="#5AB0FF" />
      </div>
      <div className="absolute right-[8%] top-[10%] opacity-70 anim-drift">
        <PortalRing size={190} sparks={8} />
      </div>
      <div className="absolute left-[30%] top-[40%] opacity-25 anim-drift" style={{ animationDelay: "-5s" }}>
        <PortalRing size={80} sparks={0} color="#F2B33D" />
      </div>
      <div className="absolute right-[30%] top-[50%] opacity-30 anim-drift-slow" style={{ animationDelay: "-9s" }}>
        <PortalRing size={70} sparks={0} color="#9B7BFF" />
      </div>

      {/* floating shards of other worlds */}
      <svg className="absolute left-[14%] top-[28%] anim-drift-slow" width="90" height="70" viewBox="0 0 90 70">
        <path d="M5 60 L20 8 L60 2 L85 40 L50 66 Z" fill="#1B2028" stroke="#5AB0FF" strokeOpacity=".5" />
        <path d="M24 56 L24 34 L32 34 L32 56 M38 56 L38 22 L48 22 L48 56 M54 56 L54 40 L62 40 L62 56" stroke="#5AB0FF" strokeOpacity=".7" fill="none" />
      </svg>
      <svg className="absolute right-[18%] top-[34%] anim-drift" width="70" height="70" viewBox="0 0 70 70" style={{ animationDelay: "-3s" }}>
        <circle cx="35" cy="35" r="20" fill="#2A1830" stroke="#E0408A" strokeOpacity=".6" />
        <ellipse cx="35" cy="35" rx="32" ry="8" fill="none" stroke="#F2B33D" strokeOpacity=".6" transform="rotate(-20 35 35)" />
      </svg>
      <svg className="absolute left-[46%] top-[22%] anim-drift" width="40" height="30" viewBox="0 0 40 30" style={{ animationDelay: "-7s" }}>
        <path d="M2 20 L14 2 L38 10 L26 28 Z" fill="#12161C" stroke="#2BD67B" strokeOpacity=".6" />
      </svg>
      <svg className="absolute left-[70%] top-[18%] anim-drift-slow" width="26" height="22" viewBox="0 0 26 22" style={{ animationDelay: "-11s" }}>
        <path d="M1 12 L10 1 L25 8 L16 21 Z" fill="#12161C" stroke="#C9D2DC" strokeOpacity=".4" />
      </svg>

      {/* skylines split by a glowing fracture */}
      <svg className="absolute bottom-0 left-0 h-[46%] w-full" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="fracture" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2BD67B" stopOpacity="0" />
            <stop offset=".4" stopColor="#2BD67B" stopOpacity=".9" />
            <stop offset="1" stopColor="#F2B33D" stopOpacity=".9" />
          </linearGradient>
          <filter id="fglow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <Skyline y={300} color="#10141A" seed={7} />
        <Skyline y={360} color="#0A0D12" seed={42} />
        <g className="anim-glow">
          <path d="M610 0 L590 90 L628 150 L596 230 L640 300 L612 400" stroke="url(#fracture)" strokeWidth="16" fill="none" filter="url(#fglow)" />
          <path d="M610 0 L590 90 L628 150 L596 230 L640 300 L612 400" stroke="#D6FFE8" strokeWidth="3" fill="none" />
          <path d="M628 150 L690 170 L720 150 M596 230 L540 250 L520 290" stroke="#2BD67B" strokeWidth="2" fill="none" opacity=".7" />
        </g>
      </svg>

      {/* heroes leaping between portals */}
      <div className="absolute bottom-[30%] left-[10%] anim-leap" style={{ "--lx": "160px", "--ly": "-110px" } as CSSProperties}>
        <Leaper />
      </div>
      <div className="absolute bottom-[38%] right-[30%] anim-leap" style={{ "--lx": "120px", "--ly": "-80px", animationDelay: "-3.5s" } as CSSProperties}>
        <Leaper color="#F2B33D" />
      </div>
      <div className="absolute bottom-[24%] left-[58%] anim-leap" style={{ "--lx": "-140px", "--ly": "-90px", animationDelay: "-1.8s" } as CSSProperties}>
        <Leaper color="#2BD67B" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-void to-transparent" />
    </div>
  );
}
