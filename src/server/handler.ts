import { sha256Hex } from "../core/crypto";
import { dispatch, METHODS, testerPasswordOk } from "../core/engine";
import { isUserError, UserError } from "../core/errors";
import { migrate } from "../core/migrate";
import { demoDbWithAdminPassword, freshDb } from "../core/seed";
import type { DB } from "../core/types";
import { buildView, scrub, upcomingTimes } from "../core/view";
import { signToken, verifyToken } from "./session";
import { imageMetaFor, isMediaId } from "../core/popups";
import { fileKey, formatMeta, isFileId, mediaKey, parseMeta, type DbStore } from "./store";

export interface ServerDeps {
  store: DbStore;
  secret: string;
  adminPassword?: string;
  seed?: string;
  now?: () => number;
}

export interface Req {
  method: string;
  url: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
}

export interface Res {
  status: number;
  headers: Record<string, string>;
  body?: string;
  /** The body is base64 and should be sent as bytes. */
  base64?: boolean;
}

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(status: number, data: unknown, extra: Record<string, string> = {}): Res {
  return {
    status,
    headers: { ...BASE_HEADERS, "Content-Type": "application/json; charset=utf-8", ...extra },
    body: JSON.stringify(data),
  };
}

function bearer(req: Req): string | null {
  const h = req.headers["authorization"] ?? req.headers["Authorization"];
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

const MAX_RETRIES = 6;

/** Loads (and if needed creates) the database. Returns the parsed DB and its version. */
async function load(deps: ServerDeps, now: number): Promise<{ db: DB; version: string }> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const { db: raw, meta } = await deps.store.read();
    const { version } = parseMeta(meta);
    if (raw) return { db: migrate(JSON.parse(raw)), version };
    // First run: create the event.
    let db: DB;
    if ((deps.seed ?? "").toLowerCase() === "demo") db = await demoDbWithAdminPassword(deps.adminPassword, now);
    else {
      if (!deps.adminPassword) throw new UserError("Server not configured: set ADMIN_PASSWORD and redeploy.", 500);
      db = await freshDb(deps.adminPassword, now);
    }
    const next = String(Number(version) + 1);
    if (await deps.store.cas(version, JSON.stringify(db), formatMeta(next, upcomingTimes(db, now)))) return { db, version: next };
  }
  throw new UserError("The server is busy. Try again.", 503);
}

function errorRes(e: unknown): Res {
  if (isUserError(e)) return json(e.status, { error: e.message });
  console.error(e);
  const msg = e instanceof Error && /Upstash|credentials/i.test(e.message) ? e.message : "Server error.";
  return json(500, { error: msg });
}

/** GET /api/state?v=<version>&t=<lastFetchMs> */
export async function handleState(req: Req, deps: ServerDeps): Promise<Res> {
  try {
    if (req.method !== "GET") return json(405, { error: "Method not allowed." });
    const now = (deps.now ?? Date.now)();
    const url = new URL(req.url, "http://local");
    const v = url.searchParams.get("v");
    const t = Number(url.searchParams.get("t"));

    // Cheap path: same version and no scheduled moment crossed since the caller's last fetch.
    if (v) {
      const meta = parseMeta(await deps.store.readMeta());
      const crossed = meta.times.some((x) => Number.isFinite(t) && x > t && x <= now);
      if (meta.version === v && !crossed) {
        return { status: 204, headers: { ...BASE_HEADERS, "X-Version": meta.version, "X-Server-Now": String(now) } };
      }
    }

    const { db, version } = await load(deps, now);
    const token = bearer(req);
    const userId = await verifyToken(deps.secret, token, db, now);
    const view = buildView(db, userId, now, version, !!token && !userId);
    const { serverNow: _n, version: _v, ...stable } = view;
    const etag = `"${(await sha256Hex(JSON.stringify(stable))).slice(0, 32)}"`;
    const inm = req.headers["if-none-match"] ?? req.headers["If-None-Match"];
    if (inm && inm === etag) {
      return { status: 204, headers: { ...BASE_HEADERS, ETag: etag, "X-Version": version, "X-Server-Now": String(now) } };
    }
    return json(200, view, { ETag: etag });
  } catch (e) {
    return errorRes(e);
  }
}

/** GET /api/media?id=img-… : an uploaded pop-up image. Images aren't secret, so they're cached. */
export async function handleMedia(req: Req, deps: ServerDeps): Promise<Res> {
  try {
    if (req.method !== "GET") return json(405, { error: "Method not allowed." });
    const id = new URL(req.url, "http://local").searchParams.get("id");
    const notFound: Res = { status: 404, headers: { ...BASE_HEADERS, "Content-Type": "text/plain" }, body: "Not found" };
    if (!isMediaId(id)) return notFound;
    const dataUrl = await deps.store.getBlob(mediaKey(id));
    const m = dataUrl ? /^data:(image\/(?:png|jpeg|gif|webp));base64,(.*)$/i.exec(dataUrl) : null;
    if (!m) return notFound;
    return {
      status: 200,
      headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
      body: m[2],
      base64: true,
    };
  } catch (e) {
    return errorRes(e);
  }
}

/**
 * GET /api/file?id=<id> with the player's Bearer token. A file is only served to Admin, or to a
 * logged-in player who can currently see a challenge that links to it (so handouts never leak
 * before release, and never sit in the public repo).
 */
