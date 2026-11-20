import type { ChallengeType, ThemeId } from "./types";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  skill: string;
  tint: string;
  intel: string;
}

/** The six challenge categories. Icons live in components/Icons.tsx. */
export const THEMES: ThemeMeta[] = [
  {
    id: "reality",
    name: "Reality",
    skill: "OSINT",
    tint: "#5AB0FF",
    intel: "Every world leaves fingerprints in public. Look before you hack.",
  },
  {
    id: "signal",
    name: "Signal",
    skill: "Crypto",
    tint: "#F2B33D",
    intel: "The Sovereign's orders travel encrypted. Break the cipher, hear the plan.",
  },
  {
    id: "machine",
    name: "Machine",
    skill: "Python / scripting",
    tint: "#2BD67B",
    intel: "Automate the grind. Ten lines of script beat ten hours of clicking.",
  },
  {
    id: "archive",
    name: "Archive",
    skill: "Data & SQL",
    tint: "#9B7BFF",
    intel: "Every timeline is logged somewhere. Ask the right query.",
  },
  {
    id: "void",
    name: "Void",
    skill: "Forensics",
    tint: "#E0408A",
    intel: "Deleted is never gone. Carve out what the void swallowed.",
  },
  {
    id: "chronos",
    name: "Chronos",
    skill: "Logic & timing",
    tint: "#3DD6D0",
    intel: "Order, sequence and timing: the clock itself is a puzzle.",
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);

export function themeMeta(id: string): ThemeMeta {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function findTheme(value: string): ThemeMeta | undefined {
  const v = value.trim().toLowerCase();
  return THEMES.find((t) => t.id === v || t.name.toLowerCase() === v || t.skill.toLowerCase() === v);
}

export const DEFAULT_CHALLENGE_TYPES: ChallengeType[] = [
  { id: "t-recruit", name: "Recruit", description: "Warm-up challenges with one clear step.", color: "#2BD67B" },
  { id: "t-agent", name: "Agent", description: "Two or three steps and some digging.", color: "#F2B33D" },
  { id: "t-elite", name: "Elite", description: "Multi-stage. Expect to write a script.", color: "#E0408A" },
  { id: "t-legend", name: "Legend", description: "For the team that wants the crown.", color: "#9B7BFF" },
];

/** Lane / emblem colours for teams, assigned by creation order. */
export const SQUAD_COLORS = [
  "#2BD67B",
  "#E0408A",
  "#5AB0FF",
  "#F2B33D",
  "#9B7BFF",
  "#3DD6D0",
  "#FF7A45",
  "#C9D2DC",
];
