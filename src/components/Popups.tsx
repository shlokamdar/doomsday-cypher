import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { CUE_LABELS } from "../core/popups";
import { useOnBump, usePrefersReducedMotion } from "../hooks/store";
import { useUi, type MemeMood } from "../hooks/ui";

/* ======================================================================================
 * Wrong flag: A.R.I.A. (Analytical Response & Intelligence Assistant), the team's original
 * holographic assistant, pops up and roasts the guess. Three moods: a normal miss, the guess
 * that leaves one attempt, and the one that uses the last attempt. The site plays no sounds.
 * ====================================================================================== */

const QUIPS: Record<MemeMood, string[]> = {
  wrong: [
    "I ran that flag through 14 million possible futures. It isn't in any of them.",
    "Bold guess, agent. Statistically adventurous. Also wrong.",
    "I've told the team. They're pretending they didn't see that.",
    "That flag has the structural integrity of a paper shield.",
    "Recalibrating… recalibrating… nope, still wrong.",
    "Doom is laughing. I can hear it through the firewall.",
    "Interesting theory. The data disagrees, politely.",
  ],
  lastAttempt: [
    "One attempt left. I've cleared my schedule to watch.",
    "Final attempt. Maybe read the briefing again? Just a thought.",
    "Power at 1%. Make this one count, agent.",
  ],
  outOfAttempts: [
    "Lockdown engaged. This breach is sealed… for you.",
    "Attempts depleted. Shall I order flowers for this challenge?",
    "That was the last one. Doom sends his regards.",
  ],
};

const MOOD: Record<MemeMood, { c: string; glow: string; label: string; bg: string }> = {
  wrong: { c: "#3DD6F5", glow: "rgba(61,214,245,0.55)", label: "INCORRECT FLAG", bg: "rgba(4,18,28,0.82)" },
  lastAttempt: { c: "#F2B33D", glow: "rgba(242,179,61,0.55)", label: "WARNING · FINAL ATTEMPT", bg: "rgba(26,18,4,0.85)" },
  outOfAttempts: { c: "#E0405A", glow: "rgba(224,64,90,0.6)", label: "LOCKDOWN · NO ATTEMPTS LEFT", bg: "rgba(28,4,8,0.9)" },
};

/** Types a line out a few characters at a time. */
function useTyped(text: string, run: boolean, cps = 55) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return setN(0);
    setN(0);
    const id = setInterval(() => setN((x) => (x >= text.length ? x : x + 1)), 1000 / cps);
    return () => clearInterval(id);
  }, [text, run, cps]);
  return text.slice(0, n);
}

/** A.R.I.A.'s face: an original holographic core of rotating arcs around a pulsing eye. */
function AriaCore({ color, mood, size = 132 }: { color: string; mood: MemeMood; size?: number }) {
  const fast = mood === "lastAttempt";
  const broken = mood === "outOfAttempts";
  return (
    <svg viewBox="-60 -60 120 120" width={size} height={size} aria-hidden>
      <defs>
        <radialGradient id={`aria-g-${mood}`}>
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="35%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="56" fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="1" />
      <motion.g animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: fast ? 2.2 : 6, ease: "linear" }}>
        <circle r="48" fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="40 22 6 22" strokeLinecap="round" />
      </motion.g>
      <motion.g animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: fast ? 1.6 : 4.5, ease: "linear" }}>
        <circle r="38" fill="none" stroke={color} strokeOpacity="0.8" strokeWidth="1.5" strokeDasharray="4 7" />
      </motion.g>
      <motion.g animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 9, ease: "linear" }}>
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <rect key={a} x="-2" y="-30" width="4" height="7" rx="1" fill={color} transform={`rotate(${a})`} opacity="0.85" />
        ))}
      </motion.g>
      <motion.circle
        r="18"
        fill={`url(#aria-g-${mood})`}
        animate={broken ? { opacity: [1, 0.2, 0.9, 0.1, 0.8] } : { scale: [1, 1.18, 1] }}
        transition={{ repeat: Infinity, duration: broken ? 0.9 : fast ? 0.5 : 1.4 }}
      />
      {/* the "eye": a narrowed slit when unimpressed */}
      <motion.rect x="-11" y="-2.5" width="22" height="5" rx="2.5" fill="#fff" animate={{ scaleY: [1, 1, 0.1, 1] }} transition={{ repeat: Infinity, duration: 3, times: [0, 0.9, 0.95, 1] }} />
      {broken && <path d="M-30 -30 L30 30 M30 -30 L-30 30" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.8" />}
    </svg>
  );
}

