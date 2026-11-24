import { describe, expect, it } from "vitest";
import { RemoteBackend, trimArgs } from "../src/backend/RemoteBackend";
import { MemoryStorage } from "../src/backend/secureStore";
import { MINUTE } from "../src/core/logic";
import type { View } from "../src/core/types";
import { handleRpc, handleSound, handleState, type Req, type ServerDeps } from "../src/server/handler";
import { findUpstashConfig, MemoryStore, parseMeta } from "../src/server/store";
import { DEMO_ADMIN_PW, DEMO_PLAYER_PW, input, NEW_PW, T0 } from "./helpers";

const SECRET = "test-secret-0123456789abcdef";

function server(seed = "demo") {
  const clock = { t: T0 };
  const store = new MemoryStore();
  const deps: ServerDeps = { store, secret: SECRET, seed, adminPassword: seed === "demo" ? undefined : "boot-admin-pass", now: () => clock.t };
  // A fetch that routes to the handlers in-process.
  const f = (async (url: string, init: RequestInit = {}) => {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => (headers[k.toLowerCase()] = v));
    const req: Req = { method: init.method ?? "GET", url, headers, body: init.body };
    const r = url.startsWith("/api/state") ? await handleState(req, deps) : await handleRpc(req, deps);
    return new Response(r.status === 204 ? null : r.body ?? null, { status: r.status, headers: r.headers });
  }) as typeof fetch;
  const client = async () => {
    const b = new RemoteBackend({ base: "/api", fetch: f, storage: new MemoryStorage(), live: false });
    await b.init();
    return b;
  };
  return { clock, store, deps, f, client };
}

async function demoAdmin(s: ReturnType<typeof server>) {
  const a = await s.client();
  await a.actions.login(null, "admin", DEMO_ADMIN_PW);
  await a.actions.changePassword(DEMO_ADMIN_PW, NEW_PW);
  return a;
}
async function demoPlayer(s: ReturnType<typeof server>) {
  const p = await s.client();
  await p.actions.login("s-iron", "kira.valdez", DEMO_PLAYER_PW);
  return p;
}

const rawView = async (s: ReturnType<typeof server>, token?: string) => {
  const r = await handleState({ method: "GET", url: "/api/state", headers: token ? { authorization: `Bearer ${token}` } : {} }, s.deps);
  return { status: r.status, text: r.body ?? "", view: r.body ? (JSON.parse(r.body) as View) : null, headers: r.headers };
};

describe("server: filtered view", () => {
  it("leaks nothing a player must not see", async () => {
    const s = server();
    const admin = await demoAdmin(s);
    await admin.actions.setScoreboardVisible(true);
    await admin.actions.freezeScoreboard();
    s.clock.t += 5 * MINUTE;
    const p = await demoPlayer(s);
    // Another squad solves after the freeze.
    const nova = await s.client();
    await nova.actions.login("s-nova", "leo.achterberg", DEMO_PLAYER_PW);
    await nova.actions.submitFlag("c-echoes", "IAMDOOM{definitely-wrong}");
    await p.refresh();
    const v = p.getView()!;
    const text = JSON.stringify(v);
    for (const bad of ["passwordHash", "passwordSalt", "flagHash", "flagSalt", "c-cipher", "c-lastlight", "IAMDOOM{definitely-wrong}", "IAMDOOM{london}", "Count the bridges"]) {
      expect(text).not.toContain(bad);
    }
    // own unlocked hint text is visible
    expect(v.challenges.find((c) => c.id === "c-ledger")!.hints[0].text).toMatch(/timestamps/);
    expect(v.submissions.every((x) => x.teamId === "s-iron")).toBe(true);
    // other squads' activity after the freeze is hidden
    expect(v.solves.every((x) => x.teamId === "s-iron" || x.at < v.settings.freezeAt!)).toBe(true);

    await admin.actions.setScoreboardVisible(false);
    await p.refresh();
    expect(p.getView()!.solves.every((x) => x.teamId === "s-iron")).toBe(true);
    expect(p.getView()!.hintUnlocks.every((x) => x.teamId === "s-iron")).toBe(true);
    const anon = await rawView(s);
    expect(anon.view!.solves).toHaveLength(0);
    expect(anon.view!.challenges).toHaveLength(0);
  });

  it("scrubs hashes from RPC results except the backup export", async () => {
    const s = server();
    const admin = await demoAdmin(s);
    const cred = await admin.actions.resetPassword("u-kira");
    expect(JSON.stringify(cred)).not.toMatch(/Hash|Salt/);
    const { json } = await admin.actions.exportBackup();
    expect(json).toContain("passwordHash");
  });
});

