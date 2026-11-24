import { useCallback, useEffect, useRef, useState } from "react";
import type { FromWorker, ToWorker } from "./worker";

export type Line = { stream: "stdout" | "stderr" | "info"; text: string };
export type PyState = "idle" | "loading" | "running";

/** One Python worker shared by every challenge window, so Python only boots once per visit. */
let shared: Worker | null = null;
let booted = false;
const make = () => new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

export const TIME_LIMIT_S = 30;
const MAX_LINES = 2000;

export function usePython() {
  const [state, setState] = useState<PyState>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [status, setStatus] = useState("");
  const runId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback((l: Line) => setLines((x) => (x.length >= MAX_LINES ? [...x.slice(-MAX_LINES + 1), l] : [...x, l])), []);

  const finish = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setState("idle");
    setStatus("");
  }, []);

  const stop = useCallback((why = "Stopped.") => {
    if (shared) { shared.terminate(); shared = null; booted = false; }
    runId.current++;
    push({ stream: "info", text: `${why} Python restarts on the next Run (your files are reloaded automatically).` });
    finish();
  }, [finish, push]);

  const run = useCallback((code: string, files: { name: string; url: string }[]) => {
    if (!shared) shared = make();
    const w = shared;
    const id = ++runId.current;
    setLines([]);
    setState(booted ? "running" : "loading");
    setStatus(booted ? "Running…" : "Starting Python…");
    w.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.id !== runId.current) return;
      if (m.type === "status") { setStatus(m.text); if (m.text === "Running…") { booted = true; setState("running"); } }
      else if (m.type === "out") push({ stream: m.stream, text: m.text });
      else if (m.type === "done") {
        if (m.ok && m.result !== undefined) push({ stream: "stdout", text: m.result });
        push({ stream: "info", text: `${m.ok ? "Finished" : "Stopped with an error"} in ${(m.ms / 1000).toFixed(2)} s.` });
        finish();
      }
    };
    w.onerror = () => { push({ stream: "stderr", text: "Python couldn't start in this browser. Try reloading the page." }); finish(); };
    // A run gets TIME_LIMIT_S seconds after Python is ready; booting doesn't count.
    const arm = () => { timer.current = setTimeout(() => stop(`Time limit (${TIME_LIMIT_S} s) reached.`), TIME_LIMIT_S * 1000 + (booted ? 0 : 60_000)); };
    arm();
    w.postMessage({ type: "run", id, code, files } satisfies ToWorker);
  }, [finish, push, stop]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { state, lines, status, run, stop, clear: () => setLines([]) };
}
