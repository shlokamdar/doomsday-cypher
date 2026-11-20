import { challengeStatus } from "./logic";
import type { DB, PublicUser, Solve, User, View, ViewChallenge, ViewHint, ViewSubmission } from "./types";

export function publicUser(u: User, includePrivate = false): PublicUser {
  const p: PublicUser = { id: u.id, username: u.username, displayName: u.displayName, role: u.role, teamId: u.teamId };
  if (includePrivate) p.mustChangePassword = u.mustChangePassword;
  return p;
}

/**
 * Builds the filtered view for one viewer. This is the ONLY data a viewer ever receives.
 * Players never get: flag/password hashes, draft/hidden/scheduled challenges, locked hint text,
 * other teams' wrong guesses, or other teams' activity after a freeze / while hidden.
 */
export function buildView(db: DB, viewerId: string | null, now: number, version = "0", sessionInvalid = false): View {
  const me = viewerId ? db.users.find((u) => u.id === viewerId) ?? null : null;
  const isAdmin = me?.role === "admin";
  const myTeam = me && me.role === "player" ? me.teamId : null;
  const s = db.settings;

  const canSeeTeamEvent = (teamId: string, at: number) => {
    if (isAdmin) return true;
    if (myTeam && teamId === myTeam) return true;
    if (!s.scoreboardVisible) return false;
    if (s.freezeAt !== null && at >= s.freezeAt) return false;
    return true;
  };

  const challengeById = new Map(db.challenges.map((c) => [c.id, c]));

  const challenges: ViewChallenge[] = [];
  if (me) {
    for (const c of db.challenges) {
      const status = challengeStatus(c, now);
      if (!isAdmin && status !== "live") continue;
      const hints: ViewHint[] = c.hints.map((h, index) => {
        if (isAdmin) return { cost: h.cost, text: h.text, unlocked: false };
        const u = db.hintUnlocks.find((x) => x.teamId === myTeam && x.challengeId === c.id && x.index === index);
        return u
          ? { cost: h.cost, text: h.text, unlocked: true, unlockedBy: u.userId, unlockedAt: u.at }
          : { cost: h.cost, unlocked: false };
      });
      const vc: ViewChallenge = {
        id: c.id,
        waveId: c.waveId,
        typeId: c.typeId,
        theme: c.theme,
        title: c.title,
        description: c.description,
        points: c.points,
        caseSensitive: c.caseSensitive,
        files: c.files.map((f) => ({ ...f })),
        hints,
        maxAttempts: c.maxAttempts,
        bonusAttempts: c.bonusAttempts,
        hidden: c.hidden,
        releaseAt: c.releaseAt,
        createdAt: c.createdAt,
        status,
      };
      if (isAdmin) vc.hasFlag = !!c.flagHash;
      challenges.push(vc);
    }
  }
  const visibleWaveIds = new Set(challenges.map((c) => c.waveId).filter(Boolean));
  const waves = db.waves.filter((w) => isAdmin || visibleWaveIds.has(w.id)).map((w) => ({ ...w }));

  const solves: Solve[] = [];
  for (const sub of db.submissions) {
    if (!sub.correct) continue;
    const c = challengeById.get(sub.challengeId);
    if (!c) continue;
    if (!canSeeTeamEvent(sub.teamId, sub.at)) continue;
    solves.push({ teamId: sub.teamId, userId: sub.userId, challengeId: sub.challengeId, at: sub.at, points: c.points });
  }
  const hintUnlocks = db.hintUnlocks.filter((h) => canSeeTeamEvent(h.teamId, h.at)).map((h) => ({ ...h }));

  let submissions: ViewSubmission[] = [];
  if (isAdmin) submissions = db.submissions.map((x) => ({ ...x }));
  else if (myTeam)
    submissions = db.submissions
      .filter((x) => x.teamId === myTeam)
      .map(({ id, userId, teamId, challengeId, correct, at }) => ({ id, userId, teamId, challengeId, correct, at }));

  const view: View = {
    serverNow: now,
    version,
    settings: { ...s },
    me: me ? { ...publicUser(me, true), mustChangePassword: me.mustChangePassword && s.forcePasswordChange } : null,
    teams: db.teams.map((t) => ({
      id: t.id,
      name: t.name,
      createdAt: t.createdAt,
      members: db.users
        .filter((u) => u.teamId === t.id && u.role === "player")
        .map((u) => ({ id: u.id, username: u.username, displayName: u.displayName })),
    })),
    challengeTypes: db.challengeTypes.map((t) => ({ ...t })),
    waves,
    challenges,
    solves,
    hintUnlocks,
    submissions,
    notifications: [...db.notifications].sort((a, b) => b.at - a.at).map((n) => ({ ...n })),
  };
  if (sessionInvalid) view.sessionInvalid = true;
  if (isAdmin) view.users = db.users.map((u) => publicUser(u, true));
  return view;
}

/** Future moments at which the view changes without any write (scheduled releases, freeze, clock). */
export function upcomingTimes(db: DB, now: number): number[] {
  const t = new Set<number>();
  for (const c of db.challenges) if (c.releaseAt !== null && c.releaseAt > now) t.add(c.releaseAt);
  const s = db.settings;
  for (const x of [s.freezeAt, s.startsAt, s.endsAt]) if (x !== null && x > now) t.add(x);
  return [...t].sort((a, b) => a - b).slice(0, 50);
}

const SECRET_KEYS = new Set(["passwordHash", "passwordSalt", "flagHash", "flagSalt"]);

/** Deep-removes hash/salt fields from any value. */
export function scrub<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => scrub(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.has(k)) continue;
      out[k] = scrub(v);
    }
    return out as T;
  }
  return value;
}
