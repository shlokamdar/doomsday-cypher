/**
 * Database adapters for the server. One key holds the DB JSON; a meta key holds
 * "<version>|<comma-separated times>" (times when the view changes on its own).
 */
export interface DbStore {
  readMeta(): Promise<string | null>;
  read(): Promise<{ db: string | null; meta: string | null }>;
  /** Writes db+meta only if the stored version still equals `expectedVersion`. */
  cas(expectedVersion: string, db: string, meta: string): Promise<boolean>;
  /** Large values kept outside the DB (pop-up images, files), so polling never downloads them. */
  getBlob(key: string): Promise<string | null>;
  putBlob(key: string, value: string): Promise<void>;
  delBlob(key: string): Promise<void>;
}

export const DB_KEY = "doomsday:db";
export const META_KEY = "doomsday:meta";
export const mediaKey = (id: string) => `doomsday:media:${id}`;
/** Private challenge files (handouts). Stored as JSON {name, type, b64}. */
export const fileKey = (id: string) => `doomsday:file:${id}`;
export const isFileId = (id: unknown): id is string => typeof id === "string" && /^[a-z0-9]{12,40}$/.test(id);

export function parseMeta(meta: string | null): { version: string; times: number[] } {
  if (!meta) return { version: "0", times: [] };
  const [version, times = ""] = meta.split("|");
  return {
    version: version || "0",
    times: times
      .split(",")
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n)),
  };
}

export function formatMeta(version: string, times: number[]): string {
  return `${version}|${times.join(",")}`;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** In-memory store (tests, `npm run api:dev`). Async on purpose so concurrent writes interleave. */
export class MemoryStore implements DbStore {
  db: string | null = null;
  meta: string | null = null;
  reads = 0;
  writes = 0;
  async readMeta() {
    await tick();
    return this.meta;
  }
  async read() {
    await tick();
    this.reads++;
    return { db: this.db, meta: this.meta };
  }
  async cas(expected: string, db: string, meta: string) {
    await tick();
    if (parseMeta(this.meta).version !== expected) return false;
    this.db = db;
    this.meta = meta;
    this.writes++;
    return true;
  }
  blobs = new Map<string, string>();
  async getBlob(key: string) {
    await tick();
    return this.blobs.get(key) ?? null;
  }
  async putBlob(key: string, value: string) {
    await tick();
    this.blobs.set(key, value);
  }
  async delBlob(key: string) {
    await tick();
    this.blobs.delete(key);
  }
}

/* ---------------- Upstash Redis over REST (no SDK) ---------------- */

const CAS_SCRIPT = `
local m = redis.call('GET', KEYS[2])
local v = '0'
if m then v = string.match(m, '^([^|]*)') or '0' end
if v ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3])
return 1
`;

export class UpstashStore implements DbStore {
  constructor(
    private url: string,
    private token: string,
    private f: typeof fetch = fetch,
  ) {
    this.url = url.replace(/\/+$/, "");
  }

  private async cmd(command: (string | number)[]): Promise<unknown> {
    const res = await this.f(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    const body = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
    if (!res.ok || body.error) throw new Error(`Upstash error: ${body.error ?? res.status}`);
    return body.result;
  }

  private async pipeline(commands: (string | number)[][]): Promise<unknown[]> {
    const res = await this.f(`${this.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
    });
    const body = (await res.json().catch(() => [])) as { result?: unknown; error?: string }[];
    if (!res.ok || !Array.isArray(body)) throw new Error(`Upstash error: ${res.status}`);
    return body.map((r) => {
      if (r.error) throw new Error(`Upstash error: ${r.error}`);
      return r.result;
    });
  }

  async readMeta() {
    return (await this.cmd(["GET", META_KEY])) as string | null;
  }

  async read() {
    const [db, meta] = await this.pipeline([
      ["GET", DB_KEY],
      ["GET", META_KEY],
    ]);
    return { db: db as string | null, meta: meta as string | null };
  }

  async cas(expected: string, db: string, meta: string) {
    const r = await this.cmd(["EVAL", CAS_SCRIPT, 2, DB_KEY, META_KEY, expected, db, meta]);
    return Number(r) === 1;
  }

  async getBlob(key: string) {
    return (await this.cmd(["GET", key])) as string | null;
  }
  async putBlob(key: string, value: string) {
    await this.cmd(["SET", key, value]);
  }
  async delBlob(key: string) {
    await this.cmd(["DEL", key]);
  }
}

/**
 * Finds Upstash REST credentials under any name Vercel's integrations generate:
 *  1. `*REST_API_URL` + `*REST_API_TOKEN` (ignoring READ_ONLY tokens), e.g. KV_REST_API_URL
 *  2. any `*_URL` holding an https://…upstash.io URL with a matching `*_TOKEN`
 *  3. a `rediss://default:<token>@<host>` URL
 */
export function findUpstashConfig(env: Record<string, string | undefined>): { url: string; token: string; source: string } {
  const keys = Object.keys(env).filter((k) => env[k]);
  for (const k of keys) {
    if (k.endsWith("REST_API_URL") && !k.includes("READ_ONLY")) {
      const tk = k.slice(0, -"REST_API_URL".length) + "REST_API_TOKEN";
      if (env[tk]) return { url: env[k]!, token: env[tk]!, source: k };
    }
  }
  for (const k of keys) {
    const v = env[k]!;
    if (k.endsWith("_URL") && !k.includes("READ_ONLY") && /^https:\/\/[^/]+\.upstash\.io/i.test(v)) {
      const tk = k.slice(0, -"_URL".length) + "_TOKEN";
      if (env[tk]) return { url: v, token: env[tk]!, source: k };
    }
  }
  for (const k of keys) {
    const m = /^rediss:\/\/[^:]*:([^@]+)@([^:/]+)(?::\d+)?/i.exec(env[k]!);
    if (m && !k.includes("READ_ONLY")) return { url: `https://${m[2]}`, token: decodeURIComponent(m[1]), source: k };
  }
  const seen = keys.filter((k) => /REDIS|KV|UPSTASH|DATABASE|STORAGE|_URL$|_TOKEN$/i.test(k));
  throw new Error(
    "No Upstash Redis credentials found. Connect Storage → Upstash for Redis in Vercel and redeploy. " +
      `Database-looking variables seen: ${seen.length ? seen.join(", ") : "(none)"}.`,
  );
}
