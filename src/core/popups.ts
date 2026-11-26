/**
 * Pop-ups shown at four moments (wrong flag, last attempt, out of attempts, correct flag).
 * Each pop-up plays one superpower effect, picked at random every time (never the same one
 * twice in a row) unless Admin locks one. Admin can also change the big line of text, how long
 * it stays up, and add an uploaded meme image. Shared by the server and the browser. No sounds.
 */
import { UserError } from "./errors";
import { newId } from "./crypto";
import type { ChallengeCues, Cue, CueKey, MediaMeta, PopupBoard } from "./types";

export const CUE_LABELS: Record<CueKey, { title: string; when: string; defaultText: string; art: string }> = {
  wrong: {
    title: "Wrong flag",
    when: "Any wrong guess (when more than one attempt is left, or attempts are unlimited)",
    defaultText: "WRONG FLAG, AGENT",
    art: "A random superpower stops the flag: A.R.I.A. roasts it, a force shield blocks it, a web traps it, a portal swallows it, the screen cracks or it turns to dust.",
  },
  lastAttempt: {
    title: "Last attempt left",
    when: "A wrong guess that leaves the team exactly one attempt",
    defaultText: "ONE ATTEMPT LEFT",
    art: "A random wrong-flag superpower, in amber alert colours with a final-attempt warning.",
  },
  outOfAttempts: {
    title: "Out of attempts",
    when: "The wrong guess that uses the team's final attempt",
    defaultText: "LOCKDOWN",
    art: "A random wrong-flag superpower, in red lockdown colours as the challenge seals shut.",
  },
  correct: {
    title: "Correct flag",
    when: "The team captures the flag",
    defaultText: "WORTHY!",
    art: "A random superpower celebrates: lightning hammer, force shield, web catch, energy blast, ground smash, portal or bullseye arrow.",
  },
};
export const CUE_KEYS = Object.keys(CUE_LABELS) as CueKey[];

/* ---------------- Superpower effects ---------------- */

export interface FxInfo {
  id: string;
  name: string;
}
/** Effects for a correct flag. */
export const CORRECT_FX: FxInfo[] = [
  { id: "thunder", name: "Lightning hammer" },
  { id: "shield", name: "Force shield" },
  { id: "web", name: "Web catch" },
  { id: "blast", name: "Energy blast" },
  { id: "smash", name: "Ground smash" },
  { id: "portal", name: "Portal" },
  { id: "arrow", name: "Bullseye arrow" },
];
/** Effects for a wrong flag (also used, recoloured, for last attempt and lockdown). */
export const WRONG_FX: FxInfo[] = [
  { id: "aria", name: "A.R.I.A. assistant" },
  { id: "shield", name: "Force shield block" },
  { id: "web", name: "Stuck in a web" },
  { id: "portal", name: "Swallowed by a portal" },
  { id: "smash", name: "Screen crack" },
  { id: "dust", name: "Turned to dust" },
];
export const fxListFor = (key: CueKey) => (key === "correct" ? CORRECT_FX : WRONG_FX);
const validFx = (key: CueKey, fx: unknown) => typeof fx === "string" && (fx === "random" || fxListFor(key).some((f) => f.id === fx));

/**
 * Turns a cue's effect setting into the effect to play now. "random" picks with the browser's
 * secure random source and never repeats `last`, so players can't predict the next one.
 */
export function pickFx(key: CueKey, fx: string | undefined, last?: string): string {
  const list = fxListFor(key).map((f) => f.id);
  if (fx && fx !== "random" && list.includes(fx)) return fx;
  const pool = list.length > 1 && last ? list.filter((id) => id !== last) : list;
  const r = new Uint32Array(1);
  globalThis.crypto.getRandomValues(r);
  return pool[r[0] % pool.length];
}

/** `image` is "none" (animation only) or "upload:<id>" (a meme shown inside the pop-up). */
export function defaultPopups(): PopupBoard {
  return {
    cues: {
      wrong: { image: "none", text: "", seconds: 3, fx: "random" },
      lastAttempt: { image: "none", text: "", seconds: 4, fx: "random" },
      outOfAttempts: { image: "none", text: "", seconds: 4, fx: "random" },
      correct: { image: "none", text: "", seconds: 4, fx: "random" },
    },
    images: [],
  };
}

/** The cue that applies to a challenge: its own override, else the event default. */
export function cueFor(board: PopupBoard, cues: ChallengeCues | undefined, key: CueKey): Cue {
  return cues?.[key] ?? board.cues[key];
}

export const MAX_IMAGE_BYTES = 1024 * 1024;
/** SVG is not allowed: it can carry scripts. */
const IMAGE_MIME = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/;
const MEDIA_ID = /^img-[a-z0-9]+$/i;
export const isMediaId = (id: unknown): id is string => typeof id === "string" && MEDIA_ID.test(id);

/** Validates an uploaded image (a data: URL) and returns its details. Shared by the browser and the server. */
export function imageMetaFor(name: unknown, dataUrl: unknown, now: number): MediaMeta {
  const m = typeof dataUrl === "string" ? IMAGE_MIME.exec(dataUrl) : null;
  if (!m) throw new UserError("That file isn't a supported image. Use a PNG, JPG, GIF or WEBP.");
  const b64 = m[2];
  const bytes = Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  if (bytes > MAX_IMAGE_BYTES) throw new UserError(`That image is ${Math.round(bytes / 1024)} KB. The limit is ${MAX_IMAGE_BYTES / 1024} KB.`);
  const clean = (typeof name === "string" ? name : "").replace(/\.[a-z0-9]+$/i, "").trim().slice(0, 60) || "Image";
  return { id: "img-" + (newId() + newId()).replace(/[^a-z0-9]/gi, "").slice(0, 14), name: clean, bytes, mime: m[1], addedAt: now };
}

function knownImage(ref: string, images: MediaMeta[]) {
  return ref === "none" || (ref.startsWith("upload:") && images.some((s) => `upload:${s.id}` === ref));
}

/** Cleans one cue. Throws if it points at an image that isn't on the board. */
export function checkCue(cue: unknown, images: MediaMeta[], key: CueKey = "wrong"): Cue {
  const c = (cue ?? {}) as Partial<Cue>;
  const image = String(c.image ?? "none");
  if (!knownImage(image, images)) throw new UserError("That image isn't on the Pop-ups board any more.");
  const seconds = Math.min(10, Math.max(1, Math.round(Number(c.seconds) || 3)));
  const fx = validFx(key, c.fx) ? String(c.fx) : "random";
  return { image, text: String(c.text ?? "").trim().slice(0, 40), seconds, fx };
}

/** Cleans a challenge's cue overrides. Returns undefined when there are none. */
export function checkCues(cues: unknown, images: MediaMeta[]): ChallengeCues | undefined {
  if (!cues || typeof cues !== "object") return undefined;
  const out: ChallengeCues = {};
  for (const k of CUE_KEYS) {
    const c = (cues as Record<string, unknown>)[k];
    if (c) out[k] = checkCue(c, images, k);
  }
  return Object.keys(out).length ? out : undefined;
}
