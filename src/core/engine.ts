import { hashFlag, hashPassword, newId, newSalt, safeEqual, tempPassword } from "./crypto";
import { parseSquadCsv, type RowError } from "./csv";
import { UserError } from "./errors";
import { attemptInfo, clockName, clockPhase, MINUTE } from "./logic";
import { validateBackup } from "./migrate";
import { DATA_VERSION, demoDb, emptyDb } from "./seed";
import { checkCue, checkCues, CUE_KEYS, defaultSoundboard, isSoundId } from "./sounds";
import { THEME_IDS } from "./themes";
import type {
  Challenge,
  ChallengeInput,
  ChallengeType,
  Credential,
  CueKey,
  DB,
  NotificationLevel,
  Release,
  SoundMeta,
  SubmitResult,
  Team,
  User,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The rules engine. Both LocalBackend (browser) and the server call `dispatch`, so behaviour is
 * identical in demo and live mode. Handlers mutate `ctx.db` in place.
 *
 * A handler may return `{ __session: userId }` to ask the caller to (re)issue a session.
 */
export interface Ctx {
  db: DB;
  actor: User | null;
  now: number;
}

type Auth = "none" | "user" | "player" | "admin";
interface MethodSpec {
  auth: Auth;
  readonly?: boolean;
  fn: (ctx: Ctx, ...args: any[]) => any;
}

/* ---------------- input validation ---------------- */

function str(v: unknown, name: string, max = 200, allowEmpty = false): string {
  if (typeof v !== "string") throw new UserError(`${name} must be text.`);
  const t = v.trim();
  if (!allowEmpty && !t) throw new UserError(`${name} is required.`);
  if (t.length > max) throw new UserError(`${name} is too long (max ${max} characters).`);
  return t;
}
function int(v: unknown, name: string, min: number, max: number): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max)
    throw new UserError(`${name} must be a whole number from ${min} to ${max}.`);
  return n;
}
function bool(v: unknown, name: string): boolean {
  if (typeof v !== "boolean") throw new UserError(`${name} must be true or false.`);
  return v;
}
function time(v: unknown, name: string): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new UserError(`${name} must be a time.`);
  return Math.round(v);
}

/* ---------------- helpers ---------------- */

function findChallenge(db: DB, id: unknown): Challenge {
  const c = db.challenges.find((x) => x.id === id);
  if (!c) throw new UserError("Challenge not found.", 404);
  return c;
}
function findTeam(db: DB, id: unknown): Team {
  const t = db.teams.find((x) => x.id === id);
  if (!t) throw new UserError("Team not found.", 404);
  return t;
}
function notify(db: DB, now: number, title: string, body: string, level: NotificationLevel = "info") {
  db.notifications.push({ id: newId("n-"), title, body, level, at: now });
}
function liveFor(c: Challenge, now: number) {
  return !c.archivedAt && c.releaseAt !== null && c.releaseAt <= now && !c.hidden;
}
function notArchived(c: Challenge) {
  if (c.archivedAt) throw new UserError(`"${c.title}" is archived. Restore it first.`);
  return c;
}

function makeUsername(db: DB, displayName: string, taken: Set<string>): string {
  const base =
    displayName
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 24) || "agent";
  const exists = (u: string) => taken.has(u) || db.users.some((x) => x.username === u);
  let name = base;
  for (let i = 2; exists(name); i++) name = `${base}${i}`;
  taken.add(name);
  return name;
}

async function newMember(db: DB, team: Team, displayName: string, now: number, taken: Set<string>): Promise<Credential> {
  const password = tempPassword();
  const salt = newSalt();
  const user: User = {
    id: newId("u-"),
    username: makeUsername(db, displayName, taken),
    displayName,
    role: "player",
    teamId: team.id,
    passwordSalt: salt,
    passwordHash: await hashPassword(password, salt),
    mustChangePassword: true,
    createdAt: now,
  };
  db.users.push(user);
  return { userId: user.id, teamName: team.name, displayName, username: user.username, password };
}

async function createTeamIn(db: DB, nameRaw: unknown, membersRaw: unknown, now: number): Promise<{ teamId: string; credentials: Credential[] }> {
  const name = str(nameRaw, "Team name", 60);
  if (db.teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) throw new UserError(`A team called "${name}" already exists.`);
  if (!Array.isArray(membersRaw)) throw new UserError("Members must be a list.");
  const members = membersRaw.map((m, i) => str(m, `Member ${i + 1}`, 60, true)).filter(Boolean);
  if (!members.length) throw new UserError("Add at least one member.");
  if (members.length > db.settings.teamSize) throw new UserError(`Teams have at most ${db.settings.teamSize} members.`);
  const team: Team = { id: newId("s-"), name, createdAt: now };
  db.teams.push(team);
  const taken = new Set<string>();
  const credentials: Credential[] = [];
  for (const m of members) credentials.push(await newMember(db, team, m, now, taken));
  return { teamId: team.id, credentials };
}