describe("server: polling", () => {
  it("an admin change reaches a player on the next poll, and 204 when nothing changed", async () => {
    const s = server();
    const admin = await demoAdmin(s);
    const p = await demoPlayer(s);
    const v0 = p.getView()!;

    // nothing changed → 204 (no DB read on the cheap path)
    const reads = s.store.reads;
    const r = await s.f(`/api/state?v=${v0.version}&t=${v0.serverNow}`, {});
    expect(r.status).toBe(204);
    expect(s.store.reads).toBe(reads);

    await admin.actions.saveChallenge({ ...input({ title: "Renamed Skyline", theme: "reality", points: 100 }), id: "c-skyline", flag: "" });
    await p.fetchState();
    expect(p.getView()!.challenges.find((c) => c.id === "c-skyline")!.title).toBe("Renamed Skyline");

    await admin.actions.unpublish("c-paradox");
    await p.fetchState();
    expect(p.getView()!.challenges.find((c) => c.id === "c-paradox")).toBeUndefined();
  });

  it("a write the player cannot see still answers 204 via ETag", async () => {
    const s = server();
    const admin = await demoAdmin(s);
    await admin.actions.setScoreboardVisible(false);
    const p = await demoPlayer(s);
    const before = p.getView()!;
    const nova = await s.client();
    await nova.actions.login("s-nova", "leo.achterberg", DEMO_PLAYER_PW);
    await nova.actions.submitFlag("c-echoes", "IAMDOOM{nope}");
    let saw204 = false;
    const orig = p["f"];
    p["f"] = (async (...a: Parameters<typeof fetch>) => {
      const res = await orig(...a);
      if (res.status === 204) saw204 = true;
      return res;
    }) as typeof fetch;
    await p.fetchState();
    expect(saw204).toBe(true);
    expect(p.getView()!.version).not.toBe(before.version);
  });

  it("a scheduled release triggers a refresh with no write", async () => {
    const s = server();
    const p = await demoPlayer(s);
    expect(p.getView()!.challenges.find((c) => c.id === "c-cipher")).toBeUndefined();
    const writes = s.store.writes;
    const meta = parseMeta(s.store.meta);
    expect(meta.times.length).toBeGreaterThan(0);
    s.clock.t += 26 * MINUTE;
    await p.fetchState();
    expect(p.getView()!.challenges.find((c) => c.id === "c-cipher")).toBeDefined();
    expect(s.store.writes).toBe(writes);
  });
});

