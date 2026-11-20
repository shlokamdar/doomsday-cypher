/**
 * Maintenance tool for the live database (Upstash). Reads credentials from .env.local
 * (`vercel env pull .env.local --environment=production`).
 *
 *   npx tsx scripts/admin-tool.ts set-admin-password <password>
 *   npx tsx scripts/admin-tool.ts add-dummy-teams <player-password>
 */
import { readFileSync } from "node:fs";
import { hashPassword, newSalt } from "../src/core/crypto";
import { dispatch } from "../src/core/engine";
import { migrate } from "../src/core/migrate";
import type { DB } from "../src/core/types";
import { upcomingTimes } from "../src/core/view";
import { findUpstashConfig, formatMeta, parseMeta, UpstashStore } from "../src/server/store";

const env: Record<string, string> = { ...(process.env as Record<string, string>) };
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line);
    if (m) env[m[1]] = m[2];
  }
} catch {
  /* fall back to process env */
}
const cfg = findUpstashConfig(env);
const store = new UpstashStore(cfg.url, cfg.token);

async function update(fn: (db: DB) => Promise<string>) {
  for (let i = 0; i < 6; i++) {
    const { db: raw, meta } = await store.read();
    if (!raw) throw new Error("No database yet: open the site once first.");
    const db = migrate(JSON.parse(raw));
    const msg = await fn(db);
    const { version } = parseMeta(meta);
    const next = String(Number(version) + 1);
    if (await store.cas(version, JSON.stringify(db), formatMeta(next, upcomingTimes(db, Date.now())))) return msg;
  }
  throw new Error("Busy, try again.");
}

const [cmd, arg] = process.argv.slice(2);
if (!arg) throw new Error("Usage: set-admin-password <pw> | add-dummy-teams <pw>");

if (cmd === "set-admin-password") {
  console.log(
    await update(async (db) => {
      const admin = db.users.find((u) => u.role === "admin" && u.username === "admin");
      if (!admin) throw new Error("No admin user.");
      admin.passwordSalt = newSalt();
      admin.passwordHash = await hashPassword(arg, admin.passwordSalt);
      admin.mustChangePassword = false;
      return "Admin password updated (old sessions logged out).";
    }),
  );
} else if (cmd === "add-dummy-teams") {
  console.log(
    await update(async (db) => {
      const admin = db.users.find((u) => u.role === "admin")!;
      const out: string[] = [];
      const teams: [string, string[]][] = [
        ["Test Team Alpha", ["Alpha One", "Alpha Two", "Alpha Three"]],
        ["Test Team Beta", ["Beta One", "Beta Two", "Beta Three"]],
      ];
      for (const [name, members] of teams) {
        if (db.teams.some((t) => t.name === name)) {
          out.push(`${name} already exists, skipped`);
          continue;
        }
        const { result } = await dispatch(db, admin.id, "createTeam", [name, members], Date.now());
        for (const c of result.credentials as { userId: string; username: string }[]) {
          const u = db.users.find((x) => x.id === c.userId)!;
          u.passwordSalt = newSalt();
          u.passwordHash = await hashPassword(arg, u.passwordSalt);
          u.mustChangePassword = false;
          out.push(`${name}: ${c.username}`);
        }
      }
      return out.join("\n");
    }),
  );
} else throw new Error("Unknown command " + cmd);
