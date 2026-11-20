import { useState } from "react";
import { clockTime, Modal, ThemeChip, TypeChip } from "../../components/Bits";
import type { ChallengeInput, ChallengeStatus, ViewChallenge } from "../../core/types";
import { useBackend } from "../../hooks/store";
import { useRun, useUi } from "../../hooks/ui";
import { BreachForm, localInput } from "./BreachForm";
import { AdminTitle } from "./CommandApp";

const STATUS_STYLE: Record<ChallengeStatus, string> = {
  live: "border-reactor/50 text-reactor",
  scheduled: "border-gold/50 text-gold",
  draft: "border-white/20 text-steel",
  hidden: "border-breach/50 text-breach",
};

export function Library() {
  const { view, actions } = useBackend();
  const [filter, setFilter] = useState<ChallengeStatus | "all">("all");
  const [editing, setEditing] = useState<ChallengeInput | null>(null);
  const [scheduling, setScheduling] = useState<{ id: string; local: string } | null>(null);
  const { run, busy } = useRun();
  const { confirm } = useUi();

  const list = view.challenges.filter((c) => filter === "all" || c.status === filter);
  const groups = [
    ...[...view.waves].sort((a, b) => b.number - a.number).map((w) => ({ key: w.id, title: `Wave ${w.number}`, waveId: w.id, items: list.filter((c) => c.waveId === w.id) })),
    { key: "singles", title: "Single challenges", waveId: null as string | null, items: list.filter((c) => !c.waveId) },
  ].filter((g) => g.items.length);

  const counts = (id: string) => ({
    solves: view.submissions.filter((s) => s.challengeId === id && s.correct).length,
    attempts: view.submissions.filter((s) => s.challengeId === id).length,
    hints: view.hintUnlocks.filter((h) => h.challengeId === id).length,
  });

  const edit = (c: ViewChallenge) =>
    setEditing({
      id: c.id,
      title: c.title,
      typeId: c.typeId,
      theme: c.theme,
      points: c.points,
      description: c.description,
      flag: "",
      caseSensitive: c.caseSensitive,
      maxAttempts: c.maxAttempts,
      hints: c.hints.map((h) => ({ text: h.text ?? "", cost: h.cost })),
      files: c.files,
    });

  return (
    <div>
      <AdminTitle sub="Every challenge, grouped by wave. Changes reach players on their next poll.">Challenge library</AdminTitle>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {(["all", "live", "scheduled", "draft", "hidden"] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 text-sm capitalize ${filter === f ? "border-reactor bg-reactor/15 text-reactor" : "border-white/10 text-steel"}`}>
            {f} ({f === "all" ? view.challenges.length : view.challenges.filter((c) => c.status === f).length})
          </button>
        ))}
      </div>

      {groups.length === 0 && <p className="text-steel/60">Nothing here yet.</p>}
      {groups.map((g) => (
        <section key={g.key} className="mb-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="h-display text-2xl">{g.title}</h2>
            {g.waveId && (
              <button
                className="btn-gold btn-sm"
                disabled={busy}
                onClick={async () => {
                  if (await confirm({ title: "Release this wave now?", body: "Every challenge in the wave goes live and a announcement is sent.", confirmLabel: "Release wave" })) await run(() => actions.releaseWave(g.waveId!), "Wave released.");
                }}
              >
                Release this wave now
              </button>
            )}
          </div>
          <ul className="grid gap-2">
            {g.items.map((c) => {
              const n = counts(c.id);
              return (
                <li key={c.id} className="plate flex flex-wrap items-center gap-3 p-3" data-testid="library-row">
                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`chip capitalize ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                      <strong className="text-white">{c.title}</strong>
                      <span className="font-display text-xl text-gold">{c.points}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-steel/60">
                      <ThemeChip theme={c.theme} />
                      <TypeChip typeId={c.typeId} />
                      {c.status === "scheduled" && c.releaseAt && <span>opens {clockTime(c.releaseAt)}</span>}
                      <span>
                        {n.solves} solves · {n.attempts} attempts · {n.hints} hints opened
                      </span>
                      <span>· {c.maxAttempts ? `${c.maxAttempts + c.bonusAttempts} attempts/squad` : "unlimited attempts"}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.status !== "live" && (
                      <button className="btn-primary btn-sm" disabled={busy} onClick={() => run(() => actions.releaseNow(c.id), `${c.title} is live.`)}>
                        Release now
                      </button>
                    )}
                    <button className="btn-ghost btn-sm" onClick={() => setScheduling({ id: c.id, local: localInput(Math.max(Date.now(), c.releaseAt ?? 0) + 30 * 60_000) })}>
                      Schedule
                    </button>
                    {c.status !== "draft" && (
                      <button className="btn-ghost btn-sm" disabled={busy} onClick={() => run(() => actions.unpublish(c.id), `${c.title} unpublished.`)}>
                        Unpublish
                      </button>
                    )}
                    {c.maxAttempts > 0 && (
                      <button className="btn-ghost btn-sm" disabled={busy} onClick={() => run(() => actions.grantAttempts(c.id, 3), "+3 attempts for every team.")}>
                        +3 attempts
                      </button>
                    )}
                    <button className="btn-ghost btn-sm" onClick={() => edit(c)}>
                      Edit
                    </button>
                    <button
                      className="btn-ghost btn-sm text-breach"
                      disabled={busy}
                      onClick={async () => {
                        if (await confirm({ title: `Delete ${c.title}?`, body: "Its solves and hint spending are removed from the scoreboard. This can't be undone.", danger: true, confirmLabel: "Delete" }))
                          await run(() => actions.deleteChallenge(c.id), "Challenge deleted.");
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
      ))}

      <Modal open={!!editing} onClose={() => setEditing(null)} wide title={<h2 className="h-display text-3xl">Edit challenge</h2>}>
        {editing && (
          <>
            <BreachForm idPrefix="edit" value={editing} onChange={setEditing} editing />
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={busy}
                onClick={async () => {
                  const r = await run(() => actions.saveChallenge(editing), "Challenge saved.");
                  if (r) setEditing(null);
                }}
              >
                Save changes
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!scheduling} onClose={() => setScheduling(null)} title={<h2 className="h-display text-3xl">Schedule release</h2>}>
        {scheduling && (
          <div className="grid gap-4">
            <input type="datetime-local" aria-label="Release time" className="input" value={scheduling.local} onChange={(e) => setScheduling({ ...scheduling, local: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setScheduling(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={busy}
                onClick={async () => {
                  const r = await run(() => actions.schedule(scheduling.id, new Date(scheduling.local).getTime()), "Release scheduled.");
                  if (r !== undefined) setScheduling(null);
                }}
              >
                Schedule
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