export async function handleFile(req: Req, deps: ServerDeps): Promise<Res> {
  const notFound: Res = { status: 404, headers: { ...BASE_HEADERS, "Content-Type": "text/plain" }, body: "Not found" };
  try {
    if (req.method !== "GET") return json(405, { error: "Method not allowed." });
    const id = new URL(req.url, "http://local").searchParams.get("id");
    if (!isFileId(id)) return notFound;
    const now = (deps.now ?? Date.now)();
    const { db } = await load(deps, now);
    const userId = await verifyToken(deps.secret, bearer(req), db, now);
    // The testing page (/all-challenge-view) sends its password in a header instead of a login.
    const tester = await testerPasswordOk(db, req.headers["x-tester-password"]);
    if (!userId && !tester) return json(401, { error: "Please log in to download challenge files." });
    const user = userId ? db.users.find((u) => u.id === userId) : undefined;
    const url = `/api/file?id=${id}`;
    const allowed =
      tester ||
      user?.role === "admin" ||
      (!!userId && buildView(db, userId, now).challenges.some((c) => c.files.some((f) => f.url === url)));
    if (!allowed) return notFound;
    const raw = await deps.store.getBlob(fileKey(id));
    if (!raw) return notFound;
    const f = JSON.parse(raw) as { name: string; type: string; b64: string };
    const safeName = f.name.replace(/["\\\r\n]/g, "_");
    return {
      status: 200,
      headers: {
        ...BASE_HEADERS,
        "Content-Type": f.type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      },
      body: f.b64,
      base64: true,
    };
  } catch (e) {
    return errorRes(e);
  }
}

/** Methods the browser may not call directly (the server calls them for it). */
const INTERNAL = new Set(["registerImage"]);

/**
 * Pop-up images: the bytes go into their own database entry and only the details into the event data,
 * so the polled state stays small.
 */
async function mediaRpc(method: string, args: unknown[], token: string | null, deps: ServerDeps): Promise<Res> {
  const now = (deps.now ?? Date.now)();
  const { db } = await load(deps, now);
  const actorId = await verifyToken(deps.secret, token, db, now);
  const actor = actorId ? db.users.find((u) => u.id === actorId) : undefined;
  if (!actor) return json(401, { error: "Please log in again." });
  if (actor.role !== "admin") return json(403, { error: "Admin only." });
  if (method === "uploadImage") {
    const meta = imageMetaFor(args[0], args[1], now);
    await deps.store.putBlob(mediaKey(meta.id), args[1] as string);
    const r = await handleRpc({ method: "POST", url: "/api/rpc", headers: { authorization: `Bearer ${token}` }, body: { method: "registerImage", args: [meta] } }, deps, true);
    if (r.status !== 200) await deps.store.delBlob(mediaKey(meta.id));
    else r.body = JSON.stringify({ result: meta });
    return r;
  }
  const r = await handleRpc({ method: "POST", url: "/api/rpc", headers: { authorization: `Bearer ${token}` }, body: { method: "deleteImage", args } }, deps, true);
  if (r.status === 200 && isMediaId(args[0])) await deps.store.delBlob(mediaKey(args[0]));
  return r;
}

/** POST /api/rpc { method, args } */
export async function handleRpc(req: Req, deps: ServerDeps, internal = false): Promise<Res> {
  try {
    if (req.method !== "POST") return json(405, { error: "Method not allowed." });
    let body = req.body as { method?: unknown; args?: unknown } | string | undefined;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return json(400, { error: "Bad request." });
      }
    }
    const method = (body as { method?: unknown })?.method;
    const args = (body as { args?: unknown })?.args ?? [];
    if (!internal && (method === "uploadImage" || method === "deleteImage")) {
      if (!Array.isArray(args)) return json(400, { error: "Bad request." });
      return await mediaRpc(method, args, bearer(req), deps);
    }
    if (!internal && INTERNAL.has(method as string)) return json(400, { error: "Unknown action." });
    if (typeof method !== "string" || !Object.prototype.hasOwnProperty.call(METHODS, method)) {
      return json(400, { error: "Unknown action." });
    }
    if (!Array.isArray(args) || args.length > 10) return json(400, { error: "Bad request." });
    const token = bearer(req);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const now = (deps.now ?? Date.now)();
      const { db, version } = await load(deps, now);
      const actorId = await verifyToken(deps.secret, token, db, now);
      if (token && !actorId && METHODS[method].auth !== "none") return json(401, { error: "Your session has ended. Please log in again." });
      const res = await dispatch(db, actorId, method, args, now);
      if (res.mutated) {
        const next = String(Number(version) + 1);
        const ok = await deps.store.cas(version, JSON.stringify(db), formatMeta(next, upcomingTimes(db, now)));
        if (!ok) continue; // someone else wrote first: re-run against fresh data
      }
      const out: Record<string, unknown> = {
        result: method === "exportBackup" ? res.result : scrub(res.result),
      };
      if (res.session) {
        const user = db.users.find((u) => u.id === res.session);
        if (user) out.token = await signToken(deps.secret, user.id, user.passwordHash, now);
      }
      return json(200, out);
    }
    return json(409, { error: "Lots of activity right now. Please try again." });
  } catch (e) {
    return errorRes(e);
  }
}
