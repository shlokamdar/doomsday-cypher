import { hmacSign, safeEqual } from "../core/crypto";
import type { DB } from "../core/types";

export const SESSION_HOURS = 14;

/** Token: `userId.expiry.passwordHashPrefix.sig` — a password change/reset invalidates old tokens. */
export async function signToken(secret: string, userId: string, pwHash: string, now: number): Promise<string> {
  const exp = now + SESSION_HOURS * 3600_000;
  const prefix = pwPrefix(pwHash);
  const body = `${userId}.${exp}.${prefix}`;
  return `${body}.${await hmacSign(secret, body)}`;
}

function pwPrefix(hash: string) {
  return hash.slice(0, 10).replace(/[^A-Za-z0-9]/g, "_");
}

/** Returns the user id when the token is valid for the current DB, else null. */
export async function verifyToken(secret: string, token: string | null | undefined, db: DB, now: number): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, expRaw, prefix, sig] = parts;
  const expected = await hmacSign(secret, `${userId}.${expRaw}.${prefix}`);
  if (!safeEqual(sig, expected)) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < now) return null;
  const user = db.users.find((u) => u.id === userId);
  if (!user || !safeEqual(pwPrefix(user.passwordHash), prefix)) return null;
  return user.id;
}
