import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Actions, Backend } from "../backend/Backend";
import { computeStandings, type Standing } from "../core/logic";
import type { View } from "../core/types";

interface Ctx {
  backend: Backend;
  view: View;
  actions: Actions;
  online: boolean;
}

const BackendCtx = createContext<Ctx | null>(null);

export function BackendProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  const [, force] = useState(0);
  useEffect(() => backend.subscribe(() => force((n) => n + 1)), [backend]);
  const view = backend.getView()!;
  const value = useMemo(
    () => ({ backend, view, actions: backend.actions, online: backend.online() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [backend, view, backend.online()],
  );
  return <BackendCtx.Provider value={value}>{children}</BackendCtx.Provider>;
}

export function useBackend(): Ctx {
  const c = useContext(BackendCtx);
  if (!c) throw new Error("BackendProvider missing");
  return c;
}

/** Ticking "now", corrected to the server clock. */
export function useNow(intervalMs = 1000): number {
  const { backend } = useBackend();
  const [now, setNow] = useState(() => Date.now() + backend.clockOffset());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + backend.clockOffset()), intervalMs);
    return () => clearInterval(id);
  }, [backend, intervalMs]);
  return now;
}

export function useStandings(): Standing[] {
  const { view } = useBackend();
  return useMemo(() => computeStandings(view.teams, view.solves, view.hintUnlocks), [view]);
}

/** Runs `effect` whenever `trigger` changes, but never for the value present on mount. */
export function useOnBump<T>(trigger: T, effect: (value: T) => void) {
  const first = useRef(true);
  const prev = useRef(trigger);
  const cb = useRef(effect);
  cb.current = effect;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      prev.current = trigger;
      return;
    }
    if (prev.current !== trigger) {
      prev.current = trigger;
      cb.current(trigger);
    }
  }, [trigger]);
}

export function usePrefersReducedMotion(): boolean {
  const q = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof matchMedia !== "undefined" && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function safeGet(storage: "local" | "session", key: string): string | null {
  try {
    return (storage === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
export function safeSet(storage: "local" | "session", key: string, value: string) {
  try {
    (storage === "local" ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function useSoundSetting(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(() => safeGet("local", "doomsday.sound") !== "off");
  const set = useCallback((v: boolean) => {
    setOn(v);
    safeSet("local", "doomsday.sound", v ? "on" : "off");
    window.dispatchEvent(new Event("doomsday-sound"));
  }, []);
  useEffect(() => {
    const sync = () => setOn(safeGet("local", "doomsday.sound") !== "off");
    window.addEventListener("doomsday-sound", sync);
    return () => window.removeEventListener("doomsday-sound", sync);
  }, []);
  return [on, set];
}
