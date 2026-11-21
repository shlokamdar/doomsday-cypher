import { motion } from "framer-motion";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Emblem, SovereignMask } from "../components/Art";
import { CountUp, DoomsdayClock, SectionTitle } from "../components/Bits";
import {
  Embers,
  EnergyArcs,
  GlitchTitle,
  Layer,
  MultiverseCanvas,
  Reveal,
  RuneRings,
  Shockwaves,
  Ticker,
  TiltCard,
  Typewriter,
  useParallax,
} from "../components/Cinematic";
import { ThemeIcon } from "../components/Icons";
import { Page } from "../components/Layout";
import { clockPhase, remainingMs, teamColor } from "../core/logic";
import { THEMES } from "../core/themes";
import type { ThemeId } from "../core/types";
import { useBackend, useNow, useStandings } from "../hooks/store";

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

const COLLAPSED = [
  "World 0417 collapsed",
  "Signal lost: World 2290",
  "World 1138 folding inward",
  "Breach detected: World 0090",
  "World 3301 consumed",
  "Rift expanding · 14% per hour",
  "World 7782 gone dark",
  "Strike teams requested",
];

function WorldsCounter() {
  const { view } = useBackend();
  const now = useNow(1000);
  const s = view.settings;
  const phase = clockPhase(s, now);
  const total = 1000;
  const left =
    phase === "idle" ? total : phase === "ended" ? 0 : Math.max(1, Math.ceil((total * remainingMs(s, now)) / (s.durationMinutes * 60_000)));
  return (
    <div className="text-center">
      <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-steel/60">Worlds still standing</div>
      <div className="font-display text-5xl leading-none tabular-nums text-breach sm:text-6xl" style={{ textShadow: "0 0 24px currentColor" }}>
        <CountUp value={left} duration={1600} />
      </div>
    </div>
  );
}

