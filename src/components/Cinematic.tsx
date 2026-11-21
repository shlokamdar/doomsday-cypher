import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "../hooks/store";

/* ============================================================================
   Original cinematic pieces for the home page. No franchise names, logos or
   likenesses: the villain, worlds and effects are all our own.
   ========================================================================== */

/* ---------------- Mouse parallax (shared by the hero layers) ---------------- */

export function useParallax() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 60, damping: 18 });
  const sy = useSpring(y, { stiffness: 60, damping: 18 });
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const on = (e: PointerEvent) => {
      x.set(e.clientX / window.innerWidth - 0.5);
      y.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", on);
    return () => window.removeEventListener("pointermove", on);
  }, [reduced, x, y]);
  return { x: sx, y: sy };
}

export function Layer({ px, depth, children, className = "" }: { px: { x: MotionValue<number>; y: MotionValue<number> }; depth: number; children: ReactNode; className?: string }) {
  const tx = useTransform(px.x, (v) => v * depth);
  const ty = useTransform(px.y, (v) => v * depth);
  return (
    <motion.div style={{ x: tx, y: ty }} className={className}>
      {children}
    </motion.div>
  );
}

/* ---------------- Multiverse canvas: warp stars + worlds pulled into a rift ---------------- */

type Star = { a: number; r: number; v: number; c: string };
type World = { a: number; r: number; v: number; size: number; hue: number; ring: boolean; dying: number };

