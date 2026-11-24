import { Emblem } from "../../components/Art";
import { clockTime, DoomsdayClock, timeAgo } from "../../components/Bits";
import { Columns, HBars } from "../../components/Charts";
import { Icon } from "../../components/Icons";
import { Link } from "react-router-dom";
import { clockName, clockPhase, isUnlimited, MINUTE, teamColor } from "../../core/logic";
import { THEMES } from "../../core/themes";
import { useBackend, useNow, useStandings } from "../../hooks/store";
import { useRun, useUi } from "../../hooks/ui";
import { AdminTitle } from "./CommandApp";

export function Dashboard() {
  const { view, actions } = useBackend();
  const { confirm } = useUi();
  const { run, busy } = useRun();
  const now = useNow(5000);
  const standings = useStandings();
  const s = view.settings;
  const phase = clockPhase(s, now);
  const unlimited = isUnlimited(s);
  const players = (view.users ?? []).filter((u) => u.role === "player");
  const subs = view.submissions;
  const correct = subs.filter((x) => x.correct);
  const activeTeams = new Set(subs.filter((x) => x.at > now - 15 * MINUTE).map((x) => x.teamId).concat(view.hintUnlocks.filter((h) => h.at > now - 15 * MINUTE).map((h) => h.teamId))).size;
  const accuracy = subs.length ? Math.round((correct.length / subs.length) * 100) : 0;
  const count = (st: string) => view.challenges.filter((c) => c.status === st).length;
  const live = view.challenges.filter((c) => c.status === "live").sort((a, b) => a.points - b.points);
  const scheduled = view.challenges.filter((c) => c.status === "scheduled").sort((a, b) => (a.releaseAt ?? 0) - (b.releaseAt ?? 0));
  const userName = (id: string) => view.users?.find((u) => u.id === id)?.displayName ?? "Former member";
  const teamName = (id: string) => view.teams.find((t) => t.id === id)?.name ?? "Deleted team";
  const chTitle = (id: string) => view.challenges.find((c) => c.id === id)?.title ?? "Deleted challenge";

  const act = async (title: string, body: string, fn: () => Promise<unknown>, ok: string, danger = false) => {
    if (await confirm({ title, body, danger, confirmLabel: title })) await run(fn, ok);
  };

  // solves over time: 12 buckets across the event window
  const start = s.startsAt ?? (correct[0]?.at ?? now - 3 * 3600_000);
  const end = Math.max(start + 60_000, Math.min(now, s.endsAt ?? now));
  const nb = 12;
  const size = (end - start) / nb;
  const buckets = Array.from({ length: nb }).map((_, i) => ({
    label: clockTime(start + i * size),
    value: correct.filter((x) => x.at >= start + i * size && x.at < start + (i + 1) * size + (i === nb - 1 ? 1 : 0)).length,
  }));
  const byTheme = THEMES.map((t) => ({
    label: t.name,
    color: t.tint,
    value: correct.filter((x) => view.challenges.find((c) => c.id === x.challengeId)?.theme === t.id).length,
  }));

  return (
    <div>
      <AdminTitle sub={`${s.eventName} · ${s.tagline}`}>Dashboard</AdminTitle>

      <section className="plate mb-5 flex flex-wrap items-center justify-between gap-5 p-5">
        <DoomsdayClock size="xl" />
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() =>
              act(
                `Start the ${clockName(s.durationMinutes)}`,
                phase === "running"
                  ? "The clock is already running. This restarts it from now."
                  : s.durationMinutes
                    ? `Challenges, hints and flags open now and close in ${s.durationMinutes} minutes.`
                    : "Challenges, hints and flags open now. There's no time limit: the event runs until you press End now.",
                () => actions.clockStart(),
                "The clock is running.",
              )
            }
          >
            Start the {clockName(s.durationMinutes)}
          </button>
          {!unlimited && (
            <button className="btn-gold" disabled={busy || s.startsAt === null} onClick={() => act("+10 minutes", "Add 10 minutes to the timer for every team?", () => actions.clockAddMinutes(10), "+10 minutes added.")}>
              +10 minutes
            </button>
          )}
          {!unlimited && phase === "running" && (
            <button className="btn-ghost" disabled={busy} onClick={() => act("Remove time limit", "Remove the time limit? The event keeps running until you press End now.", () => actions.clockRemoveLimit(), "Time limit removed.")}>
              Remove time limit
            </button>
          )}
          <button className="btn-danger" disabled={busy || phase !== "running"} onClick={() => act("End now", "Stop the clock now? Flags close immediately for everyone.", () => actions.clockEnd(), "Clock ended.", true)}>
            End now
          </button>
          <button className="btn-ghost" disabled={busy} onClick={() => act("Reset clock", "Clear the start and end times? The clock goes back to waiting and players stop seeing challenges.", () => actions.clockReset(), "Clock reset.", true)}>
            Reset
          </button>
        </div>
        <div className="flex w-full flex-wrap gap-2 border-t border-white/5 pt-4">
          <Link to="post" className="btn-gold btn-sm">
            Post a wave of 5
          </Link>
          <Link to="post?mode=single" className="btn-ghost btn-sm">
            Post a single challenge
          </Link>
          <Link to="announcements" className="btn-ghost btn-sm">
            Send an announcement
          </Link>
        </div>
      </section>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Teams · players" value={`${view.teams.length} · ${players.length}`} />
        <Kpi label="Active (last 15 min)" value={`${activeTeams} teams`} />
        <Kpi label="Solves · accuracy · hints" value={`${correct.length} · ${accuracy}% · ${view.hintUnlocks.length}`} />
        <Kpi label="Live · scheduled · drafts" value={`${count("live")} · ${count("scheduled")} · ${count("draft")}`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="plate p-5">
          <h2 className="h-display mb-3 text-2xl">Solves over time</h2>
          <Columns buckets={buckets} label="Solves over time" />
        </section>
        <section className="plate p-5">
          <h2 className="h-display mb-3 text-2xl">Solves by category</h2>
          <HBars rows={byTheme} />
        </section>
        <section className="plate p-5">
          <h2 className="h-display mb-3 text-2xl">Live submission feed</h2>
          <ul className="scrollbar-thin grid max-h-80 gap-1 overflow-y-auto pr-1 text-sm">
            {[...subs].sort((a, b) => b.at - a.at).slice(0, 40).map((x) => (
              <li key={x.id} className="flex items-center gap-2 rounded px-2 py-1.5 odd:bg-white/[0.03]">
                {x.correct ? <Icon.Check className="shrink-0 text-reactor" size={16} /> : <Icon.X className="shrink-0 text-breach" size={16} />}
                <span className="min-w-0 flex-1 truncate">
                  <strong className="text-white">{teamName(x.teamId)}</strong> <span className="text-steel/60">({userName(x.userId)})</span> → {chTitle(x.challengeId)}
                </span>
                <span className="shrink-0 text-xs text-steel/50">{timeAgo(x.at, now)}</span>
              </li>
            ))}
            {!subs.length && <li className="text-steel/60">No submissions yet.</li>}
          </ul>
        </section>
        <section className="plate p-5">
          <h2 className="h-display mb-3 text-2xl">Top teams</h2>
          <ol className="grid gap-2">
            {standings.slice(0, 6).map((r) => (
              <li key={r.teamId} className="flex items-center gap-3">
                <span className="w-6 font-display text-2xl text-gold">{r.rank}</span>
                <Emblem name={r.name} color={teamColor(r.teamId, view.teams)} size={30} />
                <span className="flex-1 truncate text-white">{r.name}</span>
                {r.hintSpend > 0 && <span className="text-xs text-breach">−{r.hintSpend}</span>}
                <span className="font-display text-2xl text-reactor">{r.power}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="plate p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="h-display text-2xl">Up next</h2>
            <Link className="text-sm font-semibold text-reactor" to="library">
              Library
            </Link>
          </div>
          {scheduled.length === 0 ? (
            <p className="text-sm text-steel/60">Nothing scheduled. Drafts: {count("draft")}.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {scheduled.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-white">{c.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-steel/60">{clockTime(c.releaseAt!)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="plate mt-5 overflow-x-auto p-5">
        <h2 className="h-display mb-3 text-2xl">Challenge health</h2>
        {live.length === 0 ? (
          <p className="text-sm text-steel/60">No live challenges yet.</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-steel/60">
                <th className="py-2 font-medium">Challenge</th>
                <th className="font-medium">Points</th>
                <th className="font-medium">Solved by</th>
                <th className="font-medium">Attempts</th>
                <th className="font-medium">First solve</th>
              </tr>
            </thead>
            <tbody>
              {live.map((c) => {
                const sv = correct.filter((x) => x.challengeId === c.id).sort((a, b) => a.at - b.at);
                const teams = new Set(sv.map((x) => x.teamId)).size;
                const first = sv[0];
                return (
                  <tr key={c.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5 font-medium text-white">{c.title}</td>
                    <td className="tabular-nums text-gold">{c.points}</td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                          <span className="block h-full bg-reactor" style={{ width: `${view.teams.length ? (teams / view.teams.length) * 100 : 0}%` }} />
                        </span>
                        <span className="tabular-nums">
                          {teams}/{view.teams.length}
                        </span>
                      </span>
                    </td>
                    <td className="tabular-nums">{subs.filter((x) => x.challengeId === c.id).length}</td>
                    <td className="text-steel/70">{first ? `${teamName(first.teamId)} at ${clockTime(first.at)}` : "Not yet"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="plate p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-steel/60">{label}</div>
      <div className="mt-1 font-display text-3xl text-white">{value}</div>
    </div>
  );
}
