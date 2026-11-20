import { describe, expect, it } from "vitest";
import { aesCodec, generateStorageKey } from "../src/backend/secureStore";
import { DB_KEY } from "../src/backend/LocalBackend";
import { computeStandings, MINUTE, remainingMs } from "../src/core/logic";
import { migrate, validateBackup } from "../src/core/migrate";
import { DATA_VERSION, freshDb } from "../src/core/seed";
import {
  adminWorld,
  ADMIN_PW,
  DEMO_PLAYER_PW,
  demoWorld,
  input,
  joinSquad,
  NEW_PW,
  randomFlag,
} from "./helpers";

async function startedEvent() {
  const w = await adminWorld();
  await w.admin.actions.clockStart();
  return w;
}

describe("ranking and scoring", () => {
  it("ranks by Power, then whoever reached that Power first", async () => {
    const d = await demoWorld();
    const b = await d.make();
    const v = b.getView()!;
    const s = computeStandings(v.teams, v.solves, v.hintUnlocks);
    expect(s.map((r) => r.name)).toEqual(["Iron Meridian", "Nova Vanguard", "Quantum Wardens", "Eclipse Unit"]);
    expect(s[1].power).toBe(450);
    expect(s[2].power).toBe(450);
    expect(s[1].reachedAt).toBeLessThan(s[2].reachedAt);
    expect(s[0].hintSpend).toBe(25);
  });

  it("member Power always sums to the squad's Power", async () => {
    const d = await demoWorld();
    const v = (await d.make()).getView()!;
    for (const row of computeStandings(v.teams, v.solves, v.hintUnlocks)) {
      expect(row.members.reduce((a, m) => a + m.power, 0)).toBe(row.power);
    }
  });

  it("only the first correct solve counts", async () => {
    const w = await startedEvent();
    const flag = randomFlag();
    const { id } = await w.admin.actions.postSingle(input({ flag, points: 200 }), { mode: "now" });
    const { players } = await joinSquad(w, w.admin);
    const r1 = await players[0].actions.submitFlag(id, flag);
    const r2 = await players[1].actions.submitFlag(id, flag);
    expect(r1.correct).toBe(true);
    expect(r2.alreadySolved).toBe(true);
    await w.admin.refresh();
    const v = w.admin.getView()!;
    expect(v.solves.filter((s) => s.challengeId === id)).toHaveLength(1);
    expect(computeStandings(v.teams, v.solves, v.hintUnlocks)[0].power).toBe(200);
  });
});

describe("visibility", () => {
  it("hides drafts and scheduled breaches from players", async () => {
    const d = await demoWorld();
    const b = await d.make();
    await b.actions.login("s-iron", "kira.valdez", DEMO_PLAYER_PW);
    const ids = b.getView()!.challenges.map((c) => c.id);
    expect(ids).toContain("c-paradox");
    expect(ids).not.toContain("c-cipher"); // scheduled
    expect(ids).not.toContain("c-lastlight"); // draft
    d.clock.t += 26 * MINUTE;
    await b.refresh();
    expect(b.getView()!.challenges.map((c) => c.id)).toContain("c-cipher");
  });
});

describe("login", () => {
  it("accepts the right squad + password and rejects wrong squad or password", async () => {
    const d = await demoWorld();
    const b = await d.make();
    await expect(b.actions.login("s-nova", "kira.valdez", DEMO_PLAYER_PW)).rejects.toThrow(/Wrong squad/);
    await expect(b.actions.login("s-iron", "kira.valdez", "nope-nope")).rejects.toThrow(/Wrong squad/);
    await expect(b.actions.login(null, "kira.valdez", DEMO_PLAYER_PW)).rejects.toThrow(/Wrong squad/);
    expect(b.getView()!.me).toBeNull();
    await b.actions.login("s-iron", "kira.valdez", DEMO_PLAYER_PW);
    expect(b.getView()!.me?.username).toBe("kira.valdez");
  });

  it("forces a password change before anything else", async () => {
    const w = await adminWorld();
    await w.admin.actions.clockStart();
    const { teamId, credentials } = await w.admin.actions.createTeam("Beta", ["Cara"]);
    const p = await w.backend();
    const r = await p.actions.login(teamId, credentials[0].username, credentials[0].password);
    expect(r.mustChangePassword).toBe(true);
    await expect(p.actions.unlockHint("x", 0)).rejects.toThrow(/Change your password/);
    await p.actions.changePassword(credentials[0].password, NEW_PW);
    expect(p.getView()!.me?.mustChangePassword).toBe(false);
  });
});

