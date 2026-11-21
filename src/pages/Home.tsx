import { motion } from "framer-motion";
import { lazy, Suspense, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Emblem } from "../components/Art";
import { CountUp, DoomsdayClock } from "../components/Bits";
import { GlitchTitle, Reveal, Ticker, TiltCard, Typewriter } from "../components/Cinematic";
import { ThemeIcon } from "../components/Icons";
import { clockPhase, remainingMs, teamColor } from "../core/logic";
import { THEMES } from "../core/themes";
import type { ThemeId } from "../core/types";
import { useBackend, useNow, useStandings } from "../hooks/store";

/** three.js scene, split into its own chunk so other pages don't download it. */
const DoomCanvas = lazy(() => import("../components/three/DoomCanvas"));

/** Free-licence Unsplash photos, self-hosted in public/images (credits in README). */
const img = (name: string) => `${import.meta.env.BASE_URL}images/${name}.webp`;
const THEME_PHOTO: Record<ThemeId, string> = { reality: "osint", signal: "crypto", machine: "python", archive: "sql" };

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

const STEPS = [
  { n: "01", t: "Assemble", d: "Your team of three logs in. Every member has their own account and plays for the team." },
  { n: "02", t: "Breach", d: "Waves of five challenges open during the event. Singles drop between waves." },
  { n: "03", t: "Seal", d: "Submit the flag to solve a challenge and earn points. Hints cost points for the whole team." },
  { n: "04", t: "Survive", d: "When the timer hits zero, the team with the most points wins." },
];

/* ---------------- small HUD pieces ---------------- */

function Hud({ children, className = "", tone = "reactor" }: { children: ReactNode; className?: string; tone?: "reactor" | "gold" | "breach" }) {
  const c = { reactor: "border-reactor", gold: "border-gold", breach: "border-breach" }[tone];
  return (
    <div className={`relative border border-white/10 bg-void/55 backdrop-blur-md ${className}`}>
      {(["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"] as const).map((pos) => (
        <span key={pos} className={`pointer-events-none absolute h-4 w-4 ${pos} ${c}`} aria-hidden />
      ))}
      {children}
    </div>
  );
}

function Kicker({ children, tone = "text-reactor" }: { children: ReactNode; tone?: string }) {
  return (
    <div className={`flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.4em] ${tone}`}>
      <span className="inline-block h-px w-10 bg-current" />
      {children}
    </div>
  );
}

function BigTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-3 font-display text-5xl leading-[0.9] text-white sm:text-7xl [text-shadow:0_6px_30px_rgba(0,0,0,.8)]">{children}</h2>;
}

function WorldsCounter() {
  const { view } = useBackend();
  const now = useNow(1000);
  const s = view.settings;
  const phase = clockPhase(s, now);
  const total = 1000;
  const left = phase === "idle" ? total : phase === "ended" ? 0 : Math.max(1, Math.ceil((total * remainingMs(s, now)) / (s.durationMinutes * 60_000)));
  return (
    <div className="text-center">
      <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-steel/60">Worlds still standing</div>
      <div className="font-display text-5xl leading-none tabular-nums text-breach sm:text-6xl" style={{ textShadow: "0 0 24px currentColor" }}>
        <CountUp value={left} duration={1600} />
      </div>
    </div>
  );
}

function CallToAction({ big = false }: { big?: boolean }) {
  const { view } = useBackend();
  const me = view.me;
  const cls = `btn-primary sheen ${big ? "px-8 py-4 text-lg" : "text-base"}`;
  return (
    <div className="flex flex-wrap gap-3">
      {me ? (
        <Link to={me.role === "admin" ? "/admin" : "/challenges"} className={cls}>
          {me.role === "admin" ? "Open Admin" : "Enter the challenges"}
        </Link>
      ) : (
        <Link to="/login" className={cls}>
          Join the fight
        </Link>
      )}
      <Link to="/scoreboard" className={`btn-ghost bg-void/70 backdrop-blur ${big ? "px-8 py-4 text-lg" : "text-base"}`}>
        Scoreboard
      </Link>
    </div>
  );
}

/* ---------------- page ---------------- */

