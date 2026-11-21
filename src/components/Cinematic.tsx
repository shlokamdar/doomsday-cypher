import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "../hooks/store";

/* ============================================================================
   Original cinematic pieces for the home page. No franchise names, logos or
   likenesses: the villain, worlds and effects are all our own.
   ========================================================================== */

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
          transition={{ delay: delay + i * 0.045, type: "spring", stiffness: 260, damping: 16, filter: { delay: delay + i * 0.045, duration: 0.45, ease: "easeOut" }, opacity: { delay: delay + i * 0.045, duration: 0.3 } }}
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