export function HomePage() {
  const { view } = useBackend();
  const standings = useStandings();
  const s = view.settings;
  const me = view.me;
  const scoreboardOpen = s.scoreboardVisible;
  const px = useParallax();
  return (
    <>
      <section className="relative isolate min-h-[92vh] overflow-hidden border-b border-white/5 bg-void">
        {/* the world being consumed: faint skyline under the multiverse */}
        <img src={img("hero-city")} alt="" aria-hidden className="absolute inset-x-0 bottom-0 -z-30 h-2/3 w-full object-cover opacity-30 saturate-150" />
        <div className="absolute inset-0 -z-20 bg-gradient-to-t from-void via-void/40 to-void" />
        <div className="absolute inset-0 -z-10">
          <MultiverseCanvas />
        </div>
        <Embers />
        <div className="scanlines pointer-events-none absolute inset-0 -z-0 opacity-60" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(7,9,13,0.85)_100%)]" aria-hidden />

        <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 pb-16 pt-14 sm:pt-20 lg:min-h-[86vh] lg:grid-cols-[1.15fr_1fr]">
          <div className="relative z-10">
            <motion.p
              initial={{ opacity: 0, letterSpacing: "1em" }}
              animate={{ opacity: 1, letterSpacing: "0.4em" }}
              transition={{ duration: 1.2, delay: 0.3 }}
              className="text-xs font-semibold uppercase text-reactor"
            >
              {s.eventName} · Team CTF
            </motion.p>
            <h1 className="mt-3 font-display text-7xl leading-[0.85] sm:text-9xl">
              <GlitchTitle text="DOOMSDAY" delay={0.5} />
              <br />
              <GlitchTitle text="CYPHER" delay={0.9} className="!text-gold" />
            </h1>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 1.4, duration: 0.8, ease: "easeOut" }}
              className="mt-4 h-[3px] w-64 origin-left bg-gradient-to-r from-reactor via-gold to-transparent shadow-reactor"
            />
            <p className="mt-5 min-h-[3.5rem] max-w-xl font-mono text-sm text-steel sm:text-base">
              <span className="text-breach">&gt; INTERCEPTED:</span>{" "}
              <Typewriter
                delay={1.6}
                text="The Sovereign is collapsing every parallel world into one. Three hours. One chance. Seal the breaches before the clock runs out."
              />
            </p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.0, duration: 0.6 }}
              className="mt-6 flex flex-wrap items-stretch gap-4"
            >
              <div className="rounded-lg border border-gold/30 bg-void/70 px-6 py-3 shadow-gold backdrop-blur">
                <DoomsdayClock size="lg" />
              </div>
              <div className="rounded-lg border border-breach/30 bg-void/70 px-6 py-3 shadow-breach backdrop-blur">
                <WorldsCounter />
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.3, duration: 0.6 }}
              className="mt-6 flex flex-wrap gap-3"
            >
              {me ? (
                <Link to={me.role === "admin" ? "/admin" : "/challenges"} className="btn-primary sheen text-base">
                  {me.role === "admin" ? "Open Admin" : "Enter the challenges"}
                </Link>
              ) : (
                <Link to="/login" className="btn-primary sheen text-base">
                  Join the fight
                </Link>
              )}
              <Link to="/scoreboard" className="btn-ghost text-base">
                Scoreboard
              </Link>
            </motion.div>
          </div>

          {/* the villain, framed by the rift */}
          <div className="relative mx-auto h-[340px] w-[340px] sm:h-[520px] sm:w-[520px]" aria-hidden>
            <Layer px={px} depth={-30} className="absolute inset-0">
              <RuneRings size={520} />
            </Layer>
            <Shockwaves />
            <Layer px={px} depth={18} className="absolute inset-0">
              <EnergyArcs size={520} />
            </Layer>
            <Layer px={px} depth={40} className="absolute inset-0 grid place-items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.4, rotate: -12, filter: "blur(20px)" }}
                animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.7, duration: 1.4, type: "spring", stiffness: 70, damping: 12 }}
              >
                <div className="float-y visor-scan">
                  <SovereignMask size={230} className="h-auto w-[160px] sm:w-[230px]" />
                </div>
              </motion.div>
            </Layer>
          </div>
        </div>

        <motion.div
          className="absolute bottom-16 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 text-[10px] uppercase tracking-[0.4em] text-steel/50 lg:flex"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          aria-hidden
        >
          Scroll
          <span className="h-6 w-px bg-gradient-to-b from-steel/60 to-transparent" />
        </motion.div>
        <div className="absolute inset-x-0 bottom-0">
          <Ticker items={COLLAPSED} />
        </div>
      </section>

      {/* Live scoreboard strip */}
      <section className="relative border-b border-white/5 bg-gradient-to-b from-void to-gunmetal/30">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <Reveal>
            <SectionTitle kicker="Live from the front">Top of the scoreboard</SectionTitle>
          </Reveal>
          {!scoreboardOpen ? (
            <p className="text-steel/80">The organisers have hidden the scoreboard. Keep solving.</p>
          ) : standings.length === 0 ? (
            <p className="text-steel/80">No teams yet.</p>
          ) : (
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {standings.slice(0, 5).map((r, i) => (
                <Reveal key={r.teamId} delay={i * 0.08}>
                  <li className={`plate flex h-full items-center gap-3 px-4 py-3 ${i === 0 ? "border-gold/50 shadow-gold" : ""}`}>
                    <span className={`font-display text-4xl ${i === 0 ? "text-gold" : "text-steel/60"}`}>{r.rank}</span>
                    <Emblem name={r.name} color={teamColor(r.teamId, view.teams)} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-white">{r.name}</span>
                      <span className="font-display text-2xl tabular-nums text-reactor">
                        <CountUp value={r.power} /> <span className="text-sm text-steel/60">pts</span>
                      </span>
                    </span>
                  </li>
                </Reveal>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* How it works, over a dimmed event photo */}
      <section className="relative isolate overflow-hidden border-b border-white/5">
        <img src={img("teams")} alt="" aria-hidden loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover brightness-125 saturate-150" />
        <div className="absolute inset-0 -z-10 bg-void/70" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-void via-transparent to-void" />
        <div className="mx-auto max-w-7xl px-4 py-14">
          <Reveal>
            <SectionTitle kicker="Briefing">How it works</SectionTitle>
          </Reveal>
          <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* energy line linking the steps */}
            <motion.div
              aria-hidden
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.6, ease: "easeInOut" }}
              className="pointer-events-none absolute -top-2 left-0 right-0 hidden h-[2px] origin-left bg-gradient-to-r from-reactor via-gold to-breach shadow-reactor lg:block"
            />
            {STEPS.map((st, i) => (
              <Reveal key={st.n} delay={0.15 + i * 0.15}>
                <motion.div
                  whileHover={{ y: -8 }}
                  className="group relative h-full rounded-lg border border-white/10 bg-gunmetal/70 p-5 backdrop-blur transition-colors hover:border-reactor/50"
                >
                  <div className="relative font-display text-5xl text-reactor/80 transition group-hover:text-reactor group-hover:[text-shadow:0_0_20px_#2BD67B]">
                    {st.n}
                  </div>
                  <h3 className="font-display text-3xl tracking-wide text-white">{st.t}</h3>
                  <p className="mt-1 text-sm text-steel/90">{st.d}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Page>
        <Reveal>
          <SectionTitle kicker="Challenge categories">Four fronts of the war</SectionTitle>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {THEMES.map((t, i) => (
            <Reveal key={t.id} delay={i * 0.12} className="h-full">
            <TiltCard glow={t.tint} className="h-full">
            <div className="plate group h-full overflow-hidden transition-shadow duration-300 hover:shadow-[0_0_40px_var(--tint)]" style={{ "--tint": `${t.tint}55` } as React.CSSProperties}>
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
            </TiltCard>
            </Reveal>
          ))}
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <Reveal className="h-full">
          <div className="plate h-full p-6">
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
          </Reveal>
          <Reveal delay={0.15} className="h-full">
          <StoryCard />
          </Reveal>
        </div>
      </Page>
    </>
  );
}

/** The villain's card: the mask cracks when it scrolls into view. */
function StoryCard() {
  const { view } = useBackend();
  const [seen, setSeen] = useState(false);
  return (
    <motion.div
      className="plate relative h-full overflow-hidden p-6"
      onViewportEnter={() => setTimeout(() => setSeen(true), 500)}
      viewport={{ once: true, margin: "-120px" }}
    >
      <div className="pointer-events-none absolute -right-10 -top-6 opacity-40 sm:opacity-70" aria-hidden>
        <div className={seen ? "anim-shake" : ""} style={{ animationIterationCount: 2 }}>
          <SovereignMask size={200} cracked={seen} />
        </div>
      </div>
      <div className="relative max-w-[70%]">
        <SectionTitle kicker="The story">The Sovereign</SectionTitle>
        <p className="text-steel/90">
          No one has seen the face behind the riveted iron mask. Every world it collapses feeds its power. Every challenge you
          solve pushes it back. Wrong flags make it laugh. Right ones make it crack.
        </p>
        <p className="mt-4 font-display text-2xl tracking-wide text-gold">{view.settings.tagline}</p>
      </div>
    </motion.div>
  );
}