describe("server: auth and concurrency", () => {
  it("rejects forged, tampered and stale tokens", async () => {
    const s = server();
    const p = await demoPlayer(s);
    const token = p["store"].getItem("doomsday.token")!;
    expect(token.split(".")).toHaveLength(4);
    const ok = await rawView(s, token);
    expect(ok.view!.me?.id).toBe("u-kira");

    const [u, exp, pre] = token.split(".");
    for (const bad of [`u-admin.${exp}.${pre}.${token.split(".")[3]}`, `${u}.${Number(exp) + 1000}.${pre}.${token.split(".")[3]}`, `${u}.${exp}.${pre}.AAAA`, "garbage"]) {
      const r = await rawView(s, bad);
      expect(r.view!.me).toBeNull();
      expect(r.view!.sessionInvalid).toBe(true);
    }
    const rpc = await handleRpc(
      { method: "POST", url: "/api/rpc", headers: { authorization: "Bearer u-admin.9999999999999.xxxx.yyyy" }, body: { method: "clockReset", args: [] } },
      s.deps,
    );
    expect(rpc.status).toBe(401);

    // a password reset invalidates old tokens
    const admin = await demoAdmin(s);
    await admin.actions.resetPassword("u-kira");
    expect((await rawView(s, token)).view!.me).toBeNull();
    // expiry
    const p2 = await s.client();
    await p2.actions.login("s-nova", "leo.achterberg", DEMO_PLAYER_PW);
    const t2 = p2["store"].getItem("doomsday.token")!;
    s.clock.t += 15 * 60 * MINUTE;
    expect((await rawView(s, t2)).view!.me).toBeNull();
  });

  it("only whitelisted methods; loadDemo and startFresh are Command only", async () => {
    const s = server();
    const r = await handleRpc({ method: "POST", url: "/api/rpc", headers: {}, body: { method: "constructor", args: [] } }, s.deps);
    expect(r.status).toBe(400);
    const p = await demoPlayer(s);
    await expect(p.actions.loadDemo()).rejects.toThrow(/Admin only/);
    await expect(p.actions.startFresh()).rejects.toThrow(/Admin only/);
  });

  it("two concurrent admin writes both survive", async () => {
    const s = server();
    const a1 = await demoAdmin(s);
    const a2 = await s.client();
    a2["store"].setItem("doomsday.token", a1["store"].getItem("doomsday.token")!);
    await Promise.all([
      a1.actions.postNotification("From laptop one", "", "info"),
      a2.actions.postNotification("From laptop two", "", "info"),
      a1.actions.renameTeam("s-iron", "Iron Meridian Prime"),
    ]);
    await a1.refresh();
    const v = a1.getView()!;
    const titles = v.notifications.map((n) => n.title);
    expect(titles).toContain("From laptop one");
    expect(titles).toContain("From laptop two");
    expect(v.teams.find((t) => t.id === "s-iron")!.name).toBe("Iron Meridian Prime");
  });

  it("first run without SEED creates an empty event with admin / ADMIN_PASSWORD", async () => {
    const s = server("");
    const a = await s.client();
    expect(a.getView()!.teams).toHaveLength(0);
    const r = await a.actions.login(null, "admin", "boot-admin-pass");
    expect(r.mustChangePassword).toBe(false); // forced change is off by default
    expect(a.getView()!.users!.find((u) => u.username === "admin")!.mustChangePassword).toBe(true);
  });

  it("sends no-store and nosniff headers", async () => {
    const s = server();
    const r = await rawView(s);
    expect(r.headers["Cache-Control"]).toBe("no-store");
    expect(r.headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("drops trailing undefined args", () => {
    expect(trimArgs(["a", undefined, 1, undefined, undefined])).toEqual(["a", undefined, 1]);
  });
});

describe("Upstash env detection", () => {
  it("finds credentials under the names Vercel generates", () => {
    expect(findUpstashConfig({ KV_REST_API_URL: "https://a.upstash.io", KV_REST_API_TOKEN: "t1", KV_REST_API_READ_ONLY_TOKEN: "ro" })).toMatchObject({ url: "https://a.upstash.io", token: "t1" });
    expect(findUpstashConfig({ STORAGE_REST_API_URL: "https://b.upstash.io", STORAGE_REST_API_TOKEN: "t2" })).toMatchObject({ token: "t2" });
    expect(findUpstashConfig({ UPSTASH_REDIS_REST_URL: "https://c.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t3" })).toMatchObject({ url: "https://c.upstash.io", token: "t3" });
    expect(findUpstashConfig({ REDIS_URL: "rediss://default:tok%2B4@d-1.upstash.io:6379" })).toMatchObject({ url: "https://d-1.upstash.io", token: "tok+4" });
  });

  it("lists the database-looking variables it saw when nothing matches", () => {
    expect(() => findUpstashConfig({ DATABASE_URL: "postgres://x", KV_TOKEN: "x", HOME: "/root" })).toThrow(/seen: DATABASE_URL, KV_TOKEN/);
  });
});

describe("server: EcoCypher parity", () => {
  it("keeps uploaded audio out of the polled state and serves it on its own", async () => {
    const s = server();
    const admin = await demoAdmin(s);
    const audio = "data:audio/mpeg;base64," + btoa("ID3" + "x".repeat(3000));
    const meta = await admin.actions.uploadSound("airhorn.mp3", audio);
    expect(meta.id).toMatch(/^snd-/);
    expect(admin.getView()!.soundboard.sounds.map((x) => x.name)).toEqual(["airhorn"]);
    expect((await rawView(s)).text).not.toContain("eHh4eHh4");
    const src = admin.soundSrc(`upload:${meta.id}`)!;
    const got = await handleSound({ method: "GET", url: src, headers: {} }, s.deps);
    expect(got.status).toBe(200);
    expect(got.headers["Content-Type"]).toBe("audio/mpeg");
    expect(got.base64).toBe(true);
    // players can't upload, and can't call the internal method directly
    const p = await demoPlayer(s);
    await expect(p.actions.uploadSound("x.mp3", audio)).rejects.toThrow(/Admin only/);
    const direct = await handleRpc({ method: "POST", url: "/api/rpc", headers: {}, body: { method: "registerSound", args: [meta] } }, s.deps);
    expect(direct.status).toBe(400);
    await admin.actions.deleteSound(meta.id);
    expect((await handleSound({ method: "GET", url: src, headers: {} }, s.deps)).status).toBe(404);
  });

  it("shows players and visitors no challenges until the clock starts", async () => {
    const s = server();
    const admin = await demoAdmin(s);
    await admin.actions.clockReset();
    const p = await demoPlayer(s);
    expect(p.getView()!.challenges).toHaveLength(0);
    expect(admin.getView()!.challenges.length).toBeGreaterThan(0);
    await admin.actions.clockStart();
    await p.refresh();
    expect(p.getView()!.challenges.length).toBeGreaterThan(0);
  });

  it("sends usernames only to Admin and to the member themselves", async () => {
    const s = server();
    const anon = (await rawView(s)).text;
    expect(anon).not.toContain("kira.valdez");
    expect(anon).not.toContain('"username"');
    const p = await demoPlayer(s);
    const members = p.getView()!.teams.flatMap((t) => t.members);
    expect(members.filter((m) => m.username).map((m) => m.username)).toEqual(["kira.valdez"]);
  });
});
