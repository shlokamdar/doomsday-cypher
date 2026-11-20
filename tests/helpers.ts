import { LocalBackend } from "../src/backend/LocalBackend";
import { MemoryStorage, plainCodec, type Codec } from "../src/backend/secureStore";
import { demoDb, freshDb } from "../src/core/seed";
import type { ChallengeInput, DB } from "../src/core/types";

export const ADMIN_PW = "first-admin-pass";
export const ADMIN_PW2 = "changed-admin-pass";
export const NEW_PW = "my-new-password";
/** Documented demo passwords (passwords, not flags). */
export const DEMO_ADMIN_PW = "command-demo-2026";
export const DEMO_PLAYER_PW = "squad-demo-2026";

export const T0 = Date.UTC(2026, 10, 20, 9, 0, 0);

/** Random flags generated at test time: no plaintext flag is ever committed. */
export function randomFlag() {
  return `IAMDOOM{${crypto.randomUUID().replace(/-/g, "")}}`;
}

export function input(over: Partial<ChallengeInput> = {}): ChallengeInput {
  return {
    title: "Test breach",
    typeId: "t-recruit",
    theme: "signal",
    points: 100,
    description: "desc",
    flag: randomFlag(),
    caseSensitive: false,
    maxAttempts: 0,
    hints: [],
    files: [],
    ...over,
  };
}

export interface World {
  clock: { t: number };
  storage: MemoryStorage;
  backend(seed?: () => DB | Promise<DB>, codec?: Codec): Promise<LocalBackend>;
}

export function world(): World {
  const clock = { t: T0 };
  const storage = new MemoryStorage();
  return {
    clock,
    storage,
    async backend(seed = () => freshDb(ADMIN_PW, clock.t), codec = plainCodec) {
      const b = new LocalBackend({ storage, sessionStore: new MemoryStorage(), codec, seed, now: () => clock.t });
      await b.init();
      return b;
    },
  };
}

/** Fresh event with a logged-in admin whose password has been changed. */
export async function adminWorld() {
  const w = world();
  const admin = await w.backend();
  await admin.actions.login(null, "admin", ADMIN_PW);
  // Exercise the full flow: the fresh admin still has a temporary password and changes it.
  await admin.actions.changePassword(ADMIN_PW, ADMIN_PW2);
  return { ...w, admin };
}

/** Creates a squad and logs one member in (password changed). */
export async function joinSquad(w: World, admin: LocalBackend, name = "Alpha", members = ["Ann One", "Bob Two"]) {
  const { teamId, credentials } = await admin.actions.createTeam(name, members);
  const players = [];
  for (const c of credentials) {
    const p = await w.backend();
    await p.actions.login(teamId, c.username, c.password);
    await p.actions.changePassword(c.password, NEW_PW);
    players.push(p);
  }
  return { teamId, credentials, players };
}

export async function demoWorld() {
  const w = world();
  const seed = () => demoDb(w.clock.t);
  return { ...w, seed, make: () => w.backend(seed) };
}
