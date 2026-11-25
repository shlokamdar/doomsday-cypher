import { hashPassword, newSalt } from "./crypto";
import { DEMO_FLAG_HASHES, DEMO_PASSWORD_HASHES } from "./demoHashes";
import { MINUTE } from "./logic";
import { defaultPopups } from "./popups";
import { DEFAULT_CHALLENGE_TYPES } from "./themes";
import type { Challenge, DB, HintUnlock, Notification, Settings, Submission, User } from "./types";

export const DATA_VERSION = 4;

export function defaultSettings(): Settings {
  return {
    eventName: "DOOMSDAY CYPHER",
    tagline: "Seal the breach. Save every world.",
    startsAt: null,
    endsAt: null,
    durationMinutes: 180,
    teamSize: 3,
    scoreboardVisible: true,
    freezeAt: null,
    submissionsPerMinute: 10,
    forcePasswordChange: false,
  };
}

export function emptyDb(): DB {
  return {
    dataVersion: DATA_VERSION,
    users: [],
    teams: [],
    challengeTypes: DEFAULT_CHALLENGE_TYPES.map((t) => ({ ...t })),
    waves: [],
    challenges: [],
    submissions: [],
    hintUnlocks: [],
    notifications: [],
    settings: defaultSettings(),
    popups: defaultPopups(),
  };
}

/** A blank event with a single admin account that must change its password on first login. */
export async function freshDb(adminPassword: string, now = Date.now()): Promise<DB> {
  const db = emptyDb();
  const salt = newSalt();
  db.users.push({
    id: "u-admin",
    username: "admin",
    displayName: "Admin",
    role: "admin",
    teamId: null,
    passwordSalt: salt,
    passwordHash: await hashPassword(adminPassword, salt),
    mustChangePassword: true,
    createdAt: now,
  });
  return db;
}

const DEMO_SQUADS: { id: string; name: string; members: [string, string][] }[] = [
  { id: "s-iron", name: "Iron Meridian", members: [["kira.valdez", "Kira Valdez"], ["oren.patel", "Oren Patel"], ["mina.strand", "Mina Strand"]] },
  { id: "s-nova", name: "Nova Vanguard", members: [["leo.achterberg", "Leo Achterberg"], ["sana.iqbal", "Sana Iqbal"], ["dev.morrow", "Dev Morrow"]] },
  { id: "s-quantum", name: "Quantum Wardens", members: [["ayla.brooks", "Ayla Brooks"], ["jun.takeda", "Jun Takeda"], ["felix.odum", "Felix Odum"]] },
  { id: "s-eclipse", name: "Eclipse Unit", members: [["noor.haddad", "Noor Haddad"], ["cal.reyes", "Cal Reyes"], ["isla.fenwick", "Isla Fenwick"]] },
];

/**
 * Demo event: 4 teams, wave 1 live, one live single, one scheduled (+25 min), one draft.
 * The clock started 110 minutes ago. Flags and passwords exist only as precomputed hashes.
 */
