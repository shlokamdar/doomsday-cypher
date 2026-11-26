import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CUE_LABELS } from "../core/popups";
import { useOnBump, usePrefersReducedMotion } from "../hooks/store";
import { useUi, type MemeMood } from "../hooks/ui";

/* ======================================================================================
 * Flag pop-ups. Every submission plays one superpower effect, picked at random (never the same
 * one twice in a row) unless Admin locks one on the Pop-ups page. All art here is original.
 *
 *   Correct: lightning hammer · force shield · web catch · energy blast · ground smash ·
 *            portal · bullseye arrow
 *   Wrong:   A.R.I.A. assistant · force shield block · stuck in a web · swallowed by a portal ·
 *            screen crack · turned to dust
 *
 * Last attempt and lockdown use the wrong-flag effects, recoloured amber and red.
 * The site plays no sounds.
 * ====================================================================================== */

const rand = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const between = (a: number, b: number) => a + Math.random() * (b - a);

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

/** Wrong-flag effects other than A.R.I.A.: their own line, colour and roasts. */
const WRONG_FX: Record<string, { text: string; accent: string; quips: string[] }> = {
  shield: {
    text: "BLOCKED!",
    accent: "#3DD6F5",
    quips: ["That flag bounced right off the shield.", "Deflected. The shield didn't even flicker.", "Rejected at the perimeter. Try a sharper flag."],
  },
  web: {
    text: "STUCK IN THE WEB",
    accent: "#E8EEF5",
    quips: ["Your flag is hanging there, thinking about its choices.", "Tangled. Wriggling won't help.", "Caught mid-swing. Try another line of attack."],
  },
  portal: {
    text: "LOST IN THE MULTIVERSE",
    accent: "#B57CFF",
    quips: ["That flag is correct in some other universe. Not this one.", "Sent to a dimension where it might be right.", "The portal swallowed it and spat out a shrug."],
  },
  smash: {
    text: "NOPE.",
    accent: "#FF5468",
    quips: ["That guess hit the screen and the screen won.", "Cracked under pressure. The flag, not you. Mostly.", "Impact detected. Accuracy not detected."],
  },
  dust: {
    text: "GONE TO DUST",
    accent: "#D9B98C",
    quips: ["Your flag faded away. Doom didn't even lift a finger.", "Reduced to particles. Rebuild it and retry.", "Scattered across the wind. Next theory, agent."],
  },
};

/** Correct-flag effects: their own line, colour and backdrop. */
const CORRECT_FX: Record<string, { text: string; accent: string; bg: string }> = {
  thunder: { text: "WORTHY!", accent: "#7FE7FF", bg: "radial-gradient(ellipse at 50% 20%, #1B2B44 0%, #070A12 70%)" },
  shield: { text: "SHIELD UP!", accent: "#F2B33D", bg: "radial-gradient(ellipse at 50% 30%, #2E2410 0%, #08070A 70%)" },
  web: { text: "CAUGHT IT!", accent: "#FF5468", bg: "radial-gradient(ellipse at 50% 30%, #2A0E18 0%, #07080F 70%)" },
  blast: { text: "DIRECT HIT!", accent: "#FF9F43", bg: "radial-gradient(ellipse at 50% 30%, #2D1A0A 0%, #07080D 70%)" },
  smash: { text: "SMASHED IT!", accent: "#5BE37D", bg: "radial-gradient(ellipse at 50% 70%, #10301A 0%, #050A07 70%)" },
  portal: { text: "BREACH OPENED!", accent: "#B57CFF", bg: "radial-gradient(ellipse at 50% 30%, #22123A 0%, #07060E 70%)" },
  arrow: { text: "BULLSEYE!", accent: "#FF5468", bg: "radial-gradient(ellipse at 50% 30%, #1E1420 0%, #07070C 70%)" },
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

/** Closes after `seconds` (plus a little), or on Escape. */
function useAutoClose(open: boolean, seconds: number, extraMs: number, close: () => void, n: number) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(close, Math.max(1, seconds) * 1000 + extraMs);
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", k);
    };
  }, [open, seconds, extraMs, close, n]);
}

/* ---------------- Shared pieces ---------------- */

/** The guessed flag, as a little glowing card. */
function FlagChip({ color, label = "flag{ ? ? ? }" }: { color: string; label?: string }) {
  return (
    <div
      className="flex items-center gap-2 whitespace-nowrap rounded-md border-2 px-3 py-2 font-mono text-sm text-white"
      style={{ borderColor: color, background: "rgba(7,10,18,0.92)", boxShadow: `0 0 18px ${color}` }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <path d="M3 1 V15 M3 2 H12 L10 5 L12 8 H3" stroke={color} fill={`${color}55`} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {label}
    </div>
  );
}

/** Centres one thing in the stage. Motion goes on the child, so centring never fights the animation. */
function Center({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`pointer-events-none absolute inset-0 grid place-items-center ${className}`}>{children}</div>;
}

/** Expanding rings from the centre of the stage. */
function Rings({ color, delay, count = 3, size = 40 }: { color: string; delay: number; count?: number; size?: number }) {
  return (
    <Center>
      {Array.from({ length: count }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute block rounded-full border-4"
          style={{ borderColor: color, width: size, height: size }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 7 + i * 2.5], opacity: [0, 0.9, 0] }}
          transition={{ delay: delay + i * 0.12, duration: 1 }}
        />
      ))}
    </Center>
  );
}

