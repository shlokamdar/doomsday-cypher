import { motion } from "framer-motion";
import { useMemo, useState, type FormEvent } from "react";
import { Emblem } from "../components/Art";
import { clockTime, CountUp, DoomsdayClock, Modal, ThemeChip, TypeChip } from "../components/Bits";
import { Icon, ThemeIcon } from "../components/Icons";
import { LatestTransmission, Page } from "../components/Layout";
import { attemptInfo, clockPhase, NEW_BADGE_MS, teamColor } from "../core/logic";
import { themeMeta, THEMES } from "../core/themes";
import type { ThemeId, ViewChallenge } from "../core/types";
import { useBackend, useNow, useSoundSetting, useStandings } from "../hooks/store";
import { useRun, useUi } from "../hooks/ui";

export function BreachesPage() {
  const { view } = useBackend();
  const standings = useStandings();
  const now = useNow(5000);
  const [filter, setFilter] = useState<ThemeId | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const me = view.me!;
  const team = view.teams.find((t) => t.id === me.teamId)!;
  const mine = standings.find((s) => s.teamId === me.teamId);
  const color = teamColor(team.id, view.teams);

  const solvedByUs = useMemo(() => new Set(view.solves.filter((s) => s.teamId === me.teamId).map((s) => s.challengeId)), [view.solves, me.teamId]);
  const solveCount = (id: string) => new Set(view.solves.filter((s) => s.challengeId === id).map((s) => s.teamId)).size;

  const list = view.challenges.filter((c) => filter === "all" || c.theme === filter);
  const singles = list.filter((c) => !c.waveId).sort((a, b) => (b.releaseAt ?? 0) - (a.releaseAt ?? 0));
  const waves = [...view.waves].sort((a, b) => b.number - a.number);
  const open = view.challenges.find((c) => c.id === openId) ?? null;

  return (
    <Page>
      <section className="plate relative mb-6 overflow-hidden p-5 sm:p-6" aria-label="Your squad">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ background: color }} />
        <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap items-center gap-5">
            <Emblem name={team.name} color={color} size={84} />
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.3em] text-steel/60">Strike Squad</div>
              <h1 className="h-display truncate text-4xl sm:text-5xl">{team.name}</h1>
              <div className="mt-1 flex flex-wrap items-baseline gap-4">
                <span className="font-display text-5xl text-reactor">
                  <CountUp value={mine?.power ?? 0} /> <span className="text-2xl text-steel/70">Power</span>
                </span>
                {mine && view.settings.scoreboardVisible && (
                  <span className="font-display text-3xl text-gold">
                    Rank #{mine.rank}
                    <span className="text-lg text-steel/60"> / {standings.length}</span>
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {mine?.members.map((m) => (
                  <span key={m.userId} className={`chip ${m.userId === me.id ? "border-reactor/50 text-white" : ""}`}>
                    {m.displayName} <strong className="text-reactor">{m.power}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <DoomsdayClock size="xl" />
        </div>
      </section>

      <LatestTransmission />

      <div className="scrollbar-thin -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by category">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All breaches
        </FilterChip>
        {THEMES.map((t) => (
          <FilterChip key={t.id} active={filter === t.id} onClick={() => setFilter(t.id)} color={t.tint}>
            <ThemeIcon theme={t.id} size={14} /> {t.name}
          </FilterChip>
        ))}
      </div>

      {view.challenges.length === 0 && (
        <div className="plate p-10 text-center">
          <p className="font-display text-3xl text-white">No breaches open yet</p>
          <p className="text-steel/70">Stand by. Command will open the first incursion wave soon.</p>
        </div>
      )}

      {singles.length > 0 && (
        <section className="mb-10">
          <h2 className="h-display mb-3 text-3xl">Single breaches</h2>
          <CardGrid items={singles} solved={solvedByUs} count={solveCount} now={now} onOpen={setOpenId} />
        </section>
      )}

      {waves.map((w) => {
        const items = list.filter((c) => c.waveId === w.id).sort((a, b) => a.points - b.points);
        if (!items.length) return null;
        const all = view.challenges.filter((c) => c.waveId === w.id);
        const sealed = all.filter((c) => solvedByUs.has(c.id)).length;
        return (
          <section key={w.id} className="mb-10">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="h-display text-3xl">
                Incursion wave <span className="text-gold">{w.number}</span>
              </h2>
              <span className="chip border-reactor/40 text-reactor">
                {sealed} of {all.length} sealed
              </span>
            </div>
            <CardGrid items={items} solved={solvedByUs} count={solveCount} now={now} onOpen={setOpenId} />
          </section>
        );
      })}

      <BreachModal challenge={open} onClose={() => setOpenId(null)} solved={!!open && solvedByUs.has(open.id)} />
    </Page>
  );
}

function FilterChip({ active, onClick, color, children }: { active: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${active ? "bg-white/10 text-white" : "border-white/10 text-steel/70 hover:text-white"}`}
      style={{ borderColor: active ? color ?? "#C9D2DC" : undefined, color: active ? color : undefined }}
    >
      {children}
    </button>
  );
}

function CardGrid(props: { items: ViewChallenge[]; solved: Set<string>; count: (id: string) => number; now: number; onOpen: (id: string) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {props.items.map((c, i) => (
        <motion.div key={c.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
          <BreachCard c={c} solved={props.solved.has(c.id)} squads={props.count(c.id)} now={props.now} onOpen={() => props.onOpen(c.id)} />
        </motion.div>
      ))}
    </div>
  );
}

function BreachCard({ c, solved, squads, now, onOpen }: { c: ViewChallenge; solved: boolean; squads: number; now: number; onOpen: () => void }) {
  const { view } = useBackend();
  const t = themeMeta(c.theme);
  const att = attemptInfo(c, view.me!.teamId!, view.submissions);
  const hintsOpened = c.hints.filter((h) => h.unlocked).length;
  const isNew = c.releaseAt !== null && now - c.releaseAt < NEW_BADGE_MS;
  return (
    <button
      onClick={onOpen}
      className={`plate group flex h-full w-full flex-col overflow-hidden text-left transition hover:-translate-y-0.5 hover:border-white/25 ${solved ? "ring-1 ring-reactor/60" : ""}`}
      aria-label={`${c.title}, ${c.points} Power${solved ? ", sealed" : ""}`}
      data-testid="breach-card"
    >
      <div className="relative flex items-start gap-3 px-4 py-3" style={{ background: `linear-gradient(100deg, ${t.tint}40, ${t.tint}10 70%, transparent)` }}>
        <span style={{ color: t.tint }} className="mt-0.5">
          <ThemeIcon theme={c.theme} size={26} />
        </span>
        <p className="line-clamp-2 text-xs leading-snug text-steel/90">{t.intel}</p>
        {isNew && <span className="absolute right-3 top-3 rounded bg-breach px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">New</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl leading-tight tracking-wide text-white">{c.title}</h3>
          <span className="shrink-0 font-display text-3xl leading-none text-gold">{c.points}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <ThemeChip theme={c.theme} />
          <TypeChip typeId={c.typeId} />
          {hintsOpened > 0 && <span className="chip border-gold/40 text-gold">{hintsOpened} hint{hintsOpened > 1 ? "s" : ""} open</span>}
          {att.limit !== null && !solved && (
            <span className={`chip ${att.left === 0 ? "border-breach/60 text-breach" : ""}`}>
              {att.left} / {att.limit} attempts
            </span>
          )}
        </div>
        <div className="mt-auto pt-4 text-sm">
          {solved ? (
            <span className="flex items-center gap-1.5 font-semibold text-reactor">
              <Icon.Check /> Sealed by your squad
            </span>
          ) : (
            <span className="text-steel/60">
              {squads} squad{squads === 1 ? "" : "s"} sealed
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function BreachModal({ challenge: c, onClose, solved }: { challenge: ViewChallenge | null; onClose: () => void; solved: boolean }) {
  const { view, actions } = useBackend();
  const { confirm, fireWrong, fireSeal, toast } = useUi();
  const { run, busy } = useRun();
  const now = useNow(1000);
  const [flag, setFlag] = useState("");
  const [sound, setSound] = useSoundSetting();
  const phase = clockPhase(view.settings, now);
  const nameOf = (id?: string) => view.teams.flatMap((t) => t.members).find((m) => m.id === id)?.displayName ?? "A squadmate";

  if (!c) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const t = themeMeta(c.theme);
  const att = attemptInfo(c, view.me!.teamId!, view.submissions);
  const out = att.left === 0;

  const openHint = async (i: number) => {
    const cost = c.hints[i].cost;
    const ok = await confirm({
      title: `Open hint ${i + 1}?`,
      body: (
        <>
          Spend <strong className="text-gold">{cost} Power</strong> to open hint {i + 1}? Your whole squad will see it.
        </>
      ),
      confirmLabel: `Spend ${cost} Power`,
    });
    if (ok) await run(() => actions.unlockHint(c.id, i), `Hint ${i + 1} opened.`);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!flag.trim()) return;
    const r = await run(() => actions.submitFlag(c.id, flag));
    if (!r) return;
    setFlag("");
    if (r.alreadySolved) toast("info", "Your squad already sealed this breach.");
    else if (r.correct) fireSeal(r.title, r.points);
    else fireWrong();
  };

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="breach-title"
      title={
        <div className="flex items-start gap-3">
          <span style={{ color: t.tint }}>
            <ThemeIcon theme={c.theme} size={34} />
          </span>
          <div>
            <h2 id="breach-title" className="font-display text-4xl leading-none tracking-wide text-white">
              {c.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <ThemeChip theme={c.theme} />
              <TypeChip typeId={c.typeId} />
              <span className="chip border-gold/40 font-display text-base text-gold">{c.points} Power</span>
            </div>
          </div>
        </div>
      }
    >
      <p className="whitespace-pre-line text-steel">{c.description || "No briefing for this breach."}</p>
      <p className="mt-3 text-xs italic" style={{ color: t.tint }}>
        Intel: {t.intel}
      </p>

      {c.files.length > 0 && (
        <div className="mt-5">
          <h3 className="label">Files</h3>
          <ul className="flex flex-wrap gap-2">
            {c.files.map((f) => (
              <li key={f.url + f.name}>
                <a className="btn-ghost btn-sm normal-case tracking-normal" href={f.url} target="_blank" rel="noopener noreferrer">
                  <Icon.File size={14} /> {f.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {c.hints.length > 0 && (
        <div className="mt-5">
          <h3 className="label">Hints</h3>
          <ul className="grid gap-2">
            {c.hints.map((h, i) => (
              <li key={i} className={`rounded-md border p-3 ${h.unlocked ? "border-gold/40 bg-gold/5" : "border-white/10 bg-void/40"}`}>
                {h.unlocked ? (
                  <>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gold">
                      <Icon.Unlock size={14} /> Hint {i + 1} · −{h.cost} Power · opened by {nameOf(h.unlockedBy)}
                      {h.unlockedAt ? ` at ${clockTime(h.unlockedAt)}` : ""}
                    </div>
                    <p className="mt-1 text-white">{h.text}</p>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-steel/80">
                      <Icon.Lock size={16} /> Hint {i + 1} is locked
                    </span>
                    <button className="btn-ghost btn-sm" onClick={() => openHint(i)} disabled={busy || phase === "ended"}>
                      Open for {h.cost} Power
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 border-t border-white/10 pt-5">
        {att.limit !== null && !solved && (
          <p className={`mb-2 text-sm ${out ? "text-breach" : "text-steel/80"}`}>
            <strong className={out ? "" : "text-white"}>
              {att.left} of {att.limit}
            </strong>{" "}
            attempts left for your squad
          </p>
        )}
        {solved ? (
          <div className="flex items-center gap-2 rounded-md bg-reactor/10 px-4 py-3 font-semibold text-reactor">
            <Icon.Check /> Sealed by your squad. Nice work.
          </div>
        ) : phase === "idle" ? (
          <Notice>Flags open when the Doomsday Clock starts.</Notice>
        ) : phase === "ended" ? (
          <Notice>Time's up.</Notice>
        ) : out ? (
          <Notice danger>Out of attempts. Command can grant more.</Notice>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="flag" className="sr-only">
              Flag
            </label>
            <input
              id="flag"
              className="input font-mono"
              placeholder="DC{…}"
              autoComplete="off"
              spellCheck={false}
              value={flag}
              onChange={(e) => setFlag(e.target.value)}
              maxLength={500}
            />
            <button className="btn-primary shrink-0" disabled={busy || !flag.trim()}>
              {busy ? "Checking…" : "Seal breach"}
            </button>
          </form>
        )}
        <button className="mt-4 flex items-center gap-2 text-xs uppercase tracking-wider text-steel/60 hover:text-white" onClick={() => setSound(!sound)} aria-pressed={sound}>
          {sound ? <Icon.Sound size={16} /> : <Icon.Mute size={16} />} Sound {sound ? "on" : "off"}
        </button>
      </div>
    </Modal>
  );
}

function Notice({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div role="status" className={`rounded-md border px-4 py-3 font-semibold ${danger ? "border-breach/50 bg-breach/10 text-breach" : "border-gold/40 bg-gold/10 text-gold"}`}>
      {children}
    </div>
  );
}