export function HomePage() {
  const { view } = useBackend();
  const standings = useStandings();
  const s = view.settings;

  return (
    <div className="relative">
      <Suspense fallback={null}>
        <DoomCanvas />
      </Suspense>

      {/* 1 · HERO */}
      <section className="relative z-10 flex min-h-[calc(100svh-64px)] flex-col">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-4 py-12">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <Kicker>
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-breach" />
                Incoming transmission · {s.eventName}
              </Kicker>
            </motion.div>
            <h1 className="mt-4 font-display text-[22vw] leading-[0.82] sm:text-[10rem]">
              <GlitchTitle text="DOOMSDAY" delay={0.5} />
              <br />
              <GlitchTitle text="CYPHER" delay={0.9} className="!text-gold" />
            </h1>
            <p className="mt-6 min-h-[3.5rem] max-w-xl font-mono text-sm text-steel sm:text-base">
              <span className="text-breach">&gt; </span>
              <Typewriter delay={1.6} text="The Sovereign is collapsing every parallel world into one. Three hours. One chance. Seal the breaches." />
            </p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.0, duration: 0.6 }} className="mt-7 flex flex-wrap gap-4">
              <Hud tone="gold" className="px-6 py-3">
                <DoomsdayClock size="lg" />
              </Hud>
              <Hud tone="breach" className="px-6 py-3">
                <WorldsCounter />
              </Hud>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.3, duration: 0.6 }} className="mt-7">
              <CallToAction />
            </motion.div>
          </div>
        </div>
        <motion.div
          className="mx-auto mb-4 flex flex-col items-center gap-1 font-mono text-[10px] uppercase tracking-[0.4em] text-steel/60"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          aria-hidden
        >
          Scroll to enter the rift
          <span className="h-8 w-px bg-gradient-to-b from-reactor to-transparent" />
        </motion.div>
        <Ticker items={COLLAPSED} />
      </section>

      {/* 2 · THE SOVEREIGN (camera turns to the mask) */}
      <section className="relative z-10 flex min-h-screen items-end">
        <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-40">
          <Reveal className="max-w-xl">
            <Hud className="p-7">
              <Kicker tone="text-breach">Threat profile</Kicker>
              <BigTitle>The Sovereign</BigTitle>
              <p className="mt-4 text-steel/90">
                No one has seen the face behind the riveted iron mask. Every world it collapses feeds its power. Every challenge you
                solve pushes it back. Wrong flags make it laugh. Right ones make it crack.
              </p>
              <blockquote className="mt-5 border-l-2 border-reactor pl-4 font-mono text-sm text-reactor">
                “A thousand worlds. One throne. You are already too late.”
              </blockquote>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                {[
                  ["Threat", "Omega"],
                  ["Worlds taken", "∞"],
                  ["Weakness", "Your flags"],
                ].map(([k, v]) => (
                  <div key={k} className="border border-white/10 bg-white/5 px-2 py-2">
                    <div className="text-[9px] uppercase tracking-[0.25em] text-steel/60">{k}</div>
                    <div className="font-display text-xl text-gold">{v}</div>
                  </div>
                ))}
              </div>
            </Hud>
          </Reveal>
        </div>
      </section>

      {/* 3 · MISSION BRIEFING */}
      <section className="relative z-10 flex min-h-screen items-center">
        <div className="mx-auto w-full max-w-7xl px-4 py-24">
          <div className="ml-auto max-w-xl">
            <Reveal>
              <Kicker>Mission briefing</Kicker>
              <BigTitle>How you stop it</BigTitle>
            </Reveal>
            <ol className="relative mt-8 space-y-4 border-l border-reactor/30 pl-8">
              {STEPS.map((st, i) => (
                <Reveal key={st.n} delay={i * 0.12}>
                  <li className="relative">
                    <span className="absolute -left-[41px] top-4 grid h-5 w-5 place-items-center rounded-full border border-reactor bg-void shadow-reactor">
                      <span className="h-1.5 w-1.5 rounded-full bg-reactor" />
                    </span>
                    <Hud className="group p-5 transition hover:bg-void/75">
                      <div className="flex items-baseline gap-4">
                        <span className="font-display text-4xl text-reactor/70 transition group-hover:text-reactor">{st.n}</span>
                        <h3 className="font-display text-3xl tracking-wide text-white">{st.t}</h3>
                      </div>
                      <p className="mt-1 text-sm text-steel/90">{st.d}</p>
                    </Hud>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* 4 · FOUR FRONTS */}
      <section className="relative z-10 flex min-h-screen items-center">
        <div className="mx-auto w-full max-w-7xl px-4 py-24">
          <Reveal>
            <Kicker tone="text-gold">Challenge categories</Kicker>
            <BigTitle>Four fronts of the war</BigTitle>
          </Reveal>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {THEMES.map((t, i) => (
              <Reveal key={t.id} delay={i * 0.1} className="h-full">
                <TiltCard glow={t.tint} className="h-full">
                  <Hud className="group h-full overflow-hidden">
                    <div className="relative h-36 overflow-hidden">
                      <img src={img(THEME_PHOTO[t.id])} alt="" loading="lazy" className="h-full w-full object-cover opacity-60 mix-blend-luminosity transition duration-500 group-hover:scale-110 group-hover:opacity-90 group-hover:mix-blend-normal" />
                      <div className="absolute inset-0 bg-gradient-to-t from-void via-void/40 to-transparent" />
                      <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: t.tint, boxShadow: `0 0 16px ${t.tint}` }} />
                      <span className="absolute right-3 top-3 font-mono text-[10px] tracking-[0.3em] text-steel/60">FRONT 0{i + 1}</span>
                    </div>
                    <div className="p-5 pt-0">
                      <span className="-mt-6 mb-3 grid h-12 w-12 place-items-center border border-white/15 bg-void" style={{ color: t.tint, boxShadow: `0 0 20px ${t.tint}55` }}>
                        <ThemeIcon theme={t.id} size={26} />
                      </span>
                      <div className="font-display text-3xl leading-none tracking-wide text-white">{t.name}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-widest" style={{ color: t.tint }}>
                        {t.skill}
                      </div>
                      <p className="mt-3 text-sm text-steel/90">{t.intel}</p>
                    </div>
                  </Hud>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 5 · SCOREBOARD + RULES */}
      <section className="relative z-10 flex min-h-screen items-center">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-24 lg:grid-cols-2">
          <Reveal>
            <Hud tone="gold" className="h-full p-7">
              <Kicker tone="text-gold">Live from the front</Kicker>
              <BigTitle>Top teams</BigTitle>
              {!s.scoreboardVisible ? (
                <p className="mt-5 text-steel/80">The organisers have hidden the scoreboard. Keep solving.</p>
              ) : standings.length === 0 ? (
                <p className="mt-5 text-steel/80">No teams yet.</p>
              ) : (
                <ol className="mt-6 space-y-2">
                  {standings.slice(0, 5).map((r, i) => (
                    <motion.li
                      key={r.teamId}
                      initial={{ opacity: 0, x: -30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className={`flex items-center gap-4 border px-4 py-3 ${i === 0 ? "border-gold/50 bg-gold/10 shadow-gold" : "border-white/10 bg-white/5"}`}
                    >
                      <span className={`w-8 font-display text-4xl ${i === 0 ? "text-gold" : "text-steel/50"}`}>{r.rank}</span>
                      <Emblem name={r.name} color={teamColor(r.teamId, view.teams)} size={36} />
                      <span className="min-w-0 flex-1 truncate font-semibold text-white">{r.name}</span>
                      <span className="font-display text-3xl tabular-nums text-reactor">
                        <CountUp value={r.power} />
                      </span>
                    </motion.li>
                  ))}
                </ol>
              )}
            </Hud>
          </Reveal>
          <Reveal delay={0.15}>
            <Hud className="h-full p-7">
              <Kicker>Rules of engagement</Kicker>
              <BigTitle>Before you start</BigTitle>
              <ul className="mt-6 space-y-3 text-steel/90">
                {[
                  <>
                    Flags look like <code className="font-mono text-reactor">IAMDOOM{"{...}"}</code>. Paste the whole thing, braces included.
                  </>,
                  <>Teams of up to {s.teamSize}. Every member logs in with their own account.</>,
                  <>Flags open when the timer starts and close when it hits zero ({s.durationMinutes} minutes).</>,
                  <>Ties go to the team that reached that score first.</>,
                  <>Hints cost points once, for the whole team. Some challenges have limited attempts.</>,
                  <>Max {s.submissionsPerMinute} flag attempts per minute per challenge for each team.</>,
                  <>No attacking the platform, other teams, or the organisers' infrastructure.</>,
                ].map((li, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-reactor" />
                    <span>{li}</span>
                  </li>
                ))}
              </ul>
            </Hud>
          </Reveal>
        </div>
      </section>

      {/* 6 · FINAL CALL (camera dives into the rift) */}
      <section className="relative z-10 flex min-h-[90vh] items-center justify-center text-center">
        <Reveal className="relative px-4">
          <div className="pointer-events-none absolute -inset-x-24 -inset-y-20 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(7,9,13,0.85),rgba(7,9,13,0.5)_45%,transparent_70%)]" aria-hidden />
          <div className="flex justify-center">
            <Kicker tone="text-breach">Final transmission</Kicker>
          </div>
          <h2 className="mt-4 font-display text-6xl leading-[0.85] text-white sm:text-9xl [text-shadow:0_0_40px_rgba(43,214,123,.5)]">
            The clock
            <br />
            <span className="text-gold">is ticking.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md font-display text-2xl tracking-wide text-steel">{s.tagline}</p>
          <div className="mt-8 flex justify-center">
            <CallToAction big />
          </div>
        </Reveal>
      </section>
    </div>
  );
}