/** Sparks bursting out of the centre. */
function Sparks({ color, delay, n = 26, spread = 260 }: { color: string; delay: number; n?: number; spread?: number }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * Math.PI * 2;
        const d = spread * between(0.45, 1);
        return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.65, s: between(4, 10) };
      }),
    [n, spread],
  );
  return (
    <Center>
      {sparks.map((s, i) => (
        <motion.span
          key={i}
          className="absolute block rounded-full"
          style={{ width: s.s, height: s.s, background: i % 3 ? color : "#FFF4C2", boxShadow: `0 0 10px ${color}` }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: s.x, y: s.y, opacity: [0, 1, 0] }}
          transition={{ delay, duration: 1.1, ease: "easeOut" }}
        />
      ))}
    </Center>
  );
}

/** A stroke that draws itself (pathLength=1 normalises every path, so the dash trick works for any shape). */
function Draw({ d, color, width = 1.5, delay = 0, duration = 0.5, nonScaling }: { d: string; color: string; width?: number; delay?: number; duration?: number; nonScaling?: boolean }) {
  // Full-screen lines stretch with the screen, which breaks the dash trick: they flash in instead.
  if (nonScaling)
    return (
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.6, 1] }}
        transition={{ delay, duration: duration + 0.2 }}
      />
    );
  return (
    <motion.path
      d={d}
      pathLength={1}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="1 1"
      initial={{ strokeDashoffset: 1 }}
      animate={{ strokeDashoffset: 0 }}
      transition={{ delay, duration, ease: "easeOut" }}
    />
  );
}

/* ---------------- A.R.I.A. ---------------- */

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
      <motion.rect x="-11" y="-2.5" width="22" height="5" rx="2.5" fill="#fff" animate={{ scaleY: [1, 1, 0.1, 1] }} transition={{ repeat: Infinity, duration: 3, times: [0, 0.9, 0.95, 1] }} />
      {broken && <path d="M-30 -30 L30 30 M30 -30 L-30 30" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.8" />}
    </svg>
  );
}