describe("flags", () => {
  it("are accepted case-insensitively and never stored", async () => {
    const w = await startedEvent();
    const flag = randomFlag();
    const { id } = await w.admin.actions.postSingle(input({ flag }), { mode: "now" });
    const { players } = await joinSquad(w, w.admin);
    const r = await players[0].actions.submitFlag(id, `  ${flag.toUpperCase()} `);
    expect(r.correct).toBe(true);
    const raw = w.storage.getItem(DB_KEY)!;
    expect(raw).not.toContain(flag);
    expect(raw.toLowerCase()).not.toContain(flag.toLowerCase());
    expect(raw).toContain("(correct flag)");
  });

  it("respect case-sensitive breaches", async () => {
    const w = await startedEvent();
    const flag = "DC{" + crypto.randomUUID() + "}";
    const { id } = await w.admin.actions.postSingle(input({ flag, caseSensitive: true }), { mode: "now" });
    const { players } = await joinSquad(w, w.admin);
    expect((await players[0].actions.submitFlag(id, flag.toUpperCase())).correct).toBe(false);
    expect((await players[0].actions.submitFlag(id, flag)).correct).toBe(true);
  });

  it("are blocked before the clock starts and after time is up", async () => {
    const w = await adminWorld();
    const flag = randomFlag();
    const { id } = await w.admin.actions.postSingle(input({ flag }), { mode: "now" });
    const { players } = await joinSquad(w, w.admin);
    await expect(players[0].actions.submitFlag(id, flag)).rejects.toThrow("Flags open when the Doomsday Clock starts");
    await w.admin.actions.clockStart();
    w.clock.t += 181 * MINUTE;
    await expect(players[0].actions.submitFlag(id, flag)).rejects.toThrow("Time's up");
  });

  it("are rate limited per squad per breach", async () => {
    const w = await startedEvent();
    await w.admin.actions.updateSettings({ submissionsPerMinute: 3 });
    const { id } = await w.admin.actions.postSingle(input(), { mode: "now" });
    const { id: other } = await w.admin.actions.postSingle(input(), { mode: "now" });
    const { players } = await joinSquad(w, w.admin);
    for (let i = 0; i < 3; i++) await players[i % 2].actions.submitFlag(id, "DC{nope}");
    await expect(players[0].actions.submitFlag(id, "DC{nope}")).rejects.toThrow(/Slow down/);
    // a different breach is not affected
    await players[0].actions.submitFlag(other, "DC{nope}");
    w.clock.t += 61_000;
    await players[0].actions.submitFlag(id, "DC{nope}");
  });
});

describe("permissions", () => {
  it("players cannot call Command actions", async () => {
    const w = await startedEvent();
    const { players } = await joinSquad(w, w.admin);
    await expect(players[0].actions.clockReset()).rejects.toThrow(/Command only/);
    await expect(players[0].actions.loadDemo()).rejects.toThrow(/Command only/);
    await expect(players[0].actions.exportBackup()).rejects.toThrow(/Command only/);
    await expect(players[0].actions.createTeam("Evil", ["x"])).rejects.toThrow(/Command only/);
  });
});

describe("posting breaches", () => {
  it("a wave needs exactly 5 breaches and is auto-numbered", async () => {
    const w = await adminWorld();
    await expect(w.admin.actions.postWave([input(), input()], { mode: "now" })).rejects.toThrow(/exactly 5/);
    const r1 = await w.admin.actions.postWave([1, 2, 3, 4, 5].map((i) => input({ title: `B${i}` })), { mode: "now" });
    const r2 = await w.admin.actions.postWave([1, 2, 3, 4, 5].map((i) => input({ title: `C${i}` })), { mode: "draft" });
    expect(r1.number).toBe(1);
    expect(r2.number).toBe(2);
    const v = w.admin.getView()!;
    expect(v.challenges.filter((c) => c.waveId === r1.waveId && c.status === "live")).toHaveLength(5);
    expect(v.challenges.filter((c) => c.waveId === r2.waveId && c.status === "draft")).toHaveLength(5);
    expect(v.notifications[0].title).toMatch(/Incursion wave 1 is live/);
    await w.admin.actions.releaseWave(r2.waveId);
    expect(w.admin.getView()!.challenges.filter((c) => c.status === "live")).toHaveLength(10);
  });

  it("singles can be live, scheduled or draft, and unpublished", async () => {
    const w = await adminWorld();
    const a = await w.admin.actions.postSingle(input(), { mode: "now" });
    const b = await w.admin.actions.postSingle(input(), { mode: "schedule", at: w.clock.t + 10 * MINUTE });
    const c = await w.admin.actions.postSingle(input(), { mode: "draft" });
    const st = (id: string) => w.admin.getView()!.challenges.find((x) => x.id === id)!.status;
    expect([st(a.id), st(b.id), st(c.id)]).toEqual(["live", "scheduled", "draft"]);
    await w.admin.actions.unpublish(a.id);
    await w.admin.actions.releaseNow(c.id);
    expect([st(a.id), st(c.id)]).toEqual(["draft", "live"]);
  });

  it("editing keeps the flag when left empty", async () => {
    const w = await startedEvent();
    const flag = randomFlag();
    const { id } = await w.admin.actions.postSingle(input({ flag }), { mode: "now" });
    await w.admin.actions.saveChallenge({ ...input({ title: "Renamed" }), id, flag: "" });
    const { players } = await joinSquad(w, w.admin);
    expect((await players[0].actions.submitFlag(id, flag)).correct).toBe(true);
    expect(players[0].getView()!.challenges.find((c) => c.id === id)!.title).toBe("Renamed");
  });
});

