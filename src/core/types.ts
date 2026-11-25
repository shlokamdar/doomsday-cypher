export type Role = "player" | "admin";
export type ThemeId = "reality" | "signal" | "machine" | "archive";
export type ChallengeStatus = "draft" | "scheduled" | "live" | "hidden" | "archived";
export type NotificationLevel = "info" | "important";

/** The moments that show a pop-up. */
export type CueKey = "wrong" | "lastAttempt" | "outOfAttempts" | "correct";
/**
 * What happens at one moment. `image` is "none" (animation only) or "upload:<id>" (a meme shown
 * inside the pop-up). `text` is the big line (empty = the built-in line). `seconds` = time on screen.
 */
export interface Cue {
  image: string;
  text: string;
  seconds: number;
}
/** An admin-uploaded image. The bytes are stored separately and fetched on demand. */
export interface MediaMeta {
  id: string;
  name: string;
  bytes: number;
  mime: string;
  addedAt: number;
}
export interface PopupBoard {
  cues: Record<CueKey, Cue>;
  images: MediaMeta[];
}
export type ChallengeCues = Partial<Record<CueKey, Cue>>;
/** In-browser Python workspace shown in the challenge window, with optional starter code. */
export interface PythonWorkspace {
  enabled: boolean;
  starter: string;
}

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
  /** Extra attempts Admin has granted to every team. */
  bonusAttempts: number;
  hidden: boolean;
  /** null = draft, future = scheduled, past = live */
  releaseAt: number | null;
  /** Set when Admin archives the challenge: out of play and off the scoreboard, but kept. */
  archivedAt?: number | null;
  /** Pop-up overrides for this challenge. Missing keys use the Pop-ups board defaults. */
  cues?: ChallengeCues;
  python?: PythonWorkspace;
  createdAt: number;
}

export interface Submission {
  id: string;
  userId: string;
  teamId: string;
  challengeId: string;
  /** Wrong guesses are kept for Admin; correct flags are stored only as "(correct flag)". */
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
  /** 0 = no time limit: the clock counts up until Admin presses "End now". */
  durationMinutes: number;
  teamSize: number;
  scoreboardVisible: boolean;
  freezeAt: number | null;
  submissionsPerMinute: number;
  /** When on, users with a temporary password must set their own before doing anything else. */
  forcePasswordChange: boolean;
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
  popups: PopupBoard;
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
  /** `username` is only sent to Admin and to the member themselves. */
  members: { id: string; username?: string; displayName: string }[];
}

export interface ViewHint {
  cost: number;
  /** Present only when unlocked by the viewer's team (always for Admin). */
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
  archivedAt?: number | null;
  createdAt: number;
  status: ChallengeStatus;
  cues?: ChallengeCues;
  python?: PythonWorkspace;
  /** Admin only */
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
  /** Admin only */
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
  /** The viewer's own team's submissions (every submission for Admin). */
  submissions: ViewSubmission[];
  notifications: Notification[];
  popups: PopupBoard;
  /** Admin only */
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
  cues?: ChallengeCues;
  python?: PythonWorkspace;
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