function AriaPanel({ mood, big, quip, image, reduced, close }: { mood: MemeMood; big: string; quip: string; image: string | null; reduced: boolean; close: () => void }) {
  const m = MOOD[mood];
  const typed = useTyped(quip, true);
  return (
    <motion.div
      className="fixed inset-0 z-[100] grid cursor-pointer place-items-center p-4"
      style={{ background: "rgba(3,6,10,0.55)", backdropFilter: "blur(2px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={close}
      role="alert"
      aria-live="assertive"
      data-testid="wrong-popup"
      data-mood={mood}
      data-fx="aria"
    >
      <motion.div
        className="relative w-full max-w-xl overflow-hidden rounded-xl border-2 p-5 sm:p-6"
        style={{ borderColor: m.c, background: m.bg, boxShadow: `0 0 50px ${m.glow}, inset 0 0 40px ${m.glow.replace(/[\d.]+\)$/, "0.15)")}` }}
        initial={reduced ? { opacity: 0 } : { y: 80, scale: 0.6, opacity: 0, rotateX: 40 }}
        animate={mood === "outOfAttempts" && !reduced ? { y: 0, scale: 1, opacity: 1, rotateX: 0, x: [0, -10, 9, -6, 4, 0] } : { y: 0, scale: 1, opacity: 1, rotateX: 0 }}
        exit={{ y: 40, opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      >
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
            <AriaCore color={m.c} mood={mood} />
          </motion.div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="font-mono text-xs tracking-[0.2em]" style={{ color: m.c }}>
              {m.label}
            </div>
            <motion.h2
              className="mt-1 font-display text-5xl leading-none tracking-wide text-white sm:text-6xl"
              style={{ textShadow: `0 0 18px ${m.glow}` }}
              initial={{ opacity: 0, x: -14 }}
              animate={mood === "outOfAttempts" && !reduced ? { opacity: [0, 1, 0.3, 1], x: 0 } : { opacity: 1, x: 0 }}
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
        {image && (
          <motion.div className="relative mt-4 overflow-hidden rounded-md border" style={{ borderColor: m.c }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}>
            <img src={image} alt="" className="mx-auto max-h-[38vh] w-auto object-contain" />
          </motion.div>
        )}
        <div className="relative mt-4 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">tap to dismiss</div>
      </motion.div>
    </motion.div>
  );
}

/* ---------------- Force shield ---------------- */

const HEX_R = 15;
const HEX_CELLS = (() => {
  const out: [number, number][] = [];
  const w = Math.sqrt(3) * HEX_R;
  for (let row = -7; row <= 7; row++)
    for (let col = -7; col <= 7; col++) {
      const x = col * w + (row % 2 ? w / 2 : 0);
      const y = row * 1.5 * HEX_R;
      if (x * x + y * y <= 92 * 92) out.push([x, y]);
    }
  return out;
})();
const hexPath = (x: number, y: number, r: number) =>
  "M" + Array.from({ length: 6 }, (_, i) => `${(x + r * Math.cos(((60 * i + 30) * Math.PI) / 180)).toFixed(1)},${(y + r * Math.sin(((60 * i + 30) * Math.PI) / 180)).toFixed(1)}`).join(" L") + " Z";

/** An original hexagonal energy shield: a dome of glowing cells. */
function HexShield({ color, flashAt }: { color: string; flashAt?: number }) {
  return (
    <motion.svg
      viewBox="-110 -110 220 220"
      width={230}
      height={230}
      aria-hidden
      initial={{ scale: 0, rotate: -40, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 14 }}
      style={{ filter: `drop-shadow(0 0 14px ${color})` }}
    >
      <circle r="104" fill={`${color}14`} stroke={color} strokeWidth="2.5" />
      {HEX_CELLS.map(([x, y], i) => (
        <motion.path
          key={i}
          d={hexPath(x, y, HEX_R - 1.5)}
          fill={color}
          stroke={color}
          strokeWidth="1.2"
          initial={{ fillOpacity: 0, strokeOpacity: 0 }}
          animate={
            flashAt !== undefined
              ? { fillOpacity: [0, 0.08, 0.08, 0.55, 0.08], strokeOpacity: [0, 0.7, 0.7, 1, 0.7] }
              : { fillOpacity: [0, 0.45, 0.08], strokeOpacity: [0, 1, 0.7] }
          }
          transition={
            flashAt !== undefined
              ? { duration: flashAt + 0.6, times: [0, 0.3, flashAt / (flashAt + 0.6), (flashAt + 0.1) / (flashAt + 0.6), 1] }
              : { delay: 0.15 + Math.hypot(x, y) / 260, duration: 0.7 }
          }
        />
      ))}
    </motion.svg>
  );
}

function ShieldScene({ color, fail }: { color: string; fail?: boolean }) {
  const HIT = 0.6;
  return (
    <>
      <Center>
        <HexShield color={color} flashAt={fail ? HIT : undefined} />
      </Center>
      {fail ? (
        <>
          <Center>
            <motion.div
              initial={{ y: 260, scale: 0.7, rotate: 0, opacity: 0 }}
              animate={{ y: [260, 40, 320], x: [0, 0, 140], scale: [0.7, 1, 0.8], rotate: [0, 0, 220], opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, times: [0, HIT / 1.5, 1], ease: "easeOut" }}
            >
              <FlagChip color={color} />
            </motion.div>
          </Center>
          <Rings color={color} delay={HIT} count={2} size={60} />
        </>
      ) : (
        <>
          <Rings color={color} delay={0.5} />
          <Center>
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.25, 1], opacity: 1 }} transition={{ delay: 0.7, duration: 0.5 }}>
              <FlagChip color={color} label="FLAG SECURED" />
            </motion.div>
          </Center>
        </>
      )}
    </>
  );
}

/* ---------------- Web ---------------- */

const SPOKES = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4 + 0.2);
const WEB_RINGS = [26, 50, 74, 98].map((r) => {
  const pt = (a: number, rr: number) => `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`;
  let d = `M${pt(SPOKES[0], r)}`;
  for (let i = 0; i < SPOKES.length; i++) {
    const a0 = SPOKES[i];
    const a1 = SPOKES[(i + 1) % SPOKES.length] + (i === SPOKES.length - 1 ? Math.PI * 2 : 0);
    d += ` Q${pt((a0 + a1) / 2, r * 0.82)} ${pt(a1, r)}`;
  }
  return d;
});

/** A spider web that spins itself: spokes first, then the rings. */
function WebSvg({ color, delay = 0 }: { color: string; delay?: number }) {
  return (
    <svg viewBox="-120 -120 240 240" width={260} height={260} aria-hidden style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
      {SPOKES.map((a, i) => (
        <Draw key={i} d={`M0,0 L${(Math.cos(a) * 118).toFixed(1)},${(Math.sin(a) * 118).toFixed(1)}`} color={color} width={1.6} delay={delay + i * 0.03} duration={0.35} />
      ))}
      {WEB_RINGS.map((d, i) => (
        <Draw key={d} d={d} color={color} width={1.3} delay={delay + 0.3 + i * 0.1} duration={0.4} />
      ))}
    </svg>
  );
}