async function buildChallenge(db: DB, raw: any, now: number, existing?: Challenge): Promise<Challenge> {
  if (!raw || typeof raw !== "object") throw new UserError("Challenge details are missing.");
  const title = str(raw.title, "Title", 120);
  const points = int(raw.points, "Points", 1, 100000);
  const typeId = str(raw.typeId, "Category", 60);
  if (!db.challengeTypes.some((t) => t.id === typeId)) throw new UserError("Unknown category.");
  const theme = str(raw.theme, "Theme", 20);
  if (!THEME_IDS.includes(theme as any)) throw new UserError("Unknown theme.");
  const description = str(raw.description ?? "", "Description", 5000, true);
  const caseSensitive = raw.caseSensitive === undefined ? false : bool(raw.caseSensitive, "Case-sensitive");
  const maxAttempts = int(raw.maxAttempts ?? 0, "Attempts per team", 0, 1000);
  if (!Array.isArray(raw.hints ?? [])) throw new UserError("Hints must be a list.");
  const hints = (raw.hints ?? []).map((h: any, i: number) => ({
    text: str(h?.text, `Hint ${i + 1}`, 1000),
    cost: int(h?.cost ?? 0, `Hint ${i + 1} cost`, 0, 100000),
  }));
  if (!Array.isArray(raw.files ?? [])) throw new UserError("Files must be a list.");
  const files = (raw.files ?? []).map((f: any, i: number) => {
    const url = str(f?.url, `File ${i + 1} link`, 1000);
    if (!/^(https?:\/\/|\/|files\/)/i.test(url)) throw new UserError(`File ${i + 1} link must start with https:// or /.`);
    return { name: str(f?.name, `File ${i + 1} name`, 120), url };
  });
  const cues = checkCues(raw.cues, db.soundboard.sounds);
  let python: Challenge["python"];
  if (raw.python && typeof raw.python === "object" && raw.python.enabled) {
    const starter = typeof raw.python.starter === "string" ? raw.python.starter : "";
    if (starter.length > 20000) throw new UserError("Starter code is too long (max 20,000 characters).");
    python = { enabled: true, starter };
  }
  const flag = typeof raw.flag === "string" ? raw.flag.trim() : "";
  if (flag.length > 500) throw new UserError("Flag is too long.");
  let flagHash = existing?.flagHash ?? "";
  let flagSalt = existing?.flagSalt ?? "";
  if (flag) {
    flagSalt = newSalt();
    flagHash = await hashFlag(flag, caseSensitive, flagSalt);
  } else if (!existing) {
    throw new UserError("Flag is required.");
  } else if (existing.caseSensitive !== caseSensitive) {
    throw new UserError("Re-enter the flag to change case sensitivity.");
  }
  return {
    id: existing?.id ?? newId("c-"),
    waveId: existing?.waveId ?? null,
    typeId,
    theme: theme as Challenge["theme"],
    title,
    description,
    points,
    flagHash,
    flagSalt,
    caseSensitive,
    files,
    hints,
    maxAttempts,
    bonusAttempts: existing?.bonusAttempts ?? 0,
    hidden: existing?.hidden ?? false,
    releaseAt: existing ? existing.releaseAt : null,
    ...(cues ? { cues } : {}),
    ...(python ? { python } : {}),
    createdAt: existing?.createdAt ?? now,
  };
}

function releaseTime(release: any, now: number): number | null {
  if (!release || typeof release !== "object") throw new UserError("Choose when to release.");
  const r = release as Release;
  if (r.mode === "now") return now;
  if (r.mode === "draft") return null;
  if (r.mode === "schedule") {
    const at = time(r.at, "Release time");
    if (at <= now) throw new UserError("Scheduled time must be in the future.");
    return at;
  }
  throw new UserError("Unknown release option.");
}

function replaceDb(target: DB, next: DB) {
  for (const k of Object.keys(target)) delete (target as any)[k];
  Object.assign(target, next);
}

function teamSolved(db: DB, teamId: string, challengeId: string) {
  return db.submissions.some((s) => s.teamId === teamId && s.challengeId === challengeId && s.correct);
}

