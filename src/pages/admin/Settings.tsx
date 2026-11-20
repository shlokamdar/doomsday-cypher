import { useEffect, useRef, useState, type FormEvent } from "react";
import { clockTime, downloadText } from "../../components/Bits";
import type { ChallengeType, Credential } from "../../core/types";
import { useBackend } from "../../hooks/store";
import { useRun, useUi } from "../../hooks/ui";
import { AdminTitle } from "./CommandApp";
import { CredentialsModal } from "./Credentials";

export function AdminSettings() {
  const { view, actions } = useBackend();
  const s = view.settings;
  const { run, busy } = useRun();
  const { confirm } = useUi();
  const [ev, setEv] = useState({ eventName: s.eventName, tagline: s.tagline, durationMinutes: s.durationMinutes, teamSize: s.teamSize, submissionsPerMinute: s.submissionsPerMinute, forcePasswordChange: s.forcePasswordChange });
  const [types, setTypes] = useState<ChallengeType[]>(view.challengeTypes);
  const [fresh, setFresh] = useState<Credential[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setTypes(view.challengeTypes), [view.challengeTypes]);

  const saveEvent = (e: FormEvent) => {
    e.preventDefault();
    void run(() => actions.updateSettings(ev), "Event settings saved.");
  };

  return (
    <div className="grid gap-6">
      <AdminTitle>Settings</AdminTitle>

      <form onSubmit={saveEvent} className="plate grid gap-3 p-5">
        <h2 className="h-display text-2xl">Event</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Event name" id="ev-name">
            <input id="ev-name" className="input" value={ev.eventName} onChange={(e) => setEv({ ...ev, eventName: e.target.value })} />
          </Field>
          <Field label="Tagline" id="ev-tag">
            <input id="ev-tag" className="input" value={ev.tagline} onChange={(e) => setEv({ ...ev, tagline: e.target.value })} />
          </Field>
          <Field label="Duration (minutes)" id="ev-dur">
            <input id="ev-dur" type="number" min={1} className="input" value={ev.durationMinutes} onChange={(e) => setEv({ ...ev, durationMinutes: Number(e.target.value) })} />
          </Field>
          <Field label="Team size" id="ev-size">
            <input id="ev-size" type="number" min={1} max={10} className="input" value={ev.teamSize} onChange={(e) => setEv({ ...ev, teamSize: Number(e.target.value) })} />
          </Field>
          <Field label="Submissions per minute (per team, per challenge)" id="ev-rate">
            <input id="ev-rate" type="number" min={1} className="input" value={ev.submissionsPerMinute} onChange={(e) => setEv({ ...ev, submissionsPerMinute: Number(e.target.value) })} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-steel">
          <input type="checkbox" className="h-4 w-4 accent-reactor" checked={ev.forcePasswordChange} onChange={(e) => setEv({ ...ev, forcePasswordChange: e.target.checked })} />
          Make people with a temporary password choose their own on first login
        </label>
        <button className="btn-primary w-fit" disabled={busy}>
          Save event settings
        </button>
      </form>

      <section className="plate grid gap-3 p-5">
        <h2 className="h-display text-2xl">Categories</h2>
        <p className="text-sm text-steel/70">Four editable categories (difficulty tiers by default). Shown as a chip on every challenge.</p>
        {types.map((t, i) => (
          <div key={t.id} className="grid gap-2 sm:grid-cols-[160px_1fr_110px]">
            <input className="input" aria-label={`Category ${i + 1} name`} value={t.name} onChange={(e) => setTypes(types.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <input className="input" aria-label={`Category ${i + 1} description`} value={t.description} onChange={(e) => setTypes(types.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
            <div className="flex items-center gap-2">
              <input type="color" aria-label={`Category ${i + 1} colour`} className="h-10 w-12 cursor-pointer rounded border border-white/15 bg-transparent" value={t.color} onChange={(e) => setTypes(types.map((x, j) => (j === i ? { ...x, color: e.target.value.toUpperCase() } : x)))} />
              <code className="text-xs text-steel/70">{t.color}</code>
            </div>
          </div>
        ))}
        <button className="btn-primary w-fit" disabled={busy} onClick={() => run(() => actions.updateChallengeTypes(types), "Categories saved.")}>
          Save categories
        </button>
      </section>

      <section className="plate grid gap-3 p-5">
        <h2 className="h-display text-2xl">Scoreboard</h2>
        <p className="text-sm text-steel/80">
          Scoreboard is <strong className="text-white">{s.scoreboardVisible ? "visible" : "hidden"}</strong>
          {s.freezeAt !== null && <> and <strong className="text-gold">frozen at {clockTime(s.freezeAt)}</strong></>}.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" disabled={busy} onClick={() => run(() => actions.setScoreboardVisible(!s.scoreboardVisible), s.scoreboardVisible ? "Scoreboard hidden." : "Scoreboard visible.")}>
            {s.scoreboardVisible ? "Hide Scoreboard" : "Show Scoreboard"}
          </button>
          {s.freezeAt === null ? (
            <button
              className="btn-gold"
              disabled={busy}
              onClick={async () => {
                if (await confirm({ title: "Freeze now?", body: "Players stop seeing other teams' progress from this moment." })) await run(() => actions.freezeScoreboard(), "Scoreboard frozen.");
              }}
            >
              Freeze now
            </button>
          ) : (
            <button className="btn-ghost" disabled={busy} onClick={() => run(() => actions.unfreezeScoreboard(), "Scoreboard unfrozen. Full reveal!")}>
              Unfreeze
            </button>
          )}
        </div>
      </section>

      <section className="plate grid gap-3 p-5">
        <h2 className="h-display text-2xl">Data</h2>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-ghost"
            disabled={busy}
            onClick={async () => {
              const r = await run(() => actions.exportBackup(), "Backup exported. It contains password and flag hashes: keep it safe.");
              if (r) downloadText(`doomsday-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`, r.json, "application/json");
            }}
          >
            Export backup
          </button>
          <button className="btn-ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (await confirm({ title: "Replace everything?", body: `Import ${f.name}? All current data is replaced. The backup must contain an admin account.`, danger: true, confirmLabel: "Import" }))
                await run(() => f.text().then((t) => actions.importBackup(t)), "Backup imported.");
            }}
          />
          <button
            className="btn-danger"
            disabled={busy}
            onClick={async () => {
              if (await confirm({ title: "Start fresh?", body: "Deletes every team, challenge, submission and announcement. A new admin password is shown once.", danger: true, confirmLabel: "Start fresh" })) {
                const r = await run(() => actions.startFresh(), "Fresh event created.");
                if (r) setFresh([r.credential]);
              }
            }}
          >
            Start fresh
          </button>
          <button
            className="btn-ghost"
            disabled={busy}
            onClick={async () => {
              if (await confirm({ title: "Load demo data?", body: "Replaces everything with the demo event (4 teams, wave 1). You'll be asked to set a new admin password.", danger: true, confirmLabel: "Load demo" }))
                await run(() => actions.loadDemo(), "Demo loaded.");
            }}
          >
            Load demo
          </button>
        </div>
      </section>
      <CredentialsModal creds={fresh} onClose={() => setFresh(null)} title="New Admin password" />
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}
