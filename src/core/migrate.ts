import { UserError } from "./errors";
import { defaultHintCost } from "./logic";
import { DATA_VERSION, defaultSettings } from "./seed";
import { CUE_KEYS, defaultPopups } from "./popups";
import { DEFAULT_CHALLENGE_TYPES, THEME_IDS } from "./themes";
import type { DB } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Brings any stored DB up to DATA_VERSION.
 *
 * v1 (previous release): challenges had `released: boolean`, hints were plain strings with no
 * cost, there were no attempt limits / hidden flag, and no hint unlocks or scoreboard freeze.
 * v2: no soundboard (meme sounds per moment), no per-challenge cues or Python workspace.
 * v3: sounds per moment. v4 replaced them with image pop-ups (sounds and their cues are dropped).
 */
export function migrate(input: any): DB {
  if (!input || typeof input !== "object") throw new UserError("Not a DOOMSDAY CYPHER database.");
  const db: any = structuredClone(input);
  const from = typeof db.dataVersion === "number" ? db.dataVersion : 1;
  if (from > DATA_VERSION) throw new UserError(`Data version ${from} is newer than this app (${DATA_VERSION}).`);

  if (from < 2) {
    db.challenges = (db.challenges ?? []).map((c: any) => {
      const points = Number(c.points) || 0;
      const out = {
        ...c,
        hints: (c.hints ?? []).map((h: any) =>
          typeof h === "string" ? { text: h, cost: defaultHintCost(points) } : h,
        ),
        maxAttempts: c.maxAttempts ?? 0,
        bonusAttempts: c.bonusAttempts ?? 0,
        hidden: c.hidden ?? false,
        releaseAt: c.releaseAt !== undefined ? c.releaseAt : c.released ? (c.createdAt ?? 0) : null,
      };
      delete out.released;
      return out;
    });
    db.hintUnlocks = db.hintUnlocks ?? [];
    db.dataVersion = 2;
  }

  if (from < 3) {
    db.dataVersion = 3;
  }
  if (from < 4) {
    // Sounds were removed: drop the old soundboard and every per-challenge sound cue.
    delete db.soundboard;
    db.popups = defaultPopups();
    for (const c of db.challenges ?? []) delete c.cues;
    db.dataVersion = 4;
  }

  // Fill defaults for anything missing (robust against partial backups).
  db.users = db.users ?? [];
  db.teams = db.teams ?? [];
  db.waves = db.waves ?? [];
  db.challenges = db.challenges ?? [];
  db.submissions = db.submissions ?? [];
  db.hintUnlocks = db.hintUnlocks ?? [];
  db.notifications = db.notifications ?? [];
  db.challengeTypes = db.challengeTypes?.length ? db.challengeTypes : DEFAULT_CHALLENGE_TYPES.map((t) => ({ ...t }));
  db.settings = { ...defaultSettings(), ...(db.settings ?? {}) };
  const board = defaultPopups();
  db.popups = db.popups ?? board;
  db.popups.images = Array.isArray(db.popups.images) ? db.popups.images : [];
  db.popups.cues = { ...board.cues, ...(db.popups.cues ?? {}) };
  for (const k of CUE_KEYS) db.popups.cues[k] = db.popups.cues[k] ?? board.cues[k];
  for (const c of db.challenges) {
    if (c.theme === "void") c.theme = "archive";
    if (c.theme === "chronos") c.theme = "machine";
    if (!THEME_IDS.includes(c.theme)) c.theme = "reality";
    c.files = c.files ?? [];
    c.waveId = c.waveId ?? null;
    c.archivedAt = c.archivedAt ?? null;
  }
  db.dataVersion = DATA_VERSION;
  return db as DB;
}

/** Validates an uploaded backup. It must contain at least one admin with a password hash. */
export function validateBackup(json: string): DB {
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new UserError("Backup is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.users) || !Array.isArray(parsed.challenges)) {
    throw new UserError("Backup is missing users or challenges.");
  }
  const db = migrate(parsed);
  const admin = db.users.find((u) => u.role === "admin" && u.passwordHash && u.passwordSalt);
  if (!admin) throw new UserError("Backup must contain at least one admin account.");
  return db;
}
