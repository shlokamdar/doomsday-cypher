import { SQUAD_COLORS } from "./themes";
import type {
  ChallengeStatus,
  HintUnlock,
  Settings,
  Solve,
  ViewSubmission,
  ViewTeam,
} from "./types";

export const MINUTE = 60_000;
export const NEW_BADGE_MS = 15 * MINUTE;

export function challengeStatus(c: { hidden: boolean; releaseAt: number | null }, now: number): ChallengeStatus {
  if (c.releaseAt === null) return "draft";
  if (c.hidden) return "hidden";
  if (c.releaseAt > now) return "scheduled";
  return "live";
}

export type ClockPhase = "idle" | "running" | "ended";

export function clockPhase(s: Pick<Settings, "startsAt" | "endsAt">, now: number): ClockPhase {
  if (s.startsAt === null || s.endsAt === null) return "idle";
  if (now < s.startsAt) return "idle";
  if (now >= s.endsAt) return "ended";
  return "running";
}

export function remainingMs(s: Pick<Settings, "startsAt" | "endsAt" | "durationMinutes">, now: number): number {
  if (s.startsAt === null || s.endsAt === null) return s.durationMinutes * MINUTE;
  if (now < s.startsAt) return s.endsAt - s.startsAt;
  return Math.max(0, s.endsAt - now);
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export interface MemberStanding {
  userId: string;
  displayName: string;
  power: number;
  solvePoints: number;
  hintSpend: number;
  solves: number;
}

export interface Standing {
  teamId: string;
  name: string;
  rank: number;
  power: number;
  solvePoints: number;
  hintSpend: number;
  solves: number;
  /** Time the squad reached its current Power (Infinity if it never scored). */
  reachedAt: number;
  members: MemberStanding[];
  series: { at: number; power: number }[];
}

/**
 * Ranks squads by Power, then by who reached that Power first.
 * Power = solve points − hint costs. Member Power always sums to the squad's Power.
 */
export function computeStandings(teams: ViewTeam[], solves: Solve[], hintUnlocks: HintUnlock[]): Standing[] {
  const rows: Standing[] = teams.map((t) => {
    const events: { at: number; delta: number; userId: string; kind: "solve" | "hint" }[] = [];
    for (const s of solves) if (s.teamId === t.id) events.push({ at: s.at, delta: s.points, userId: s.userId, kind: "solve" });
    for (const h of hintUnlocks) if (h.teamId === t.id) events.push({ at: h.at, delta: -h.cost, userId: h.userId, kind: "hint" });
    events.sort((a, b) => a.at - b.at);

    const members = new Map<string, MemberStanding>();
    for (const m of t.members) {
      members.set(m.id, { userId: m.id, displayName: m.displayName, power: 0, solvePoints: 0, hintSpend: 0, solves: 0 });
    }
    let power = 0;
    let solvePoints = 0;
    let hintSpend = 0;
    let solveCount = 0;
    const series: { at: number; power: number }[] = [];
    for (const e of events) {
      power += e.delta;
      let m = members.get(e.userId);
      if (!m) {
        m = { userId: e.userId, displayName: "Former member", power: 0, solvePoints: 0, hintSpend: 0, solves: 0 };
        members.set(e.userId, m);
      }
      m.power += e.delta;
      if (e.kind === "solve") {
        solvePoints += e.delta;
        m.solvePoints += e.delta;
        m.solves += 1;
        solveCount += 1;
      } else {
        hintSpend += -e.delta;
        m.hintSpend += -e.delta;
      }
      series.push({ at: e.at, power });
    }
    return {
      teamId: t.id,
      name: t.name,
      rank: 0,
      power,
      solvePoints,
      hintSpend,
      solves: solveCount,
      reachedAt: events.length ? events[events.length - 1].at : Infinity,
      members: [...members.values()],
      series,
    };
  });
  rows.sort(
    (a, b) => b.power - a.power || a.reachedAt - b.reachedAt || a.name.localeCompare(b.name),
  );
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export interface AttemptInfo {
  used: number;
  limit: number | null;
  left: number | null;
}

export function attemptInfo(
  c: { id: string; maxAttempts: number; bonusAttempts: number },
  teamId: string,
  subs: Pick<ViewSubmission, "teamId" | "challengeId">[],
): AttemptInfo {
  const used = subs.filter((s) => s.teamId === teamId && s.challengeId === c.id).length;
  if (!c.maxAttempts) return { used, limit: null, left: null };
  const limit = c.maxAttempts + (c.bonusAttempts || 0);
  return { used, limit, left: Math.max(0, limit - used) };
}

export function teamColor(teamId: string, teams: { id: string; createdAt: number }[]): string {
  const sorted = [...teams].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const i = sorted.findIndex((t) => t.id === teamId);
  return SQUAD_COLORS[(i < 0 ? 0 : i) % SQUAD_COLORS.length];
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function defaultHintCost(points: number): number {
  return Math.max(1, Math.round(points * 0.1));
}
