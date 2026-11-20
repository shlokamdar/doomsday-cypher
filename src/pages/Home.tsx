import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Emblem } from "../components/Art";
import { DoomsdayClock, SectionTitle } from "../components/Bits";
import { HeroScene } from "../components/HeroScene";
import { ThemeIcon } from "../components/Icons";
import { Page } from "../components/Layout";
import { teamColor } from "../core/logic";
import { THEMES } from "../core/themes";
import { useBackend, useStandings } from "../hooks/store";

const STEPS = [
  { n: "01", t: "Assemble", d: "Your team of three logs in. Every member has their own account and plays for the team." },
  { n: "02", t: "Challenge", d: "Waves of five challenges open across the multiverse. Singles drop between waves." },
  { n: "03", t: "Solve", d: "Submit the flag to solve a challenge and earn points. Hints cost points for the whole team." },
  { n: "04", t: "Win", d: "When the timer hits zero, the team with the most points saves every world." },
];

export function HomePage() {
  const { view } = useBackend();
  const standings = useStandings();
  const s = view.settings;
  const me = view.me;
  const scoreboardOpen = s.scoreboardVisible;
  return (
    <>
      <section className="relative isolate min-h-[640px] overflow-hidden border-b border-white/5">
        <HeroScene />
        <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 pb-16 pt-16 sm:pt-24 lg:grid-cols-[1.4fr_1fr]">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-reactor">{s.eventName} · Team CTF</p>
            <h1 className="mt-3 font-display text-6xl leading-[0.9] text-white sm:text-8xl" style={{ textShadow: "0 6px 30px rgba(0,0,0,.6)" }}>
              Seal the breach.
              <br />
              <span className="text-gold">Save every world.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-steel">
              The Sovereign is collapsing parallel worlds into one. Your Team has three hours to solve the challenges and
              gather enough points to stop it.
            </p>
            <div className="mt-6 inline-block rounded-lg border border-gold/30 bg-void/70 px-6 py-3 backdrop-blur">
              <DoomsdayClock size="xl" />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {me ? (
                <Link to={me.role === "admin" ? "/admin" : "/challenges"} className="btn-primary text-base">
                  {me.role === "admin" ? "Open Admin" : "Enter the challenges"}
                </Link>
              ) : (
                <Link to="/login" className="btn-primary text-base">
                  Log in
                </Link>
              )}
              <Link to="/scoreboard" className="btn-ghost text-base">
                Scoreboard
              </Link>
            </div>
          </motion.div>
          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="plate self-end p-5 backdrop-blur"
            aria-label="Top of the scoreboard"
          >
            <h2 className="font-display text-2xl tracking-wide text-white">Top of the scoreboard</h2>
            {!scoreboardOpen ? (
              <p className="mt-3 text-steel/80">The organisers have hidden the scoreboard. Keep solving.</p>
            ) : standings.length === 0 ? (
              <p className="mt-3 text-steel/80">No teams yet.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {standings.slice(0, 5).map((r) => (
                  <li key={r.teamId} className="flex items-center gap-3 rounded-md bg-void/50 px-3 py-2">
                    <span className="w-6 font-display text-2xl text-gold">{r.rank}</span>
                    <Emblem name={r.name} color={teamColor(r.teamId, view.teams)} size={32} />
                    <span className="flex-1 truncate font-semibold text-white">{r.name}</span>
                    <span className="font-display text-2xl text-reactor tabular-nums">{r.power}</span>
                  </li>
                ))}
              </ol>
            )}
          </motion.aside>
        </div>
      </section>

      <Page>
        <SectionTitle kicker="Briefing">How it works</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((st) => (
            <div key={st.n} className="plate p-5">
              <div className="font-display text-5xl text-reactor/70">{st.n}</div>
              <h3 className="font-display text-3xl tracking-wide text-white">{st.t}</h3>
              <p className="mt-1 text-sm text-steel/90">{st.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-14">
          <SectionTitle kicker="Challenge categories">Six fronts of the multiverse</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {THEMES.map((t) => (
              <div key={t.id} className="plate overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3" style={{ background: `linear-gradient(90deg, ${t.tint}33, transparent)` }}>
                  <span style={{ color: t.tint }}>
                    <ThemeIcon theme={t.id} size={30} />
                  </span>
                  <div>
                    <div className="font-display text-2xl tracking-wide text-white">{t.name}</div>
                    <div className="text-xs uppercase tracking-widest" style={{ color: t.tint }}>
                      {t.skill}
                    </div>
                  </div>
                </div>
                <p className="px-5 pb-4 pt-2 text-sm text-steel/90">{t.intel}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <div className="plate p-6">
            <SectionTitle kicker="Rules of engagement">The rules</SectionTitle>
            <ul className="list-disc space-y-2 pl-5 text-steel/90">
              <li>
                Flags look like <code className="font-mono text-reactor">IAMDOOM{"{...}"}</code>. Paste the whole thing, braces included.
              </li>
              <li>Teams of up to {s.teamSize}. Every member logs in with their own account.</li>
              <li>Flags open when the timer starts and close when it hits zero ({s.durationMinutes} minutes).</li>
              <li>Ties go to the team that reached that score first.</li>
              <li>Hints cost points once, for the whole team. Some challenges have limited attempts.</li>
              <li>Max {s.submissionsPerMinute} flag attempts per minute per challenge for each team.</li>
              <li>No attacking the platform, other teams, or the organisers' infrastructure.</li>
              <li>No AI assistants solving challenges for you. Your brain, your team, your win.</li>
            </ul>
          </div>
          <div className="plate relative overflow-hidden p-6">
            <SectionTitle kicker="Intel">The Sovereign</SectionTitle>
            <p className="text-steel/90">
              No one has seen the face behind the riveted iron mask. Every world it collapses feeds its power. Every challenge you
              solve pushes it back. Wrong flags make it laugh. Right ones make it crack.
            </p>
            <p className="mt-4 font-display text-2xl tracking-wide text-gold">{s.tagline}</p>
          </div>
        </div>
      </Page>
    </>
  );
}
