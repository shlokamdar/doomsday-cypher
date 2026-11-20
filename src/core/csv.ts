import { defaultHintCost } from "./logic";
import { findTheme } from "./themes";
import type { ChallengeInput, ChallengeType, FileLink, Hint } from "./types";

/** RFC 4180-style CSV parser (quotes, escaped quotes, CRLF, newlines in quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (inQuotes) throw new Error("Unclosed quote in CSV.");
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c);
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
}

export const BREACH_HEADER = ["title", "type", "theme", "points", "flag", "description", "hint", "hint_cost", "attempts", "files"];

export const BREACH_TEMPLATE = toCsv([
  BREACH_HEADER,
  [
    "Example breach",
    "Recruit",
    "Signal",
    100,
    "REPLACE_WITH_YOUR_FLAG",
    "Describe the breach here.",
    "Optional hint text",
    10,
    0,
    "notes.txt|https://example.org/notes.txt;image.png|https://example.org/image.png",
  ],
]);

export interface RowError {
  row: number;
  message: string;
}

export function parseFiles(value: string): FileLink[] {
  if (!value.trim()) return [];
  return value
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [name, ...rest] = p.split("|");
      const url = rest.join("|").trim();
      if (!name.trim() || !url) throw new Error(`File "${p}" must look like name|url.`);
      if (!/^(https?:\/\/|\/|files\/)/i.test(url)) throw new Error(`File URL "${url}" must start with http(s):// or /.`);
      return { name: name.trim(), url };
    });
}

/** Parses breach imports from CSV (header required) or JSON (array of objects with the same keys). */
export function parseBreachImport(
  text: string,
  types: ChallengeType[],
): { rows: ChallengeInput[]; errors: RowError[] } {
  const trimmed = text.trim();
  let records: Record<string, unknown>[];
  const errors: RowError[] = [];
  if (!trimmed) return { rows: [], errors: [{ row: 0, message: "The file is empty." }] };
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      records = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return { rows: [], errors: [{ row: 0, message: "Invalid JSON." }] };
    }
  } else {
    let table: string[][];
    try {
      table = parseCsv(trimmed);
    } catch (e) {
      return { rows: [], errors: [{ row: 0, message: (e as Error).message }] };
    }
    const header = table[0].map((h) => h.trim().toLowerCase());
    const missing = ["title", "points", "flag"].filter((h) => !header.includes(h));
    if (missing.length) return { rows: [], errors: [{ row: 1, message: `Header is missing: ${missing.join(", ")}.` }] };
    records = table.slice(1).map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""])));
  }

  const rows: ChallengeInput[] = [];
  records.forEach((r, i) => {
    const rowNo = i + 2;
    const str = (k: string) => (r[k] === undefined || r[k] === null ? "" : String(r[k])).trim();
    try {
      const title = str("title");
      if (!title) throw new Error("Title is required.");
      const points = Number(str("points"));
      if (!Number.isFinite(points) || points <= 0 || !Number.isInteger(points)) throw new Error("Points must be a positive whole number.");
      const flag = str("flag");
      if (!flag) throw new Error("Flag is required.");
      const typeName = str("type");
      const type = typeName
        ? types.find((t) => t.name.toLowerCase() === typeName.toLowerCase() || t.id === typeName)
        : types[0];
      if (!type) throw new Error(`Unknown category "${typeName}". Use one of: ${types.map((t) => t.name).join(", ")}.`);
      const themeName = str("theme");
      const theme = themeName ? findTheme(themeName) : findTheme("reality");
      if (!theme) throw new Error(`Unknown theme "${themeName}".`);
      const attemptsRaw = str("attempts");
      const attempts = attemptsRaw ? Number(attemptsRaw) : 0;
      if (!Number.isInteger(attempts) || attempts < 0) throw new Error("Attempts must be 0 (unlimited) or more.");
      const hints: Hint[] = [];
      if (Array.isArray(r.hints)) {
        for (const h of r.hints as Hint[]) hints.push({ text: String(h.text), cost: Number(h.cost) || defaultHintCost(points) });
      } else if (str("hint")) {
        const costRaw = str("hint_cost");
        const cost = costRaw ? Number(costRaw) : defaultHintCost(points);
        if (!Number.isFinite(cost) || cost < 0) throw new Error("Hint cost must be a number.");
        hints.push({ text: str("hint"), cost });
      }
      const files = Array.isArray(r.files) ? (r.files as FileLink[]) : parseFiles(str("files"));
      rows.push({
        title,
        typeId: type.id,
        theme: theme.id,
        points,
        description: str("description"),
        flag,
        caseSensitive: str("case_sensitive").toLowerCase() === "true",
        maxAttempts: attempts,
        hints,
        files,
      });
    } catch (e) {
      errors.push({ row: rowNo, message: (e as Error).message });
    }
  });
  return { rows, errors };
}

/** Squad import: `team,member1,member2,member3` (header optional). */
export function parseSquadCsv(text: string, teamSize: number): { rows: { team: string; members: string[] }[]; errors: RowError[] } {
  const errors: RowError[] = [];
  let table: string[][];
  try {
    table = parseCsv(text.trim());
  } catch (e) {
    return { rows: [], errors: [{ row: 0, message: (e as Error).message }] };
  }
  const start = table[0] && table[0][0]?.trim().toLowerCase() === "team" ? 1 : 0;
  const rows: { team: string; members: string[] }[] = [];
  table.slice(start).forEach((cells, i) => {
    const rowNo = i + 1 + start;
    const team = (cells[0] ?? "").trim();
    const members = cells.slice(1).map((c) => c.trim()).filter(Boolean);
    if (!team) errors.push({ row: rowNo, message: "Squad name is required." });
    else if (!members.length) errors.push({ row: rowNo, message: "At least one member is required." });
    else if (members.length > teamSize) errors.push({ row: rowNo, message: `Too many members (max ${teamSize}).` });
    else rows.push({ team, members });
  });
  return { rows, errors };
}
