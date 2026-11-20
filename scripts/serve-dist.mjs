// Serves dist/ plus the bundled API (api/_lib/server.mjs) on one port, like Vercel does.
// Uses an in-memory DB with demo data. Run `npm run build:vercel` first.
//   node scripts/serve-dist.mjs [port]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { randomBytes } from "node:crypto";

process.env.DOOMSDAY_MEMORY_DB = "1";
process.env.SEED = process.env.SEED ?? "demo";
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? randomBytes(24).toString("hex");
const { stateHandler, rpcHandler } = await import("../api/_lib/server.mjs");

const root = new URL("../dist/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".txt": "text/plain", ".json": "application/json", ".mp3": "audio/mpeg" };
const port = Number(process.argv[2] ?? 4300);

createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (path === "/api/state") return void stateHandler(req, res);
  if (path === "/api/rpc") return void rpcHandler(req, res);
  const file = normalize(join(root, path === "/" ? "index.html" : decodeURIComponent(path)));
  if (!file.startsWith(normalize(root))) return void res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "X-Content-Type-Options": "nosniff" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, () => console.log(`dist + API on http://localhost:${port}`));
