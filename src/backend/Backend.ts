import type { RowError } from "../core/csv";
import type {
  ChallengeInput,
  ChallengeType,
  Credential,
  Cue,
  CueKey,
  NotificationLevel,
  Release,
  Settings,
  SoundMeta,
  SubmitResult,
  View,
} from "../core/types";

/** Every action the UI can take. All of them go through the backend and return Promises. */
export interface Actions {
  login(teamId: string | null, username: string, password: string): Promise<{ mustChangePassword: boolean }>;
  changePassword(oldPassword: string, newPassword: string): Promise<unknown>;
  submitFlag(challengeId: string, value: string): Promise<SubmitResult>;
  unlockHint(challengeId: string, index: number): Promise<{ already: boolean }>;

  clockStart(): Promise<unknown>;
  clockAddMinutes(minutes: number): Promise<unknown>;
  clockEnd(): Promise<unknown>;
  clockReset(): Promise<unknown>;
  clockRemoveLimit(): Promise<unknown>;

  saveChallenge(input: ChallengeInput): Promise<{ id: string }>;
  postWave(inputs: ChallengeInput[], release: Release): Promise<{ waveId: string; number: number; ids: string[] }>;
  postSingle(input: ChallengeInput, release: Release): Promise<{ id: string }>;
  releaseNow(id: string): Promise<unknown>;
  schedule(id: string, at: number): Promise<unknown>;
  unpublish(id: string): Promise<unknown>;
  setHidden(id: string, hidden: boolean): Promise<unknown>;
  releaseWave(waveId: string): Promise<unknown>;
  deleteChallenge(id: string): Promise<unknown>;
  archiveChallenge(id: string): Promise<unknown>;
  restoreChallenge(id: string): Promise<unknown>;
  grantAttempts(id: string, n?: number): Promise<unknown>;
  groupIntoWave(ids: string[]): Promise<{ waveId: string; number: number }>;
  splitWave(waveId: string): Promise<unknown>;

  createTeam(name: string, members: string[]): Promise<{ teamId: string; credentials: Credential[] }>;
  importTeams(csv: string): Promise<{ credentials: Credential[]; errors: RowError[] }>;
  renameTeam(teamId: string, name: string): Promise<unknown>;
  addMember(teamId: string, displayName: string): Promise<Credential>;
  resetPassword(userId: string): Promise<Credential>;
  removeMember(userId: string): Promise<unknown>;
  deleteTeam(teamId: string): Promise<unknown>;

  postNotification(title: string, body: string, level: NotificationLevel): Promise<unknown>;
  deleteNotification(id: string): Promise<unknown>;

  updateSettings(patch: Partial<Pick<Settings, "eventName" | "tagline" | "durationMinutes" | "teamSize" | "submissionsPerMinute" | "forcePasswordChange">>): Promise<unknown>;
  updateChallengeTypes(types: ChallengeType[]): Promise<unknown>;
  setScoreboardVisible(visible: boolean): Promise<unknown>;
  freezeScoreboard(): Promise<unknown>;
  unfreezeScoreboard(): Promise<unknown>;

  updateCue(key: CueKey, cue: Cue): Promise<unknown>;
  /** Stores the audio (a data: URL) and adds it to the soundboard. Handled by each backend. */
  uploadSound(name: string, dataUrl: string): Promise<SoundMeta>;
  deleteSound(id: string): Promise<unknown>;

  exportBackup(): Promise<{ json: string }>;
  importBackup(json: string): Promise<unknown>;
  startFresh(): Promise<unknown>;
  loadDemo(): Promise<unknown>;
}

export const ACTION_NAMES: (keyof Actions)[] = [
  "login",
  "changePassword",
  "submitFlag",
  "unlockHint",
  "clockStart",
  "clockAddMinutes",
  "clockEnd",
  "clockReset",
  "clockRemoveLimit",
  "saveChallenge",
  "postWave",
  "postSingle",
  "releaseNow",
  "schedule",
  "unpublish",
  "setHidden",
  "releaseWave",
  "deleteChallenge",
  "archiveChallenge",
  "restoreChallenge",
  "grantAttempts",
  "groupIntoWave",
  "splitWave",
  "createTeam",
  "importTeams",
  "renameTeam",
  "addMember",
  "resetPassword",
  "removeMember",
  "deleteTeam",
  "postNotification",
  "deleteNotification",
  "updateSettings",
  "updateChallengeTypes",
  "setScoreboardVisible",
  "freezeScoreboard",
  "unfreezeScoreboard",
  "updateCue",
  "uploadSound",
  "deleteSound",
  "exportBackup",
  "importBackup",
  "startFresh",
  "loadDemo",
];

export function makeActions(exec: (method: string, args: unknown[]) => Promise<unknown>): Actions {
  const out: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  for (const name of ACTION_NAMES) out[name] = (...args: unknown[]) => exec(name, args);
  return out as unknown as Actions;
}

/** Where a built-in sound lives, relative to the site. */
export function builtinSoundSrc(ref: string, file: string | undefined): string | null {
  if (!file) return null;
  let base = "/";
  try {
    base = import.meta.env.BASE_URL ?? "/";
  } catch {
    /* not built by Vite */
  }
  return `${base}${file}`;
}

export interface Backend {
  readonly mode: "local" | "remote";
  readonly actions: Actions;
  init(): Promise<void>;
  getView(): View | null;
  subscribe(fn: () => void): () => void;
  refresh(): Promise<void>;
  logout(): Promise<void>;
  /** Downloads a challenge file. Private files (/api/file) need the player's login. */
  downloadFile(url: string, name: string): Promise<void>;
  /** A URL the browser can play for a sound reference ("builtin:…" or "upload:…"), or null. */
  soundSrc(ref: string): string | null;
  /** serverNow − Date.now(), so clocks agree with the server. */
  clockOffset(): number;
  online(): boolean;
  dispose(): void;
}