describe("attempts and hints", () => {
  it("attempts are shared per squad, and Command can grant +3", async () => {
    const w = await startedEvent();
    const flag = randomFlag();
    const { id } = await w.admin.actions.postSingle(input({ flag, maxAttempts: 2 }), { mode: "now" });
    const { players } = await joinSquad(w, w.admin);
    expect((await players[0].actions.submitFlag(id, "wrong")).attemptsLeft).toBe(1);
    expect((await players[1].actions.submitFlag(id, "wrong")).attemptsLeft).toBe(0);
    await expect(players[0].actions.submitFlag(id, flag)).rejects.toThrow("Out of attempts. Command can grant more.");
    await w.admin.actions.grantAttempts(id);
    const r = await players[0].actions.submitFlag(id, flag);
    expect(r.correct).toBe(true);
    expect(r.attemptsLeft).toBe(2);
  });

  it("a hint is charged once and the whole squad sees it", async () => {
    const w = await startedEvent();
    const { id } = await w.admin.actions.postSingle(
      input({ points: 300, hints: [{ text: "look closer", cost: 30 }, { text: "second", cost: 50 }] }),
      { mode: "now" },
    );
    const { players } = await joinSquad(w, w.admin);
    const before = players[1].getView()!.challenges.find((c) => c.id === id)!;
    expect(before.hints[0].text).toBeUndefined();
    await players[0].actions.unlockHint(id, 0);
    await players[1].actions.unlockHint(id, 0);
    await players[1].refresh();
    const after = players[1].getView()!;
    const h = after.challenges.find((c) => c.id === id)!.hints;
    expect(h[0].text).toBe("look closer");
    expect(h[0].unlockedBy).toBe(players[0].getView()!.me!.id);
    expect(h[1].text).toBeUndefined();
    expect(after.hintUnlocks).toHaveLength(1);
    expect(computeStandings(after.teams, after.solves, after.hintUnlocks).find((s) => s.name === "Alpha")!.power).toBe(-30);
  });
});

