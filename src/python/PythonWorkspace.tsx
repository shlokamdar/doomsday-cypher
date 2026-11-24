import { useEffect, useRef, useState } from "react";
import type { ViewChallenge } from "../core/types";
import { useUi } from "../hooks/ui";
import { TIME_LIMIT_S, usePython } from "./usePython";

const DEFAULT_STARTER = `# Python runs right here in your browser. Your challenge files are in this folder.
import os
print(os.listdir("."))
`;
const key = (id: string) => `doomsday.py.${id}`;

/**
 * Code editor + output for one challenge. Python (Pyodide) runs in a background thread in the
 * player's browser; code is kept in this browser per challenge and never reaches the server.
 */
export function PythonWorkspace({ c }: { c: ViewChallenge }) {
  const starter = c.python?.starter?.trim() ? c.python.starter : DEFAULT_STARTER;
  const [code, setCode] = useState(() => {
    try {
      return localStorage.getItem(key(c.id)) ?? starter;
    } catch {
      return starter;
    }
  });
  const py = usePython();
  const { confirm } = useUi();
  const out = useRef<HTMLPreElement>(null);
  const files = c.files.filter((f) => !/^https?:/i.test(f.url));
  const busy = py.state !== "idle";

  useEffect(() => {
    try {
      localStorage.setItem(key(c.id), code);
    } catch {
      /* storage full or blocked */
    }
  }, [c.id, code]);
  useEffect(() => {
    out.current?.scrollTo({ top: out.current.scrollHeight });
  }, [py.lines]);

  const run = () => {
    if (!busy && code.trim()) py.run(code, files);
  };
  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      run();
      return;
    }
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const t = e.currentTarget;
      const s = t.selectionStart;
      const en = t.selectionEnd;
      setCode(code.slice(0, s) + "    " + code.slice(en));
      requestAnimationFrame(() => {
        t.selectionStart = t.selectionEnd = s + 4;
      });
    }
  }

  return (
    <div className="mt-5 overflow-hidden rounded-md border border-reactor/30" data-testid="python-workspace">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-reactor/10 px-4 py-2.5">
        <p className="flex items-center gap-2 font-display text-xl tracking-wide text-reactor">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" />
          </svg>
          Python workspace
        </p>
        <p className="text-xs text-steel/80">
          {files.length ? (
            <>
              Files ready:
              {files.map((f) => (
                <code key={f.url} className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-white">
                  {f.url.split("/").pop()}
                </code>
              ))}
            </>
          ) : (
            "numpy, pandas and the standard library are available"
          )}
        </p>
      </div>
      <label htmlFor={`py-${c.id}`} className="sr-only">
        Python code
      </label>
      <textarea
        id={`py-${c.id}`}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={onKey}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className="block h-56 w-full resize-y border-0 bg-[#0A1018] px-4 py-3 font-mono text-[13.5px] leading-relaxed text-[#E6F5F2] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-reactor"
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-[#0A1018] px-4 py-2.5">
        <button type="button" className="btn-primary btn-sm" onClick={run} disabled={busy || !code.trim()}>
          {py.state === "loading" ? "Starting…" : py.state === "running" ? "Running…" : "Run"}
        </button>
        {busy && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => py.stop()}>
            Stop
          </button>
        )}
        <button
          type="button"
          className="btn-ghost btn-sm"
          disabled={busy}
          onClick={async () => {
            if (await confirm({ title: "Reset code?", body: "Replace your code with the starter code?", confirmLabel: "Reset" })) setCode(starter);
          }}
        >
          Reset code
        </button>
        <span className="ml-auto text-xs text-steel/60">{busy ? py.status : `Ctrl+Enter to run · ${TIME_LIMIT_S} s limit per run`}</span>
      </div>
      <pre
        ref={out}
        aria-live="polite"
        aria-label="Python output"
        className="max-h-64 min-h-[5rem] overflow-auto whitespace-pre-wrap break-words bg-[#05080D] px-4 py-3 font-mono text-[13px] leading-relaxed text-[#D3EEEA]"
      >
        {py.lines.length === 0 ? (
          <span className="text-steel/40">{busy ? py.status : "Output appears here."}</span>
        ) : (
          py.lines.map((l, i) => (
            <span key={i} className={l.stream === "stderr" ? "text-[#FF9A94]" : l.stream === "info" ? "text-steel/50" : ""}>
              {l.text}
              {"\n"}
            </span>
          ))
        )}
      </pre>
    </div>
  );
}
