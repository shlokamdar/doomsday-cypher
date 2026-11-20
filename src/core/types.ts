export type Role = "player" | "admin";
export type ThemeId = "reality" | "signal" | "machine" | "archive" | "void" | "chronos";
export type ChallengeStatus = "draft" | "scheduled" | "live" | "hidden";
export type NotificationLevel = "info" | "important";

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  teamId: string | null;
  passwordHash: string;
  passwordSalt: string;
  mustChangePassword: boolean;
  createdAt: number;
}

export interface Team {
  id: string;
  name: string;
  createdAt: number;
}

/** One of the 4 editable categories (difficulty tiers by default). */
export interface ChallengeType {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface Wave {
  id: string;
  number: number;
  createdAt: number;
}

export interface Hint {
  text: string;
  cost: number;
}

export interface FileLink {
  name: string;
  url: string;
}

export interface Challenge {
  id: string;
  waveId: string | null;
  typeId: string;
  theme: ThemeId;
  title: string;
  description: string;
  points: number;
  flagHash: string;
  flagSalt: string;
  caseSensitive: boolean;
  files: FileLink[];
  hints: Hint[];
  /** 0 = unlimited */
  maxAttempts: number;
  /** Extra attempts Command has granted to every squad. */
  bonusAttempts: number;
  hidden: boolean;
  /** null = draft, future = scheduled, past = live */
  releaseAt: number | null;
  createdAt: number;
}

export interface Submission {
  id: string;
  userId: string;
  teamId: string;
  challengeId: string;
  /** Wrong guesses are kept for Command; correct flags are stored only as "(correct flag)". */
  value: string;
  correct: boolean;
  at: number;
}

export interface HintUnlock {
  teamId: string;
  userId: string;
  challengeId: string;
  index: number;
  cost: number;
  at: number;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  level: NotificationLevel;
  at: number;
}

export interface Settings {
  eventName: string;
  tagline: string;
  startsAt: number | null;
  endsAt: number | null;
  durationMinutes: number;
  teamSize: number;
  scoreboardVisible: boolean;
  freezeAt: number | null;
  submissionsPerMinute: number;
}

export interface DB {
  dataVersion: number;
  users: User[];
  teams: Team[];
  challengeTypes: ChallengeType[];
  waves: Wave[];
  challenges: Challenge[];
  submissions: Submission[];
  hintUnlocks: HintUnlock[];
  notifications: Notification[];
  settings: Settings;
}

/* ---------------- View: what one viewer is allowed to see ---------------- */

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  teamId: string | null;
  mustChangePassword?: boolean;
}

export interface ViewTeam {
  id: string;
  name: string;
  createdAt: number;
  members: { id: string; username: string; displayName: string }[];
}

export interface ViewHint {
  cost: number;
  /** Present only when unlocked by the viewer's squad (always for Command). */
  text?: string;
  unlocked: boolean;
  unlockedBy?: string;
  unlockedAt?: number;
}

export interface ViewChallenge {
  id: string;
  waveId: string | null;
  typeId: string;
  theme: ThemeId;
  title: string;
  description: string;
  points: number;
  caseSensitive: boolean;
  files: FileLink[];
  hints: ViewHint[];
  maxAttempts: number;
  bonusAttempts: number;
  hidden: boolean;
  releaseAt: number | null;
  createdAt: number;
  status: ChallengeStatus;
  /** Command only */
  hasFlag?: boolean;
}

export interface Solve {
  teamId: string;
  userId: string;
  challengeId: string;
  at: number;
  points: number;
}

export interface ViewSubmission {
  id: string;
  userId: string;
  teamId: string;
  challengeId: string;
  /** Command only */
  value?: string;
  correct: boolean;
  at: number;
}

export interface View {
  serverNow: number;
  version: string;
  sessionInvalid?: boolean;
  settings: Settings;
  me: PublicUser | null;
  teams: ViewTeam[];
  challengeTypes: ChallengeType[];
  waves: Wave[];
  challenges: ViewChallenge[];
  /** Correct solves the viewer may see (respecting scoreboard hide/freeze). */
  solves: Solve[];
  /** Hint spending the viewer may see (same rules as solves). */
  hintUnlocks: HintUnlock[];
  /** The viewer's own squad's submissions (every submission for Command). */
  submissions: ViewSubmission[];
  notifications: Notification[];
  /** Command only */
  users?: PublicUser[];
}

export interface ChallengeInput {
  id?: string;
  title: string;
  typeId: string;
  theme: ThemeId;
  points: number;
  description: string;
  /** Empty/undefined when editing = keep the current flag. */
  flag?: string;
  caseSensitive: boolean;
  maxAttempts: number;
  hints: Hint[];
  files: FileLink[];
}

export type Release = { mode: "now" } | { mode: "schedule"; at: number } | { mode: "draft" };

export interface Credential {
  userId: string;
  teamName: string;
  displayName: string;
  username: string;
  password: string;
}

export interface SubmitResult {
  correct: boolean;
  alreadySolved?: boolean;
  points: number;
  title: string;
  attemptsLeft: number | null;
}
