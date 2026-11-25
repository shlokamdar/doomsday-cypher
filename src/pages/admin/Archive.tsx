import { useState } from "react";
import { Link } from "react-router-dom";
import { clockTime, ThemeChip, TypeChip } from "../../components/Bits";
import { useBackend } from "../../hooks/store";
import { useRun, useUi } from "../../hooks/ui";
import { AdminTitle } from "./CommandApp";

/** Archived challenges: out of play and off the scoreboard, but kept so they can be restored. */
export function Archive() {
  const { view, actions } = useBackend();
  const { run, busy } = useRun();
  const { confirm } = useUi();
  const archived = view.challenges
    .filter((c) => c.status === "archived")
    .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
  const [selected, setSelected] = useState<string[]>([]);
  const sel = selected.filter((id) => archived.some((c) => c.id === id));
  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const bulk = async (action: "restore" | "delete") => {
    const what = `${sel.length} challenge${sel.length === 1 ? "" : "s"}`;
    if (
      action === "delete" &&
      !(await confirm({
        title: `Delete ${what} for good?`,
        body: "This removes them and all their submissions and hint history. It can't be undone.",
        danger: true,
        confirmLabel: "Delete permanently",
      }))
    )
      return;
    const r = await run(() => actions.bulkChallenges(action, sel), (x) => `${x.changed} challenge${x.changed === 1 ? "" : "s"} ${action === "restore" ? "restored" : "deleted permanently"}.`);
    if (r) setSelected([]);
  };
  const waveNumber = (id: string | null) => view.waves.find((w) => w.id === id)?.number;
  const counts = (id: string) => ({
    solves: view.submissions.filter((s) => s.challengeId === id && s.correct).length,
    attempts: view.submissions.filter((s) => s.challengeId === id).length,
  });

  return (
    <div>
      <AdminTitle sub="Archived challenges are hidden from players and their points don't count, but nothing is lost. Restore puts a challenge back exactly as it was, solves included.">
        Archive
      </AdminTitle>

      {archived.length === 0 ? (
        <div className="plate p-8 text-center text-steel/70">
          Nothing archived yet. Use <strong className="text-white">Archive</strong> on a challenge in the{" "}
          <Link to="/admin/library" className="text-reactor underline">
            Challenge library
          </Link>{" "}
          to set it aside without deleting it.
        </div>
      ) : (
        <>
        <div className="sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-md border border-white/10 bg-gunmetal/95 px-4 py-3 text-sm text-steel shadow-lg backdrop-blur">
          <label className="mr-1 flex items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5 cursor-pointer accent-reactor"
              aria-label="Select all archived"
              checked={sel.length === archived.length}
              ref={(el) => {
                if (el) el.indeterminate = sel.length > 0 && sel.length < archived.length;
              }}
              onChange={(e) => setSelected(e.target.checked ? archived.map((c) => c.id) : [])}
            />
            <span>
              <strong className="tabular-nums text-white">{sel.length}</strong> of {archived.length} selected
            </span>
          </label>
          {sel.length > 0 ? (
            <>
              <button className="btn-primary btn-sm" disabled={busy} onClick={() => bulk("restore")}>
                Restore
              </button>
              <button className="btn-ghost btn-sm text-breach" disabled={busy} onClick={() => bulk("delete")}>
                Delete permanently
              </button>
              <button className="btn-ghost btn-sm ml-auto" onClick={() => setSelected([])}>
                Clear
              </button>
            </>
          ) : (
            <span className="text-steel/60">Tick challenges to restore or delete several at once.</span>
          )}
        </div>
        <ul className="grid gap-2">
          {archived.map((c) => {
            const n = counts(c.id);
            const wave = waveNumber(c.waveId);
            const was = c.releaseAt === null ? "draft" : c.hidden ? "hidden" : c.releaseAt > view.serverNow ? "scheduled" : "live";
            return (
              <li key={c.id} className={`plate flex flex-wrap items-center gap-3 p-3 ${sel.includes(c.id) ? "ring-2 ring-reactor" : ""}`} data-testid="archive-row">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 cursor-pointer accent-reactor"
                  aria-label={`Select ${c.title}`}
                  checked={sel.includes(c.id)}
                  onChange={() => toggle(c.id)}
                />
                <div className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip border-white/20 text-steel/70">Archived</span>
                    <strong className="text-white">{c.title}</strong>
                    <span className="font-display text-xl text-gold/70">{c.points}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-steel/60">
                    <ThemeChip theme={c.theme} />
                    <TypeChip typeId={c.typeId} />
                    {wave && <span>from Wave {wave}</span>}
                    <span>· was {was}</span>
                    {c.archivedAt && <span>· archived {clockTime(c.archivedAt)}</span>}
                    <span>
                      · {n.solves} solves, {n.attempts} attempts kept
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    className="btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => run(() => actions.restoreChallenge(c.id), `${c.title} restored (${was}).`)}
                  >
                    Restore
                  </button>
                  <button
                    className="btn-ghost btn-sm text-breach"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: `Delete ${c.title} for good?`,
                          body: "This removes the challenge and all its submissions and hint history. It can't be undone.",
                          danger: true,
                          confirmLabel: "Delete permanently",
                        })
                      )
                        await run(() => actions.deleteChallenge(c.id), "Challenge deleted permanently.");
                    }}
                  >
                    Delete permanently
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        </>
      )}
    </div>
  );
}
