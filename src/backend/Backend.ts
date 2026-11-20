import type { RowError } from "../core/csv";
import type {
  ChallengeInput,
  ChallengeType,
  Credential,
  NotificationLevel,
  Release,
  Settings,
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

  saveChallenge(input: ChallengeInput): Promise<{ id: string }>;
  postWave(inputs: ChallengeInput[], release: Release): Promise<{ waveId: string; number: number; ids: string[] }>;
  postSingle(input: ChallengeInput, release: Release): Promise<{ id: string }>;
  releaseNow(id: string): Promise<unknown>;
  schedule(id: string, at: number): Promise<unknown>;
  unpublish(id: string): Promise<unknown>;
  setHidden(id: string, hidden: boolean): Promise<unknown>;
  releaseWave(waveId: string): Promise<unknown>;
  deleteChallenge(id: string): Promise<unknown>;
  grantAttempts(id: string, n?: number): Promise<unknown>;

  createTeam(name: string, members: string[]): Promise<{ teamId: string; credentials: Credential[] }>;
  importTeams(csv: string): Promise<{ credentials: Credential[]; errors: RowError[] }>;
  renameTeam(teamId: string, name: string): Promise<unknown>;
  addMember(teamId: string, displayName: string): Promise<Credential>;
  resetPassword(userId: string): Promise<Credential>;
  removeMember(userId: string): Promise<unknown>;
  deleteTeam(teamId: string): Promise<unknown>;

  postNotification(title: string, body: string, level: NotificationLevel): Promise<unknown>;
  deleteNotification(id: string): Promise<unknown>;

  updateSettings(patch: Partial<Pick<Settings, "eventName" | "tagline" | "durationMinutes" | "teamSize" | "submissionsPerMinute">>): Promise<unknown>;
  updateChallengeTypes(types: ChallengeType[]): Promise<unknown>;
  setScoreboardVisible(visible: boolean): Promise<unknown>;
  freezeScoreboard(): Promise<unknown>;
  unfreezeScoreboard(): Promise<unknown>;

  exportBackup(): Promise<{ json: string }>;
  importBackup(json: string): Promise<unknown>;
  startFresh(): Promise<{ credential: Credential }>;
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
  "saveChallenge",
  "postWave",
  "postSingle",
  "releaseNow",
  "schedule",
  "unpublish",
  "setHidden",
  "releaseWave",
  "deleteChallenge",
  "grantAttempts",
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

export interface Backend {
  readonly mode: "local" | "remote";
  readonly actions: Actions;
  init(): Promise<void>;
  getView(): View | null;
  subscribe(fn: () => void): () => void;
  refresh(): Promise<void>;
  logout(): Promise<void>;
  /** serverNow − Date.now(), so clocks agree with the server. */
  clockOffset(): number;
  online(): boolean;
  dispose(): void;
}
