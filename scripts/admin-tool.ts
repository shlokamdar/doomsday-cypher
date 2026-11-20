/**
 * Maintenance tool for the live database (Upstash). Reads credentials from .env.local
 * (`vercel env pull .env.local --environment=production`).
 *
 *   npx tsx scripts/admin-tool.ts set-admin-password <password>
 *   npx tsx scripts/admin-tool.ts add-dummy-teams <player-password>
 *   npx tsx scripts/admin-tool.ts sync-difficulty
 *   npx tsx scripts/admin-tool.ts add-dummy-challenges
 *
 * Dummy challenge flags are generated at random and written only to .secrets/live-dummy-flags.txt.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { DEFAULT_CHALLENGE_TYPES } from "../src/core/themes";
import type { ChallengeInput } from "../src/core/types";
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
if (!arg && !["sync-difficulty", "add-dummy-challenges"].includes(cmd)) throw new Error("Usage: see header");

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
} else if (cmd === "sync-difficulty") {
  console.log(
    await update(async (db) => {
      for (const d of DEFAULT_CHALLENGE_TYPES) {
        const t = db.challengeTypes.find((x) => x.id === d.id);
        if (t) Object.assign(t, { name: d.name, description: d.description });
      }
      return "Difficulty levels: " + db.challengeTypes.map((t) => t.name).join(", ");
    }),
  );
} else if (cmd === "add-dummy-challenges") {
  const tag = () => randomBytes(2).toString("hex");
  const f = {
    recon: `IAMDOOM{recon_${tag()}}`,
    b64: `IAMDOOM{postcard_${tag()}}`,
    caesar: `IAMDOOM{shifted_${tag()}}`,
    hex: `IAMDOOM{hexdump_${tag()}}`,
    sql: `IAMDOOM{lost_row_${tag()}}`,
    rev: `IAMDOOM{backwards_${tag()}}`,
  };
  const caesar = (t: string) => t.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 3) % 26) + 97));
  const inner = (x: string) => x.slice(8, -1);
  const base = { caseSensitive: false, files: [], hints: [], maxAttempts: 0 };
  const wave: ChallengeInput[] = [
    { ...base, title: "Recon Warm-up", typeId: "t-recruit", theme: "reality", points: 100, flag: f.recon,
      description: `TEST CHALLENGE. A scout left a note on a public noticeboard. It just says:

${f.recon}

Submit it to check the flag box works.` },
    { ...base, title: "Base64 Postcard", typeId: "t-recruit", theme: "signal", points: 150, flag: f.b64,
      description: `TEST CHALLENGE. A postcard arrived covered in odd letters:

${Buffer.from(f.b64).toString("base64")}`,
      hints: [{ text: "It's Base64. Any online decoder (or Python's base64 module) will do.", cost: 15 }] },
    { ...base, title: "Shift by Three", typeId: "t-agent", theme: "signal", points: 200, flag: f.caesar, maxAttempts: 5,
      description: `TEST CHALLENGE. The text inside the braces was shifted forward by three letters:

IAMDOOM{${caesar(inner(f.caesar))}}`,
      hints: [{ text: "Shift each letter back by 3 (d→a, e→b…). Underscores and digits don't move.", cost: 20 }] },
    { ...base, title: "Hex Dump", typeId: "t-agent", theme: "machine", points: 200, flag: f.hex,
      description: `TEST CHALLENGE. A drone dumped its memory as hex:

${Buffer.from(f.hex).toString("hex")}

Try: bytes.fromhex("...").decode()` },
    { ...base, title: "The Lost Row", typeId: "t-agent", theme: "archive", points: 250, flag: f.sql,
      description: `TEST CHALLENGE. Table worlds(id, name, secret):

1 | Earth-1 | nothing here
4 | Earth-4 | still nothing
7 | Earth-7 | ${f.sql}
9 | Earth-9 | nope

SELECT secret FROM worlds WHERE id = 7;`,
      hints: [{ text: "Look at the row where id = 7.", cost: 25 }, { text: "The secret column holds the flag.", cost: 40 }] },
  ];
  const single: ChallengeInput = { ...base, title: "Read It Backwards", typeId: "t-elite", theme: "machine", points: 300, flag: f.rev, maxAttempts: 3,
    description: `TEST CHALLENGE. Someone wrote the flag in reverse:

${[...f.rev].reverse().join("")}

In Python: text[::-1]`,
    hints: [{ text: "Reverse the whole string, braces included.", cost: 30 }] };
  console.log(
    await update(async (db) => {
      const admin = db.users.find((u) => u.role === "admin")!;
      const now = Date.now();
      const w = await dispatch(db, admin.id, "postWave", [wave, { mode: "now" }], now);
      await dispatch(db, admin.id, "postSingle", [single, { mode: "now" }], now);
      return `Posted wave ${w.result.number} (5 challenges) + 1 single, all live.`;
    }),
  );
  mkdirSync(".secrets", { recursive: true });
  writeFileSync(
    ".secrets/live-dummy-flags.txt",
    "Live dummy challenge flags (do not commit)\n" +
      [["Recon Warm-up", f.recon], ["Base64 Postcard", f.b64], ["Shift by Three", f.caesar], ["Hex Dump", f.hex], ["The Lost Row", f.sql], ["Read It Backwards", f.rev]]
        .map((r) => r.join("\t"))
        .join("\n") + "\n",
  );
  console.log("Flags written to .secrets/live-dummy-flags.txt");
} else throw new Error("Unknown command " + cmd);
