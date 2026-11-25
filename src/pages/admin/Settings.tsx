import { useEffect, useRef, useState, type FormEvent } from "react";
import { clockTime, downloadText } from "../../components/Bits";
import { useBackend } from "../../hooks/store";
import { useRun, useUi } from "../../hooks/ui";
import { AdminTitle } from "./CommandApp";

export function AdminSettings() {
  const { view, actions } = useBackend();
  const s = view.settings;
  const { run, busy } = useRun();
  const { confirm } = useUi();
  const [ev, setEv] = useState({ eventName: s.eventName, tagline: s.tagline, durationMinutes: s.durationMinutes, teamSize: s.teamSize, submissionsPerMinute: s.submissionsPerMinute, forcePasswordChange: s.forcePasswordChange });
  const fileRef = useRef<HTMLInputElement>(null);
  // "Remove time limit" on the dashboard changes the duration: keep the form in step.
  useEffect(() => setEv((x) => ({ ...x, durationMinutes: s.durationMinutes })), [s.durationMinutes]);
  const unlimited = ev.durationMinutes === 0;

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
          <Field label="Clock length (minutes)" id="ev-dur">
            <input
              id="ev-dur"
              type="number"
              min={10}
              className="input disabled:opacity-40"
              disabled={unlimited}
              value={unlimited ? 180 : ev.durationMinutes}
              onChange={(e) => setEv({ ...ev, durationMinutes: Number(e.target.value) })}
            />
            <label className="mt-1.5 flex items-center gap-2 text-sm text-steel">
              <input type="checkbox" className="h-4 w-4 accent-reactor" checked={unlimited} onChange={(e) => setEv({ ...ev, durationMinutes: e.target.checked ? 0 : 180 })} />
              No time limit (runs until you press End now)
            </label>
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
        <p className="text-xs text-steel/60">Start, extend and end the clock from the dashboard.</p>
      </form>


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
        <h2 className="h-display text-2xl">Data and security</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-steel/80">
          <li>Flags and passwords are stored only as salted PBKDF2 hashes. Nobody, including admins, can read a flag back.</li>
          <li>In the browser-only (GitHub Pages) version, data is encrypted with AES-256 using a key the browser won't let anyone export. Export a backup before clearing browser data.</li>
        </ul>
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
              if (
                await confirm({
                  title: "Start fresh?",
                  body: "This deletes every team, member, challenge, wave, announcement, submission and score, and resets the clock. Your admin login, the event settings, difficulty levels and soundboard stay as they are. Export a backup first if you might need it.",
                  danger: true,
                  confirmLabel: "Delete and start fresh",
                })
              )
                await run(() => actions.startFresh(), "Everything cleared. You're still logged in with your current password.");
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
