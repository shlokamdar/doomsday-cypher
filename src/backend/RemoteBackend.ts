import type { View } from "../core/types";
import { makeActions, type Actions, type Backend } from "./Backend";

const TOKEN_KEY = "doomsday.token";
const FAST_MS = 3000;
const SLOW_MS = 15000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Drop trailing `undefined` args: JSON turns them into null, which can mean "unpublish". */
export function trimArgs(args: unknown[]): unknown[] {
  const out = [...args];
  while (out.length && out[out.length - 1] === undefined) out.pop();
  return out;
}

export interface RemoteOptions {
  base?: string;
  fetch?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  live?: boolean;
}

/** Talks to the shared server: POST /api/rpc for actions, polls GET /api/state for the view. */
export class RemoteBackend implements Backend {
  readonly mode = "remote" as const;
  readonly actions: Actions;
  private view: View | null = null;
  private etag = "";
  private offset = 0;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isOnline = true;
  private base: string;
  private f: typeof fetch;
  private store: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  private inflight: Promise<void> | null = null;

  constructor(private opts: RemoteOptions = {}) {
    this.base = opts.base ?? "/api";
    this.f = opts.fetch ?? ((...a) => fetch(...a));
    this.store = opts.storage ?? localStorage;
    this.actions = makeActions((m, a) => this.rpc(m, a));
  }

  private token() {
    return this.store.getItem(TOKEN_KEY);
  }

  private headers(extra: Record<string, string> = {}) {
    const h: Record<string, string> = { ...extra };
    const t = this.token();
    if (t) h.Authorization = `Bearer ${t}`;
    return h;
  }

  async init() {
    await this.fetchState(true);
    if (this.opts.live !== false && typeof window !== "undefined") {
      document.addEventListener("visibilitychange", this.onWake);
      window.addEventListener("focus", this.onWake);
      this.schedule();
    }
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    if (typeof window !== "undefined") {
      document.removeEventListener("visibilitychange", this.onWake);
      window.removeEventListener("focus", this.onWake);
    }
  }

  private onWake = () => {
    if (document.visibilityState === "visible") {
      void this.fetchState().finally(() => this.schedule());
    }
  };

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    this.timer = setTimeout(async () => {
      try {
        await this.fetchState();
      } catch {
        /* handled in fetchState */
      }
      this.schedule();
    }, hidden ? SLOW_MS : FAST_MS);
  }

  /** Fetch the view; 204 means nothing this viewer can see has changed. */
  fetchState(force = false): Promise<void> {
    if (this.inflight && !force) return this.inflight;
    const run = async () => {
      const q = force || !this.view ? "" : `?v=${encodeURIComponent(this.view.version)}&t=${this.view.serverNow}`;
      try {
        const res = await this.f(`${this.base}/state${q}`, {
          headers: this.headers(this.etag && !force ? { "If-None-Match": this.etag } : {}),
          cache: "no-store",
        });
        if (res.status === 204) {
          const v = res.headers.get("X-Version");
          const now = Number(res.headers.get("X-Server-Now"));
          if (this.view && v) this.view = { ...this.view, version: v, serverNow: now || this.view.serverNow };
          if (now) this.offset = now - Date.now();
          this.setOnline(true);
          return;
        }
        if (!res.ok) throw new ApiError(await errorText(res), res.status);
        const view = (await res.json()) as View;
        this.etag = res.headers.get("ETag") ?? "";
        this.offset = view.serverNow - Date.now();
        if (view.sessionInvalid && this.token()) this.store.removeItem(TOKEN_KEY);
        this.view = view;
        this.isOnline = true;
        this.listeners.forEach((fn) => fn());
      } catch (e) {
        this.setOnline(false);
        throw e;
      }
    };
    const p = run().finally(() => {
      if (this.inflight === p) this.inflight = null;
    });
    this.inflight = p;
    return p;
  }

  private setOnline(v: boolean) {
    if (this.isOnline !== v) {
      this.isOnline = v;
      this.listeners.forEach((fn) => fn());
    }
  }

  private async rpc(method: string, args: unknown[]): Promise<unknown> {
    let res: Response;
    try {
      res = await this.f(`${this.base}/rpc`, {
        method: "POST",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ method, args: trimArgs(args) }),
      });
    } catch {
      throw new ApiError("Can't reach the server. Check your connection.", 0);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && method !== "login" && method !== "changePassword") this.store.removeItem(TOKEN_KEY);
      throw new ApiError(body.error || `Request failed (${res.status})`, res.status);
    }
    if (body.token) this.store.setItem(TOKEN_KEY, body.token);
    await this.fetchState(true).catch(() => undefined);
    return body.result;
  }

  /** Uploaded pop-up images are served by GET /api/media?id=… (cached; they aren't secret). */
  mediaSrc(ref: string): string | null {
    if (ref.startsWith("upload:")) return `${this.base}/media?id=${encodeURIComponent(ref.slice(7))}`;
    return null;
  }

  getView() {
    return this.view;
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  refresh() {
    return this.fetchState(true);
  }
  async downloadFile(url: string, name: string) {
    if (!url.startsWith("/api/file")) {
      window.open(url, "_blank", "noopener");
      return;
    }
    const res = await this.f(url, { headers: this.headers(), cache: "no-store" });
    if (!res.ok) throw new ApiError(res.status === 401 ? "Log in again to download this file." : "That file isn't available.", res.status);
    const href = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
  }

  async logout() {
    this.store.removeItem(TOKEN_KEY);
    await this.fetchState(true);
  }
  clockOffset() {
    return this.offset;
  }
  online() {
    return this.isOnline;
  }
}

async function errorText(res: Response) {
  try {
    const b = await res.json();
    return b.error || `Server error (${res.status})`;
  } catch {
    return `Server error (${res.status})`;
  }
}
