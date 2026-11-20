import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Emblem, PortalRing } from "../components/Art";
import { clockTime, DoomsdayClock, SectionTitle } from "../components/Bits";
import { StepChart } from "../components/Charts";
import { Icon } from "../components/Icons";
import { Page } from "../components/Layout";
import { teamColor, type Standing } from "../core/logic";
import { safeGet, safeSet, useBackend, useNow, useOnBump, usePrefersReducedMotion, useStandings } from "../hooks/store";

export function WarTablePage() {
  const { view } = useBackend();
  const standings = useStandings();
  const now = useNow(10000);
  const s = view.settings;
  const [prevRanks] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(safeGet("session", "doomsday.ranks") ?? "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    safeSet("session", "doomsday.ranks", JSON.stringify(Object.fromEntries(standings.map((r) => [r.teamId, r.rank]))));
  }, [standings]);

  const leader = standings[0] && standings[0].power > 0 ? standings[0] : null;
  const [banner, setBanner] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(0);
  useOnBump(leader?.teamId, () => {
    if (!leader) return;
    setBanner(`New leader: ${leader.name} holds the line`);
    setConfetti((c) => c + 1);
  });
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);

  const hiddenForMe = !s.scoreboardVisible && view.me?.role !== "admin";
  const start = s.startsAt ?? Math.min(now - 3600_000, ...view.solves.map((x) => x.at));
  const end = Math.min(now, s.endsAt ?? now);

  return (
    <Page>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-reactor">Scoreboard</div>
          <h1 className="h-display text-5xl sm:text-6xl">Scoreboard</h1>
        </div>
        <DoomsdayClock size="md" />
      </div>

      {s.freezeAt !== null && s.freezeAt <= now && (
        <div className="mb-4 rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-gold" role="status">
          Frozen at {clockTime(s.freezeAt)}. Other teams' moves after that stay secret until the reveal.
        </div>
      )}

      {hiddenForMe ? (
        <div className="plate p-10 text-center">
          <p className="font-display text-4xl text-white">Scoreboard is solved</p>
          <p className="mt-2 text-steel/80">The organisers have hidden the scoreboard. Your own team's points are still on your Challenges page.</p>
        </div>
      ) : (
        <>
          <AnimatePresence>
            {banner && (
              <motion.div
                initial={{ y: -20, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="mb-4 rounded-md border border-gold bg-gold/15 px-4 py-3 text-center font-display text-3xl tracking-wide text-gold"
                role="status"
              >
                {banner}
              </motion.div>
            )}
          </AnimatePresence>
          <Confetti trigger={confetti} />

          <section className="plate mb-6 p-4 sm:p-6" aria-label="Portal race">
            <SectionTitle kicker="Live">Portal race</SectionTitle>
            <PortalRace standings={standings} />
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
            <section className="plate p-4 sm:p-5" aria-label="Rankings">
              <SectionTitle>Rankings</SectionTitle>
              {standings.length === 0 ? (
                <p className="text-steel/70">No teams yet.</p>
              ) : (
                <ol className="grid gap-2">
                  {standings.map((r) => (
                    <RankRow key={r.teamId} r={r} prev={prevRanks[r.teamId]} mine={r.teamId === view.me?.teamId} />
                  ))}
                </ol>
              )}
            </section>
            <section className="plate p-4 sm:p-5" aria-label="Points over time">
              <SectionTitle>Points over time</SectionTitle>
              <StepChart
                start={start}
                end={end}
                series={standings.slice(0, 5).map((r) => ({ id: r.teamId, name: r.name, color: teamColor(r.teamId, view.teams), points: r.series }))}
              />
            </section>
          </div>
        </>
      )}
    </Page>
  );
}

function RankRow({ r, prev, mine }: { r: Standing; prev?: number; mine: boolean }) {
  const { view } = useBackend();
  const [open, setOpen] = useState(false);
  const color = teamColor(r.teamId, view.teams);
  const delta = prev ? prev - r.rank : 0;
  const maxMember = Math.max(1, ...r.members.map((m) => Math.abs(m.power)));
  return (
    <li className={`rounded-md border ${mine ? "border-reactor/50 bg-reactor/5" : "border-white/5 bg-void/40"}`}>
      <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="w-7 text-center font-display text-3xl text-gold">{r.rank}</span>
        <span className="w-5" aria-label={delta > 0 ? `up ${delta}` : delta < 0 ? `down ${-delta}` : "no change"}>
          {delta > 0 && <Icon.Up className="text-reactor" />}
          {delta < 0 && <Icon.Down className="text-breach" />}
        </span>
        <Emblem name={r.name} color={color} size={38} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-white">{r.name}</span>
          <span className="text-xs text-steel/60">
            {r.solves} solved
            {r.hintSpend > 0 && <span className="ml-2 text-breach">−{r.hintSpend} on hints</span>}
          </span>
        </span>
        <span className="font-display text-3xl tabular-nums text-reactor">{r.power}</span>
        <Icon.Chevron className={`text-steel/40 transition ${open ? "rotate-90" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-4 pb-3">
            {r.members.map((m) => (
              <li key={m.userId} className="grid grid-cols-[110px_1fr_48px] items-center gap-2 py-1 text-sm">
                <span className="truncate text-steel">{m.displayName}</span>
                <span className="h-2.5 rounded-r bg-white/5">
                  <span className="block h-2.5 rounded-r" style={{ width: `${(Math.max(0, m.power) / maxMember) * 100}%`, background: color }} />
                </span>
                <span className="text-right tabular-nums text-white">{m.power}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

/** Each team's emblem flies along its own lane towards a portal; distance = share of the leader's points. */
function PortalRace({ standings }: { standings: Standing[] }) {
  const { view } = useBackend();
  const reduced = usePrefersReducedMotion();
  const [pulse, setPulse] = useState<Record<string, number>>({});
  const top = Math.max(1, standings[0]?.power ?? 1);
  const lanes = useMemo(() => [...standings].sort((a, b) => a.name.localeCompare(b.name)), [standings]);
  const trackRef = useRef<HTMLDivElement>(null);
  if (!standings.length) return <p className="text-steel/70">No teams yet.</p>;
  return (
    <div className="relative" ref={trackRef}>
      <div className="absolute -right-6 top-1/2 hidden -translate-y-1/2 sm:block" aria-hidden>
        <PortalRing size={140} sparks={8} />
      </div>
      <ul className="grid gap-3 sm:pr-24">
        {lanes.map((r) => {
          const color = teamColor(r.teamId, view.teams);
          const pct = Math.max(0, Math.min(1, r.power / top));
          const isLeader = r.rank === 1 && r.power > 0;
          return (
            <li key={r.teamId} className="relative h-14 rounded-full border border-white/5 bg-void/50">
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `calc(${pct} * (100% - 120px) + 48px)`, background: `linear-gradient(90deg, transparent, ${color}33)` }} />
              <div className="absolute inset-y-0 left-3 flex items-center text-xs font-semibold uppercase tracking-wider text-steel/40">{r.name}</div>
              <motion.button
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: `calc(${pct} * (100% - 120px))` }}
                initial={reduced ? false : { left: "0%" }}
                animate={{ left: `calc(${pct} * (100% - 120px))` }}
                transition={{ type: "spring", stiffness: 60, damping: 16 }}
                onClick={() => setPulse((p) => ({ ...p, [r.teamId]: (p[r.teamId] ?? 0) + 1 }))}
                aria-label={`${r.name}: ${r.power} points, rank ${r.rank}`}
              >
                <span className="relative block">
                  {pulse[r.teamId] ? <span key={pulse[r.teamId]} className="anim-pulse-ring absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 4px ${color}` }} /> : null}
                  {isLeader && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-gold drop-shadow-[0_0_8px_#F2B33D]" aria-hidden>
                      <Icon.Crown size={22} />
                    </span>
                  )}
                  <Emblem name={r.name} color={color} size={48} />
                </span>
              </motion.button>
              <div className="absolute inset-y-0 right-4 flex items-center font-display text-xl tabular-nums text-white/80">{r.power}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Confetti({ trigger }: { trigger: number }) {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  useOnBump(trigger, (n) => {
    if (!reduced) setActive(n);
  });
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(0), 2600);
    return () => clearTimeout(t);
  }, [active]);
  const bits = useMemo(
    () =>
      Array.from({ length: 70 }).map((_, i) => ({
        x: Math.random() * 100,
        d: 1.4 + Math.random() * 1.2,
        r: Math.random() * 720,
        c: ["#2BD67B", "#F2B33D", "#E0408A", "#5AB0FF"][i % 4],
        delay: Math.random() * 0.4,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active],
  );
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute top-0 h-3 w-2 rounded-sm"
          style={{ left: `${b.x}%`, background: b.c }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", rotate: b.r, opacity: 0.9 }}
          transition={{ duration: b.d, delay: b.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
