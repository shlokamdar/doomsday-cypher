import { copyText, Modal } from "../../components/Bits";
import { Icon } from "../../components/Icons";
import type { Credential } from "../../core/types";
import { useUi } from "../../hooks/ui";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Shows generated credentials ONCE, with copy and print. */
export function CredentialsModal({ creds, onClose, title = "New credentials" }: { creds: Credential[] | null; onClose: () => void; title?: string }) {
  const { toast } = useUi();
  const text = (creds ?? []).map((c) => `${c.teamName}\t${c.displayName}\t${c.username}\t${c.password}`).join("\n");
  const print = () => {
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return toast("error", "Pop-up blocked. Allow pop-ups to print.");
    const rows = (creds ?? [])
      .map((c) => `<tr><td>${esc(c.teamName)}</td><td>${esc(c.displayName)}</td><td><code>${esc(c.username)}</code></td><td><code>${esc(c.password)}</code></td></tr>`)
      .join("");
    w.document.write(
      `<!doctype html><title>DOOMSDAY CYPHER credentials</title><body style="font-family:system-ui;padding:24px"><h1>DOOMSDAY CYPHER · login slips</h1><p>Temporary passwords: each member must set their own on first login.</p><table border="1" cellpadding="8" style="border-collapse:collapse;width:100%"><thead><tr><th>Team</th><th>Name</th><th>Username</th><th>Temporary password</th></tr></thead><tbody>${rows}</tbody></table></body>`,
    );
    w.document.close();
    w.focus();
    w.print();
  };
  return (
    <Modal open={!!creds} onClose={onClose} wide title={<h2 className="h-display text-3xl">{title}</h2>}>
      <p className="mb-3 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
        Shown once. Copy or print them now: passwords are stored only as hashes and can't be shown again (you can reset them).
      </p>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-steel/60">
            <tr>
              <th className="py-2 pr-3">Team</th>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Username</th>
              <th className="py-2">Temporary password</th>
            </tr>
          </thead>
          <tbody>
            {(creds ?? []).map((c) => (
              <tr key={c.userId} className="border-t border-white/5">
                <td className="py-2 pr-3">{c.teamName}</td>
                <td className="py-2 pr-3 text-white">{c.displayName}</td>
                <td className="py-2 pr-3 font-mono">{c.username}</td>
                <td className="py-2 font-mono text-reactor">{c.password}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          className="btn-ghost"
          onClick={async () => {
            await copyText("Team\tName\tUsername\tPassword\n" + text);
            toast("success", "Credentials copied.");
          }}
        >
          <Icon.Copy /> Copy all
        </button>
        <button className="btn-ghost" onClick={print}>
          <Icon.Print /> Print
        </button>
        <button className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