/** Strands shooting in from the four corners of the screen. */
function CornerStrands({ color }: { color: string }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      {[
        [0, 0],
        [100, 0],
        [0, 100],
        [100, 100],
      ].map(([x, y], i) => (
        <Draw key={i} d={`M${x},${y} L50,32`} color={color} width={2} delay={i * 0.05} duration={0.3} nonScaling />
      ))}
    </svg>
  );
}

function WebScene({ color, fail }: { color: string; fail?: boolean }) {
  return (
    <>
      <Center>
        {fail ? (
          <motion.div initial={{ y: -200, opacity: 0 }} animate={{ y: 0, opacity: 1, rotate: [0, -10, 9, -7, 5, -3, 0] }} transition={{ y: { duration: 0.35 }, rotate: { delay: 0.8, duration: 1.4 } }}>
            <FlagChip color={color} />
          </motion.div>
        ) : (
          <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.2, 1], opacity: 1 }} transition={{ delay: 0.75, duration: 0.45 }}>
            <FlagChip color={color} label="FLAG CAUGHT" />
          </motion.div>
        )}
      </Center>
      <Center>
        <WebSvg color={fail ? color : "#F4F7FB"} delay={fail ? 0.3 : 0.2} />
      </Center>
    </>
  );
}

/* ---------------- Energy blast ---------------- */

function BlastScene({ color }: { color: string }) {
  const motes = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2, d: between(90, 140) })), []);
  const FIRE = 0.8;
  return (
    <>
      {/* charging: motes rush into the core */}
      <Center>
        {motes.map((m, i) => (
          <motion.span
            key={i}
            className="absolute block h-2 w-2 rounded-full"
            style={{ background: color, boxShadow: `0 0 10px ${color}` }}
            initial={{ x: Math.cos(m.a) * m.d, y: Math.sin(m.a) * m.d, opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: [0, 1, 0] }}
            transition={{ duration: FIRE - 0.1, ease: "easeIn" }}
          />
        ))}
      </Center>
      {/* the beam crosses the whole screen */}
      <Center>
        <motion.div
          className="absolute h-5 rounded-full"
          style={{ width: "200vw", background: `linear-gradient(90deg, transparent, ${color} 20%, #fff 50%, ${color} 80%, transparent)`, boxShadow: `0 0 40px ${color}`, transformOrigin: "50% 50%" }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: [0, 1.4, 0.6, 0], opacity: [0, 1, 1, 0] }}
          transition={{ delay: FIRE, duration: 0.7, times: [0, 0.2, 0.7, 1] }}
        />
      </Center>
      <Center>
        <motion.div
          className="h-24 w-24 rounded-full"
          style={{ background: `radial-gradient(circle, #fff 0%, ${color} 40%, transparent 70%)` }}
          initial={{ scale: 0 }}
          animate={{ scale: [0, 0.6, 0.8, 2.6, 1], opacity: [0, 1, 1, 1, 0.9] }}
          transition={{ duration: FIRE + 0.6, times: [0, 0.4, 0.55, 0.65, 1] }}
        />
      </Center>
      <Rings color={color} delay={FIRE} />
      <Sparks color={color} delay={FIRE} />
    </>
  );
}

/* ---------------- Ground smash / screen crack ---------------- */

/** Jagged cracks radiating from a point, across the whole screen. */
function Cracks({ color, at = [50, 34] as [number, number], n }: { color: string; at?: [number, number]; n: number }) {
  const paths = useMemo(() => {
    const out: string[] = [];
    const [cx, cy] = at;
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + between(-0.2, 0.2);
      const len = between(35, 80);
      let d = `M${cx},${cy}`;
      for (let s = 1; s <= 4; s++) {
        const r = (len * s) / 4;
        const j = between(-0.18, 0.18);
        d += ` L${(cx + Math.cos(a + j) * r).toFixed(1)},${(cy + Math.sin(a + j) * r).toFixed(1)}`;
      }
      out.push(d);
    }
    for (const r of [5, 12]) {
      let d = "";
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const rr = r * between(0.8, 1.2);
        d += `${i ? " L" : "M"}${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr * 1.4).toFixed(1)}`;
      }
      out.push(d);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
      {paths.map((d, i) => (
        <Draw key={i} d={d} color={i < 11 ? "#F4F7FB" : color} width={i < 11 ? 2 : 1.5} delay={0.45 + i * 0.015} duration={0.25} nonScaling />
      ))}
    </svg>
  );
}

