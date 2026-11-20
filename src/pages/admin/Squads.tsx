import { useRef, useState, type FormEvent } from "react";
import { Emblem } from "../../components/Art";
import { downloadText } from "../../components/Bits";
import { Icon } from "../../components/Icons";
import { teamColor } from "../../core/logic";
import type { Credential, ViewTeam } from "../../core/types";
import { useBackend } from "../../hooks/store";
import { useRun, useUi } from "../../hooks/ui";
import { AdminTitle } from "./CommandApp";
import { CredentialsModal } from "./Credentials";

export function Squads() {
  const { view, actions } = useBackend();
  const size = view.settings.teamSize;
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>(() => Array(size).fill(""));
  const [creds, setCreds] = useState<Credential[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { run, busy } = useRun();
  const { toast } = useUi();

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const r = await run(() => actions.createTeam(name, members), `Squad ${name} created.`);
    if (r) {
      setCreds(r.credentials);
      setName("");
      setMembers(Array(size).fill(""));
    }
  };

  const importCsv = async (file: File) => {
    const r = await run(() => file.text().then((t) => actions.importTeams(t)));
    if (r) {
      if (r.errors.length) toast("error", r.errors.map((e) => `Row ${e.row}: ${e.message}`).join("\n"), "Some rows were skipped");
      if (r.credentials.length) {
        toast("success", `Imported ${r.credentials.length} members.`);
        setCreds(r.credentials);
      }
    }
  };

  return (
    <div>
      <AdminTitle
        sub={`Up to ${size} members per squad. Each member gets their own login.`}
        right={
          <div className="flex gap-2">
            <button className="btn-ghost btn-sm" onClick={() => downloadText("squads-template.csv", "team,member1,member2,member3\nIron Meridian,Ada Lovelace,Grace Hopper,Alan Turing\n", "text/csv")}>
              Download template
            </button>
            <button className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              Import CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importCsv(f);
                e.target.value = "";
              }}
            />
          </div>
        }
      >
        Squads &amp; members
      </AdminTitle>

      <form onSubmit={create} className="plate mb-6 grid gap-3 p-5">
        <h2 className="h-display text-2xl">Create a squad</h2>
        <div>
          <label className="label" htmlFor="sq-name">
            Squad name
          </label>
          <input id="sq-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: size }).map((_, i) => (
            <div key={i}>
              <label className="label" htmlFor={`m-${i}`}>
                Member {i + 1}
              </label>
              <input id={`m-${i}`} className="input" value={members[i] ?? ""} onChange={(e) => setMembers(Array.from({ length: size }, (_, j) => (j === i ? e.target.value : members[j] ?? "")))} maxLength={60} />
            </div>
          ))}
        </div>
        <button className="btn-primary w-fit" disabled={busy || !name.trim() || !members.some((m) => m.trim())}>
          Create squad
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        {view.teams.map((t) => (
          <SquadCard key={t.id} t={t} onCreds={setCreds} />
        ))}
      </div>
      {!view.teams.length && <p className="text-steel/60">No squads yet.</p>}

      <CredentialsModal creds={creds} onClose={() => setCreds(null)} />
    </div>
  );
}

function SquadCard({ t, onCreds }: { t: ViewTeam; onCreds: (c: Credential[]) => void }) {
  const { view, actions } = useBackend();
  const { run, busy } = useRun();
  const { confirm } = useUi();
  const [rename, setRename] = useState<string | null>(null);
  const [newMember, setNewMember] = useState("");
  const users = view.users ?? [];
  return (
    <section className="plate p-4" data-testid="squad-card">
      <div className="flex items-center gap-3">
        <Emblem name={t.name} color={teamColor(t.id, view.teams)} size={44} />
        {rename === null ? (
          <h3 className="h-display flex-1 truncate text-2xl">{t.name}</h3>
        ) : (
          <form
            className="flex flex-1 gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => actions.renameTeam(t.id, rename), "Squad renamed.")) setRename(null);
            }}
          >
            <input className="input" aria-label="New squad name" value={rename} onChange={(e) => setRename(e.target.value)} autoFocus />
            <button className="btn-primary btn-sm" disabled={busy}>
              Save
            </button>
          </form>
        )}
        {rename === null && (
          <button className="btn-ghost btn-sm" onClick={() => setRename(t.name)}>
            Rename
          </button>
        )}
        <button
          className="btn-ghost btn-sm text-breach"
          aria-label={`Delete ${t.name}`}
          onClick={async () => {
            if (await confirm({ title: `Delete ${t.name}?`, body: "Removes the squad, its members, solves and hint spending. This can't be undone.", danger: true, confirmLabel: "Delete squad" }))
              await run(() => actions.deleteTeam(t.id), "Squad deleted.");
          }}
        >
          <Icon.Trash />
        </button>
      </div>
      <ul className="mt-3 grid gap-1.5">
        {t.members.map((m) => {
          const u = users.find((x) => x.id === m.id);
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-2 rounded bg-void/40 px-3 py-2 text-sm">
              <span className="flex-1 text-white">{m.displayName}</span>
              <code className="text-steel/70">{m.username}</code>
              {u?.mustChangePassword && <span className="chip border-gold/40 text-gold">temp password</span>}
              <button
                className="btn-ghost btn-sm"
                disabled={busy}
                onClick={async () => {
                  if (await confirm({ title: `Reset ${m.displayName}'s password?`, body: "They'll be logged out everywhere and get a new temporary password.", confirmLabel: "Reset" })) {
                    const c = await run(() => actions.resetPassword(m.id), "Password reset.");
                    if (c) onCreds([c]);
                  }
                }}
              >
                Reset password
              </button>
              <button
                className="btn-ghost btn-sm"
                aria-label={`Remove ${m.displayName}`}
                disabled={busy}
                onClick={async () => {
                  if (await confirm({ title: `Remove ${m.displayName}?`, body: "Their solves stay with the squad.", danger: true, confirmLabel: "Remove" })) await run(() => actions.removeMember(m.id), "Member removed.");
                }}
              >
                <Icon.X size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      {t.members.length < view.settings.teamSize && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const c = await run(() => actions.addMember(t.id, newMember), "Member added.");
            if (c) {
              setNewMember("");
              onCreds([c]);
            }
          }}
        >
          <input className="input" placeholder="New member name" aria-label={`Add member to ${t.name}`} value={newMember} onChange={(e) => setNewMember(e.target.value)} />
          <button className="btn-ghost btn-sm" disabled={busy || !newMember.trim()}>
            <Icon.Plus /> Add
          </button>
        </form>
      )}
    </section>
  );
}