export function MultiverseCanvas({ className = "", focusX = 0.68, focusY = 0.45 }: { className?: string; focusX?: number; focusY?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const maxR = () => Math.hypot(w, h) * 0.75;
    const COLORS = ["#C9D2DC", "#2BD67B", "#F2B33D", "#E0408A", "#7FB8FF"];
    const stars: Star[] = Array.from({ length: w < 640 ? 110 : 220 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: Math.random() * maxR(),
      v: 0.2 + Math.random() * 0.9,
      c: COLORS[Math.random() < 0.75 ? 0 : 1 + Math.floor(Math.random() * 4)],
    }));
    const newWorld = (far = true): World => ({
      a: Math.random() * Math.PI * 2,
      r: far ? maxR() * (0.55 + Math.random() * 0.45) : maxR() * (0.2 + Math.random() * 0.7),
      v: 0.00045 + Math.random() * 0.0007,
      size: 6 + Math.random() * 18,
      hue: [150, 40, 330, 210, 270][Math.floor(Math.random() * 5)],
      ring: Math.random() < 0.35,
      dying: 0,
    });
    const worlds: World[] = Array.from({ length: 7 }, () => newWorld(false));
    const bursts: { x: number; y: number; t: number; hue: number }[] = [];

    let raf = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const cx = w * focusX;
      const cy = h * focusY;
      ctx.clearRect(0, 0, w, h);

      // rift glow at the centre
      const pulse = 0.85 + Math.sin(now / 700) * 0.15;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 220 * pulse);
      g.addColorStop(0, "rgba(43,214,123,0.35)");
      g.addColorStop(0.35, "rgba(224,64,138,0.12)");
      g.addColorStop(1, "rgba(7,9,13,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // warp stars streaking inward, spiralling slightly
      for (const s of stars) {
        const speed = s.v * (1 + (maxR() - s.r) / 260) * dt * 0.06;
        const r0 = s.r;
        s.r -= speed * 3;
        s.a += 0.0009 * dt * (300 / (s.r + 80));
        if (s.r < 8) {
          s.r = maxR() * (0.7 + Math.random() * 0.3);
          s.a = Math.random() * Math.PI * 2;
          continue;
        }
        const x0 = cx + Math.cos(s.a) * r0;
        const y0 = cy + Math.sin(s.a) * r0 * 0.62;
        const x1 = cx + Math.cos(s.a) * s.r;
        const y1 = cy + Math.sin(s.a) * s.r * 0.62;
        ctx.strokeStyle = s.c;
        ctx.globalAlpha = Math.min(1, s.r / 120) * 0.8;
        ctx.lineWidth = s.c === "#C9D2DC" ? 1 : 1.4;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // worlds being dragged into the rift
      for (let i = 0; i < worlds.length; i++) {
        const o = worlds[i];
        o.r -= o.v * dt * (40 + (maxR() - o.r) * 0.25);
        o.a += 0.00025 * dt * (400 / (o.r + 60));
        const x = cx + Math.cos(o.a) * o.r;
        const y = cy + Math.sin(o.a) * o.r * 0.62;
        const k = Math.max(0.15, Math.min(1, o.r / 260));
        const sz = o.size * k;
        if (o.r < 40) {
          bursts.push({ x, y, t: 0, hue: o.hue });
          worlds[i] = newWorld(true);
          continue;
        }
        // stretched toward the rift (spaghettified)
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.atan2(cy - y, cx - x));
        ctx.scale(1 + (1 - k) * 1.8, 1 - (1 - k) * 0.4);
        const pg = ctx.createRadialGradient(-sz * 0.3, -sz * 0.3, sz * 0.1, 0, 0, sz);
        pg.addColorStop(0, `hsla(${o.hue},80%,75%,1)`);
        pg.addColorStop(0.6, `hsla(${o.hue},60%,40%,1)`);
        pg.addColorStop(1, `hsla(${o.hue},70%,15%,1)`);
        ctx.shadowColor = `hsla(${o.hue},90%,60%,0.8)`;
        ctx.shadowBlur = 18;
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(0, 0, sz, 0, Math.PI * 2);
        ctx.fill();
        if (o.ring) {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = `hsla(${o.hue},80%,75%,0.6)`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(0, 0, sz * 1.8, sz * 0.45, -0.4, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // flashes when a world is consumed
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.t += dt;
        const p = b.t / 900;
        if (p >= 1) {
          bursts.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `hsla(${b.hue},90%,70%,${1 - p})`;
        ctx.lineWidth = 3 * (1 - p);
        ctx.beginPath();
        ctx.arc(b.x, b.y, 10 + p * 70, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${(1 - p) * 0.5})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 6 * (1 - p), 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduced, focusX, focusY]);
  return <canvas ref={ref} className={`pointer-events-none h-full w-full ${className}`} aria-hidden />;
}

/* ---------------- Glitching, letter-by-letter title ---------------- */

export function GlitchTitle({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
  return (
    <span className={`glitch relative inline-block ${className}`} data-text={text} aria-label={text}>
      {text.split("").map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="inline-block"
          initial={{ opacity: 0, y: -40, filter: "blur(12px)", scale: 1.6 }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
          transition={{ delay: delay + i * 0.045, type: "spring", stiffness: 260, damping: 16 }}
        >
          {ch === " " ? " " : ch}
        </motion.span>
      ))}
    </span>
  );
}

/* ---------------- Typewriter line ---------------- */

export function Typewriter({ text, delay = 0, speed = 28, className = "" }: { text: string; delay?: number; speed?: number; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(reduced ? text.length : 0);
  useEffect(() => {
    if (reduced) return setN(text.length);
    let id = 0;
    const t = window.setTimeout(() => {
      id = window.setInterval(() => setN((v) => (v >= text.length ? (clearInterval(id), v) : v + 1)), speed);
    }, delay * 1000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [text, delay, speed, reduced]);
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {text.slice(0, n)}
        <span className="type-caret">▍</span>
      </span>
    </span>
  );
}

/* ---------------- Crackling energy arcs (regenerated lightning) ---------------- */

function bolt(x0: number, y0: number, x1: number, y1: number, segs = 9, jitter = 14) {
  let d = `M${x0} ${y0}`;
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const x = x0 + (x1 - x0) * t + (Math.random() - 0.5) * jitter * 2;
    const y = y0 + (y1 - y0) * t + (Math.random() - 0.5) * jitter * 2;
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d + ` L${x1} ${y1}`;
}

export function EnergyArcs({ size = 520, color = "#2BD67B", count = 6 }: { size?: number; color?: string; count?: number }) {
  const reduced = usePrefersReducedMotion();
  const make = () =>
    Array.from({ length: count }, (_, i) => {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const r0 = 120 + Math.random() * 20;
      const r1 = 200 + Math.random() * 50;
      return {
        d: bolt(250 + Math.cos(a) * r0, 250 + Math.sin(a) * r0, 250 + Math.cos(a + 0.3) * r1, 250 + Math.sin(a + 0.3) * r1, 7, 12),
        o: Math.random() < 0.35 ? 0 : 0.5 + Math.random() * 0.5,
      };
    });
  const [arcs, setArcs] = useState(make);
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setArcs(make()), 110);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, count]);
  if (reduced) return null;
  return (
    <svg viewBox="0 0 500 500" width="100%" height="100%" data-size={size} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible" aria-hidden>
      <defs>
        <filter id="arc-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {arcs.map((a, i) => (
        <path key={i} d={a.d} fill="none" stroke={i % 3 === 0 ? "#E0408A" : color} strokeWidth={1.6} strokeLinejoin="round" opacity={a.o} filter="url(#arc-glow)" />
      ))}
    </svg>
  );
}

/* ---------------- Rune rings: the rift sigil behind the villain ---------------- */