function SmashScene({ color }: { color: string }) {
  const rocks = useMemo(() => Array.from({ length: 16 }, () => ({ x: between(-180, 180), y: between(-200, -60), r: between(-240, 240), s: between(8, 20) })), []);
  return (
    <>
      {/* an energy meteor drops and slams the ground */}
      <Center>
        <motion.div
          className="h-20 w-20 rounded-full"
          style={{ background: `radial-gradient(circle at 35% 35%, #fff, ${color} 45%, #0E3A1C 100%)`, boxShadow: `0 0 50px ${color}` }}
          initial={{ y: -900, scale: 1.3 }}
          animate={{ y: [-900, 60, 60], scale: [1.3, 1, 0], opacity: [1, 1, 0] }}
          transition={{ duration: 0.75, times: [0, 0.6, 1], ease: "easeIn" }}
        />
      </Center>
      <Center className="translate-y-[60px]">
        <motion.div
          className="h-10 w-[180px] rounded-[50%]"
          style={{ background: `radial-gradient(ellipse, #fff 0%, ${color} 35%, #0E3A1C 70%, transparent 72%)`, boxShadow: `0 0 40px ${color}` }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 0.85] }}
          transition={{ delay: 0.45, duration: 0.6 }}
        />
      </Center>
      <Center className="translate-y-[60px]">
        <motion.div
          className="h-6 w-[420px] rounded-[50%]"
          style={{ background: `radial-gradient(ellipse, ${color}, transparent 70%)` }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: [0, 1.4, 1], opacity: [0, 1, 0] }}
          transition={{ delay: 0.45, duration: 1 }}
        />
      </Center>
      <Center className="translate-y-[60px]">
        {rocks.map((r, i) => (
          <motion.span
            key={i}
            className="absolute block"
            style={{ width: r.s, height: r.s * 0.8, background: i % 2 ? "#3B4A3F" : "#5C6B5E", clipPath: "polygon(20% 0, 100% 15%, 85% 100%, 0 80%)" }}
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: r.x, y: [0, r.y, r.y + 160], rotate: r.r, opacity: [0, 1, 0] }}
            transition={{ delay: 0.45, duration: 1.2, ease: "easeOut" }}
          />
        ))}
      </Center>
      <Rings color={color} delay={0.45} />
    </>
  );
}

/* ---------------- Portal ---------------- */

function PortalRing({ color, closeAt }: { color: string; closeAt?: number }) {
  const dots = useMemo(() => Array.from({ length: 44 }, (_, i) => ({ a: (i / 44) * 360, r: between(80, 96), s: between(2, 5) })), []);
  return (
    <motion.div
      className="relative h-[220px] w-[220px]"
      initial={{ scale: 0 }}
      animate={closeAt ? { scale: [0, 1, 1, 0] } : { scale: 1 }}
      transition={closeAt ? { duration: closeAt + 0.4, times: [0, 0.25, closeAt / (closeAt + 0.4), 1] } : { type: "spring", stiffness: 160, damping: 15 }}
    >
      <div className="absolute inset-[18px] rounded-full" style={{ background: `radial-gradient(circle, #05030A 35%, ${color}66 70%, transparent 72%)` }} />
      <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}>
        {dots.map((d, i) => (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 block rounded-full"
            style={{ width: d.s, height: d.s, background: i % 4 ? color : "#fff", boxShadow: `0 0 8px ${color}`, transform: `rotate(${d.a}deg) translateX(${d.r}px)` }}
          />
        ))}
      </motion.div>
      <motion.div
        className="absolute inset-[30px] rounded-full border-2 border-dashed"
        style={{ borderColor: color }}
        animate={{ rotate: -360 }}
        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
      />
    </motion.div>
  );
}

function PortalScene({ color, fail }: { color: string; fail?: boolean }) {
  return (
    <>
      <Center>
        <PortalRing color={color} closeAt={fail ? 1.5 : undefined} />
      </Center>
      <Center>
        {fail ? (
          <motion.div
            initial={{ x: -230, y: 120, scale: 1, rotate: 0, opacity: 0 }}
            animate={{ x: [-230, 120, -40, 0], y: [120, 60, -40, 0], scale: [1, 0.85, 0.5, 0], rotate: [0, 240, 480, 720], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.3, ease: "easeIn" }}
          >
            <FlagChip color={color} />
          </motion.div>
        ) : (
          <motion.div initial={{ scale: 0, rotate: -180, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ delay: 0.5, type: "spring", stiffness: 180, damping: 12 }}>
            <FlagChip color={color} label="FLAG RECOVERED" />
          </motion.div>
        )}
      </Center>
      {!fail && <Sparks color={color} delay={0.55} n={18} spread={200} />}
    </>
  );
}

/* ---------------- Bullseye arrow ---------------- */

