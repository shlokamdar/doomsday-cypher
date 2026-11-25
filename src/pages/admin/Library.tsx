import { useState } from "react";
import { Link } from "react-router-dom";
import { clockTime, Modal, ThemeChip, TypeChip } from "../../components/Bits";
import type { ChallengeInput, ChallengeStatus, ViewChallenge } from "../../core/types";
import { clockPhase } from "../../core/logic";
import { useBackend, useNow } from "../../hooks/store";
import { useRun, useUi } from "../../hooks/ui";
import { BreachForm, localInput } from "./BreachForm";
import { AdminTitle } from "./CommandApp";

const STATUS_STYLE: Record<ChallengeStatus, string> = {
  live: "border-reactor/50 text-reactor",
  scheduled: "border-gold/50 text-gold",
  draft: "border-white/20 text-steel",
  hidden: "border-breach/50 text-breach",
  archived: "border-white/20 text-steel/60",
};

export function Library() {
  const { view, actions } = useBackend();
  const [filter, setFilter] = useState<ChallengeStatus | "all">("all");
  const [editing, setEditing] = useState<ChallengeInput | null>(null);
  const [scheduling, setScheduling] = useState<{ ids: string[]; local: string } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const { run, busy } = useRun();
  const { confirm } = useUi();
  const now = useNow(5000);
  const nextWave = view.waves.reduce((m, w) => Math.max(m, w.number), 0) + 1;
  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleMany = (ids: string[], on: boolean) => setSelected((p) => (on ? [...new Set([...p, ...ids])] : p.filter((x) => !ids.includes(x))));

  const active = view.challenges.filter((c) => c.status !== "archived");
  const archivedCount = view.challenges.length - active.length;
  const list = active.filter((c) => filter === "all" || c.status === filter);
  // Only act on selected challenges that are still on screen.
  const sel = selected.filter((id) => list.some((c) => c.id === id));
  const selChallenges = list.filter((c) => sel.includes(c.id));
  const canMakeWave = sel.length === 5 && selChallenges.every((c) => !c.waveId);
  const bulk = async (action: "release" | "unpublish" | "archive" | "delete") => {
    const n = sel.length;
    const what = `${n} challenge${n === 1 ? "" : "s"}`;
    const ask = {
      release: { title: `Release ${what} now?`, body: "They go live straight away and one announcement is sent.", confirmLabel: "Release" },
      unpublish: { title: `Unpublish ${what}?`, body: "They go back to drafts. Players stop seeing them; solves are kept.", confirmLabel: "Unpublish" },
      archive: { title: `Archive ${what}?`, body: "Players stop seeing them and their points come off the scoreboard. You can restore them from Archive.", confirmLabel: "Archive" },
      delete: { title: `Delete ${what} for good?`, body: "Their solves and hint history are removed. This can't be undone. (Archive keeps them instead.)", confirmLabel: "Delete", danger: true },
    }[action];
    if (!(await confirm(ask))) return;
    const done = { release: "released", unpublish: "unpublished", archive: "archived", delete: "deleted" }[action];
    const r = await run(() => actions.bulkChallenges(action, sel), (x) => `${x.changed} challenge${x.changed === 1 ? "" : "s"} ${done}.${x.skipped ? ` ${x.skipped} skipped.` : ""}`);
    if (r) setSelected([]);
  };
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
      cues: c.cues,
      python: c.python,
    });

  return (
    <div>
      <AdminTitle sub="Every challenge, grouped by wave. Release drafts, reschedule, edit, hide or delete. Changes reach players on their next poll.">Challenge library</AdminTitle>
      {clockPhase(view.settings, now) === "idle" && view.challenges.some((c) => c.status === "live") && (
        <p className="mb-4 rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
          Some challenges are live, but the <strong>event clock hasn't started</strong>, so players can't see any challenges yet. They all appear the moment you start the clock on the Dashboard.
        </p>
      )}
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {(["all", "live", "scheduled", "draft", "hidden"] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => { setFilter(f); setSelected([]); }} className={`rounded-full border px-3 py-1 text-sm capitalize ${filter === f ? "border-reactor bg-reactor/15 text-reactor" : "border-white/10 text-steel"}`}>
            {f} ({f === "all" ? active.length : active.filter((c) => c.status === f).length})
          </button>
        ))}
      </div>

      {archivedCount > 0 && (
        <p className="mb-4 text-sm text-steel/60">
          {archivedCount} archived challenge{archivedCount === 1 ? " is" : "s are"} kept in{" "}
          <Link to="/admin/archive" className="text-reactor underline">
            Archive
          </Link>
          .
        </p>
      )}
      {list.length > 0 && (
        <div className="sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-md border border-white/10 bg-gunmetal/95 px-4 py-3 text-sm text-steel shadow-lg backdrop-blur" data-testid="bulk-bar">
          <label className="mr-1 flex items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5 cursor-pointer accent-reactor"
              aria-label="Select all shown"
              checked={sel.length === list.length}
              ref={(el) => {
                if (el) el.indeterminate = sel.length > 0 && sel.length < list.length;
              }}
              onChange={(e) => setSelected(e.target.checked ? list.map((c) => c.id) : [])}
            />
            <span>
              <strong className="tabular-nums text-white">{sel.length}</strong> of {list.length} selected
            </span>
          </label>
          {sel.length > 0 ? (
            <>
              <button className="btn-primary btn-sm" disabled={busy} onClick={() => bulk("release")}>
                Release now
              </button>
              <button className="btn-ghost btn-sm" disabled={busy} onClick={() => setScheduling({ ids: sel, local: localInput(Date.now() + 30 * 60_000) })}>
                Schedule
              </button>
              <button className="btn-ghost btn-sm" disabled={busy} onClick={() => bulk("unpublish")}>
                Unpublish
              </button>
              <button className="btn-ghost btn-sm" disabled={busy} onClick={() => bulk("archive")}>
                Archive
              </button>
              <button className="btn-ghost btn-sm text-breach" disabled={busy} onClick={() => bulk("delete")}>
                Delete
              </button>
              <button
                className="btn-gold btn-sm"
                disabled={busy || !canMakeWave}
                title={canMakeWave ? "" : "Select exactly 5 single challenges to make a wave"}
                onClick={async () => {
                  const r = await run(() => actions.groupIntoWave(sel), `Wave ${nextWave} created. Its challenges keep their own release status.`);
                  if (r) setSelected([]);
                }}
              >
                Make Wave {nextWave}
              </button>
              <button className="btn-ghost btn-sm ml-auto" onClick={() => setSelected([])}>
                Clear
              </button>
            </>
          ) : (
            <span className="text-steel/60">Tick challenges to release, schedule, unpublish, archive or delete several at once. Pick exactly 5 singles to make a wave.</span>
          )}
        </div>
      )}
      {groups.length === 0 && <p className="text-steel/60">Nothing here yet.</p>}
      {groups.map((g) => (
        <section key={g.key} className="mb-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="h-5 w-5 cursor-pointer accent-reactor"
                aria-label={`Select all in ${g.title}`}
                checked={g.items.every((c) => sel.includes(c.id))}
                onChange={(e) => toggleMany(g.items.map((c) => c.id), e.target.checked)}
              />
              <h2 className="h-display text-2xl">{g.title}</h2>
            </label>
            {g.waveId && (
              <span className="flex flex-wrap gap-2">
                {view.challenges.some((c) => c.waveId === g.waveId && c.status !== "live") && (
                <button
                  className="btn-gold btn-sm"
                  disabled={busy}
                  onClick={async () => {
                    if (await confirm({ title: "Release this wave now?", body: "Every challenge in the wave goes live and an announcement is sent.", confirmLabel: "Release wave" })) await run(() => actions.releaseWave(g.waveId!), "Wave released.");
                  }}
                >
                  Release this wave now
                </button>
                )}
                <button
                  className="btn-ghost btn-sm"
                  disabled={busy}
                  onClick={async () => {
                    if (await confirm({ title: `Split ${g.title}?`, body: "Its challenges go back to single challenges and keep their release status.", confirmLabel: "Split wave" }))
                      await run(() => actions.splitWave(g.waveId!), `${g.title} split into single challenges.`);
                  }}
                >
                  Split wave
                </button>
              </span>
            )}
          </div>
          <ul className="grid gap-2">
            {g.items.map((c) => {
              const n = counts(c.id);
              return (
                <li key={c.id} className={`plate flex flex-wrap items-center gap-3 p-3 ${sel.includes(c.id) ? "ring-2 ring-reactor" : ""}`} data-testid="library-row">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 cursor-pointer accent-reactor"
                    aria-label={`Select ${c.title}`}
                    checked={sel.includes(c.id)}
                    onChange={() => toggle(c.id)}
                  />
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
                      <span>· {c.maxAttempts ? `${c.maxAttempts + c.bonusAttempts} attempts/team` : "unlimited attempts"}</span>
                      {c.python?.enabled && <span className="chip border-reactor/40 text-reactor">Python workspace</span>}
                      {c.cues && <span className="chip border-gold/40 text-gold">Custom pop-ups</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.status !== "live" && (
                      <button className="btn-primary btn-sm" disabled={busy} onClick={() => run(() => actions.releaseNow(c.id), `${c.title} is live.`)}>
                        Release now
                      </button>
                    )}
                    <button className="btn-ghost btn-sm" onClick={() => setScheduling({ ids: [c.id], local: localInput(Math.max(Date.now(), c.releaseAt ?? 0) + 30 * 60_000) })}>
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
                      className="btn-ghost btn-sm"
                      disabled={busy}
                      onClick={async () => {
                        if (
                          await confirm({
                            title: `Archive ${c.title}?`,
                            body: "Players stop seeing it and its points come off the scoreboard. Everything is kept, and you can restore it from Archive any time.",
                            confirmLabel: "Archive",
                          })
                        )
                          await run(() => actions.archiveChallenge(c.id), `${c.title} moved to Archive.`);
                      }}
                    >
                      Archive
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

      <Modal open={!!scheduling} onClose={() => setScheduling(null)} title={<h2 className="h-display text-3xl">{scheduling && scheduling.ids.length > 1 ? `Schedule ${scheduling.ids.length} challenges` : "Schedule release"}</h2>}>
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
                  const at = new Date(scheduling.local).getTime();
                  const r =
                    scheduling.ids.length === 1
                      ? await run(() => actions.schedule(scheduling.ids[0], at), "Release scheduled.")
                      : await run(() => actions.bulkChallenges("schedule", scheduling.ids, at), (x) => `${x.changed} challenges scheduled.${x.skipped ? ` ${x.skipped} skipped.` : ""}`);
                  if (r !== undefined && scheduling.ids.length > 1) setSelected([]);
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
