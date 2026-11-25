import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

/* ---------------- Toasts ---------------- */

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  title?: string;
}

interface UiCtx {
  toast(kind: ToastKind, text: string, title?: string): void;
  confirm(opts: ConfirmOpts): Promise<boolean>;
  /** Fx triggers: each call bumps a counter that the full-screen pop-ups watch. */
  fx: FxState;
  /** Wrong-flag pop-up (A.R.I.A.) in one of three moods. Empty text = the built-in line. */
  fireWrong(mood?: MemeMood, opts?: PopupOpts): void;
  /** Correct-flag pop-up (the lightning hammer). */
  fireSeal(title: string, points: number, opts?: PopupOpts): void;
}

export type MemeMood = "wrong" | "lastAttempt" | "outOfAttempts";
/** What the admin set for this moment: the big line, an optional meme image, and time on screen. */
export interface PopupOpts {
  text?: string;
  image?: string | null;
  seconds?: number;
}

interface ConfirmOpts {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

export interface FxState {
  wrong: { n: number; mood: MemeMood; text: string; image: string | null; seconds: number };
  seal: { n: number; title: string; points: number; text: string; image: string | null; seconds: number };
}

const Ui = createContext<UiCtx | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [fx, setFx] = useState<FxState>({
    wrong: { n: 0, mood: "wrong", text: "", image: null, seconds: 3 },
    seal: { n: 0, title: "", points: 0, text: "", image: null, seconds: 4 },
  });
  const idRef = useRef(0);

  const toast = useCallback((kind: ToastKind, text: string, title?: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text, title }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6500 : 4000);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOpts) => new Promise<boolean>((resolve) => setDialog({ ...opts, resolve })),
    [],
  );
  const fireWrong = useCallback(
    (mood: MemeMood = "wrong", o: PopupOpts = {}) =>
      setFx((f) => ({ ...f, wrong: { n: f.wrong.n + 1, mood, text: o.text ?? "", image: o.image ?? null, seconds: o.seconds ?? (mood === "wrong" ? 3 : 4) } })),
    [],
  );
  const fireSeal = useCallback(
    (title: string, points: number, o: PopupOpts = {}) =>
      setFx((f) => ({ ...f, seal: { n: f.seal.n + 1, title, points, text: o.text ?? "", image: o.image ?? null, seconds: o.seconds ?? 4 } })),
    [],
  );

  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  return (
    <Ui.Provider value={{ toast, confirm, fx, fireWrong, fireSeal }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[90] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              role={t.kind === "error" ? "alert" : "status"}
              className={`rounded-md border-l-4 bg-gunmetal/95 px-4 py-3 text-sm shadow-xl backdrop-blur ${
                t.kind === "error" ? "border-breach" : t.kind === "success" ? "border-reactor" : "border-gold"
              }`}
            >
              {t.title && <div className="font-display text-lg tracking-wide text-white">{t.title}</div>}
              <div className="whitespace-pre-line text-steel">{t.text}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {dialog && (
          <motion.div
            className="fixed inset-0 z-[95] grid place-items-center bg-black/70 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => close(false)}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              className="plate w-full max-w-md p-6"
              initial={{ scale: 0.92, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.key === "Escape" && close(false)}
            >
              <h2 id="confirm-title" className="font-display text-3xl tracking-wide text-white">
                {dialog.title}
              </h2>
              {dialog.body && <div className="mt-2 text-steel">{dialog.body}</div>}
              <div className="mt-6 flex justify-end gap-3">
                <button className="btn-ghost" onClick={() => close(false)}>
                  Cancel
                </button>
                <button autoFocus className={dialog.danger ? "btn-danger" : "btn-primary"} onClick={() => close(true)}>
                  {dialog.confirmLabel ?? "Confirm"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ui.Provider>
  );
}

export function useUi() {
  const c = useContext(Ui);
  if (!c) throw new Error("UiProvider missing");
  return c;
}

/**
 * Awaits a backend action and reports the outcome: success toast, or the server's error message.
 * Returns the result, or undefined on failure.
 */
export function useRun() {
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string | ((r: T) => string)): Promise<T | undefined> => {
      setBusy(true);
      try {
        const r = await fn();
        if (success) toast("success", typeof success === "function" ? success(r) : success);
        return r;
      } catch (e) {
        toast("error", e instanceof Error ? e.message : String(e));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { run, busy };
}