function ArrowScene({ color }: { color: string }) {
  const HIT = 0.55;
  return (
    <>
      <Center>
        <motion.svg
          viewBox="-60 -60 120 120"
          width={180}
          height={180}
          aria-hidden
          initial={{ scale: 0 }}
          animate={{ scale: 1, x: [0, 0, 6, -4, 2, 0] }}
          transition={{ scale: { type: "spring", stiffness: 220, damping: 14 }, x: { delay: HIT, duration: 0.4 } }}
        >
          {[56, 44, 32, 20, 9].map((r, i) => (
            <circle key={r} r={r} fill={i % 2 ? "#F4F7FB" : color} stroke="#07080D" strokeWidth="1.5" />
          ))}
        </motion.svg>
      </Center>
      <Center>
        {/* the arrow lands with its tip at the centre, then quivers */}
        <motion.div
          style={{ transformOrigin: "0% 50%" }}
          className="translate-x-[95px]"
          initial={{ x: "-70vw", opacity: 0 }}
          animate={{ x: 0, opacity: 1, rotate: [0, 0, -5, 4, -2, 0] }}
          transition={{ x: { duration: HIT, ease: "easeIn" }, opacity: { duration: 0.1 }, rotate: { delay: HIT, duration: 0.6 } }}
        >
          <svg viewBox="0 0 190 30" width={190} height={30} aria-hidden style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,.5))" }}>
            <rect x="10" y="13.5" width="160" height="3" fill="#C9D3DD" />
            <path d="M0 15 L14 8 L14 22 Z" fill="#E8EEF5" />
            <path d="M160 15 L182 4 L190 4 L172 15 L190 26 L182 26 Z" fill={color} />
          </svg>
        </motion.div>
      </Center>
      <Rings color="#FFF4C2" delay={HIT} count={2} size={30} />
      <Sparks color={color} delay={HIT} n={16} spread={160} />
    </>
  );
}

/* ---------------- Turned to dust ---------------- */

function DustScene({ color }: { color: string }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 60 }, () => {
        const x = between(-80, 80);
        const y = between(-18, 18);
        return { x, y, dx: between(60, 260), dy: between(-120, 30), s: between(2, 5), delay: 0.6 + ((x + 80) / 160) * 0.7 };
      }),
    [],
  );
  return (
    <>
      <Center>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1, 1, 1] }} transition={{ duration: 1.5, times: [0, 0.15, 0.45, 0.9] }}>
          <FlagChip color={color} />
        </motion.div>
      </Center>
      <Center>
        {bits.map((b, i) => (
          <motion.span
            key={i}
            className="absolute block"
            style={{ width: b.s, height: b.s, background: i % 3 ? color : "#F4F7FB" }}
            initial={{ x: b.x, y: b.y, opacity: 0 }}
            animate={{ x: b.x + b.dx, y: b.y + b.dy, opacity: [0, 1, 0], rotate: between(-180, 180) }}
            transition={{ delay: b.delay, duration: 1.4, ease: "easeOut" }}
          />
        ))}
      </Center>
    </>
  );
}

/* ---------------- Lightning hammer ---------------- */

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
      <rect x="92" y="78" width="16" height="170" rx="6" fill="url(#th-handle)" />
      {[110, 130, 150, 170, 190, 210, 230].map((y) => (
        <path key={y} d={`M92 ${y} L108 ${y - 8}`} stroke="#2A1D12" strokeWidth="3" />
      ))}
      <circle cx="100" cy="250" r="9" fill="url(#th-head)" stroke="#2B3138" strokeWidth="2" />
      <path d="M18 34 L40 14 L160 14 L182 34 L182 74 L160 94 L40 94 L18 74 Z" fill="url(#th-head)" stroke="#2B3138" strokeWidth="3" />
      <path d="M40 14 L52 30 L148 30 L160 14 M40 94 L52 78 L148 78 L160 94" fill="none" stroke="#2B3138" strokeWidth="2" opacity="0.6" />
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
    for (let y = 0; y <= 32; y += 4) {
      out.push(`${cx},${y}`);
      cx = x + (Math.random() - 0.5) * 8 + (50 - x) * (y / 32);
    }
    out.push("50,34");
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

function ThunderBackdrop({ n }: { n: number }) {
  const IMPACT = 0.55;
  return (
    <>
      <motion.div
        className="pointer-events-none absolute inset-x-[-10%] top-[-12%] h-[45%]"
        style={{ background: "radial-gradient(ellipse at 30% 60%, rgba(90,110,140,.55), transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(70,90,120,.5), transparent 60%)", filter: "blur(18px)" }}
        animate={{ x: ["-3%", "3%", "-3%"] }}
        transition={{ repeat: Infinity, duration: 6 }}
      />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {[18, 34, 50, 66, 82].map((x, i) => (
          <Bolt key={`${n}-${x}`} x={x} delay={0.15 + i * 0.06} w={i === 2 ? 9 : 5} />
        ))}
        {[26, 74].map((x, i) => (
          <Bolt key={`b2-${n}-${x}`} x={x} delay={IMPACT + 0.5 + i * 0.25} />
        ))}
      </svg>
      <motion.div className="pointer-events-none absolute inset-0 bg-white" initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 0.9, 0] }} transition={{ duration: IMPACT + 0.35, times: [0, 0.6, 0.72, 1] }} />
    </>
  );
}

