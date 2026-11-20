import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/store";
import { PortalRing } from "./Art";

const LINES = ["Hashing the flags…", "Recruiting teams…", "Stabilising the timeline…", "Locking The Sovereign out…"];
const NAME = "DOOMSDAY CYPHER";
const GLYPHS = "!<>-_\\/[]{}—=+*^?#ΔΣΞΨΩ01";

function useDecrypt(text: string, durationMs = 1300) {
  const reduced = usePrefersReducedMotion();
  const [out, setOut] = useState(reduced ? text : text.replace(/\S/g, "#"));
  useEffect(() => {
    if (reduced) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / durationMs);
      const fixed = Math.floor(k * text.length);
      setOut(
        text
          .split("")
          .map((c, i) => (c === " " || i < fixed ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join(""),
      );
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, durationMs, reduced]);
  return out;
}

export function LoadingScreen({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  const title = useDecrypt(NAME);
  const [line, setLine] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setLine((l) => (l + 1) % LINES.length), 650);
    return () => clearInterval(id);
  }, []);
  return (
    <motion.div
      className="fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-void"
      exit={{ clipPath: "circle(0% at 50% 50%)" }}
      initial={{ clipPath: "circle(150% at 50% 50%)" }}
      animate={{ clipPath: "circle(150% at 50% 50%)" }}
      transition={{ duration: 0.7, ease: [0.7, 0, 0.3, 1] }}
      data-testid="loading-screen"
    >
      {/* cracks spreading from the centre */}
      <svg viewBox="-200 -200 400 400" className="absolute h-[140vmin] w-[140vmin] opacity-60" aria-hidden>
        {Array.from({ length: 9 }).map((_, i) => {
          const a = (i / 9) * Math.PI * 2;
          const pts = [0, 1, 2, 3].map((k) => {
            const r = 60 + k * 40;
            const j = (k % 2 ? 0.12 : -0.1) + i * 0.01;
            return `${Math.cos(a + j) * r},${Math.sin(a + j) * r}`;
          });
          return (
            <polyline
              key={i}
              points={`${Math.cos(a) * 50},${Math.sin(a) * 50} ${pts.join(" ")}`}
              fill="none"
              stroke="#2BD67B"
              strokeWidth="1.4"
              className="anim-crack"
              style={{ animationDelay: `${0.3 + i * 0.08}s`, filter: "drop-shadow(0 0 4px #2BD67B)" }}
            />
          );
        })}
      </svg>
      <div className="relative flex flex-col items-center px-4 text-center">
        <motion.div initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8, ease: "easeOut" }}>
          <PortalRing size={220} sparks={14} />
        </motion.div>
        <h1 className="mt-6 font-display text-5xl tracking-[0.12em] text-white sm:text-7xl" aria-label={NAME}>
          <span aria-hidden>{title}</span>
        </h1>
        {error ? (
          <div className="mt-6 max-w-md" role="alert">
            <p className="font-display text-3xl text-breach">The multiverse is offline</p>
            <p className="mt-2 break-words font-mono text-sm text-steel/80">{error}</p>
            <button className="btn-primary mt-5" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : (
          <p className="mt-4 h-6 font-mono text-sm text-reactor" aria-live="polite">
            {LINES[line]}
          </p>
        )}
      </div>
    </motion.div>
  );
}
