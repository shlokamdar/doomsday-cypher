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
        <ul className="grid gap-2">
          {archived.map((c) => {
            const n = counts(c.id);
            const wave = waveNumber(c.waveId);
            const was = c.releaseAt === null ? "draft" : c.hidden ? "hidden" : c.releaseAt > view.serverNow ? "scheduled" : "live";
            return (
              <li key={c.id} className="plate flex flex-wrap items-center gap-3 p-3" data-testid="archive-row">
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
      )}
    </div>
  );
}