function ThunderScene({ color }: { color: string }) {
  const IMPACT = 0.55;
  return (
    <>
      <Rings color={color} delay={IMPACT} />
      <Sparks color={color} delay={IMPACT} n={28} />
      <Center>
        <motion.div
          initial={{ y: -1100, rotate: -35, scale: 1.2 }}
          animate={{ y: [-1100, 0, -14, 0], rotate: [-35, 0, 4, 0], scale: [1.2, 1, 1, 1] }}
          transition={{ duration: IMPACT + 0.35, times: [0, 0.6, 0.8, 1], ease: "easeIn" }}
          className="drop-shadow-[0_0_30px_rgba(127,231,255,0.65)]"
        >
          <ThunderHammer size={150} />
        </motion.div>
      </Center>
    </>
  );
}

/* ---------------- Frames ---------------- */

/** The 300×240 area where an effect plays. Effects may spill outside it. */
function Stage({ children }: { children: ReactNode }) {
  return <div className="relative h-[220px] w-[300px] sm:h-[240px]">{children}</div>;
}

function wrongScene(fx: string, color: string) {
  switch (fx) {
    case "shield":
      return <ShieldScene color={color} fail />;
    case "web":
      return <WebScene color={color} fail />;
    case "portal":
      return <PortalScene color={color} fail />;
    case "smash":
      return <SmashSceneChipOnly color={color} />;
    default:
      return <DustScene color={color} />;
  }
}

export function WrongFlagPopup() {
  const { fx } = useUi();
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState({ n: 0, fx: "aria", mood: "wrong" as MemeMood, text: "", quip: QUIPS.wrong[0], image: null as string | null, seconds: 3 });
  useOnBump(fx.wrong.n, (n) => {
    const mood = fx.wrong.mood;
    const effect = WRONG_FX[fx.wrong.fx] ? fx.wrong.fx : "aria";
    const quips = mood === "wrong" && effect !== "aria" ? WRONG_FX[effect].quips : QUIPS[mood];
    setShown({ n, fx: effect, mood, text: fx.wrong.text.trim(), quip: rand(quips), image: fx.wrong.image, seconds: fx.wrong.seconds });
    setOpen(true);
  });
  const close = useMemo(() => () => setOpen(false), []);
  useAutoClose(open, shown.seconds, 900, close, fx.wrong.n);

  const meta = WRONG_FX[shown.fx];
  // A normal miss shows the effect's own colour and line; last attempt / lockdown keep their warning colours and line.
  const color = shown.mood === "wrong" && meta ? meta.accent : MOOD[shown.mood].c;
  const big = shown.text || (shown.mood === "wrong" && meta ? meta.text : CUE_LABELS[shown.mood].defaultText);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && shown.fx === "aria" && <AriaPanel key={`aria-${shown.n}`} mood={shown.mood} big={big} quip={shown.quip} image={shown.image} reduced={reduced} close={close} />}
        {open && meta && (
          <motion.div
            key={`fx-${shown.n}`}
            className="fixed inset-0 z-[100] grid cursor-pointer place-items-center overflow-hidden p-4"
            style={{ background: `radial-gradient(ellipse at 50% 35%, ${color}22 0%, rgba(3,5,10,0.92) 65%)`, backdropFilter: "blur(2px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, x: shown.fx === "smash" || shown.mood === "outOfAttempts" ? [0, 0, -12, 10, -6, 3, 0] : 0 }}
            exit={{ opacity: 0 }}
            transition={{ x: { delay: 0.45, duration: 0.45 } }}
            onClick={close}
            role="alert"
            aria-live="assertive"
            data-testid="wrong-popup"
            data-mood={shown.mood}
            data-fx={shown.fx}
          >
            {shown.fx === "smash" && <Cracks color={color} n={shown.n} />}
            <div className="relative flex w-full max-w-xl flex-col items-center text-center">
              <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.25em]" style={{ color }}>
                <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: color }} />
                {MOOD[shown.mood].label}
              </div>
              <Stage>{wrongScene(shown.fx, color)}</Stage>
              {shown.mood !== "wrong" && (
                <div className="font-display text-2xl tracking-wide" style={{ color }}>
                  {meta.text}
                </div>
              )}
              <motion.h2
                className="font-display text-[clamp(2.6rem,9vw,4.5rem)] leading-none tracking-wide text-white"
                style={{ textShadow: `0 0 22px ${color}, 4px 4px 0 #07090D` }}
                initial={{ scale: 1.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 380, damping: 14 }}
              >
                {big}
              </motion.h2>
              <motion.p className="mt-3 max-w-md font-mono text-sm text-white/90 sm:text-base" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }}>
                &gt; {shown.quip}
              </motion.p>
              {shown.image && (
                <motion.img
                  src={shown.image}
                  alt=""
                  className="mt-4 max-h-[30vh] w-auto rounded-md border-2 object-contain"
                  style={{ borderColor: color }}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.85 }}
                />
              )}
              <p className="mt-3 text-[10px] uppercase tracking-[0.3em] text-white/40">tap to dismiss</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

