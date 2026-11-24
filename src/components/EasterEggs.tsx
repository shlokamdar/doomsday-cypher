import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PortalRing, SovereignMask } from "./Art";

/**
 * Two secrets on the challenges page. Neither gives points or touches flags.
 *  1. Konami code (↑ ↑ ↓ ↓ ← → ← → B A): a multiverse frenzy of masks and portals rushes across
 *     the screen. A hint is printed in the browser console, where CTF players love to look.
 *  1b. Or just click the little portal peeking up from the bottom of the page.
 *  2. Click your team's points 3 times: "Australia mode" turns the page upside down for a moment,
 *     a nod to Deakin's home.
 */
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let hinted = false;

function soundOn() {
  try {
    return localStorage.getItem("doomsday.sound") !== "off";
  } catch {
    return true;
  }
}

/** A short rising portal "whoosh" with a doom chord. */
function whoosh() {
  if (!soundOn()) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    const t = ac.currentTime;
    [0, 0.3, 0.6, 0.75, 0.9, 1.05].forEach((d, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(i % 2 ? 98 : 73.4, t + d);
      o.frequency.exponentialRampToValueAtTime(i % 2 ? 196 : 146.8, t + d + 0.2);
      g.gain.setValueAtTime(0, t + d);
      g.gain.linearRampToValueAtTime(0.18, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.24);
      o.connect(g).connect(ac.destination);
      o.start(t + d);
      o.stop(t + d + 0.26);
    });
    setTimeout(() => void ac.close(), 2000);
  } catch {
    /* no audio */
  }
}

const COLOURS = ["#2BD67B", "#E0408A", "#5AB0FF", "#F2B33D", "#9B7BFF", "#3DD6D0"];

function Flyer({ i, reduce }: { i: number; reduce: boolean }) {
  const flip = i % 3 === 0;
  const size = 46 + (i % 4) * 20;
  const y = 6 + ((i * 37) % 84);
  if (reduce) return null;
  return (
    <motion.div
      className="absolute"
      style={{ top: `${y}%` }}
      initial={{ x: flip ? "110vw" : "-20vw", rotate: 0 }}
      animate={{ x: flip ? "-20vw" : "110vw", rotate: flip ? -360 : 360, y: [0, -12, 0, 12, 0] }}
      transition={{ x: { duration: 3 + (i % 5) * 0.7, delay: (i % 6) * 0.25, ease: "linear" }, rotate: { duration: 3, repeat: Infinity, ease: "linear" }, y: { duration: 1.2, repeat: Infinity } }}
    >
      {i % 2 ? <SovereignMask size={size} glow={COLOURS[i % COLOURS.length]} /> : <PortalRing size={size} sparks={4} />}
    </motion.div>
  );
}

export function EasterEggs() {
  const reduce = !!useReducedMotion();
  const [frenzy, setFrenzy] = useState(0);
  const [aussie, setAussie] = useState(false);

  useEffect(() => {
    if (!hinted) {
      hinted = true;
      console.log("%c⌬ psst… the multiverse responds to an old cheat code:  ↑ ↑ ↓ ↓ ← → ← → B A", "font: 600 13px system-ui; color: #2BD67B");
    }
    let pos = 0;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return; // never while typing a flag or code
      const want = KONAMI[pos];
      pos = e.key.toLowerCase() === want.toLowerCase() || e.key === want ? pos + 1 : e.key === KONAMI[0] ? 1 : 0;
      if (pos === KONAMI.length) {
        pos = 0;
        setFrenzy((n) => n + 1);
        whoosh();
      }
    };
    let clicks = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement | null)?.closest?.("[data-egg='points']")) return;
      clicks++;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        clicks = 0;
      }, 1500);
      if (clicks >= 3) {
        clicks = 0;
        setAussie(true);
        setTimeout(() => setAussie(false), 3200);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, []);

  // Australia mode: flip the whole page briefly.
  useEffect(() => {
    if (!aussie || reduce) return;
    const root = document.getElementById("root");
    if (!root) return;
    root.style.transition = "transform .7s cubic-bezier(.6,-0.3,.4,1.3)";
    root.style.transform = "rotate(180deg)";
    const t = setTimeout(() => {
      root.style.transform = "";
    }, 2400);
    return () => {
      clearTimeout(t);
      root.style.transform = "";
    };
  }, [aussie, reduce]);

  useEffect(() => {
    if (!frenzy) return;
    const t = setTimeout(() => setFrenzy(0), 7000);
    return () => clearTimeout(t);
  }, [frenzy]);

  // Rendered outside the page root, so the messages stay the right way up in Australia mode.
  return createPortal(
    <>
      {/* The peeking portal: one click starts the frenzy. */}
      <motion.button
        type="button"
        aria-label="A small portal is flickering at the bottom of the page. Click it."
        title="Psst…"
        className="fixed bottom-0 right-[12%] z-[60] cursor-pointer"
        initial={{ y: 40 }}
        animate={reduce ? { y: 22 } : { y: [26, 16, 26], x: [0, -18, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ y: 4, scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          setFrenzy((n) => n + 1);
          whoosh();
        }}
        data-testid="egg-portal"
      >
        <PortalRing size={56} sparks={3} />
      </motion.button>
      <AnimatePresence>
        {frenzy > 0 && (
          <motion.div
            key={frenzy}
            className="pointer-events-none fixed inset-0 z-[90] overflow-hidden bg-void/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-live="polite"
          >
            {Array.from({ length: 16 }).map((_, i) => (
              <Flyer key={i} i={i} reduce={reduce} />
            ))}
            <motion.div
              className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-4"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 260, damping: 16 }}
            >
              <div className="rounded-md border-4 border-reactor bg-void px-6 py-4 text-center shadow-[8px_8px_0_#2BD67B]">
                <p className="font-display text-[clamp(30px,7vw,64px)] leading-none tracking-wide text-reactor">MULTIVERSE FRENZY!</p>
                <p className="mt-2 text-base text-steel">You found a hidden timeline. 0 points, 100% respect.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {aussie && (
          <motion.div
            className="pointer-events-none fixed inset-x-0 top-6 z-[90] flex justify-center px-4"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            role="status"
          >
            <p className="rounded-full bg-gold px-5 py-2.5 text-base font-bold text-void shadow-lg">G'day! Australia mode: greetings from Deakin's home 🦘</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}
