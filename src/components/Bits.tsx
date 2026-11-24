import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { clockPhase, elapsedMs, formatClock, isUnlimited, remainingMs } from "../core/logic";
import { themeMeta } from "../core/themes";
import type { ThemeId } from "../core/types";
import { useBackend, useNow, usePrefersReducedMotion } from "../hooks/store";
import { ThemeIcon } from "./Icons";

/* ---------------- Timer ---------------- */

export function DoomsdayClock({ size = "lg", className = "" }: { size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const { view } = useBackend();
  const now = useNow(500);
  const s = view.settings;
  const phase = clockPhase(s, now);
  // No time limit: once started the clock counts up, and never turns red.
  const unlimited = isUnlimited(s);
  const ms = remainingMs(s, now);
  const low = !unlimited && phase === "running" && ms < 10 * 60_000;
  const text = unlimited ? (phase === "idle" ? "∞" : formatClock(elapsedMs(s, now))) : formatClock(ms);
  const label =
    phase === "idle"
      ? unlimited
        ? "No time limit"
        : "Awaiting launch"
      : phase === "ended"
        ? "Time's up"
        : unlimited
          ? "Elapsed · no time limit"
          : low
            ? "Final minutes"
            : "Time left";
  const color = phase === "ended" ? "text-breach" : phase === "idle" ? "text-steel" : low ? "text-breach" : "text-gold";
  const sizes = { sm: "text-2xl", md: "text-4xl", lg: "text-5xl sm:text-6xl", xl: "text-6xl sm:text-8xl" };
  return (
    <div className={`text-center ${className}`} role="timer" aria-label={`${label}: ${text}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-steel/60">{label}</div>
      <div className={`font-display leading-none tabular-nums ${sizes[size]} ${color}`} style={{ textShadow: "0 0 24px currentColor" }}>
        {text}
      </div>
    </div>
  );
}

/* ---------------- Count-up number ---------------- */

export function CountUp({ value, duration = 900, className = "" }: { value: number; duration?: number; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(reduced ? value : 0);
  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);
  return <span className={`tabular-nums ${className}`}>{shown.toLocaleString()}</span>;
}

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            className={`plate my-auto w-full ${wide ? "max-w-4xl" : "max-w-2xl"} outline-none`}
            initial={{ y: 30, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
          >
            <button className="btn-ghost btn-sm absolute right-3 top-3 z-10" onClick={onClose} aria-label="Close">
              ✕
            </button>
            {title && <div className="border-b border-white/10 px-5 py-4 pr-14">{title}</div>}
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ThemeChip({ theme }: { theme: ThemeId }) {
  const t = themeMeta(theme);
  return (
    <span className="chip" style={{ borderColor: t.tint + "66", color: t.tint }}>
      <ThemeIcon theme={theme} size={13} />
      {t.name}
    </span>
  );
}

export function TypeChip({ typeId }: { typeId: string }) {
  const { view } = useBackend();
  const t = view.challengeTypes.find((x) => x.id === typeId);
  if (!t) return null;
  return (
    <span className="chip" style={{ borderColor: t.color + "66", color: t.color }} title={t.description}>
      {t.name}
    </span>
  );
}

export function SectionTitle({ children, kicker, right }: { children: ReactNode; kicker?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker && <div className="text-xs font-semibold uppercase tracking-[0.3em] text-reactor">{kicker}</div>}
        <h2 className="h-display text-3xl sm:text-4xl">{children}</h2>
      </div>
      {right}
    </div>
  );
}

export function timeAgo(at: number, now: number): string {
  const s = Math.round((now - at) / 1000);
  if (s < 0) return "in " + formatDur(-s);
  if (s < 45) return "just now";
  return formatDur(s) + " ago";
}
function formatDur(s: number) {
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}
export function clockTime(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Copy text helper with a fallback for non-secure contexts. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

export function downloadText(filename: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
