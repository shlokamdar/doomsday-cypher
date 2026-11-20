import { useState } from "react";
import { downloadText } from "../../components/Bits";
import { Icon } from "../../components/Icons";
import { toCsv } from "../../core/csv";
import { useBackend } from "../../hooks/store";
import { AdminTitle } from "./CommandApp";

export function Submissions() {
  const { view } = useBackend();
  const [team, setTeam] = useState("");
  const [ch, setCh] = useState("");
  const [result, setResult] = useState<"" | "correct" | "wrong">("");
  const [q, setQ] = useState("");
  const userName = (id: string) => view.users?.find((u) => u.id === id)?.displayName ?? "Former member";
  const teamName = (id: string) => view.teams.find((t) => t.id === id)?.name ?? "Deleted team";
  const chTitle = (id: string) => view.challenges.find((c) => c.id === id)?.title ?? "Deleted challenge";
  const rows = [...view.submissions]
    .sort((a, b) => b.at - a.at)
    .filter((s) => (!team || s.teamId === team) && (!ch || s.challengeId === ch) && (!result || (result === "correct") === s.correct))
    .filter((s) => !q || (s.value ?? "").toLowerCase().includes(q.toLowerCase()) || userName(s.userId).toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <AdminTitle
        sub="Every guess, including wrong ones. Correct flags are never stored."
        right={
          <button
            className="btn-ghost btn-sm"
            onClick={() =>
              downloadText(
                "submissions.csv",
                toCsv([["time", "team", "member", "challenge", "correct", "value"], ...rows.map((s) => [new Date(s.at).toISOString(), teamName(s.teamId), userName(s.userId), chTitle(s.challengeId), s.correct ? "yes" : "no", s.value ?? ""])]),
                "text/csv",
              )
            }
          >
            Export CSV
          </button>
        }
      >
        Submissions
      </AdminTitle>
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <select className="input" aria-label="Filter by team" value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="">All teams</option>
          {view.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select className="input" aria-label="Filter by challenge" value={ch} onChange={(e) => setCh(e.target.value)}>
          <option value="">All challenges</option>
          {view.challenges.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <select className="input" aria-label="Filter by result" value={result} onChange={(e) => setResult(e.target.value as typeof result)}>
          <option value="">Correct and wrong</option>
          <option value="correct">Correct only</option>
          <option value="wrong">Wrong only</option>
        </select>
        <input className="input" placeholder="Search guess or member" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="plate scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-steel/60">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2">Challenge</th>
              <th className="px-3 py-2">Guess</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((s) => (
              <tr key={s.id} className="border-t border-white/5">
                <td className="whitespace-nowrap px-3 py-2 text-steel/70">{new Date(s.at).toLocaleTimeString()}</td>
                <td className="px-3 py-2 text-white">{teamName(s.teamId)}</td>
                <td className="px-3 py-2">{userName(s.userId)}</td>
                <td className="px-3 py-2">{chTitle(s.challengeId)}</td>
                <td className="px-3 py-2">
                  <span className={`flex items-center gap-1.5 font-mono ${s.correct ? "text-reactor" : "text-breach"}`}>
                    {s.correct ? <Icon.Check size={14} /> : <Icon.X size={14} />}
                    <span className="break-all">{s.value}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-4 text-steel/60">No submissions match.</p>}
      </div>
    </div>
  );
}
