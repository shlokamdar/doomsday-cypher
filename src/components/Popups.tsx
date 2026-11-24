import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { CUE_LABELS } from "../core/sounds";
import { useOnBump, usePrefersReducedMotion } from "../hooks/store";
import { useUi, type MemeMood } from "../hooks/ui";
import { PortalRing, SovereignMask } from "./Art";

const QUIPS: Record<MemeMood, string[]> = {
  wrong: [
    "The Sovereign laughs at your flag.",
    "That timeline is a dead end.",
    "Wrong world. Try another.",
    "The challenge widens. Not your best move.",
    "Somewhere, a multiverse just sighed.",
    "Close? The Sovereign says no.",
    "Even the iron mask facepalmed.",
  ],
  lastAttempt: [
    "One attempt left. Make it count.",
    "Last chance. No pressure. (Lots of pressure.)",
    "One shot left. Read the briefing again.",
  ],
  outOfAttempts: [
    "No attempts left on this one. Move on, agent.",
    "This timeline is sealed shut. Try another challenge.",
    "The Sovereign wins this round.",
  ],
};

const MOOD_STYLE: Record<MemeMood, { bg: string; glow: string; text: string; shadow: string; hint: string }> = {
  wrong: {
    bg: "radial-gradient(circle,rgba(224,64,138,0.35),rgba(7,9,13,0.92) 70%)",
    glow: "#E0408A",
    text: "text-gold",
    shadow: "8px 8px 0 #07090D, 0 0 40px rgba(242,179,61,0.6)",
    hint: "Wrong flag",
  },
  lastAttempt: {
    bg: "radial-gradient(circle,rgba(242,179,61,0.35),rgba(7,9,13,0.92) 70%)",
    glow: "#F2B33D",
    text: "text-breach",
    shadow: "8px 8px 0 #07090D, 0 0 40px rgba(224,64,138,0.6)",
    hint: "Wrong flag · one attempt left",
  },
  outOfAttempts: {
    bg: "radial-gradient(circle,rgba(60,66,80,0.6),rgba(7,9,13,0.97) 70%)",
    glow: "#6B7280",
    text: "text-steel",
    shadow: "8px 8px 0 #07090D, 0 0 30px rgba(201,210,220,0.35)",
    hint: "Wrong flag · no attempts left",
  },
};

/**
 * Full-screen wrong-flag pop-up, shown exactly once per wrong guess. Three moods: a normal miss
 * ("FAAAAAA!!!!!!!!"), the guess that leaves one attempt, and the one that uses the last attempt.
 * The text can be changed on the Soundboard (and per challenge). Sounds are played by the caller.
 */
export function WrongFlagPopup() {
  const { fx } = useUi();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<{ mood: MemeMood; text: string; quip: string }>({ mood: "wrong", text: "", quip: QUIPS.wrong[0] });
  useOnBump(fx.wrong.n, (n) => {
    const mood = fx.wrong.mood;
    setShown({ mood, text: fx.wrong.text, quip: QUIPS[mood][n % QUIPS[mood].length] });
    setOpen(true);
  });
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), shown.mood === "wrong" ? 2600 : 3400);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", k);
    };
  }, [open, shown.mood]);
  const st = MOOD_STYLE[shown.mood];
  const big = shown.text.trim() || CUE_LABELS[shown.mood].defaultText;
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
          data-mood={shown.mood}
        >
          <div className="absolute inset-0" style={{ background: st.bg }} />
          <div className="relative flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0.3, rotate: -20 }}
              animate={shown.mood === "outOfAttempts" ? { scale: 1, rotate: [0, -10, -10], y: [0, 0, 8] } : { scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 12 }}
            >
              <motion.div
                animate={shown.mood === "lastAttempt" ? { x: [-4, 4, -4] } : {}}
                transition={shown.mood === "lastAttempt" ? { repeat: Infinity, duration: 0.18 } : undefined}
              >
                <SovereignMask size={170} cracked={shown.mood !== "lastAttempt"} facepalm={shown.mood === "wrong"} glow={st.glow} />
              </motion.div>
            </motion.div>
            <motion.h2
              initial={{ scale: 2.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 14 }}
              className={`anim-shake text-outline mt-2 select-none font-display text-[clamp(3.2rem,15vw,9rem)] leading-none ${st.text}`}
              style={{ textShadow: st.shadow }}
            >
              {big}
            </motion.h2>
            <p className="mt-3 rounded bg-void/80 px-4 py-2 font-display text-2xl tracking-wide text-white sm:text-3xl">{shown.quip}</p>
            <p className="mt-2 text-xs uppercase tracking-widest text-steel/60">{st.hint} · tap to dismiss</p>
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
  const [data, setData] = useState({ title: "", points: 0, text: "" });
  useOnBump(fx.seal.n, () => {
    setData({ title: fx.seal.title, points: fx.seal.points, text: fx.seal.text.trim() });
    setOpen(true);
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
                {data.text && data.text.toUpperCase() !== "BREACH SEALED" ? (
                  <text x="100" y="116" textAnchor="middle" fontFamily="'Bebas Neue',Impact" fontSize={Math.max(18, Math.min(46, 260 / Math.max(1, data.text.length)))} fill="#fff" letterSpacing="2">
                    {data.text}
                  </text>
                ) : (
                  <>
                    <text x="100" y="88" textAnchor="middle" fontFamily="'Bebas Neue',Impact" fontSize="40" fill="#2BD67B" letterSpacing="2">
                      BREACH
                    </text>
                    <text x="100" y="128" textAnchor="middle" fontFamily="'Bebas Neue',Impact" fontSize="46" fill="#fff" letterSpacing="3">
                      SEALED
                    </text>
                  </>
                )}
              </svg>
            </motion.div>
            <motion.div
              initial={{ y: 40, scale: 0.4, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ delay: 0.85, type: "spring", stiffness: 380, damping: 11 }}
              className="mt-2 font-display text-6xl text-gold sm:text-7xl"
              style={{ textShadow: "4px 4px 0 #07090D, 0 0 30px rgba(242,179,61,.7)" }}
            >
              +{data.points} points
            </motion.div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="mt-2 max-w-md text-lg text-white">
              Your team solved <strong className="text-reactor">{data.title}</strong>
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
