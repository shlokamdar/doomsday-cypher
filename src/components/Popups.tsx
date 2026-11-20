import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useOnBump, usePrefersReducedMotion } from "../hooks/store";
import { useUi } from "../hooks/ui";
import { PortalRing, SovereignMask } from "./Art";
import { playSeal, playWrong } from "./audio";

const QUIPS = [
  "The Sovereign laughs at your flag.",
  "That timeline is a dead end.",
  "Wrong world. Try another.",
  "The breach widens. Not your best move.",
  "Somewhere, a multiverse just sighed.",
  "Close? The Sovereign says no.",
  "Even the iron mask facepalmed.",
];

/** Full-screen "FAAAAAA!!!!!!!!" — shows exactly once per wrong guess. */
export function WrongFlagPopup() {
  const { fx } = useUi();
  const [open, setOpen] = useState(false);
  const [quip, setQuip] = useState(QUIPS[0]);
  useOnBump(fx.wrong, (n) => {
    setQuip(QUIPS[n % QUIPS.length]);
    setOpen(true);
    playWrong();
  });
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), 2600);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", k);
    };
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] grid cursor-pointer place-items-center overflow-hidden bg-breach/25 p-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          role="alert"
          aria-live="assertive"
          data-testid="wrong-popup"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(224,64,138,0.35),rgba(7,9,13,0.92)_70%)]" />
          <div className="relative flex flex-col items-center text-center">
            <motion.div initial={{ scale: 0.3, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 12 }}>
              <SovereignMask size={170} cracked facepalm glow="#E0408A" />
            </motion.div>
            <motion.h2
              initial={{ scale: 2.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 14 }}
              className="anim-shake text-outline mt-2 select-none font-display text-[clamp(3.2rem,15vw,9rem)] leading-none text-gold"
              style={{ textShadow: "8px 8px 0 #07090D, 0 0 40px rgba(242,179,61,0.6)" }}
            >
              FAAAAAA!!!!!!!!
            </motion.h2>
            <p className="mt-3 rounded bg-void/80 px-4 py-2 font-display text-2xl tracking-wide text-white sm:text-3xl">{quip}</p>
            <p className="mt-2 text-xs uppercase tracking-widest text-steel/60">Wrong flag · tap to dismiss</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Full-screen "BREACH SEALED" celebration — once per correct flag. */
export function SealedPopup() {
  const { fx } = useUi();
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ title: "", points: 0 });
  useOnBump(fx.seal.n, () => {
    setData({ title: fx.seal.title, points: fx.seal.points });
    setOpen(true);
    playSeal();
  });
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), 3600);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", k);
    };
  }, [open]);
  const shards = useMemo(
    () =>
      Array.from({ length: 26 }).map((_, i) => {
        const a = (i / 26) * Math.PI * 2 + Math.random() * 0.3;
        const d = 180 + Math.random() * 260;
        return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: Math.random() * 360, s: 6 + Math.random() * 14, gold: i % 3 === 0 };
      }),
    // regenerate per celebration
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fx.seal.n],
  );
  const hex = "M100 6 L182 53 L182 147 L100 194 L18 147 L18 53 Z";
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] grid cursor-pointer place-items-center overflow-hidden bg-void/85 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          role="alert"
          aria-live="assertive"
          data-testid="seal-popup"
        >
          {/* rotating light rays */}
          <div className="anim-spin pointer-events-none absolute h-[160vmax] w-[160vmax] opacity-30" aria-hidden>
            <svg viewBox="-100 -100 200 200" className="h-full w-full">
              {Array.from({ length: 18 }).map((_, i) => (
                <path key={i} d="M0 0 L-4 -100 L4 -100 Z" fill="#2BD67B" transform={`rotate(${i * 20})`} opacity={i % 2 ? 0.5 : 1} />
              ))}
            </svg>
          </div>
          {/* portal ring snapping shut */}
          <motion.div className="absolute" initial={{ scale: 2.2, opacity: 0.9 }} animate={{ scale: 0.15, opacity: 0 }} transition={{ duration: 0.9, ease: "easeIn" }}>
            <PortalRing size={460} sparks={14} />
          </motion.div>
          {!reduced &&
            shards.map((s, i) => (
              <motion.span
                key={i}
                className="absolute"
                style={{ width: s.s, height: s.s * 0.6, background: s.gold ? "#F2B33D" : "#2BD67B", clipPath: "polygon(0 0,100% 30%,40% 100%)", boxShadow: "0 0 10px currentColor" }}
                initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                animate={{ x: s.x, y: s.y, opacity: 0, rotate: s.r }}
                transition={{ duration: 1.3, delay: 0.55, ease: "easeOut" }}
              />
            ))}
          <div className="relative flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 3.2, rotate: -25, opacity: 0 }}
              animate={{ scale: 1, rotate: -6, opacity: 1 }}
              transition={{ delay: 0.45, type: "spring", stiffness: 500, damping: 16 }}
              className="relative"
            >
              <svg viewBox="0 0 200 200" className="h-[min(70vw,300px)] w-[min(70vw,300px)] drop-shadow-[0_0_40px_rgba(43,214,123,0.7)]">
                <path d={hex} fill="#07090D" stroke="#2BD67B" strokeWidth="10" strokeLinejoin="round" />
                <path d="M100 26 L164 63 L164 137 L100 174 L36 137 L36 63 Z" fill="none" stroke="#2BD67B" strokeWidth="2.5" strokeDasharray="6 5" />
                <text x="100" y="88" textAnchor="middle" fontFamily="'Bebas Neue',Impact" fontSize="40" fill="#2BD67B" letterSpacing="2">
                  BREACH
                </text>
                <text x="100" y="128" textAnchor="middle" fontFamily="'Bebas Neue',Impact" fontSize="46" fill="#fff" letterSpacing="3">
                  SEALED
                </text>
              </svg>
            </motion.div>
            <motion.div
              initial={{ y: 40, scale: 0.4, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ delay: 0.85, type: "spring", stiffness: 380, damping: 11 }}
              className="mt-2 font-display text-6xl text-gold sm:text-7xl"
              style={{ textShadow: "4px 4px 0 #07090D, 0 0 30px rgba(242,179,61,.7)" }}
            >
              +{data.points} Power
            </motion.div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="mt-2 max-w-md text-lg text-white">
              Your squad sealed <strong className="text-reactor">{data.title}</strong>
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
