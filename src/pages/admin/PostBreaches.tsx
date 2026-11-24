import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { downloadText } from "../../components/Bits";
import { BREACH_TEMPLATE, parseBreachImport, type RowError } from "../../core/csv";
import type { ChallengeInput } from "../../core/types";
import { useBackend } from "../../hooks/store";
import { useRun } from "../../hooks/ui";
import { BreachForm, blankInput, ReleasePicker, toRelease, type ReleaseChoice } from "./BreachForm";
import { AdminTitle } from "./CommandApp";

export function PostBreaches() {
  const { view, actions } = useBackend();
  const firstType = view.challengeTypes[0]?.id ?? "";
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"wave" | "single">(params.get("mode") === "single" ? "single" : "wave");
  const [wave, setWave] = useState<ChallengeInput[]>(() => Array.from({ length: 5 }, () => blankInput(firstType)));
  const [slot, setSlot] = useState(0);
  const [single, setSingle] = useState<ChallengeInput>(() => blankInput(firstType));
  const [queue, setQueue] = useState<ChallengeInput[]>([]);
  const [release, setRelease] = useState<ReleaseChoice>({ mode: "now" });
  const [importErrors, setImportErrors] = useState<RowError[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { run, busy } = useRun();
  const nextWave = view.waves.reduce((m, w) => Math.max(m, w.number), 0) + 1;

  const onImport = async (file: File) => {
    const text = await file.text();
    const { rows, errors } = parseBreachImport(text, view.challengeTypes);
    setImportErrors(errors);
    if (!rows.length) return;
    if (rows.length === 5) {
      setMode("wave");
      setWave(rows);
      setSlot(0);
    } else {
      setMode("single");
      setSingle(rows[0]);
      setQueue(rows.slice(1));
    }
  };

  const postWave = async () => {
    const r = await run(() => actions.postWave(wave, toRelease(release)), (x) => `Wave ${x.number} ${release.mode === "now" ? "is live" : release.mode === "draft" ? "saved as drafts" : "scheduled"}.`);
    if (r) {
      setWave(Array.from({ length: 5 }, () => blankInput(firstType)));
      setSlot(0);
    }
  };
  const postSingle = async () => {
    const r = await run(() => actions.postSingle(single, toRelease(release)), release.mode === "now" ? "Challenge is live. An announcement went out." : release.mode === "draft" ? "Saved as draft." : "Challenge scheduled.");
    if (r) {
      setSingle(queue[0] ?? blankInput(firstType));
      setQueue(queue.slice(1));
    }
  };

  return (
    <div>
      <AdminTitle
        sub="Waves are exactly 5 challenges. Posting live sends a announcement automatically."
        right={
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost btn-sm" onClick={() => downloadText("breaches-template.csv", BREACH_TEMPLATE, "text/csv")}>
              Download template
            </button>
            <button className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
              Import CSV / JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
                e.target.value = "";
              }}
            />
          </div>
        }
      >
        Post challenges
      </AdminTitle>

      {importErrors.length > 0 && (
        <div className="mb-4 rounded-md border border-breach/50 bg-breach/10 p-3 text-sm" role="alert">
          <strong className="text-breach">Some rows were skipped:</strong>
          <ul className="mt-1 list-disc pl-5 text-steel">
            {importErrors.map((e, i) => (
              <li key={i}>
                Row {e.row}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 flex w-fit rounded-lg border border-white/10 bg-void/60 p-1" role="tablist">
        {(["wave", "single"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wider ${mode === m ? "bg-reactor text-void" : "text-steel hover:text-white"}`}>
            {m === "wave" ? `Wave ${nextWave}` : "Single challenge"}
          </button>
        ))}
      </div>

      <div className="plate p-5">
        {mode === "wave" ? (
          <>
            <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Wave challenges">
              {wave.map((w, i) => (
                <button key={i} role="tab" aria-selected={slot === i} onClick={() => setSlot(i)} className={`rounded-md border px-3 py-1.5 text-sm ${slot === i ? "border-gold bg-gold/15 text-gold" : "border-white/10 text-steel"}`}>
                  {i + 1}. {w.title || "Untitled"}
                </button>
              ))}
            </div>
            <BreachForm key={slot} idPrefix={`w${slot}`} value={wave[slot]} onChange={(v) => setWave(wave.map((x, i) => (i === slot ? v : x)))} />
          </>
        ) : (
          <>
            {queue.length > 0 && <p className="mb-3 text-sm text-gold">Reviewing imported challenges: {queue.length} more after this one.</p>}
            <BreachForm idPrefix="single" value={single} onChange={setSingle} />
          </>
        )}
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-5">
          <ReleasePicker value={release} onChange={setRelease} />
          <button className="btn-primary" disabled={busy} onClick={mode === "wave" ? postWave : postSingle}>
            {busy ? "Posting…" : mode === "wave" ? `Post wave ${nextWave}` : "Post challenge"}
          </button>
        </div>
      </div>
    </div>
  );
}
