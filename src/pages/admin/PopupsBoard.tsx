import { useRef, useState } from "react";
import { CUE_KEYS, CUE_LABELS, fxListFor, MAX_IMAGE_BYTES } from "../../core/popups";
import type { Cue, CueKey, MediaMeta } from "../../core/types";
import { useBackend } from "../../hooks/store";
import { useRun, useUi } from "../../hooks/ui";
import { AdminTitle } from "./CommandApp";

const DEFAULT = "__default__";

/** Shows a moment's pop-up exactly as players will see it. */
export function usePreview() {
  const { backend } = useBackend();
  const { fireWrong, fireSeal } = useUi();
  return (key: CueKey, cue: Cue) => {
    const opts = { text: cue.text, image: backend.mediaSrc(cue.image), seconds: cue.seconds, fx: cue.fx };
    if (key === "correct") fireSeal("this challenge", 100, opts);
    else fireWrong(key, opts);
  };
}

function labelOf(ref: string, images: MediaMeta[]) {
  if (ref === "none") return "animation only";
  return images.find((s) => `upload:${s.id}` === ref)?.name ?? "missing";
}

/** Superpower effect + meme image + pop-up text + time on screen for one moment. With `allowDefault`, it can follow the board default. */
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
  const board = view.popups;
  const fallback = board.cues[k];
  const usingDefault = !!allowDefault && !value;
  const cue = value ?? fallback;
  const set = (patch: Partial<Cue>) => onChange({ ...cue, ...patch });
  const id = (s: string) => `${idPrefix}-${k}-${s}`;
  return (
    <div className="grid gap-3 sm:grid-cols-[1.3fr_1.3fr_1.3fr_5.5rem_auto] sm:items-end">
      <div>
        <label className="label" htmlFor={id("f")}>
          Effect
        </label>
        <select id={id("f")} className="input disabled:opacity-40" disabled={usingDefault} value={cue.fx ?? "random"} onChange={(e) => set({ fx: e.target.value })}>
          <option value="random">Random every time</option>
          {fxListFor(k).map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={id("i")}>
          Meme image
        </label>
        <select id={id("i")} className="input" value={usingDefault ? DEFAULT : cue.image} onChange={(e) => (e.target.value === DEFAULT ? onChange(undefined) : set({ image: e.target.value }))}>
          {allowDefault && <option value={DEFAULT}>Pop-ups board default ({labelOf(fallback.image, board.images)})</option>}
          <option value="none">No image (animation only)</option>
          {board.images.length > 0 && (
            <optgroup label="Uploaded">
              {board.images.map((s) => (
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
          Big text
        </label>
        <input
          id={id("t")}
          className="input disabled:opacity-40"
          maxLength={40}
          disabled={usingDefault}
          placeholder={k === "wrong" || k === "correct" ? "Each effect's own line" : CUE_LABELS[k].defaultText}
          value={usingDefault ? "" : cue.text}
          onChange={(e) => set({ text: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor={id("n")}>
          Seconds
        </label>
        <input id={id("n")} type="number" min={1} max={10} className="input disabled:opacity-40" disabled={usingDefault} value={cue.seconds} onChange={(e) => set({ seconds: Number(e.target.value) })} />
      </div>
      <button type="button" className="btn-ghost" onClick={() => preview(k, cue)}>
        Preview
      </button>
    </div>
  );
}

export function PopupsBoard() {
  const { view, actions, backend } = useBackend();
  const { run, busy } = useRun();
  const { confirm, toast } = useUi();
  const [draft, setDraft] = useState<Partial<Record<CueKey, Cue>>>({});
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const board = view.popups;
  const usedBy = (ref: string) =>
    CUE_KEYS.filter((k) => board.cues[k].image === ref).length + view.challenges.filter((c) => CUE_KEYS.some((k) => c.cues?.[k]?.image === ref)).length;
  const drop = (k: CueKey) =>
    setDraft((d) => {
      const n = { ...d };
      delete n[k];
      return n;
    });

  async function upload(files: FileList) {
    setUploading(true);
    for (const f of Array.from(files)) {
      if (f.size > MAX_IMAGE_BYTES) {
        toast("error", `${f.name} is ${Math.round(f.size / 1024)} KB. The limit is ${MAX_IMAGE_BYTES / 1024} KB.`);
        continue;
      }
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      await run(() => actions.uploadImage(f.name, dataUrl), `"${f.name}" added.`);
    }
    setUploading(false);
    if (file.current) file.current.value = "";
  }

  return (
    <div className="grid max-w-4xl gap-6">
      <AdminTitle sub="Pick the pop-up for each moment. These are the event defaults; any challenge can override them in its editor (Challenge library → Edit → Pop-ups). There are no sounds.">
        Pop-ups
      </AdminTitle>

      <section className="grid gap-4">
        {CUE_KEYS.map((k) => {
          const changed = draft[k] !== undefined;
          return (
            <div key={k} className="plate p-5">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="h-display text-2xl">{CUE_LABELS[k].title}</h2>
                <p className="text-xs text-steel/60">{CUE_LABELS[k].when}</p>
              </div>
              <p className="mb-3 text-sm text-steel/70">{CUE_LABELS[k].art}</p>
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
            <h2 className="h-display text-2xl">Meme library</h2>
            <p className="text-xs text-steel/60">PNG, JPG, GIF or WEBP, up to {MAX_IMAGE_BYTES / 1024} KB each. You can pick several at once.</p>
          </div>
          <label className={`btn-primary btn-sm cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}>
            {uploading ? "Uploading…" : "Upload images"}
            <input
              ref={file}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) void upload(e.target.files);
              }}
            />
          </label>
        </div>
        {board.images.length === 0 && <p className="text-sm text-steel/60">No images yet. Pop-ups show the built-in animation only.</p>}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {board.images.map((s) => {
            const ref = `upload:${s.id}`;
            const src = backend.mediaSrc(ref);
            return (
              <li key={s.id} className="overflow-hidden rounded-md border border-white/10 bg-void/40">
                <div className="grid h-36 place-items-center bg-black/40">{src ? <img src={src} alt={s.name} className="max-h-36 w-auto object-contain" /> : <span className="text-xs text-steel/50">not in this browser</span>}</div>
                <div className="flex items-center gap-2 p-3">
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-white">{s.name}</strong>
                    <span className="block text-xs text-steel/60">
                      {Math.round(s.bytes / 1024)} KB{usedBy(ref) ? `, used ${usedBy(ref)}×` : ""}
                    </span>
                  </span>
                  <button
                    className="btn-danger btn-sm"
                    disabled={busy}
                    onClick={async () => {
                      if (await confirm({ title: `Delete "${s.name}"?`, body: "Moments using it go back to the animation only.", danger: true, confirmLabel: "Delete" }))
                        await run(() => actions.deleteImage(s.id), "Image deleted.");
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
