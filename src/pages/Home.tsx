import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Emblem, PortalRing } from "../components/Art";
import { DoomsdayClock, SectionTitle } from "../components/Bits";
import { ThemeIcon } from "../components/Icons";
import { Page } from "../components/Layout";
import { teamColor } from "../core/logic";
import { THEMES } from "../core/themes";
import type { ThemeId } from "../core/types";
import { useBackend, useStandings } from "../hooks/store";

/** Free-licence Unsplash photos, self-hosted in public/images (credits in README). */
const img = (name: string) => `${import.meta.env.BASE_URL}images/${name}.webp`;
const THEME_PHOTO: Record<ThemeId, { file: string; alt: string }> = {
  reality: { file: "osint", alt: "City lights across the Earth at night, seen from orbit" },
  signal: { file: "crypto", alt: "Open and closed padlocks lit in red and green" },
  machine: { file: "python", alt: "Python code on a dark editor screen" },
  archive: { file: "sql", alt: "Network cables running into a server rack" },
};

const STEPS = [
  { n: "01", t: "Assemble", d: "Your team of three logs in. Every member has their own account and plays for the team." },
  { n: "02", t: "Challenge", d: "Waves of five challenges open during the event. Singles drop between waves." },
  { n: "03", t: "Solve", d: "Submit the flag to solve a challenge and earn points. Hints cost points for the whole team." },
  { n: "04", t: "Win", d: "When the timer hits zero, the team with the most points wins." },
];

export function HomePage() {
  const { view } = useBackend();
  const standings = useStandings();
  const s = view.settings;
  const me = view.me;
  const scoreboardOpen = s.scoreboardVisible;
  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-white/5">
        {/* photo background with brand-tinted overlays */}
        <img src={img("hero-city")} alt="" aria-hidden className="absolute inset-0 -z-20 h-full w-full object-cover brightness-125 saturate-150" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-void/95 via-void/55 to-transparent" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-void via-transparent to-void/40" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_20%,rgba(224,64,138,0.25),transparent_55%)] mix-blend-screen" />
        <div className="pointer-events-none absolute right-[6%] top-[12%] -z-10 hidden opacity-80 md:block" aria-hidden>
          <PortalRing size={240} sparks={10} />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-20 pt-16 sm:pt-24 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-reactor">{s.eventName} · Team CTF</p>
            <h1 className="mt-3 font-display text-6xl leading-[0.9] text-white sm:text-8xl" style={{ textShadow: "0 6px 30px rgba(0,0,0,.6)" }}>
              Seal the breach.
              <br />
              <span className="text-gold">Save every world.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-steel">
              The Sovereign is collapsing parallel worlds into one. Your team has three hours to solve the challenges and
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
            className="rounded-lg border border-white/10 bg-void/70 p-5 shadow-2xl backdrop-blur-md"
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
                  <li key={r.teamId} className="flex items-center gap-3 rounded-md bg-white/5 px-3 py-2">
                    <span className="w-6 font-display text-2xl text-gold">{r.rank}</span>
                    <Emblem name={r.name} color={teamColor(r.teamId, view.teams)} size={32} />
                    <span className="flex-1 truncate font-semibold text-white">{r.name}</span>
                    <span className="font-display text-2xl tabular-nums text-reactor">{r.power}</span>
                  </li>
                ))}
              </ol>
            )}
          </motion.aside>
        </div>
      </section>

      {/* How it works, over a dimmed event photo */}
      <section className="relative isolate overflow-hidden border-b border-white/5">
        <img src={img("teams")} alt="" aria-hidden loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover brightness-125 saturate-150" />
        <div className="absolute inset-0 -z-10 bg-void/70" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-void via-transparent to-void" />
        <div className="mx-auto max-w-7xl px-4 py-14">
          <SectionTitle kicker="Briefing">How it works</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((st) => (
              <div key={st.n} className="rounded-lg border border-white/10 bg-gunmetal/60 p-5 backdrop-blur">
                <div className="font-display text-5xl text-reactor/80">{st.n}</div>
                <h3 className="font-display text-3xl tracking-wide text-white">{st.t}</h3>
                <p className="mt-1 text-sm text-steel/90">{st.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Page>
        <SectionTitle kicker="Challenge categories">Four categories</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {THEMES.map((t) => (
            <div key={t.id} className="plate group overflow-hidden">
              <div className="relative h-40 overflow-hidden">
                <img
                  src={img(THEME_PHOTO[t.id].file)}
                  alt={THEME_PHOTO[t.id].alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gunmetal via-gunmetal/30 to-transparent" />
                <div className="absolute inset-x-0 top-0 h-1" style={{ background: t.tint }} />
                <div className="absolute bottom-3 left-4 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-void/80" style={{ color: t.tint }}>
                    <ThemeIcon theme={t.id} size={24} />
                  </span>
                  <div>
                    <div className="font-display text-3xl leading-none tracking-wide text-white">{t.name}</div>
                    <div className="text-[11px] uppercase tracking-widest" style={{ color: t.tint }}>
                      {t.skill}
                    </div>
                  </div>
                </div>
              </div>
              <p className="px-4 pb-4 pt-3 text-sm text-steel/90">{t.intel}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <div className="plate p-6">
            <SectionTitle kicker="Before you start">The rules</SectionTitle>
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
            </ul>
          </div>
          <div className="plate relative overflow-hidden p-6">
            <SectionTitle kicker="The story">The Sovereign</SectionTitle>
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
