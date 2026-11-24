/* `npm run api:dev` — local API on :8787 with an in-memory DB and demo data. */
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { rpcHandler, soundHandler, stateHandler } from "./vercel";

process.env.DOOMSDAY_MEMORY_DB = "1";
process.env.SEED = process.env.SEED ?? "demo";
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? randomBytes(24).toString("hex");

const port = Number(process.env.PORT ?? 8787);
createServer((req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (path === "/api/state") return void stateHandler(req, res);
  if (path === "/api/rpc") return void rpcHandler(req, res);
  if (path === "/api/sound") return void soundHandler(req, res);
  res.statusCode = 404;
  res.end("Not found");
}).listen(port, () => {
  console.log(`DOOMSDAY CYPHER API (in-memory, SEED=${process.env.SEED}) on http://localhost:${port}`);
});
