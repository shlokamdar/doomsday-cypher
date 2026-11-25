import { dispatch } from "../core/engine";
import { migrate } from "../core/migrate";
import { buildView, scrub } from "../core/view";
import { imageMetaFor } from "../core/popups";
import type { DB, MediaMeta, View } from "../core/types";
import { makeActions, type Actions, type Backend } from "./Backend";
import type { Codec, StorageLike } from "./secureStore";

export const DB_KEY = "doomsday.db";
export const SESSION_KEY = "doomsday.session";
/** Uploaded pop-up images are kept beside the event data, one key each, so they never bloat it. */
export const MEDIA_PREFIX = "doomsday.media.";
const SESSION_MS = 14 * 60 * 60 * 1000;

export interface LocalBackendOptions {
  storage: StorageLike;
  /** Where the login session is kept (defaults to `storage`). */
  sessionStore?: StorageLike;
  codec: Codec;
  /** Builds the initial data when storage is empty. */
  seed: () => DB | Promise<DB>;
  now?: () => number;
  /** Listen to `storage` events / tick timers (browser only). */
  live?: boolean;
}

/**
 * Runs the whole event in this browser. Data lives in localStorage, encrypted with AES-GCM
 * (key is a non-extractable CryptoKey in IndexedDB). Tabs of one browser sync via `storage` events.
 */
export class LocalBackend implements Backend {
  readonly mode = "local" as const;
  readonly actions: Actions;
  private db: DB | null = null;
  private view: View | null = null;
  private viewJson = "";
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private now: () => number;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private opts: LocalBackendOptions) {
    this.now = opts.now ?? (() => Date.now());
    this.actions = makeActions((m, a) => this.exec(m, a));
    this.actions.uploadImage = (name, dataUrl) => this.uploadImage(name, dataUrl);
    this.actions.deleteImage = async (id) => {
      const r = await this.exec("deleteImage", [id]);
      this.opts.storage.removeItem(MEDIA_PREFIX + id);
      return r;
    };
  }

  /** Browser-only: the image goes into this browser's storage, its details into the event data. */
  private async uploadImage(name: string, dataUrl: string): Promise<MediaMeta> {
    const meta = imageMetaFor(name, dataUrl, this.now());
    await this.exec("registerImage", [meta]);
    try {
      this.opts.storage.setItem(MEDIA_PREFIX + meta.id, dataUrl);
    } catch {
      await this.exec("deleteImage", [meta.id]).catch(() => undefined);
      throw new Error("This browser has no room left for that image. Try a smaller file.");
    }
    return meta;
  }

  mediaSrc(ref: string): string | null {
    if (ref.startsWith("upload:")) {
      try {
        return this.opts.storage.getItem(MEDIA_PREFIX + ref.slice(7));
      } catch {
        return null;
      }
    }
    return null;
  }

  async init() {
    await this.load();
    if (!this.db) {
      this.db = migrate(await this.opts.seed());
      await this.persist();
    }
    this.rebuild();
    if (this.opts.live && typeof window !== "undefined") {
      window.addEventListener("storage", this.onStorage);
      this.timer = setInterval(() => this.rebuild(), 2000);
    }
  }

  dispose() {
    if (typeof window !== "undefined") window.removeEventListener("storage", this.onStorage);
    if (this.timer) clearInterval(this.timer);
  }

  private onStorage = (e: StorageEvent) => {
    if (e.key === DB_KEY || e.key === SESSION_KEY || e.key === null) {
      void this.load().then(() => this.rebuild());
    }
  };

  private async load() {
    const raw = this.opts.storage.getItem(DB_KEY);
    if (!raw) return;
    try {
      this.db = migrate(JSON.parse(await this.opts.codec.decode(raw)));
    } catch (e) {
      console.warn("Stored event data could not be decrypted; starting over.", e);
      this.db = null;
    }
  }

  private async persist() {
    this.opts.storage.setItem(DB_KEY, await this.opts.codec.encode(JSON.stringify(this.db)));
  }

  private sessions(): StorageLike {
    return this.opts.sessionStore ?? this.opts.storage;
  }

  private sessionUser(): string | null {
    const raw = this.sessions().getItem(SESSION_KEY);
    if (!raw || !this.db) return null;
    try {
      const s = JSON.parse(raw) as { u: string; exp: number; p: string };
      const user = this.db.users.find((u) => u.id === s.u);
      if (!user || s.exp < this.now() || user.passwordHash.slice(0, 10) !== s.p) return null;
      return user.id;
    } catch {
      return null;
    }
  }

  private setSession(userId: string | null) {
    const user = userId ? this.db?.users.find((u) => u.id === userId) : null;
    if (!user) this.sessions().removeItem(SESSION_KEY);
    else
      this.sessions().setItem(
        SESSION_KEY,
        JSON.stringify({ u: user.id, exp: this.now() + SESSION_MS, p: user.passwordHash.slice(0, 10) }),
      );
  }

  private exec(method: string, args: unknown[]): Promise<unknown> {
    // Serialise actions so two quick clicks never interleave.
    const run = async () => {
      await this.load();
      if (!this.db) throw new Error("Event data is not loaded.");
      const copy = structuredClone(this.db);
      const res = await dispatch(copy, this.sessionUser(), method, args, this.now());
      if (res.mutated) {
        this.db = copy;
        await this.persist();
      }
      if (res.session) this.setSession(res.session);
      this.rebuild(true);
      return method === "exportBackup" ? res.result : scrub(res.result);
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  private rebuild(force = false) {
    if (!this.db) return;
    const v = buildView(this.db, this.sessionUser(), this.now(), "local");
    const { serverNow: _ignored, ...rest } = v;
    const json = JSON.stringify(rest);
    if (!force && json === this.viewJson) return;
    this.viewJson = json;
    this.view = v;
    this.listeners.forEach((fn) => fn());
  }

  getView() {
    return this.view;
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  async refresh() {
    await this.load();
    this.rebuild(true);
  }
  async downloadFile(url: string) {
    // The browser-only demo has no private file store; its demo files are public.
    window.open(url, "_blank", "noopener");
  }

  async logout() {
    this.setSession(null);
    this.rebuild(true);
  }
  clockOffset() {
    return 0;
  }
  online() {
    return true;
  }
  /** Test helper: raw stored value. */
  rawStored() {
    return this.opts.storage.getItem(DB_KEY);
  }
}
