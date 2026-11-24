import { AnimatePresence, motion } from "framer-motion";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Emblem, PortalRing } from "../components/Art";
import { Page } from "../components/Layout";
import { teamColor } from "../core/logic";
import { useBackend } from "../hooks/store";
import { useRun } from "../hooks/ui";

export function LoginPage() {
  const { view, actions } = useBackend();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<"team" | "admin">(params.get("tab") === "admin" ? "admin" : "team");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [adminUser, setAdminUser] = useState("admin");
  const { run, busy } = useRun();
  const navigate = useNavigate();

  if (view.me) return <Navigate to={view.me.role === "admin" ? "/admin" : "/challenges"} replace />;

  const team = view.teams.find((t) => t.id === teamId);
  const member = team?.members.find((m) => m.id === username);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r =
      tab === "team"
        ? await run(() => actions.login(teamId, username ?? "", password))
        : await run(() => actions.login(null, adminUser, password));
    if (r) navigate(tab === "team" ? "/challenges" : "/admin");
    else setPassword("");
  };

  return (
    <Page className="max-w-3xl">
      <div className="flex flex-col items-center text-center">
        <PortalRing size={110} sparks={6} />
        <h1 className="h-display mt-2 text-5xl">Report for duty</h1>
        <p className="text-steel/80">Pick your team, tap your name, enter your password.</p>
      </div>

      <div className="mx-auto mt-6 flex w-fit rounded-lg border border-white/10 bg-void/60 p-1" role="tablist">
        {(["team", "admin"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`rounded-md px-5 py-2 text-sm font-semibold uppercase tracking-wider ${tab === t ? "bg-reactor text-void" : "text-steel hover:text-white"}`}
            onClick={() => {
              setTab(t);
              setPassword("");
            }}
          >
            {t === "team" ? "Team" : "Admin"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="plate mt-6 p-5 sm:p-6">
        {tab === "team" ? (
          <>
            <fieldset>
              <legend className="label">1 · Your team</legend>
              {view.teams.length === 0 && <p className="text-steel/70">No teams yet. Admin creates teams before the event.</p>}
              <div className="grid gap-2 sm:grid-cols-2">
                {view.teams.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    aria-pressed={teamId === t.id}
                    onClick={() => {
                      setTeamId(t.id);
                      setUsername(null);
                    }}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2 text-left transition ${teamId === t.id ? "border-reactor bg-reactor/10" : "border-white/10 bg-void/40 hover:border-white/30"}`}
                  >
                    <Emblem name={t.name} color={teamColor(t.id, view.teams)} size={36} />
                    <span className="font-semibold text-white">{t.name}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <AnimatePresence>
              {team && (
                <motion.fieldset initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-5 overflow-hidden">
                  <legend className="label">2 · Who are you?</legend>
                  <div className="flex flex-wrap gap-2">
                    {team.members.map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        aria-pressed={username === m.id}
                        onClick={() => setUsername(m.id)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${username === m.id ? "border-gold bg-gold text-void" : "border-white/15 text-steel hover:border-white/40"}`}
                      >
                        {m.displayName}
                      </button>
                    ))}
                  </div>
                </motion.fieldset>
              )}
            </AnimatePresence>
            {member && (
              <div className="mt-5">
                <label className="label" htmlFor="pw">
                  3 · Password for {member.displayName}
                </label>
                <input id="pw" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              </div>
            )}
          </>
        ) : (
          <div className="grid gap-4">
            <div>
              <label className="label" htmlFor="au">
                Admin username
              </label>
              <input id="au" className="input" autoComplete="username" value={adminUser} onChange={(e) => setAdminUser(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="apw">
                Password
              </label>
              <input id="apw" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
        )}
        <button className="btn-primary mt-6 w-full" disabled={busy || !password || (tab === "team" && !member)}>
          {busy ? "Verifying…" : "Log in"}
        </button>
      </form>
    </Page>
  );
}
