/// <reference lib="webworker" />
/**
 * Runs Python (Pyodide, self-hosted under /pyodide/) in a background thread, so a slow or endless
 * script can never freeze the page. The page stops a run by terminating this worker.
 * Everything here happens in the player's own browser; nothing reaches the server.
 */
export type ToWorker = { type: "run"; id: number; code: string; files: { name: string; url: string }[] };
export type FromWorker =
  | { type: "status"; id: number; text: string }
  | { type: "out"; id: number; stream: "stdout" | "stderr"; text: string }
  | { type: "done"; id: number; ok: boolean; result?: string; ms: number };

declare const self: DedicatedWorkerGlobalScope;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pyodide = any;

/**
 * The site's root. With an absolute base ("/" or "/doomsday-cypher/") use it; with a relative base
 * ("./") the built worker sits in <root>/assets/, so the root is one folder up.
 */
const root = import.meta.env.BASE_URL.startsWith("/") ? new URL(import.meta.env.BASE_URL, self.location.origin) : new URL("../", self.location.href);
const base = new URL("pyodide/", root).toString();
let ready: Promise<Pyodide> | null = null;
const loadedFiles = new Set<string>();
let current = 0;
const post = (m: FromWorker) => self.postMessage(m);

function boot(id: number): Promise<Pyodide> {
  if (!ready) {
    post({ type: "status", id, text: "Starting Python (first run downloads about 10 MB)…" });
    ready = (async () => {
      const mod = await import(/* @vite-ignore */ `${base}pyodide.mjs`);
      const py = await mod.loadPyodide({ indexURL: base, stdout: () => {}, stderr: () => {} });
      py.setStdout({ batched: (t: string) => post({ type: "out", id: current, stream: "stdout", text: t }) });
      py.setStderr({ batched: (t: string) => post({ type: "out", id: current, stream: "stderr", text: t }) });
      return py;
    })();
  }
  return ready;
}

/** The challenge's files, written into Python's working folder so open("name") just works. */
async function mount(py: Pyodide, id: number, files: { name: string; url: string }[]) {
  for (const f of files) {
    const name = f.url.split("?")[0].split("/").pop() || f.name;
    if (loadedFiles.has(name)) continue;
    const url = new URL(f.url, root).toString();
    if (new URL(url).origin !== self.location.origin) continue;   // only this site's own files
    post({ type: "status", id, text: `Loading ${name}…` });
    const r = await fetch(url);
    if (!r.ok) { post({ type: "out", id, stream: "stderr", text: `Couldn't load ${name} (${r.status}).` }); continue; }
    py.FS.writeFile(name, new Uint8Array(await r.arrayBuffer()));
    loadedFiles.add(name);
  }
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const { id, code, files } = e.data;
  current = id;
  const t0 = performance.now();
  try {
    const py = await boot(id);
    await mount(py, id, files);
    // Load any of the bundled libraries the code imports (numpy, pandas…).
    try {
      await py.loadPackagesFromImports(code, { messageCallback: (m: string) => /^Loading /.test(m) && post({ type: "status", id, text: m }), errorCallback: () => {} });
    } catch { /* an unavailable library surfaces as a normal ImportError below */ }
    post({ type: "status", id, text: "Running…" });
    const result = await py.runPythonAsync(code);
    let shown: string | undefined;
    if (result !== undefined && result !== null) {
      try { shown = py.globals.get("repr")(result); } catch { shown = String(result); }
      result?.destroy?.();
    }
    post({ type: "done", id, ok: true, result: shown, ms: performance.now() - t0 });
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    // Trim Pyodide's own frames; keep the part about the player's code.
    const lines = msg.split("\n");
    const start = lines.findIndex((l) => l.includes('File "<exec>"'));
    let text = (start > 0 ? ["Traceback (most recent call last):", ...lines.slice(start)] : lines).join("\n").trim();
    if (/ModuleNotFoundError/.test(text)) {
      // Drop Pyodide's developer advice (about JavaScript loaders), which means nothing to players.
      const mod = /No module named '([^']+)'/.exec(text)?.[1];
      text = text.split("\n").filter((l) => !/loadPackage|pyodide\.org|micropip|included in the Pyodide distribution|You can install it/i.test(l)).join("\n").trim();
      text += `\n\n${mod ? `"${mod}" isn't available here. ` : ""}This workspace includes Python's standard library (sqlite3, csv, json, re, hashlib…) plus numpy and pandas.`;
    }
    post({ type: "out", id, stream: "stderr", text });
    post({ type: "done", id, ok: false, ms: performance.now() - t0 });
  }
};
