import { useRef, useState } from "react";
import { playRef } from "../../components/audio";
import { Icon } from "../../components/Icons";
import { BUILTIN_SOUNDS, CUE_KEYS, CUE_LABELS, MAX_SOUND_BYTES } from "../../core/sounds";
import type { Cue, CueKey, SoundMeta } from "../../core/types";
import { useBackend } from "../../hooks/store";
import { useRun, useUi } from "../../hooks/ui";
import { AdminTitle } from "./CommandApp";

const DEFAULT = "__default__";

/** Plays a cue's sound and shows its pop-up, exactly as players will get it. */
export function usePreview() {
  const { backend } = useBackend();
  const { fireWrong, fireSeal } = useUi();
  return (key: CueKey, cue: Cue) => {
    playRef(cue.sound, backend.soundSrc(cue.sound), cue.seconds);
    if (key === "correct") fireSeal("this challenge", 100, cue.text);
    else fireWrong(key, cue.text);
  };
}

function labelOf(ref: string, sounds: SoundMeta[]) {
  if (ref === "none") return "no sound";
  return BUILTIN_SOUNDS.find((b) => b.ref === ref)?.name ?? sounds.find((s) => `upload:${s.id}` === ref)?.name ?? "missing";
}

/** Sound + pop-up text + length for one moment. With `allowDefault`, it can follow the Soundboard default. */
export function CueEditor({
  k,
  value,
  onChange,
  allowDefault,
  idPrefix,
}: {
  k: CueKey;
  value: Cue | undefined;
  onChange: (c: Cue | undefined) => void;
  allowDefault?: boolean;
  idPrefix: string;
}) {
  const { view } = useBackend();
  const preview = usePreview();
  const board = view.soundboard;
  const fallback = board.cues[k];
  const usingDefault = !!allowDefault && !value;
  const cue = value ?? fallback;
  const set = (patch: Partial<Cue>) => onChange({ ...cue, ...patch });
  const id = (s: string) => `${idPrefix}-${k}-${s}`;
  return (
    <div className="grid gap-3 sm:grid-cols-[1.4fr_1.4fr_5.5rem_auto] sm:items-end">
      <div>
        <label className="label" htmlFor={id("s")}>
          Sound
        </label>
        <select
          id={id("s")}
          className="input"
          value={usingDefault ? DEFAULT : cue.sound}
          onChange={(e) => (e.target.value === DEFAULT ? onChange(undefined) : set({ sound: e.target.value }))}
        >
          {allowDefault && <option value={DEFAULT}>Soundboard default ({labelOf(fallback.sound, board.sounds)})</option>}
          <option value="none">No sound</option>
          <optgroup label="Built in">
            {BUILTIN_SOUNDS.map((b) => (
              <option key={b.ref} value={b.ref}>
                {b.name}
              </option>
            ))}
          </optgroup>
          {board.sounds.length > 0 && (
            <optgroup label="Uploaded">
              {board.sounds.map((s) => (
                <option key={s.id} value={`upload:${s.id}`}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={id("t")}>
          Pop-up text
        </label>
        <input
          id={id("t")}
          className="input disabled:opacity-40"
          maxLength={40}
          disabled={usingDefault}
          placeholder={CUE_LABELS[k].defaultText}
          value={usingDefault ? "" : cue.text}
          onChange={(e) => set({ text: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor={id("n")}>
          Max secs
        </label>
        <input id={id("n")} type="number" min={1} max={30} className="input disabled:opacity-40" disabled={usingDefault} value={cue.seconds} onChange={(e) => set({ seconds: Number(e.target.value) })} />
      </div>
      <button type="button" className="btn-ghost" onClick={() => preview(k, cue)}>
        <Icon.Sound size={16} /> Preview
      </button>
    </div>
  );
}

export function Soundboard() {
  const { view, actions, backend } = useBackend();
  const { run, busy } = useRun();
  const { confirm, toast } = useUi();
  const [draft, setDraft] = useState<Partial<Record<CueKey, Cue>>>({});
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const board = view.soundboard;
  const usedBy = (ref: string) =>
    CUE_KEYS.filter((k) => board.cues[k].sound === ref).length + view.challenges.filter((c) => CUE_KEYS.some((k) => c.cues?.[k]?.sound === ref)).length;
  const drop = (k: CueKey) =>
    setDraft((d) => {
      const n = { ...d };
      delete n[k];
      return n;
    });

  async function upload(f: File) {
    if (f.size > MAX_SOUND_BYTES) {
      toast("error", `That file is ${Math.round(f.size / 1024)} KB. The limit is ${MAX_SOUND_BYTES / 1024} KB; trim it to a few seconds.`);
      return;
    }
    setUploading(true);
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(f);
    });
    await run(() => actions.uploadSound(f.name, dataUrl), `"${f.name}" added to the soundboard.`);
    setUploading(false);
    if (file.current) file.current.value = "";
  }

  const library = [
    ...BUILTIN_SOUNDS.map((b) => ({ ref: b.ref, name: b.name, info: "Built in", id: null as string | null })),
    ...board.sounds.map((s) => ({ ref: `upload:${s.id}`, name: s.name, info: `${Math.round(s.bytes / 1024)} KB, uploaded`, id: s.id })),
  ];

  return (
    <div className="grid max-w-4xl gap-6">
      <AdminTitle sub="Pick the meme sound and pop-up for each moment. These are the event defaults; any challenge can override them in its editor (Challenge library → Edit → Meme sounds).">
        Soundboard
      </AdminTitle>

      <section className="grid gap-4">
        {CUE_KEYS.map((k) => {
          const changed = draft[k] !== undefined;
          return (
            <div key={k} className="plate p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="h-display text-2xl">{CUE_LABELS[k].title}</h2>
                <p className="text-xs text-steel/60">{CUE_LABELS[k].when}</p>
              </div>
              <CueEditor k={k} idPrefix="board" value={draft[k] ?? board.cues[k]} onChange={(c) => c && setDraft((d) => ({ ...d, [k]: c }))} />
              {changed && (
                <div className="mt-3 flex justify-end gap-2">
                  <button className="btn-ghost btn-sm" onClick={() => drop(k)}>
                    Undo
                  </button>
                  <button
                    className="btn-primary btn-sm"
                    disabled={busy}
                    onClick={async () => {
                      if (await run(() => actions.updateCue(k, draft[k]!), `${CUE_LABELS[k].title} saved.`)) drop(k);
                    }}
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="plate p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="h-display text-2xl">Sound library</h2>
            <p className="text-xs text-steel/60">MP3, WAV, OGG or M4A, up to {MAX_SOUND_BYTES / 1024} KB. Short clips work best.</p>
          </div>
          <label className={`btn-primary btn-sm cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}>
            {uploading ? "Uploading…" : "Upload a sound"}
            <input
              ref={file}
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
          </label>
        </div>
        <ul className="divide-y divide-white/5">
          {library.map((s) => (
            <li key={s.ref} className="flex flex-wrap items-center gap-3 py-3">
              <button
                className="grid h-9 w-9 place-items-center rounded-full bg-reactor text-void"
                aria-label={`Play ${s.name}`}
                onClick={() => playRef(s.ref, backend.soundSrc(s.ref), 6)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 4v16l13-8z" />
                </svg>
              </button>
              <span className="min-w-[10rem] flex-1">
                <strong className="text-white">{s.name}</strong>
                <span className="block text-xs text-steel/60">
                  {s.info}
                  {usedBy(s.ref) ? `, used ${usedBy(s.ref)}×` : ""}
                </span>
              </span>
              {s.id && (
                <button
                  className="btn-danger btn-sm"
                  disabled={busy}
                  onClick={async () => {
                    if (await confirm({ title: `Delete "${s.name}"?`, body: "Moments using it go back to their default sound.", danger: true, confirmLabel: "Delete" }))
                      await run(() => actions.deleteSound(s.id!), "Sound deleted.");
                  }}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