export function RuneRings({ size = 560 }: { size?: number }) {
  const ticks = Array.from({ length: 72 });
  const glyphs = "ΔΣΨΩΞΦΛΓΘΠ";
  return (
    <svg viewBox="0 0 400 400" width="100%" height="100%" data-size={size} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden>
      <defs>
        <radialGradient id="rr-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2BD67B" stopOpacity=".35" />
          <stop offset="45%" stopColor="#E0408A" stopOpacity=".12" />
          <stop offset="100%" stopColor="#07090D" stopOpacity="0" />
        </radialGradient>
        <path id="rr-text" d="M200 200 m-150 0 a150 150 0 1 1 300 0 a150 150 0 1 1 -300 0" />
      </defs>
      <circle cx="200" cy="200" r="200" fill="url(#rr-core)" className="anim-glow" />
      <g className="anim-spin svg-spin">
        <circle cx="200" cy="200" r="182" fill="none" stroke="#2BD67B" strokeOpacity=".55" strokeWidth="1.2" />
        {ticks.map((_, i) => (
          <line
            key={i}
            x1="200"
            y1={i % 6 === 0 ? 12 : 18}
            x2="200"
            y2="24"
            stroke={i % 6 === 0 ? "#F2B33D" : "#2BD67B"}
            strokeOpacity={i % 6 === 0 ? 0.9 : 0.45}
            strokeWidth={i % 6 === 0 ? 2 : 1}
            transform={`rotate(${i * 5} 200 200)`}
          />
        ))}
      </g>
      <g className="anim-spin-rev svg-spin">
        <text fill="#F2B33D" fillOpacity=".55" fontSize="13" letterSpacing="9" fontFamily="'IBM Plex Mono', monospace">
          <textPath href="#rr-text">
            {(glyphs + " · SEAL · THE · BREACH · ").repeat(3)}
          </textPath>
        </text>
        <circle cx="200" cy="200" r="138" fill="none" stroke="#E0408A" strokeOpacity=".45" strokeWidth="1" strokeDasharray="70 14 4 14" />
      </g>
      <g className="anim-spin-fast svg-spin">
        <polygon points="200,82 302,259 98,259" fill="none" stroke="#2BD67B" strokeOpacity=".35" strokeWidth="1" />
        <polygon points="200,318 98,141 302,141" fill="none" stroke="#2BD67B" strokeOpacity=".35" strokeWidth="1" />
      </g>
    </svg>
  );
}

/* ---------------- Shockwave rings that pulse out from the rift ---------------- */

export function Shockwaves({ color = "#2BD67B" }: { color?: string }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="shockwave" style={{ animationDelay: `${i * 1.3}s`, borderColor: color }} />
      ))}
    </div>
  );
}

/* ---------------- Floating embers ---------------- */

export function Embers({ count = 26 }: { count?: number }) {
  const [list] = useState(() =>
    Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      size: 2 + Math.random() * 4,
      dur: 6 + Math.random() * 10,
      delay: -Math.random() * 16,
      drift: (Math.random() - 0.5) * 120,
      c: Math.random() < 0.6 ? "#F2B33D" : Math.random() < 0.5 ? "#2BD67B" : "#E0408A",
    })),
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {list.map((e, i) => (
        <span
          key={i}
          className="ember"
          style={
            {
              left: `${e.left}%`,
              width: e.size,
              height: e.size,
              background: e.c,
              boxShadow: `0 0 ${e.size * 3}px ${e.c}`,
              animationDuration: `${e.dur}s`,
              animationDelay: `${e.delay}s`,
              "--drift": `${e.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ---------------- Scrolling "worlds collapsed" ticker ---------------- */

export function Ticker({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-breach/30 bg-breach/10 py-2" aria-hidden>
      <div className="ticker flex w-max gap-10 whitespace-nowrap font-mono text-xs uppercase tracking-[0.3em] text-breach">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-3">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-breach shadow-breach" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 3D tilt card ---------------- */

export function TiltCard({ children, className = "", glow = "#2BD67B" }: { children: ReactNode; className?: string; glow?: string }) {
  const reduced = usePrefersReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const srx = useSpring(rx, { stiffness: 200, damping: 18 });
  const sry = useSpring(ry, { stiffness: 200, damping: 18 });
  const bg = useTransform([gx, gy] as MotionValue<number>[], ([x, y]: number[]) => `radial-gradient(circle at ${x}% ${y}%, ${glow}33, transparent 55%)`);
  return (
    <motion.div
      className={`relative [perspective:900px] ${className}`}
      onPointerMove={(e) => {
        if (reduced) return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry.set((px - 0.5) * 16);
        rx.set(-(py - 0.5) * 16);
        gx.set(px * 100);
        gy.set(py * 100);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      <motion.div style={{ rotateX: srx, rotateY: sry, transformStyle: "preserve-3d" }} className="relative h-full">
        {children}
        <motion.div style={{ background: bg }} className="pointer-events-none absolute inset-0 rounded-lg mix-blend-screen" />
      </motion.div>
    </motion.div>
  );
}

/* ---------------- Scroll reveal wrapper ---------------- */

export function Reveal({ children, delay = 0, className = "", y = 40 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
