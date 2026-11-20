/**
 * Hashing helpers shared by the browser and the server (WebCrypto exists in both).
 * Flags and passwords use PBKDF2-SHA256, 150,000 iterations, with a per-item salt.
 */
export const PBKDF2_ITERATIONS = 150_000;

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();

export function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function b64url(bytes: Uint8Array): string {
  return bytesToB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

export function newSalt(): string {
  return bytesToB64(randomBytes(16));
}

export function newId(prefix = ""): string {
  return prefix + b64url(randomBytes(9));
}

export async function pbkdf2(secret: string, saltB64: string): Promise<string> {
  const key = await subtle().importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle().deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: b64ToBytes(saltB64), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return bytesToB64(new Uint8Array(bits));
}

/** Constant-time comparison (only the length can leak). */
export function safeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const n = Math.max(ab.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export function normaliseFlag(value: string, caseSensitive: boolean): string {
  const t = value.trim();
  return caseSensitive ? t : t.toLowerCase();
}

export function hashFlag(flag: string, caseSensitive: boolean, salt: string): Promise<string> {
  return pbkdf2("flag:" + normaliseFlag(flag, caseSensitive), salt);
}

export function hashPassword(password: string, salt: string): Promise<string> {
  return pbkdf2("pw:" + password, salt);
}

const PW_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Readable temporary password, e.g. "kx7R-pm3Q-Zt9w". */
export function tempPassword(): string {
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) {
    if (i && i % 4 === 0) out += "-";
    out += PW_ALPHABET[bytes[i] % PW_ALPHABET.length];
  }
  return out;
}

export async function sha256Hex(text: string): Promise<string> {
  const d = await subtle().digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await subtle().importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await subtle().sign("HMAC", key, enc.encode(data));
  return b64url(new Uint8Array(sig));
}