export function WrongFlagPopup() {
  const { fx } = useUi();
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState({ mood: "wrong" as MemeMood, text: "", quip: QUIPS.wrong[0], image: null as string | null, seconds: 3 });
  useOnBump(fx.wrong.n, (n) => {
    const mood = fx.wrong.mood;
    setShown({ mood, text: fx.wrong.text, quip: QUIPS[mood][n % QUIPS[mood].length], image: fx.wrong.image, seconds: fx.wrong.seconds });
    setOpen(true);
  });
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), Math.max(1, shown.seconds) * 1000 + 600);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", k);
    };
  }, [open, shown.seconds, fx.wrong.n]);
  const typed = useTyped(shown.quip, open);
  const m = MOOD[shown.mood];
  const big = shown.text.trim() || CUE_LABELS[shown.mood].defaultText;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] grid cursor-pointer place-items-center p-4"
          style={{ background: "rgba(3,6,10,0.55)", backdropFilter: "blur(2px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          role="alert"
          aria-live="assertive"
          data-testid="wrong-popup"
          data-mood={shown.mood}
        >
          <motion.div
            className="relative w-full max-w-xl overflow-hidden rounded-xl border-2 p-5 sm:p-6"
            style={{ borderColor: m.c, background: m.bg, boxShadow: `0 0 50px ${m.glow}, inset 0 0 40px ${m.glow.replace(/[\d.]+\)$/, "0.15)")}` }}
            initial={reduced ? { opacity: 0 } : { y: 80, scale: 0.6, opacity: 0, rotateX: 40 }}
            animate={
              shown.mood === "outOfAttempts" && !reduced
                ? { y: 0, scale: 1, opacity: 1, rotateX: 0, x: [0, -10, 9, -6, 4, 0] }
                : { y: 0, scale: 1, opacity: 1, rotateX: 0 }
            }
            exit={{ y: 40, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            {/* scan lines and a sweeping light */}
            <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: `repeating-linear-gradient(0deg, transparent 0 3px, ${m.glow} 3px 4px)` }} />
            {!reduced && (
              <motion.div
                className="pointer-events-none absolute inset-x-0 h-16"
                style={{ background: `linear-gradient(180deg, transparent, ${m.glow}, transparent)` }}
                initial={{ top: "-20%" }}
                animate={{ top: "120%" }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
              />
            )}
            <div className="relative flex items-center gap-2 font-mono text-[11px] tracking-[0.25em]" style={{ color: m.c }}>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: m.c }} />
              A.R.I.A. · ANALYTICAL RESPONSE &amp; INTELLIGENCE ASSISTANT
            </div>
            <div className="relative mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <motion.div className="shrink-0" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 14 }}>
                <AriaCore color={m.c} mood={shown.mood} />
              </motion.div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <div className="font-mono text-xs tracking-[0.2em]" style={{ color: m.c }}>
                  {m.label}
                </div>
                <motion.h2
                  className="mt-1 font-display text-5xl leading-none tracking-wide text-white sm:text-6xl"
                  style={{ textShadow: `0 0 18px ${m.glow}` }}
                  initial={{ opacity: 0, x: -14 }}
                  animate={shown.mood === "outOfAttempts" && !reduced ? { opacity: [0, 1, 0.3, 1], x: 0 } : { opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  {big}
                </motion.h2>
                <p className="mt-3 min-h-[3.2em] font-mono text-sm leading-relaxed text-white/90 sm:text-base">
                  &gt; {typed}
                  <span className="ml-0.5 inline-block w-2 animate-pulse" style={{ background: m.c }}>
                    &nbsp;
                  </span>
                </p>
              </div>
            </div>
            {shown.image && (
              <motion.div className="relative mt-4 overflow-hidden rounded-md border" style={{ borderColor: m.c }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}>
                <img src={shown.image} alt="" className="mx-auto max-h-[38vh] w-auto object-contain" />
              </motion.div>
            )}
            <div className="relative mt-4 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">tap to dismiss</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ======================================================================================
 * Correct flag: a lightning hammer (an original thunder-maul design) drops from the storm,
 * slams down with bolts, a white flash and a shockwave, then the points appear.
 * ====================================================================================== */

/** An original thunder maul: long rune-carved handle, octagonal tapered head. */
function ThunderHammer({ size = 220 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 260" width={size} height={size * 1.3} aria-hidden>
      <defs>
        <linearGradient id="th-head" x1="0" x2="1">
          <stop offset="0" stopColor="#5B6573" />
          <stop offset="0.45" stopColor="#D8E1EA" />
          <stop offset="0.55" stopColor="#A9B5C2" />
          <stop offset="1" stopColor="#3C444F" />
        </linearGradient>
        <linearGradient id="th-handle" x1="0" x2="1">
          <stop offset="0" stopColor="#3A2A1C" />
          <stop offset="0.5" stopColor="#7A5634" />
          <stop offset="1" stopColor="#3A2A1C" />
        </linearGradient>
        <filter id="th-glow">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* handle */}
      <rect x="92" y="78" width="16" height="170" rx="6" fill="url(#th-handle)" />
      {[110, 130, 150, 170, 190, 210, 230].map((y) => (
        <path key={y} d={`M92 ${y} L108 ${y - 8}`} stroke="#2A1D12" strokeWidth="3" />
      ))}
      <circle cx="100" cy="250" r="9" fill="url(#th-head)" stroke="#2B3138" strokeWidth="2" />
      {/* head: tapered octagon */}
      <path d="M18 34 L40 14 L160 14 L182 34 L182 74 L160 94 L40 94 L18 74 Z" fill="url(#th-head)" stroke="#2B3138" strokeWidth="3" />
      <path d="M40 14 L52 30 L148 30 L160 14 M40 94 L52 78 L148 78 L160 94" fill="none" stroke="#2B3138" strokeWidth="2" opacity="0.6" />
      {/* glowing rune lines */}
      <g filter="url(#th-glow)" stroke="#7FE7FF" strokeWidth="3.2" strokeLinecap="round" fill="none">
        <path d="M70 40 L70 68 M70 40 L82 52" />
        <path d="M96 40 L104 54 L96 68" />
        <path d="M126 40 L126 68 M118 54 L134 54" />
      </g>
    </svg>
  );
}

/** One jagged bolt from the top of the screen down to the impact point. */
function Bolt({ x, delay, w = 5 }: { x: number; delay: number; w?: number }) {
  const pts = useMemo(() => {
    const out: string[] = [];
    let cx = x;
    for (let y = 0; y <= 55; y += 5.5) {
      out.push(`${cx},${y}`);
      cx = x + (Math.random() - 0.5) * 8 + (50 - x) * (y / 55);
    }
    out.push("50,57");
    return "M" + out.join(" L");
  }, [x]);
  return (
    <motion.path
      d={pts}
      fill="none"
      stroke="#E9FBFF"
      strokeWidth={w / 10}
      strokeLinejoin="round"
      style={{ filter: "drop-shadow(0 0 1.2px #7FE7FF) drop-shadow(0 0 3px #3DD6F5)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0.2, 1, 0] }}
      transition={{ delay, duration: 0.7, times: [0, 0.25, 0.45, 0.6, 1] }}
    />
  );
}

export function SealedPopup() {
  const { fx } = useUi();
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ title: "", points: 0, text: "", image: null as string | null, seconds: 4 });
  useOnBump(fx.seal.n, () => {
    setData({ title: fx.seal.title, points: fx.seal.points, text: fx.seal.text.trim(), image: fx.seal.image, seconds: fx.seal.seconds });
    setOpen(true);
  });
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), Math.max(1, data.seconds) * 1000 + 900);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", k);
    };
  }, [open, data.seconds, fx.seal.n]);
  const sparks = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => {
        const a = (i / 28) * Math.PI * 2;
        const d = 140 + Math.random() * 260;
        return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.6, s: 4 + Math.random() * 7 };
      }),
    // a fresh burst per celebration
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fx.seal.n],
  );
  const big = data.text || CUE_LABELS.correct.defaultText;
  const IMPACT = reduced ? 0 : 0.55;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] grid cursor-pointer place-items-center overflow-hidden p-4"
          style={{ background: "radial-gradient(ellipse at 50% 20%, #1B2B44 0%, #070A12 70%)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          role="alert"
          aria-live="assertive"
          data-testid="seal-popup"
        >
          {/* storm clouds */}
          {!reduced && (
            <motion.div
              className="pointer-events-none absolute inset-x-[-10%] top-[-12%] h-[45%]"
              style={{ background: "radial-gradient(ellipse at 30% 60%, rgba(90,110,140,.55), transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(70,90,120,.5), transparent 60%)", filter: "blur(18px)" }}
              animate={{ x: ["-3%", "3%", "-3%"] }}
              transition={{ repeat: Infinity, duration: 6 }}
            />
          )}
          {/* lightning bolts striking the impact point */}
          {!reduced && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {[18, 34, 50, 66, 82].map((x, i) => (
                <Bolt key={`${fx.seal.n}-${x}`} x={x} delay={0.15 + i * 0.06} w={i === 2 ? 9 : 5} />
              ))}
              {[26, 74].map((x, i) => (
                <Bolt key={`b2-${fx.seal.n}-${x}`} x={x} delay={IMPACT + 0.5 + i * 0.25} />
              ))}
            </svg>
          )}
          {/* the white flash on impact */}
          <motion.div className="pointer-events-none absolute inset-0 bg-white" initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 0.9, 0] }} transition={{ duration: IMPACT + 0.35, times: [0, 0.6, 0.72, 1] }} />
          <div className="relative flex flex-col items-center text-center">
            {/* shockwave rings */}
            {!reduced &&
              [0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="pointer-events-none absolute left-1/2 top-[150px] block rounded-full border-4"
                  style={{ borderColor: "#7FE7FF", width: 40, height: 16, marginLeft: -20 }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 14 + i * 4], opacity: [0, 0.9, 0] }}
                  transition={{ delay: IMPACT + i * 0.12, duration: 1 }}
                />
              ))}
            {!reduced &&
              sparks.map((s, i) => (
                <motion.span
                  key={i}
                  className="pointer-events-none absolute left-1/2 top-[150px] block rounded-full"
                  style={{ width: s.s, height: s.s, background: i % 3 ? "#7FE7FF" : "#FFF4C2", boxShadow: "0 0 10px #7FE7FF" }}
                  initial={{ x: 0, y: 0, opacity: 0 }}
                  animate={{ x: s.x, y: s.y, opacity: [0, 1, 0] }}
                  transition={{ delay: IMPACT, duration: 1.1, ease: "easeOut" }}
                />
              ))}
            {/* the hammer drops from the sky and slams down */}
            <motion.div
              initial={reduced ? { opacity: 0 } : { y: "-120vh", rotate: -35, scale: 1.2 }}
              animate={reduced ? { opacity: 1 } : { y: [null, 0, -14, 0], rotate: [null, 0, 4, 0], scale: [null, 1, 1, 1] }}
              transition={reduced ? { duration: 0.3 } : { duration: IMPACT + 0.35, times: [0, 0.6, 0.8, 1], ease: "easeIn" }}
              className="relative drop-shadow-[0_0_30px_rgba(127,231,255,0.65)]"
            >
              <ThunderHammer size={170} />
            </motion.div>
            <motion.div
              className="mt-2 font-display text-[clamp(3rem,12vw,7.5rem)] leading-none tracking-wide text-white"
              style={{ textShadow: "0 0 30px #3DD6F5, 0 0 60px #3DD6F5, 6px 6px 0 #07090D" }}
              initial={{ scale: 2.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: IMPACT + 0.1, type: "spring", stiffness: 420, damping: 13 }}
            >
              {big}
            </motion.div>
            <motion.div
              className="mt-1 font-display text-5xl text-gold sm:text-6xl"
              style={{ textShadow: "4px 4px 0 #07090D, 0 0 24px rgba(242,179,61,.7)" }}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: IMPACT + 0.35, type: "spring", stiffness: 380, damping: 12 }}
            >
              +{data.points} points
            </motion.div>
            <motion.p className="mt-2 max-w-md text-lg text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: IMPACT + 0.55 }}>
              Your team solved <strong className="text-[#7FE7FF]">{data.title}</strong>
            </motion.p>
            {data.image && (
              <motion.img
                src={data.image}
                alt=""
                className="mt-4 max-h-[30vh] w-auto rounded-md border-2 border-[#7FE7FF]/70 object-contain shadow-[0_0_30px_rgba(127,231,255,.4)]"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: IMPACT + 0.7 }}
              />
            )}
            <p className="mt-3 text-[10px] uppercase tracking-[0.3em] text-white/40">tap to dismiss</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