describe("clock, squads, notifications, backups", () => {
  it("runs a 3-hour Doomsday Clock with +10 minutes, end and reset", async () => {
    const w = await adminWorld();
    let s = w.admin.getView()!.settings;
    expect(remainingMs(s, w.clock.t)).toBe(180 * MINUTE);
    await w.admin.actions.clockStart();
    s = w.admin.getView()!.settings;
    expect(s.endsAt! - s.startsAt!).toBe(180 * MINUTE);
    w.clock.t += 60 * MINUTE;
    expect(remainingMs(w.admin.getView()!.settings, w.clock.t)).toBe(120 * MINUTE);
    await w.admin.actions.clockAddMinutes(10);
    expect(remainingMs(w.admin.getView()!.settings, w.clock.t)).toBe(130 * MINUTE);
    await w.admin.actions.clockEnd();
    expect(remainingMs(w.admin.getView()!.settings, w.clock.t)).toBe(0);
    await w.admin.actions.clockReset();
    expect(w.admin.getView()!.settings.startsAt).toBeNull();
  });

  it("creates squads with unique usernames and temporary passwords", async () => {
    const w = await adminWorld();
    const a = await w.admin.actions.createTeam("Alpha", ["Sam Lee", "Sam Lee", "Zoë Ádám"]);
    expect(a.credentials.map((c) => c.username)).toEqual(["sam.lee", "sam.lee2", "zoe.adam"]);
    expect(new Set(a.credentials.map((c) => c.password)).size).toBe(3);
    await expect(w.admin.actions.createTeam("alpha", ["X"])).rejects.toThrow(/already exists/);
    await expect(w.admin.actions.createTeam("Big", ["a", "b", "c", "d"])).rejects.toThrow(/at most 3/);
    const imp = await w.admin.actions.importTeams("team,member1,member2,member3\nGamma,Al,Bo\n,Nobody\nDelta,Di");
    expect(imp.credentials).toHaveLength(3);
    expect(imp.errors).toHaveLength(1);
    // credentials never include hashes
    expect(JSON.stringify(a)).not.toMatch(/passwordHash|passwordSalt/);
  });

  it("posts and deletes transmissions", async () => {
    const w = await adminWorld();
    await w.admin.actions.postNotification("Heads up", "Wave 2 soon", "important");
    const n = w.admin.getView()!.notifications[0];
    expect(n).toMatchObject({ title: "Heads up", level: "important" });
    await w.admin.actions.deleteNotification(n.id);
    expect(w.admin.getView()!.notifications.find((x) => x.id === n.id)).toBeUndefined();
  });

  it("validates backups: must contain an admin", async () => {
    const w = await adminWorld();
    const { json } = await w.admin.actions.exportBackup();
    expect(validateBackup(json).users.some((u) => u.role === "admin")).toBe(true);
    const noAdmin = JSON.parse(json);
    noAdmin.users = noAdmin.users.filter((u: { role: string }) => u.role !== "admin");
    await expect(w.admin.actions.importBackup(JSON.stringify(noAdmin))).rejects.toThrow(/admin/);
    await expect(w.admin.actions.importBackup("{not json")).rejects.toThrow(/valid JSON/);
    await w.admin.actions.importBackup(json);
  });

  it("start fresh shows a new admin password once and keeps Command logged in", async () => {
    const w = await adminWorld();
    await joinSquad(w, w.admin);
    const r = await w.admin.actions.startFresh();
    expect(r.credential.password).toMatch(/^[\w-]{14}$/);
    const v = w.admin.getView()!;
    expect(v.me?.role).toBe("admin");
    expect(v.teams).toHaveLength(0);
  });

  it("stores only ciphertext in localStorage", async () => {
    const d = await demoWorld();
    const codec = aesCodec(await generateStorageKey());
    const b = await d.backend(d.seed, codec);
    await b.actions.login("s-iron", "kira.valdez", DEMO_PLAYER_PW);
    const raw = d.storage.getItem(DB_KEY)!;
    expect(raw.startsWith("aesgcm1:")).toBe(true);
    for (const needle of ["Iron Meridian", "kira", "passwordHash", "Paradox", "(correct flag)"]) expect(raw).not.toContain(needle);
    // and it round-trips
    const again = await d.backend(d.seed, codec);
    expect(again.getView()!.teams).toHaveLength(4);
  });
});

describe("migration", () => {
  it("upgrades a v1 database", async () => {
    const v2 = await freshDb(ADMIN_PW);
    const v1 = {
      users: v2.users,
      teams: [{ id: "s1", name: "Old Squad", createdAt: 1 }],
      challengeTypes: v2.challengeTypes,
      waves: [],
      challenges: [
        { id: "c1", waveId: null, typeId: "t-recruit", theme: "signal", title: "Old", description: "", points: 200, flagHash: "h", flagSalt: "s", caseSensitive: false, files: [], hints: ["try harder"], released: true, createdAt: 5 },
        { id: "c2", waveId: null, typeId: "t-recruit", theme: "nature", title: "Draft", description: "", points: 100, flagHash: "h", flagSalt: "s", caseSensitive: false, files: [], hints: [], released: false, createdAt: 5 },
      ],
      submissions: [],
      notifications: [],
      settings: { eventName: "Old", tagline: "", startsAt: null, endsAt: null, durationMinutes: 180, teamSize: 3, scoreboardVisible: true },
    };
    const db = migrate(v1);
    expect(db.dataVersion).toBe(DATA_VERSION);
    expect(db.challenges[0]).toMatchObject({ releaseAt: 5, maxAttempts: 0, bonusAttempts: 0, hidden: false, hints: [{ text: "try harder", cost: 20 }] });
    expect(db.challenges[1].releaseAt).toBeNull();
    expect(db.challenges[1].theme).toBe("reality");
    expect(db.settings.submissionsPerMinute).toBe(10);
    expect(db.settings.freezeAt).toBeNull();
    expect(db.hintUnlocks).toEqual([]);
    expect("released" in db.challenges[0]).toBe(false);
  });
});