/** The screen-crack miss: the cracks cover the whole overlay (drawn by the frame); the stage only holds the flag. */
function SmashSceneChipOnly({ color }: { color: string }) {
  return (
    <Center>
      <motion.div
        initial={{ scale: 2.5, opacity: 0 }}
        animate={{ scale: [2.5, 1, 1], opacity: [0, 1, 0.35], x: [0, 0, -6, 5, -3, 0], rotate: [0, 0, -4] }}
        transition={{ duration: 1.3, times: [0, 0.35, 1] }}
      >
        <FlagChip color={color} />
      </motion.div>
    </Center>
  );
}

function correctScene(fx: string, color: string) {
  switch (fx) {
    case "shield":
      return <ShieldScene color={color} />;
    case "web":
      return <WebScene color={color} />;
    case "blast":
      return <BlastScene color={color} />;
    case "smash":
      return <SmashScene color={color} />;
    case "portal":
      return <PortalScene color={color} />;
    case "arrow":
      return <ArrowScene color={color} />;
    default:
      return <ThunderScene color={color} />;
  }
}

export function SealedPopup() {
  const { fx } = useUi();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ n: 0, fx: "thunder", title: "", points: 0, text: "", image: null as string | null, seconds: 4 });
  useOnBump(fx.seal.n, (n) => {
    setData({ n, fx: CORRECT_FX[fx.seal.fx] ? fx.seal.fx : "thunder", title: fx.seal.title, points: fx.seal.points, text: fx.seal.text.trim(), image: fx.seal.image, seconds: fx.seal.seconds });
    setOpen(true);
  });
  const close = useMemo(() => () => setOpen(false), []);
  useAutoClose(open, data.seconds, 900, close, fx.seal.n);
  const meta = CORRECT_FX[data.fx];
  const big = data.text || meta.text;
  const T = data.fx === "blast" ? 0.95 : data.fx === "thunder" || data.fx === "smash" || data.fx === "arrow" ? 0.6 : 0.8;

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <motion.div
            key={data.n}
            className="fixed inset-0 z-[100] grid cursor-pointer place-items-center overflow-hidden p-4"
            style={{ background: meta.bg }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: data.fx === "smash" ? [0, 0, 14, -10, 6, -3, 0] : 0 }}
            exit={{ opacity: 0 }}
            transition={{ y: { delay: 0.45, duration: 0.5 } }}
            onClick={close}
            role="alert"
            aria-live="assertive"
            data-testid="seal-popup"
            data-fx={data.fx}
          >
            {data.fx === "thunder" && <ThunderBackdrop n={data.n} />}
            {data.fx === "web" && <CornerStrands color="#F4F7FB" />}
            {data.fx === "smash" && <Cracks color={meta.accent} n={data.n} at={[50, 42]} />}
            <div className="relative flex flex-col items-center text-center">
              <Stage>{correctScene(data.fx, meta.accent)}</Stage>
              <motion.div
                className="mt-2 font-display text-[clamp(3rem,12vw,7.5rem)] leading-none tracking-wide text-white"
                style={{ textShadow: `0 0 30px ${meta.accent}, 0 0 60px ${meta.accent}, 6px 6px 0 #07090D` }}
                initial={{ scale: 2.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: T, type: "spring", stiffness: 420, damping: 13 }}
              >
                {big}
              </motion.div>
              <motion.div
                className="mt-1 font-display text-5xl text-gold sm:text-6xl"
                style={{ textShadow: "4px 4px 0 #07090D, 0 0 24px rgba(242,179,61,.7)" }}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: T + 0.25, type: "spring", stiffness: 380, damping: 12 }}
              >
                +{data.points} points
              </motion.div>
              <motion.p className="mt-2 max-w-md text-lg text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: T + 0.45 }}>
                Your team solved <strong style={{ color: meta.accent }}>{data.title}</strong>
              </motion.p>
              {data.image && (
                <motion.img
                  src={data.image}
                  alt=""
                  className="mt-4 max-h-[30vh] w-auto rounded-md border-2 object-contain"
                  style={{ borderColor: meta.accent, boxShadow: `0 0 30px ${meta.accent}66` }}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: T + 0.6 }}
                />
              )}
              <p className="mt-3 text-[10px] uppercase tracking-[0.3em] text-white/40">tap to dismiss</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