/* ---------------- methods (the RPC whitelist) ---------------- */

export const METHODS: Record<string, MethodSpec> = {
  /* ---- auth ---- */
  login: {
    auth: "none",
    readonly: true,
    async fn({ db }, teamId: unknown, usernameRaw: unknown, passwordRaw: unknown) {
      const username = typeof usernameRaw === "string" ? usernameRaw.trim().toLowerCase() : "";
      const password = typeof passwordRaw === "string" ? passwordRaw : "";
      // Members pick their own name on the login page, which sends their id; Admin types a username.
      const byId = teamId !== null && teamId !== undefined && typeof usernameRaw === "string" ? db.users.find((u) => u.id === usernameRaw) : undefined;
      const user = byId ?? db.users.find((u) => u.username === username);
      const fail = () => new UserError("Wrong team, name or password.", 401);
      if (!user) {
        await hashPassword(password, newSalt()); // keep timing similar
        throw fail();
      }
      const hash = await hashPassword(password, user.passwordSalt);
      const okPw = safeEqual(hash, user.passwordHash);
      const okRole = teamId === null || teamId === undefined ? user.role === "admin" : user.role === "player" && user.teamId === teamId;
      if (!okPw || !okRole) throw fail();
      return { __session: user.id, mustChangePassword: user.mustChangePassword && db.settings.forcePasswordChange };
    },
  },
  changePassword: {
    auth: "user",
    async fn({ actor }, oldPw: unknown, newPw: unknown) {
      const user = actor!;
      const next = typeof newPw === "string" ? newPw : "";
      if (next.length < 8) throw new UserError("New password must be at least 8 characters.");
      if (next.length > 200) throw new UserError("New password is too long.");
      const old = await hashPassword(typeof oldPw === "string" ? oldPw : "", user.passwordSalt);
      if (!safeEqual(old, user.passwordHash)) throw new UserError("Current password is wrong.");
      if (next === oldPw) throw new UserError("Choose a different password.");
      user.passwordSalt = newSalt();
      user.passwordHash = await hashPassword(next, user.passwordSalt);
      user.mustChangePassword = false;
      return { __session: user.id };
    },
  },

  /* ---- players ---- */
  submitFlag: {
    auth: "player",
    async fn({ db, actor, now }, challengeId: unknown, valueRaw: unknown): Promise<SubmitResult> {
      const user = actor!;
      const teamId = user.teamId!;
      const c = db.challenges.find((x) => x.id === challengeId);
      if (!c || !liveFor(c, now)) throw new UserError("Challenge not found.", 404);
      const phase = clockPhase(db.settings, now);
      if (phase === "idle") throw new UserError("Flags open when the timer starts.");
      if (phase === "ended") throw new UserError("Time's up.");
      const value = typeof valueRaw === "string" ? valueRaw.trim() : "";
      if (!value) throw new UserError("Enter a flag.");
      if (value.length > 500) throw new UserError("That flag is far too long.");
      const info = () => attemptInfo(c, teamId, db.submissions);
      if (teamSolved(db, teamId, c.id)) {
        return { correct: true, alreadySolved: true, points: 0, title: c.title, attemptsLeft: info().left };
      }
      if (info().left === 0) throw new UserError("Out of attempts. An admin can grant more.");
      const recent = db.submissions.filter((s) => s.teamId === teamId && s.challengeId === c.id && s.at > now - MINUTE).length;
      if (recent >= db.settings.submissionsPerMinute)
        throw new UserError(`Slow down: your team can try ${db.settings.submissionsPerMinute} flags per minute on this challenge.`, 429);
      const hash = await hashFlag(value, c.caseSensitive, c.flagSalt);
      const correct = safeEqual(hash, c.flagHash);
      db.submissions.push({
        id: newId("sub-"),
        userId: user.id,
        teamId,
        challengeId: c.id,
        value: correct ? "(correct flag)" : value,
        correct,
        at: now,
      });
      return { correct, points: correct ? c.points : 0, title: c.title, attemptsLeft: info().left };
    },
  },
  unlockHint: {
    auth: "player",
    fn({ db, actor, now }, challengeId: unknown, indexRaw: unknown) {
      const user = actor!;
      const c = db.challenges.find((x) => x.id === challengeId);
      if (!c || !liveFor(c, now)) throw new UserError("Challenge not found.", 404);
      const phase = clockPhase(db.settings, now);
      if (phase === "idle") throw new UserError("Hints open when the event clock starts.");
      if (phase === "ended") throw new UserError("Time's up.");
      const index = int(indexRaw, "Hint", 0, c.hints.length - 1);
      const existing = db.hintUnlocks.find((h) => h.teamId === user.teamId && h.challengeId === c.id && h.index === index);
      if (existing) return { already: true };
      db.hintUnlocks.push({ teamId: user.teamId!, userId: user.id, challengeId: c.id, index, cost: c.hints[index].cost, at: now });
      return { already: false };
    },
  },

  /* ---- Admin: clock ---- */
  clockStart: {
    auth: "admin",
    fn({ db, now }) {
      const d = db.settings.durationMinutes;
      db.settings.startsAt = now;
      // durationMinutes 0 = no time limit: the event runs until Admin presses "End now".
      db.settings.endsAt = d > 0 ? now + d * MINUTE : null;
      notify(
        db,
        now,
        "The Timer is ticking",
        d > 0 ? `The ${clockName(d)} is running. Solve every challenge you can.` : "The event has started. There's no time limit: the organisers will end it.",
        "important",
      );
    },
  },
  clockAddMinutes: {
    auth: "admin",
    fn({ db, now }, minutes: unknown) {
      const m = int(minutes, "Minutes", 1, 600);
      if (db.settings.startsAt === null) throw new UserError("Start the clock first.");
      if (db.settings.endsAt === null) throw new UserError("The event has no time limit, so there's nothing to extend.");
      db.settings.endsAt = Math.max(db.settings.endsAt, now) + m * MINUTE;
      notify(db, now, `+${m} minutes on the timer`, "The organisers added more time to the clock.");
    },
  },
  clockEnd: {
    auth: "admin",
    fn({ db, now }) {
      if (db.settings.startsAt === null) throw new UserError("The clock has not started.");
      db.settings.endsAt = db.settings.endsAt === null ? now : Math.min(db.settings.endsAt, now);
      if (db.settings.startsAt > now) db.settings.startsAt = now;
      notify(db, now, "Time's up", "The Timer has hit zero. Flags are closed.", "important");
    },
  },
  /** Turns a running timed clock into one with no time limit. */
  clockRemoveLimit: {
    auth: "admin",
    fn({ db, now }) {
      if (clockPhase(db.settings, now) !== "running") throw new UserError("The clock isn't running.");
      db.settings.endsAt = null;
      db.settings.durationMinutes = 0;
      notify(db, now, "No time limit", "The organisers removed the time limit. The event runs until they end it.");
    },
  },
  clockReset: {
    auth: "admin",
    fn({ db }) {
      db.settings.startsAt = null;
      db.settings.endsAt = null;
    },
  },

  /* ---- Admin: challenges ---- */
  saveChallenge: {
    auth: "admin",
    async fn({ db, now }, input: unknown) {
      const raw = input as ChallengeInput;
      const existing = raw?.id ? findChallenge(db, raw.id) : undefined;
      const c = await buildChallenge(db, raw, now, existing);
      if (existing) Object.assign(existing, c);
      else db.challenges.push(c);
      return { id: c.id };
    },
  },
  postWave: {
    auth: "admin",
    async fn({ db, now }, inputs: unknown, release: unknown) {
      if (!Array.isArray(inputs) || inputs.length !== 5) throw new UserError("An wave has exactly 5 challenges.");
      const releaseAt = releaseTime(release, now);
      const built: Challenge[] = [];
      for (let i = 0; i < 5; i++) {
        try {
          built.push(await buildChallenge(db, { ...(inputs[i] as object), id: undefined }, now));
        } catch (e) {
          throw new UserError(`Challenge ${i + 1}: ${(e as Error).message}`);
        }
      }
      const number = db.waves.reduce((m, w) => Math.max(m, w.number), 0) + 1;
      const wave = { id: newId("w-"), number, createdAt: now };
      db.waves.push(wave);
      for (const c of built) {
        c.waveId = wave.id;
        c.releaseAt = releaseAt;
        db.challenges.push(c);
      }
      if (releaseAt === now) notify(db, now, `Wave ${number} is live`, "Five new challenges have opened across the multiverse.", "important");
      return { waveId: wave.id, number, ids: built.map((c) => c.id) };
    },
  },
  postSingle: {
    auth: "admin",
    async fn({ db, now }, input: unknown, release: unknown) {
      const releaseAt = releaseTime(release, now);
      const c = await buildChallenge(db, { ...(input as object), id: undefined }, now);
      c.releaseAt = releaseAt;
      db.challenges.push(c);
      if (releaseAt === now) notify(db, now, `New challenge: ${c.title}`, `A ${c.points}-Power challenge has opened.`);
      return { id: c.id };
    },
  },
  releaseNow: {
    auth: "admin",
    fn({ db, now }, id: unknown) {
      const c = notArchived(findChallenge(db, id));
      c.releaseAt = now;
      c.hidden = false;
      notify(db, now, `New challenge: ${c.title}`, `A ${c.points}-Power challenge has opened.`);
    },
  },
  schedule: {
    auth: "admin",
    fn({ db, now }, id: unknown, at: unknown) {
      const c = notArchived(findChallenge(db, id));
      const t = time(at, "Release time");
      if (t <= now) throw new UserError("Scheduled time must be in the future.");
      c.releaseAt = t;
      c.hidden = false;
    },
  },
  unpublish: {
    auth: "admin",
    fn({ db }, id: unknown) {
      findChallenge(db, id).releaseAt = null;
    },
  },
  setHidden: {
    auth: "admin",
    fn({ db }, id: unknown, hidden: unknown) {
      findChallenge(db, id).hidden = bool(hidden, "Hidden");
    },
  },
  releaseWave: {
    auth: "admin",
    fn({ db, now }, waveId: unknown) {
      const wave = db.waves.find((w) => w.id === waveId);
      if (!wave) throw new UserError("Wave not found.", 404);
      const cs = db.challenges.filter((c) => c.waveId === wave.id && !c.archivedAt);
      for (const c of cs) {
        c.releaseAt = now;
        c.hidden = false;
      }
      notify(db, now, `Wave ${wave.number} is live`, `${cs.length} new challenges have opened across the multiverse.`, "important");
    },
  },
  /** Puts exactly five single challenges into a new wave. Each keeps its own release status. */
  groupIntoWave: {
    auth: "admin",
    fn({ db, now }, idsRaw: unknown) {
      if (!Array.isArray(idsRaw)) throw new UserError("Pick the challenges for the wave.");
      const ids = [...new Set(idsRaw)];
      if (ids.length !== 5) throw new UserError(`Pick exactly 5 challenges for a wave. You picked ${ids.length}.`);
      const picked = ids.map((id) => db.challenges.find((c) => c.id === id));
      if (picked.some((c) => !c)) throw new UserError("One of those challenges no longer exists.", 404);
      const inWave = picked.find((c) => c!.waveId);
      if (inWave) throw new UserError(`"${inWave.title}" is already in a wave. Split that wave first.`);
      const number = db.waves.reduce((m, w) => Math.max(m, w.number), 0) + 1;
      const wave = { id: newId("w-"), number, createdAt: now };
      db.waves.push(wave);
      for (const c of picked) c!.waveId = wave.id;
      return { waveId: wave.id, number };
    },
  },
  /** Turns a wave's challenges back into single challenges and removes the wave. */
  splitWave: {
    auth: "admin",
    fn({ db }, waveId: unknown) {
      const wave = db.waves.find((w) => w.id === waveId);
      if (!wave) throw new UserError("That wave no longer exists.", 404);
      for (const c of db.challenges) if (c.waveId === wave.id) c.waveId = null;
      db.waves = db.waves.filter((w) => w.id !== wave.id);
    },
  },
  /** Takes a challenge out of play (players can't see it, its points stop counting) but keeps everything. */
  archiveChallenge: {
    auth: "admin",
    fn({ db, now }, id: unknown) {
      const c = findChallenge(db, id);
      if (!c.archivedAt) c.archivedAt = now;
    },
  },
  /** Brings an archived challenge back exactly as it was (same release state, solves count again). */
  restoreChallenge: {
    auth: "admin",
    fn({ db }, id: unknown) {
      findChallenge(db, id).archivedAt = null;
    },
  },
  /**
   * Applies one action to many challenges in a single save:
   * release | schedule (needs `at`) | unpublish | archive | restore | delete.
   * Archived challenges are skipped by release/schedule/unpublish. A bulk release sends one announcement.
   */
  bulkChallenges: {
    auth: "admin",
    fn({ db, now }, actionRaw: unknown, idsRaw: unknown, atRaw: unknown) {
      const ACTIONS = ["release", "schedule", "unpublish", "archive", "restore", "delete"] as const;
      const action = ACTIONS.find((a) => a === actionRaw);
      if (!action) throw new UserError("Unknown bulk action.");
      if (!Array.isArray(idsRaw) || !idsRaw.length) throw new UserError("Select at least one challenge.");
      if (idsRaw.length > 500) throw new UserError("Too many challenges at once.");
      const ids = [...new Set(idsRaw)];
      const list = ids.map((id) => db.challenges.find((c) => c.id === id));
      if (list.some((c) => !c)) throw new UserError("Some of those challenges no longer exist. Refresh and try again.", 404);
      const cs = list as Challenge[];
      const at = action === "schedule" ? time(atRaw, "Release time") : 0;
      if (action === "schedule" && at <= now) throw new UserError("Scheduled time must be in the future.");
      let changed = 0;
      let skipped = 0;
      for (const c of cs) {
        if (["release", "schedule", "unpublish"].includes(action) && c.archivedAt) {
          skipped++;
          continue;
        }
        if (action === "release") {
          c.releaseAt = now;
          c.hidden = false;
        } else if (action === "schedule") {
          c.releaseAt = at;
          c.hidden = false;
        } else if (action === "unpublish") c.releaseAt = null;
        else if (action === "archive") {
          if (!c.archivedAt) c.archivedAt = now;
        } else if (action === "restore") c.archivedAt = null;
        else if (action === "delete") {
          db.challenges = db.challenges.filter((x) => x.id !== c.id);
          db.submissions = db.submissions.filter((x) => x.challengeId !== c.id);
          db.hintUnlocks = db.hintUnlocks.filter((x) => x.challengeId !== c.id);
        }
        changed++;
      }
      if (action === "delete") {
        const used = new Set(db.challenges.map((c) => c.waveId).filter(Boolean));
        db.waves = db.waves.filter((w) => used.has(w.id));
      }
      if (action === "release" && changed) {
        const released = cs.filter((c) => !c.archivedAt);
        if (released.length === 1) notify(db, now, `New challenge: ${released[0].title}`, `A ${released[0].points}-point challenge has opened.`);
        else notify(db, now, `${released.length} new challenges are live`, released.map((c) => c.title).join(", "), "important");
      }
      return { changed, skipped };
    },
  },
  deleteChallenge: {
    auth: "admin",
    fn({ db }, id: unknown) {
      const c = findChallenge(db, id);
      db.challenges = db.challenges.filter((x) => x.id !== c.id);
      db.submissions = db.submissions.filter((x) => x.challengeId !== c.id);
      db.hintUnlocks = db.hintUnlocks.filter((x) => x.challengeId !== c.id);
      if (c.waveId && !db.challenges.some((x) => x.waveId === c.waveId)) db.waves = db.waves.filter((w) => w.id !== c.waveId);
    },
  },
  grantAttempts: {
    auth: "admin",
    fn({ db }, id: unknown, n: unknown) {
      const c = findChallenge(db, id);
      if (!c.maxAttempts) throw new UserError("This challenge already has unlimited attempts.");
      c.bonusAttempts += int(n ?? 3, "Attempts", 1, 100);
    },
  },

  /* ---- Admin: teams ---- */
  createTeam: {
    auth: "admin",
    fn({ db, now }, name: unknown, members: unknown) {
      return createTeamIn(db, name, members, now);
    },
  },
  importTeams: {
    auth: "admin",
    async fn({ db, now }, csv: unknown) {
      const parsed = parseSquadCsv(str(csv, "CSV", 200000), db.settings.teamSize);
      const errors: RowError[] = [...parsed.errors];
      const credentials: Credential[] = [];
      for (const [i, row] of parsed.rows.entries()) {
        try {
          credentials.push(...(await createTeamIn(db, row.team, row.members, now)).credentials);
        } catch (e) {
          errors.push({ row: i + 1, message: `${row.team}: ${(e as Error).message}` });
        }
      }
      if (!credentials.length && errors.length) throw new UserError(errors.map((e) => `Row ${e.row}: ${e.message}`).join("\n"));
      return { credentials, errors };
    },
  },
  renameTeam: {
    auth: "admin",
    fn({ db }, teamId: unknown, name: unknown) {
      const t = findTeam(db, teamId);
      const n = str(name, "Team name", 60);
      if (db.teams.some((x) => x.id !== t.id && x.name.toLowerCase() === n.toLowerCase())) throw new UserError(`A team called "${n}" already exists.`);
      t.name = n;
    },
  },
  addMember: {
    auth: "admin",
    fn({ db, now }, teamId: unknown, displayName: unknown) {
      const t = findTeam(db, teamId);
      const count = db.users.filter((u) => u.teamId === t.id).length;
      if (count >= db.settings.teamSize) throw new UserError(`Teams have at most ${db.settings.teamSize} members.`);
      return newMember(db, t, str(displayName, "Name", 60), now, new Set());
    },
  },
  resetPassword: {
    auth: "admin",
    async fn({ db }, userId: unknown): Promise<Credential> {
      const u = db.users.find((x) => x.id === userId);
      if (!u) throw new UserError("Member not found.", 404);
      const password = tempPassword();
      u.passwordSalt = newSalt();
      u.passwordHash = await hashPassword(password, u.passwordSalt);
      u.mustChangePassword = true;
      const team = db.teams.find((t) => t.id === u.teamId);
      return { userId: u.id, teamName: team?.name ?? "Admin", displayName: u.displayName, username: u.username, password };
    },
  },
  removeMember: {
    auth: "admin",
    fn({ db }, userId: unknown) {
      const u = db.users.find((x) => x.id === userId);
      if (!u || u.role !== "player") throw new UserError("Member not found.", 404);
      db.users = db.users.filter((x) => x.id !== u.id);
    },
  },
  deleteTeam: {
    auth: "admin",
    fn({ db }, teamId: unknown) {
      const t = findTeam(db, teamId);
      db.teams = db.teams.filter((x) => x.id !== t.id);
      db.users = db.users.filter((u) => u.teamId !== t.id);
      db.submissions = db.submissions.filter((s) => s.teamId !== t.id);
      db.hintUnlocks = db.hintUnlocks.filter((h) => h.teamId !== t.id);
    },
  },

  /* ---- Admin: announcements ---- */
  postNotification: {
    auth: "admin",
    fn({ db, now }, title: unknown, body: unknown, level: unknown) {
      const lv = level === "important" ? "important" : "info";
      notify(db, now, str(title, "Title", 120), str(body ?? "", "Message", 2000, true), lv);
    },
  },
  deleteNotification: {
    auth: "admin",
    fn({ db }, id: unknown) {
      db.notifications = db.notifications.filter((n) => n.id !== id);
    },
  },

  /* ---- Admin: settings ---- */
  updateSettings: {
    auth: "admin",
    fn({ db }, patch: any) {
      if (!patch || typeof patch !== "object") throw new UserError("Nothing to update.");
      const s = db.settings;
      if (patch.eventName !== undefined) s.eventName = str(patch.eventName, "Event name", 80);
      if (patch.tagline !== undefined) s.tagline = str(patch.tagline, "Tagline", 160, true);
      if (patch.durationMinutes !== undefined) {
        const d = int(patch.durationMinutes, "Duration", 0, 1440);
        if (d > 0 && d < 10) throw new UserError("Duration must be at least 10 minutes, or 0 for no time limit.");
        s.durationMinutes = d;
      }
      if (patch.teamSize !== undefined) s.teamSize = int(patch.teamSize, "Team size", 1, 10);
      if (patch.forcePasswordChange !== undefined) s.forcePasswordChange = bool(patch.forcePasswordChange, "Force password change");
      if (patch.submissionsPerMinute !== undefined) s.submissionsPerMinute = int(patch.submissionsPerMinute, "Submissions per minute", 1, 1000);
    },
  },
  updateChallengeTypes: {
    auth: "admin",
    fn({ db }, types: unknown) {
      if (!Array.isArray(types)) throw new UserError("Categories must be a list.");
      for (const t of types as ChallengeType[]) {
        const existing = db.challengeTypes.find((x) => x.id === t?.id);
        if (!existing) throw new UserError("Unknown category.");
        existing.name = str(t.name, "Category name", 40);
        existing.description = str(t.description ?? "", "Category description", 200, true);
        const color = str(t.color, "Colour", 7);
        if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new UserError("Colour must look like #2BD67B.");
        existing.color = color;
      }
    },
  },
  setScoreboardVisible: {
    auth: "admin",
    fn({ db }, visible: unknown) {
      db.settings.scoreboardVisible = bool(visible, "Visible");
    },
  },
  freezeScoreboard: {
    auth: "admin",
    fn({ db, now }) {
      db.settings.freezeAt = now;
    },
  },
  unfreezeScoreboard: {
    auth: "admin",
    fn({ db }) {
      db.settings.freezeAt = null;
    },
  },

  /* ---- Admin: soundboard ---- */
  updateCue: {
    auth: "admin",
    fn({ db }, key: unknown, cue: unknown) {
      if (!CUE_KEYS.includes(key as CueKey)) throw new UserError("Unknown moment.");
      db.soundboard.cues[key as CueKey] = checkCue(cue, db.soundboard.sounds);
    },
  },
  /**
   * Records an uploaded sound's details. The audio itself is stored by the backend first
   * (this browser's storage, or the server's database), never inside the event data.
   */
  registerSound: {
    auth: "admin",
    fn({ db }, metaRaw: unknown) {
      const m = metaRaw as SoundMeta;
      if (!m || !isSoundId(m.id) || typeof m.mime !== "string" || !/^audio\//.test(m.mime)) throw new UserError("Bad sound.");
      if (db.soundboard.sounds.some((x) => x.id === m.id)) return { id: m.id };
      if (db.soundboard.sounds.length >= 40) throw new UserError("The soundboard is full (40 sounds). Delete one first.");
      db.soundboard.sounds.push({
        id: m.id,
        name: str(m.name, "Sound name", 60),
        bytes: int(m.bytes, "Size", 0, 10_000_000),
        mime: m.mime,
        addedAt: time(m.addedAt, "Added"),
      });
      return { id: m.id };
    },
  },
  deleteSound: {
    auth: "admin",
    fn({ db }, id: unknown) {
      if (!isSoundId(id)) throw new UserError("Sound not found.", 404);
      const ref = `upload:${id}`;
      const defaults = defaultSoundboard().cues;
      db.soundboard.sounds = db.soundboard.sounds.filter((s) => s.id !== id);
      for (const k of CUE_KEYS) if (db.soundboard.cues[k].sound === ref) db.soundboard.cues[k] = defaults[k];
      for (const c of db.challenges) {
        if (!c.cues) continue;
        for (const k of CUE_KEYS) if (c.cues[k]?.sound === ref) delete c.cues[k];
        if (!Object.keys(c.cues).length) delete c.cues;
      }
    },
  },

  /* ---- Admin: data ---- */
  exportBackup: {
    auth: "admin",
    readonly: true,
    fn({ db }) {
      return { json: JSON.stringify(db, null, 2) };
    },
  },
  importBackup: {
    auth: "admin",
    fn({ db }, json: unknown) {
      if (typeof json !== "string") throw new UserError("Choose a backup file.");
      replaceDb(db, validateBackup(json));
    },
  },
  /**
   * Clears everything that happened in the event (teams, members, challenges, waves, submissions,
   * hints, announcements, the clock) but keeps the admin who pressed it with the same password,
   * the event settings, the categories and the soundboard.
   */
  startFresh: {
    auth: "admin",
    fn({ db, actor }) {
      const me = actor!;
      const next = emptyDb();
      next.users.push({ ...structuredClone(me), mustChangePassword: false });
      next.settings = { ...db.settings, startsAt: null, endsAt: null, freezeAt: null };
      next.challengeTypes = structuredClone(db.challengeTypes);
      next.soundboard = structuredClone(db.soundboard);
      replaceDb(db, next);
      return { __session: me.id };
    },
  },
  loadDemo: {
    auth: "admin",
    fn({ db, now }) {
      replaceDb(db, demoDb(now));
      return { __session: "u-admin" };
    },
  },
};

export const METHOD_NAMES = Object.keys(METHODS);

export interface DispatchResult {
  result: any;
  mutated: boolean;
  session?: string;
}

/** Runs one whitelisted action as `actorId`. Mutates `db` in place. */
export async function dispatch(db: DB, actorId: string | null, method: string, args: unknown[], now: number): Promise<DispatchResult> {
  if (typeof method !== "string" || !Object.prototype.hasOwnProperty.call(METHODS, method)) {
    throw new UserError("Unknown action.", 400);
  }
  if (!Array.isArray(args)) throw new UserError("Bad request.", 400);
  if (db.dataVersion !== DATA_VERSION) throw new Error("Database not migrated.");
  const spec = METHODS[method];
  const actor = actorId ? db.users.find((u) => u.id === actorId) ?? null : null;
  if (spec.auth !== "none") {
    if (!actor) throw new UserError("Please log in again.", 401);
    if (spec.auth === "admin" && actor.role !== "admin") throw new UserError("Admin only.", 403);
    if (spec.auth === "player" && (actor.role !== "player" || !actor.teamId)) throw new UserError("Only team members can do that.", 403);
    if (actor.mustChangePassword && db.settings.forcePasswordChange && method !== "changePassword") throw new UserError("Change your password first.", 403);
  }
  const raw = await spec.fn({ db, actor, now }, ...args);
  let result = raw;
  let session: string | undefined;
  if (raw && typeof raw === "object" && "__session" in raw) {
    const { __session, ...rest } = raw as { __session: string };
    session = __session;
    result = rest;
  }
  return { result: result ?? { ok: true }, mutated: !spec.readonly, session };
}
