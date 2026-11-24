/** Built-in sounds and the default meme moments. Shared by the server and the browser. */
import { UserError } from "./errors";
import { newId } from "./crypto";
import type { ChallengeCues, Cue, CueKey, Soundboard, SoundMeta } from "./types";

/** `file` is relative to the site root. A sound without a file is synthesised in the browser. */
export const BUILTIN_SOUNDS: { ref: string; name: string; file?: string }[] = [
  { ref: "builtin:faaah", name: "FAAAAH", file: "sounds/faaah.mp3" },
  { ref: "builtin:abhi-maza", name: "Abhi maza aayega", file: "sounds/abhi-maza.mp3" },
  { ref: "builtin:game-over", name: "Game over", file: "sounds/game-over.mp3" },
  { ref: "builtin:seal", name: "Breach sealed chord (generated)" },
];

export const CUE_LABELS: Record<CueKey, { title: string; when: string; defaultText: string }> = {
  wrong: {
    title: "Wrong flag",
    when: "Any wrong guess (when more than one attempt is left, or attempts are unlimited)",
    defaultText: "FAAAAAA!!!!!!!!",
  },
  lastAttempt: {
    title: "Last attempt left",
    when: "A wrong guess that leaves the team exactly one attempt",
    defaultText: "ABHI MAZA AAYEGA!",
  },
  outOfAttempts: {
    title: "Out of attempts",
    when: "The wrong guess that uses the team's final attempt",
    defaultText: "GAME OVER",
  },
  correct: { title: "Correct flag", when: "The team captures the flag", defaultText: "BREACH SEALED" },
};
export const CUE_KEYS = Object.keys(CUE_LABELS) as CueKey[];

export function defaultSoundboard(): Soundboard {
  return {
    cues: {
      wrong: { sound: "builtin:faaah", text: "", seconds: 4 },
      lastAttempt: { sound: "builtin:abhi-maza", text: "", seconds: 6 },
      outOfAttempts: { sound: "builtin:game-over", text: "", seconds: 8 },
      correct: { sound: "builtin:seal", text: "", seconds: 3 },
    },
    sounds: [],
  };
}

/** The cue that applies to a challenge: its own override, else the event default. */
export function cueFor(board: Soundboard, cues: ChallengeCues | undefined, key: CueKey): Cue {
  return cues?.[key] ?? board.cues[key];
}

export const MAX_SOUND_BYTES = 600 * 1024;
const SOUND_ID = /^snd-[a-z0-9]+$/i;
export const isSoundId = (id: unknown): id is string => typeof id === "string" && SOUND_ID.test(id);

/** Validates an uploaded sound (a data: URL) and returns its details. Shared by the browser and the server. */
export function soundMetaFor(name: unknown, dataUrl: unknown, now: number): SoundMeta {
  const m = typeof dataUrl === "string" ? /^data:(audio\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!m) throw new UserError("That file isn't an audio file. Use an MP3, WAV, OGG or M4A.");
  const b64 = m[2];
  const bytes = Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  if (bytes > MAX_SOUND_BYTES)
    throw new UserError(`That sound is ${Math.round(bytes / 1024)} KB. The limit is ${MAX_SOUND_BYTES / 1024} KB; trim it to a few seconds.`);
  const clean = (typeof name === "string" ? name : "").replace(/\.[a-z0-9]+$/i, "").trim().slice(0, 60) || "Sound";
  return { id: "snd-" + (newId() + newId()).replace(/[^a-z0-9]/gi, "").slice(0, 14), name: clean, bytes, mime: m[1], addedAt: now };
}

function knownSound(ref: string, sounds: SoundMeta[]) {
  return ref === "none" || BUILTIN_SOUNDS.some((b) => b.ref === ref) || (ref.startsWith("upload:") && sounds.some((s) => `upload:${s.id}` === ref));
}

/** Cleans one cue. Throws if it points at a sound that isn't on the soundboard. */
export function checkCue(cue: unknown, sounds: SoundMeta[]): Cue {
  const c = (cue ?? {}) as Partial<Cue>;
  const sound = String(c.sound ?? "none");
  if (!knownSound(sound, sounds)) throw new UserError("That sound isn't on the soundboard any more.");
  const seconds = Math.min(30, Math.max(1, Math.round(Number(c.seconds) || 4)));
  return { sound, text: String(c.text ?? "").trim().slice(0, 40), seconds };
}

/** Cleans a challenge's cue overrides. Returns undefined when there are none. */
export function checkCues(cues: unknown, sounds: SoundMeta[]): ChallengeCues | undefined {
  if (!cues || typeof cues !== "object") return undefined;
  const out: ChallengeCues = {};
  for (const k of CUE_KEYS) {
    const c = (cues as Record<string, unknown>)[k];
    if (c) out[k] = checkCue(c, sounds);
  }
  return Object.keys(out).length ? out : undefined;
}
