import { ThemeIcon, Icon } from "../../components/Icons";
import { defaultHintCost } from "../../core/logic";
import { THEMES } from "../../core/themes";
import type { ChallengeInput, Release } from "../../core/types";
import { useBackend } from "../../hooks/store";

export function blankInput(typeId: string): ChallengeInput {
  return { title: "", typeId, theme: "reality", points: 100, description: "", flag: "", caseSensitive: false, maxAttempts: 0, hints: [], files: [] };
}

export function BreachForm({ value, onChange, editing = false, idPrefix = "bf" }: { value: ChallengeInput; onChange: (v: ChallengeInput) => void; editing?: boolean; idPrefix?: string }) {
  const { view } = useBackend();
  const set = <K extends keyof ChallengeInput>(k: K, v: ChallengeInput[K]) => onChange({ ...value, [k]: v });
  const id = (s: string) => `${idPrefix}-${s}`;
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_120px_180px]">
        <div>
          <label className="label" htmlFor={id("title")}>
            Title
          </label>
          <input id={id("title")} className="input" value={value.title} onChange={(e) => set("title", e.target.value)} maxLength={120} />
        </div>
        <div>
          <label className="label" htmlFor={id("points")}>
            Points
          </label>
          <input id={id("points")} type="number" min={1} className="input" value={value.points} onChange={(e) => set("points", Number(e.target.value))} />
        </div>
        <div>
          <label className="label" htmlFor={id("type")}>
            Category
          </label>
          <select id={id("type")} className="input" value={value.typeId} onChange={(e) => set("typeId", e.target.value)}>
            {view.challengeTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="label">Theme</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {THEMES.map((t) => (
            <button
              type="button"
              key={t.id}
              aria-pressed={value.theme === t.id}
              onClick={() => set("theme", t.id)}
              className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold transition ${value.theme === t.id ? "bg-white/10 text-white" : "border-white/10 text-steel/70 hover:border-white/30"}`}
              style={{ borderColor: value.theme === t.id ? t.tint : undefined }}
            >
              <span style={{ color: t.tint }}>
                <ThemeIcon theme={t.id} size={22} />
              </span>
              {t.name}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor={id("desc")}>
          Description
        </label>
        <textarea id={id("desc")} className="input min-h-[96px]" value={value.description} onChange={(e) => set("description", e.target.value)} maxLength={5000} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto_160px] sm:items-end">
        <div>
          <label className="label" htmlFor={id("flag")}>
            Flag
          </label>
          <input
            id={id("flag")}
            className="input font-mono"
            autoComplete="off"
            spellCheck={false}
            placeholder={editing ? "Leave empty to keep the current flag" : "IAMDOOM{…}"}
            value={value.flag ?? ""}
            onChange={(e) => set("flag", e.target.value)}
          />
        </div>
        <label className="flex min-h-[40px] items-center gap-2 text-sm text-steel">
          <input type="checkbox" className="h-4 w-4 accent-reactor" checked={value.caseSensitive} onChange={(e) => set("caseSensitive", e.target.checked)} />
          Case-sensitive
        </label>
        <div>
          <label className="label" htmlFor={id("att")}>
            Attempts / team
          </label>
          <input id={id("att")} type="number" min={0} className="input" value={value.maxAttempts} onChange={(e) => set("maxAttempts", Number(e.target.value))} aria-describedby={id("att-h")} />
          <span id={id("att-h")} className="text-[11px] text-steel/50">
            0 = unlimited
          </span>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="label mb-0">Hints</span>
          <button type="button" className="btn-ghost btn-sm" onClick={() => set("hints", [...value.hints, { text: "", cost: defaultHintCost(value.points || 100) }])}>
            <Icon.Plus /> Add hint
          </button>
        </div>
        {value.hints.length === 0 && <p className="text-sm text-steel/50">No hints.</p>}
        <ul className="grid gap-2">
          {value.hints.map((h, i) => (
            <li key={i} className="grid grid-cols-[1fr_96px_auto] gap-2">
              <input className="input" aria-label={`Hint ${i + 1} text`} placeholder={`Hint ${i + 1}`} value={h.text} onChange={(e) => set("hints", value.hints.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              <input className="input" type="number" min={0} aria-label={`Hint ${i + 1} cost`} value={h.cost} onChange={(e) => set("hints", value.hints.map((x, j) => (j === i ? { ...x, cost: Number(e.target.value) } : x)))} />
              <button type="button" className="btn-ghost btn-sm" aria-label={`Remove hint ${i + 1}`} onClick={() => set("hints", value.hints.filter((_, j) => j !== i))}>
                <Icon.Trash />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="label mb-0">File links</span>
          <button type="button" className="btn-ghost btn-sm" onClick={() => set("files", [...value.files, { name: "", url: "" }])}>
            <Icon.Plus /> Add file
          </button>
        </div>
        {value.files.length === 0 && <p className="text-sm text-steel/50">No files.</p>}
        <ul className="grid gap-2">
          {value.files.map((f, i) => (
            <li key={i} className="grid grid-cols-[140px_1fr_auto] gap-2">
              <input className="input" aria-label={`File ${i + 1} name`} placeholder="name.txt" value={f.name} onChange={(e) => set("files", value.files.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input className="input" aria-label={`File ${i + 1} link`} placeholder="https://…" value={f.url} onChange={(e) => set("files", value.files.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              <button type="button" className="btn-ghost btn-sm" aria-label={`Remove file ${i + 1}`} onClick={() => set("files", value.files.filter((_, j) => j !== i))}>
                <Icon.Trash />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export type ReleaseChoice = { mode: "now" } | { mode: "schedule"; local: string } | { mode: "draft" };

export function toRelease(r: ReleaseChoice): Release {
  if (r.mode === "schedule") return { mode: "schedule", at: new Date(r.local).getTime() };
  return r;
}

export function localInput(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReleasePicker({ value, onChange }: { value: ReleaseChoice; onChange: (v: ReleaseChoice) => void }) {
  const opts: { mode: ReleaseChoice["mode"]; label: string }[] = [
    { mode: "now", label: "Post now" },
    { mode: "schedule", label: "Schedule" },
    { mode: "draft", label: "Save as draft" },
  ];
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="label">Release</legend>
      {opts.map((o) => (
        <button
          type="button"
          key={o.mode}
          aria-pressed={value.mode === o.mode}
          onClick={() => onChange(o.mode === "schedule" ? { mode: "schedule", local: localInput(Date.now() + 30 * 60_000) } : ({ mode: o.mode } as ReleaseChoice))}
          className={`rounded-md border px-3 py-2 text-sm font-semibold ${value.mode === o.mode ? "border-reactor bg-reactor/15 text-reactor" : "border-white/10 text-steel hover:border-white/30"}`}
        >
          {o.label}
        </button>
      ))}
      {value.mode === "schedule" && (
        <input type="datetime-local" aria-label="Release time" className="input w-auto" value={value.local} onChange={(e) => onChange({ mode: "schedule", local: e.target.value })} />
      )}
    </fieldset>
  );
}