export function demoDb(now = Date.now(), adminOverride?: { salt: string; hash: string }): DB {
  const db = emptyDb();
  const start = now - 110 * MINUTE;
  const at = (min: number) => start + min * MINUTE;
  db.settings.startsAt = start;
  db.settings.endsAt = start + 180 * MINUTE;

  const admin = adminOverride ?? DEMO_PASSWORD_HASHES["admin"];
  db.users.push({
    id: "u-admin",
    username: "admin",
    displayName: "Admin",
    role: "admin",
    teamId: null,
    passwordSalt: admin.salt,
    passwordHash: admin.hash,
    mustChangePassword: true,
    createdAt: start - 60 * MINUTE,
  });
  DEMO_SQUADS.forEach((sq, i) => {
    db.teams.push({ id: sq.id, name: sq.name, createdAt: start - 50 * MINUTE + i * 1000 });
    sq.members.forEach(([username, displayName]) => {
      const h = DEMO_PASSWORD_HASHES[username];
      const u: User = {
        id: "u-" + username.split(".")[0],
        username,
        displayName,
        role: "player",
        teamId: sq.id,
        passwordSalt: h.salt,
        passwordHash: h.hash,
        mustChangePassword: false,
        createdAt: start - 50 * MINUTE,
      };
      db.users.push(u);
    });
  });

  db.waves.push({ id: "w-1", number: 1, createdAt: start - 10 * MINUTE });

  const ch = (
    id: string,
    o: Omit<Challenge, "id" | "flagHash" | "flagSalt" | "bonusAttempts" | "hidden" | "createdAt" | "caseSensitive"> & {
      caseSensitive?: boolean;
    },
  ): Challenge => ({
    id,
    flagHash: DEMO_FLAG_HASHES[id].hash,
    flagSalt: DEMO_FLAG_HASHES[id].salt,
    bonusAttempts: 0,
    hidden: false,
    createdAt: start - 10 * MINUTE,
    caseSensitive: o.caseSensitive ?? false,
    ...o,
  });
  const briefing = [{ name: "briefing.txt", url: "files/briefing.txt" }];

  db.challenges.push(
    ch("c-skyline", {
      waveId: "w-1",
      typeId: "t-recruit",
      theme: "reality",
      title: "Shadow of the Skyline",
      description:
        "A scout photographed a skyline moments before its world folded. Identify the city from the public clues in the briefing and submit the flag it unlocks.",
      points: 100,
      files: briefing,
      hints: [{ text: "Count the bridges, then check the river names on an open map.", cost: 10 }],
      maxAttempts: 0,
      releaseAt: at(0),
    }),
    ch("c-channel9", {
      waveId: "w-1",
      typeId: "t-recruit",
      theme: "signal",
      title: "Static on Channel Nine",
      description:
        "An intercepted burst of static repeats every nine seconds. It has been encoded more than once. Peel it back layer by layer.",
      points: 150,
      files: briefing,
      hints: [
        { text: "The first layer is a very common web encoding.", cost: 15 },
        { text: "The second layer shifts letters, and the number nine matters.", cost: 25 },
      ],
      maxAttempts: 8,
      releaseAt: at(0),
    }),
    ch("c-sentry", {
      waveId: "w-1",
      typeId: "t-agent",
      theme: "machine",
      title: "Clockwork Sentry",
      description:
        "A sentry drone answers 500 arithmetic challenges in a row before it opens. Nobody types that fast. Write something that does.",
      points: 200,
      files: briefing,
      hints: [{ text: "Read the prompt, compute, reply, loop. A socket and a while loop are enough.", cost: 20 }],
      maxAttempts: 0,
      releaseAt: at(0),
    }),
    ch("c-ledger", {
      waveId: "w-1",
      typeId: "t-agent",
      theme: "archive",
      title: "Ledger of Lost Worlds",
      description:
        "The Sovereign keeps a ledger of every world it has collapsed. One entry was edited after the fact. Find the row that does not belong.",
      points: 250,
      files: briefing,
      hints: [
        { text: "Compare the created and updated timestamps.", cost: 25 },
        { text: "GROUP BY world and look for a count that is off by one.", cost: 40 },
      ],
      maxAttempts: 0,
      releaseAt: at(0),
    }),
    ch("c-echoes", {
      waveId: "w-1",
      typeId: "t-elite",
      theme: "archive",
      title: "Echoes in the Void",
      description:
        "A disk image recovered from a dead timeline. The files were wiped, but the void remembers. Carve what is left.",
      points: 300,
      files: briefing,
      hints: [{ text: "File signatures survive deletion. Look for magic bytes.", cost: 30 }],
      maxAttempts: 5,
      releaseAt: at(0),
    }),
    ch("c-paradox", {
      waveId: null,
      typeId: "t-agent",
      theme: "machine",
      title: "Paradox Gate",
      description:
        "Four switches, three clocks and one rule: the gate opens only if every event happens before its cause. Find the only valid order.",
      points: 200,
      files: [],
      hints: [{ text: "Draw it as a graph and sort it.", cost: 20 }],
      maxAttempts: 3,
      releaseAt: at(40),
    }),
    ch("c-cipher", {
      waveId: null,
      typeId: "t-elite",
      theme: "signal",
      title: "The Sovereign's Cipher",
      description: "The tyrant's own key schedule has leaked. It will not stay secret for long.",
      points: 350,
      files: [],
      hints: [{ text: "The key repeats.", cost: 35 }],
      maxAttempts: 0,
      releaseAt: now + 25 * MINUTE,
      caseSensitive: true,
    }),
    ch("c-lastlight", {
      waveId: null,
      typeId: "t-legend",
      theme: "machine",
      title: "Last Light Protocol",
      description: "Draft: the final challenge. Admin has not released it yet.",
      points: 400,
      files: [],
      hints: [],
      maxAttempts: 0,
      releaseAt: null,
    }),
  );

  const solves: [string, string, number][] = [
    // [userId, challengeId, minute]
    ["u-kira", "c-skyline", 8],
    ["u-oren", "c-channel9", 21],
    ["u-mina", "c-ledger", 55],
    ["u-kira", "c-sentry", 92],
    ["u-leo", "c-skyline", 12],
    ["u-sana", "c-sentry", 40],
    ["u-dev", "c-channel9", 66],
    ["u-ayla", "c-channel9", 15],
    ["u-jun", "c-echoes", 80],
    ["u-noor", "c-skyline", 30],
    ["u-cal", "c-paradox", 75],
  ];
  const wrong: [string, string, number, string][] = [
    ["u-leo", "c-channel9", 18, "IAMDOOM{channel_nine}"],
    ["u-sana", "c-channel9", 25, "static"],
    ["u-felix", "c-skyline", 20, "IAMDOOM{london}"],
    ["u-isla", "c-echoes", 50, "IAMDOOM{deleted}"],
    ["u-noor", "c-echoes", 58, "IAMDOOM{void_echo}"],
    ["u-oren", "c-ledger", 44, "IAMDOOM{row_42}"],
    ["u-jun", "c-echoes", 70, "IAMDOOM{magic}"],
    ["u-cal", "c-paradox", 62, "ABCD"],
  ];
  const teamOf = (userId: string) => db.users.find((u) => u.id === userId)!.teamId!;
  const subs: Submission[] = [];
  let n = 0;
  for (const [userId, challengeId, min] of solves) {
    subs.push({ id: `sub-${++n}`, userId, teamId: teamOf(userId), challengeId, value: "(correct flag)", correct: true, at: at(min) });
  }
  for (const [userId, challengeId, min, value] of wrong) {
    subs.push({ id: `sub-${++n}`, userId, teamId: teamOf(userId), challengeId, value, correct: false, at: at(min) });
  }
  subs.sort((a, b) => a.at - b.at);
  db.submissions = subs;

  const unlocks: HintUnlock[] = [
    { teamId: "s-iron", userId: "u-mina", challengeId: "c-ledger", index: 0, cost: 25, at: at(48) },
    { teamId: "s-eclipse", userId: "u-isla", challengeId: "c-echoes", index: 0, cost: 30, at: at(60) },
  ];
  db.hintUnlocks = unlocks;

  const notes: Notification[] = [
    { id: "n-1", title: "The Timer is ticking", body: "Three hours. Solve every challenge you can. Good luck, teams.", level: "important", at: at(0) },
    { id: "n-2", title: "Wave 1 is live", body: "Five challenges have opened across the multiverse.", level: "info", at: at(0) },
    { id: "n-3", title: "New challenge: Paradox Gate", body: "A Chronos challenge has opened. Worth 200 points.", level: "info", at: at(40) },
    { id: "n-4", title: "Reminder: hints cost points", body: "Opening a hint spends points for your whole team. Choose wisely.", level: "info", at: at(65) },
  ];
  db.notifications = notes;
  return db;
}

export async function demoDbWithAdminPassword(adminPassword: string | undefined, now = Date.now()): Promise<DB> {
  if (!adminPassword) return demoDb(now);
  const salt = newSalt();
  return demoDb(now, { salt, hash: await hashPassword(adminPassword, salt) });
}
