/* Entry point bundled by esbuild into api/_lib/server.mjs. */
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleFile, handleRpc, handleMedia, handleState, type Req, type Res, type ServerDeps } from "./handler";
import { findUpstashConfig, MemoryStore, UpstashStore, type DbStore } from "./store";

let cached: { store: DbStore } | null = null;

export function depsFromEnv(env: Record<string, string | undefined> = process.env): ServerDeps {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("Server not configured: set SESSION_SECRET (at least 16 characters).");
  if (!cached) {
    if (env.DOOMSDAY_MEMORY_DB === "1") cached = { store: new MemoryStore() };
    else {
      const cfg = findUpstashConfig(env);
      cached = { store: new UpstashStore(cfg.url, cfg.token) };
    }
  }
  return { store: cached.store, secret, adminPassword: env.ADMIN_PASSWORD, seed: env.SEED };
}

export async function readBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body !== undefined) return req.body;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 2_000_000) throw new Error("Body too large");
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function toReq(req: IncomingMessage, body?: unknown): Req {
  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
  return { method: req.method ?? "GET", url: req.url ?? "/", headers, body };
}

export function send(res: ServerResponse, r: Res) {
  res.statusCode = r.status;
  for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
  res.end(r.base64 && r.body ? Buffer.from(r.body, "base64") : (r.body ?? ""));
}

function configError(res: ServerResponse, e: unknown) {
  send(res, {
    status: 500,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    body: JSON.stringify({ error: e instanceof Error ? e.message : "Server error." }),
  });
}

export async function stateHandler(req: IncomingMessage, res: ServerResponse) {
  let deps: ServerDeps;
  try {
    deps = depsFromEnv();
  } catch (e) {
    return configError(res, e);
  }
  send(res, await handleState(toReq(req), deps));
}

export async function fileHandler(req: IncomingMessage, res: ServerResponse) {
  let deps: ServerDeps;
  try {
    deps = depsFromEnv();
  } catch (e) {
    return configError(res, e);
  }
  send(res, await handleFile(toReq(req), deps));
}

export async function mediaHandler(req: IncomingMessage, res: ServerResponse) {
  let deps: ServerDeps;
  try {
    deps = depsFromEnv();
  } catch (e) {
    return configError(res, e);
  }
  send(res, await handleMedia(toReq(req), deps));
}

export async function rpcHandler(req: IncomingMessage, res: ServerResponse) {
  let deps: ServerDeps;
  try {
    deps = depsFromEnv();
  } catch (e) {
    return configError(res, e);
  }
  let body: unknown;
  try {
    body = await readBody(req as IncomingMessage & { body?: unknown });
  } catch {
    return send(res, { status: 413, headers: { "Content-Type": "application/json" }, body: '{"error":"Request too large."}' });
  }
  send(res, await handleRpc(toReq(req, body), deps));
}
