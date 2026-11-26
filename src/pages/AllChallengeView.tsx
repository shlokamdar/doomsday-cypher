import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { clockTime, ThemeChip } from "../components/Bits";
import { Icon } from "../components/Icons";
import { Page } from "../components/Layout";
import { THEMES } from "../core/themes";
import type { ChallengeStatus, TesterChallenge, ThemeId } from "../core/types";
import { safeGet, safeSet, useBackend } from "../hooks/store";
import { useRun } from "../hooks/ui";

const PW_KEY = "doomsday.testerpw";
const STATUS_STYLE: Record<ChallengeStatus, string> = {
  live: "border-reactor/50 text-reactor",
  scheduled: "border-gold/50 text-gold",
  draft: "border-white/20 text-steel",
  hidden: "border-breach/50 text-breach",
  archived: "border-white/20 text-steel/60",
};

/**
 * Testing page: every challenge (any status), full text, all hints, files, and a flag checker that
 * records nothing. Open to Admin, or to anyone with the testing password set in Admin → Settings.
 */
export function AllChallengeViewPage() {
  const { view, actions } = useBackend();
  const isAdmin = view.me?.role === "admin";
  const [pw, setPw] = useState(() => safeGet("session", PW_KEY) ?? "");
  const [typed, setTyped] = useState("");
  const [list, setList] = useState<TesterChallenge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeId | "all">("all");
  const [status, setStatus] = useState<ChallengeStatus | "all">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (password: string) => {
      setLoading(true);
      setError(null);
      try {
        const r = await actions.testerChallenges(password);
        setList(r);
        setPw(password);
        safeSet("session", PW_KEY, password);
      } catch (e) {
        setList(null);
        setError(e instanceof Error ? e.message : String(e));
        safeSet("session", PW_KEY, "");
      } finally {
        setLoading(false);
      }
    },
    [actions],
  );

  // Admin needs no password; a tester's password is remembered for this browser tab.
  useEffect(() => {
    if (isAdmin || pw) void load(isAdmin ? "" : pw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const shown = useMemo(
    () =>
      (list ?? [])
        .filter((c) => theme === "all" || c.theme === theme)
        .filter((c) => status === "all" || c.status === status)
        .filter((c) => !q.trim() || `${c.title} ${c.description}`.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => THEMES.findIndex((t) => t.id === a.theme) - THEMES.findIndex((t) => t.id === b.theme) || a.points - b.points || a.title.localeCompare(b.title)),
    [list, theme, status, q],
  );

  if (!list) {
    return (
      <Page className="max-w-md">
        <form
          className="plate mt-10 p-6"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void load(typed);
          }}
        >
          <h1 className="h-display text-4xl">All challenges</h1>
          <p className="mt-1 text-sm text-steel/80">Testing view for organisers. Enter the testing password.</p>
          <label className="label mt-5" htmlFor="tester-pw">
            Testing password
          </label>
          <input id="tester-pw" type="password" className="input" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          {error && (
            <p className="mt-2 text-sm text-breach" role="alert">
              {error}
            </p>
          )}
          <button className="btn-primary mt-5 w-full" disabled={loading || !typed}>
            {loading ? "Checking…" : "Open"}
          </button>
        </form>
      </Page>
    );
  }

  return (
    <Page>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Testing view</div>
          <h1 className="h-display text-5xl">All challenges</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" disabled={loading} onClick={() => load(isAdmin ? "" : pw)}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          {!isAdmin && (
            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                safeSet("session", PW_KEY, "");
                setPw("");
                setList(null);
              }}
            >
              Lock
            </button>
          )}
        </div>
      </div>
      <p className="mb-5 rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
        Every challenge, whatever its status. Flags you check here are <strong>not recorded</strong>: no points, no attempts used, nothing on the
        scoreboard or in Submissions. Hints are shown in full and cost nothing.
      </p>

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {(["all", ...THEMES.map((t) => t.id)] as const).map((t) => (
          <button
            key={t}
            aria-pressed={theme === t}
            onClick={() => setTheme(t)}
            className={`rounded-full border px-3 py-1 text-sm ${theme === t ? "border-reactor bg-reactor/15 text-reactor" : "border-white/10 text-steel"}`}
          >
            {t === "all" ? "All categories" : THEMES.find((x) => x.id === t)!.name} ({t === "all" ? list.length : list.filter((c) => c.theme === t).length})
          </button>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(["all", "live", "scheduled", "draft", "hidden", "archived"] as const).map((s) => (
          <button
            key={s}
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${status === s ? "border-gold bg-gold/15 text-gold" : "border-white/10 text-steel"}`}
          >
            {s} ({s === "all" ? list.length : list.filter((c) => c.status === s).length})
          </button>
        ))}
        <input className="input ml-auto w-full sm:w-64" placeholder="Search title or text" aria-label="Search challenges" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {shown.length === 0 && <p className="text-steel/60">No challenges match.</p>}
      <ul className="grid gap-3">
        {shown.map((c) => (
          <TesterCard key={c.id} c={c} pw={isAdmin ? "" : pw} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} />
        ))}
      </ul>
    </Page>
  );
}

function TesterCard({ c, pw, open, onToggle }: { c: TesterChallenge; pw: string; open: boolean; onToggle: () => void }) {
  const { backend, actions } = useBackend();
  const { run, busy } = useRun();
  const [flag, setFlag] = useState("");
  const [result, setResult] = useState<null | { correct: boolean; value: string }>(null);

  const check = async (e: FormEvent) => {
    e.preventDefault();
    const value = flag;
    const r = await run(() => actions.testerCheckFlag(pw, c.id, value));
    if (r) setResult({ correct: r.correct, value });
  };

  return (
    <li className="plate overflow-hidden" data-testid="tester-card">
      <button className="flex w-full flex-wrap items-center gap-3 p-4 text-left" onClick={onToggle} aria-expanded={open}>
        <span className={`chip capitalize ${STATUS_STYLE[c.status]}`}>{c.status}</span>
        <strong className="text-lg text-white">{c.title}</strong>
        <ThemeChip theme={c.theme} />
        <span className="font-display text-2xl text-gold">{c.points}</span>
        <span className="ml-auto flex flex-wrap items-center gap-3 text-xs text-steel/60">
          {c.waveNumber && <span>Wave {c.waveNumber}</span>}
          {c.status === "scheduled" && c.releaseAt && <span>opens {clockTime(c.releaseAt)}</span>}
          <span>{c.files.length} file{c.files.length === 1 ? "" : "s"}</span>
          <span>{c.hints.length} hint{c.hints.length === 1 ? "" : "s"}</span>
          <span>{c.maxAttempts ? `${c.maxAttempts} attempts/team` : "unlimited attempts"}</span>
          <span>{c.solves} team{c.solves === 1 ? "" : "s"} solved</span>
          <Icon.Chevron className={`transition ${open ? "rotate-90" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="border-t border-white/10 p-4">
          <p className="whitespace-pre-line text-steel">{c.description || "No description."}</p>

          {c.files.length > 0 && (
            <div className="mt-4">
              <h3 className="label">Files</h3>
              <div className="flex flex-wrap gap-2">
                {c.files.map((f) => (
                  <button key={f.url + f.name} type="button" className="btn-ghost btn-sm normal-case tracking-normal" onClick={() => run(() => backend.downloadFile(f.url, f.name, pw || undefined))}>
                    <Icon.File size={14} /> {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {c.hints.length > 0 && (
            <div className="mt-4">
              <h3 className="label">Hints (costs shown are what players pay)</h3>
              <ol className="grid gap-2">
                {c.hints.map((h, i) => (
                  <li key={i} className="rounded-md border border-white/10 bg-void/40 p-3 text-sm">
                    <span className="text-xs uppercase tracking-wider text-gold">
                      Hint {i + 1} · {h.cost} points
                    </span>
                    <p className="mt-1 text-white">{h.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <form onSubmit={check} className="mt-5 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor={`f-${c.id}`}>
              Flag to check
            </label>
            <input
              id={`f-${c.id}`}
              className="input font-mono"
              placeholder="IAMDOOM{…}"
              autoComplete="off"
              spellCheck={false}
              value={flag}
              onChange={(e) => {
                setFlag(e.target.value);
                setResult(null);
              }}
            />
            <button className="btn-primary shrink-0" disabled={busy || !flag.trim()}>
              Check flag
            </button>
          </form>
          {result && (
            <p className={`mt-2 flex items-center gap-2 text-sm font-semibold ${result.correct ? "text-reactor" : "text-breach"}`} role="status">
              {result.correct ? <Icon.Check size={16} /> : <Icon.X size={16} />}
              {result.correct ? "Correct flag." : "Not the flag."}
              <span className="font-normal text-steel/60">{c.caseSensitive ? "(case-sensitive)" : "(case doesn't matter)"}</span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}
