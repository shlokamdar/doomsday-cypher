/**
 * Pop-ups shown at four moments (wrong flag, last attempt, out of attempts, correct flag).
 * The animation is built in; Admin can change the big line of text, how long it stays up, and
 * add an uploaded meme image. Shared by the server and the browser. There are no sounds.
 */
import { UserError } from "./errors";
import { newId } from "./crypto";
import type { ChallengeCues, Cue, CueKey, MediaMeta, PopupBoard } from "./types";

export const CUE_LABELS: Record<CueKey, { title: string; when: string; defaultText: string; art: string }> = {
  wrong: {
    title: "Wrong flag",
    when: "Any wrong guess (when more than one attempt is left, or attempts are unlimited)",
    defaultText: "WRONG FLAG, AGENT",
    art: "A.R.I.A., the team's holographic assistant, pops up and roasts the guess.",
  },
  lastAttempt: {
    title: "Last attempt left",
    when: "A wrong guess that leaves the team exactly one attempt",
    defaultText: "ONE ATTEMPT LEFT",
    art: "A.R.I.A. in amber alert mode, flashing a warning.",
  },
  outOfAttempts: {
    title: "Out of attempts",
    when: "The wrong guess that uses the team's final attempt",
    defaultText: "LOCKDOWN",
    art: "A.R.I.A. in red lockdown mode as the challenge seals shut.",
  },
  correct: {
    title: "Correct flag",
    when: "The team captures the flag",
    defaultText: "WORTHY!",
    art: "A lightning hammer slams down with thunder bolts and a screen flash.",
  },
};
export const CUE_KEYS = Object.keys(CUE_LABELS) as CueKey[];

/** `image` is "none" (animation only) or "upload:<id>" (a meme shown inside the pop-up). */
export function defaultPopups(): PopupBoard {
  return {
    cues: {
      wrong: { image: "none", text: "", seconds: 3 },
      lastAttempt: { image: "none", text: "", seconds: 4 },
      outOfAttempts: { image: "none", text: "", seconds: 4 },
      correct: { image: "none", text: "", seconds: 4 },
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
export function checkCue(cue: unknown, images: MediaMeta[]): Cue {
  const c = (cue ?? {}) as Partial<Cue>;
  const image = String(c.image ?? "none");
  if (!knownImage(image, images)) throw new UserError("That image isn't on the Pop-ups board any more.");
  const seconds = Math.min(10, Math.max(1, Math.round(Number(c.seconds) || 3)));
  return { image, text: String(c.text ?? "").trim().slice(0, 40), seconds };
}

/** Cleans a challenge's cue overrides. Returns undefined when there are none. */
export function checkCues(cues: unknown, images: MediaMeta[]): ChallengeCues | undefined {
  if (!cues || typeof cues !== "object") return undefined;
  const out: ChallengeCues = {};
  for (const k of CUE_KEYS) {
    const c = (cues as Record<string, unknown>)[k];
    if (c) out[k] = checkCue(c, images);
  }
  return Object.keys(out).length ? out : undefined;
}
