import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Page } from "../components/Layout";
import { useBackend } from "../hooks/store";
import { useRun } from "../hooks/ui";

export function ChangePasswordPage({ forced = false }: { forced?: boolean }) {
  const { actions, view } = useBackend();
  const [oldPw, setOld] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const { run, busy } = useRun();
  const navigate = useNavigate();
  const mismatch = pw2.length > 0 && pw !== pw2;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) return;
    const ok = await run(() => actions.changePassword(oldPw, pw), "Password changed.");
    if (ok !== undefined) navigate(view.me?.role === "admin" ? "/admin" : "/challenges");
  };

  return (
    <Page className="max-w-lg">
      <form onSubmit={submit} className="plate p-6">
        <h1 className="h-display text-4xl">{forced ? "Set your own password" : "Change password"}</h1>
        {forced && <p className="mt-1 text-steel/80">You signed in with a temporary password. Choose a new one (8+ characters) to continue.</p>}
        <div className="mt-5 grid gap-4">
          <div>
            <label className="label" htmlFor="cur">
              {forced ? "Temporary password" : "Current password"}
            </label>
            <input id="cur" type="password" className="input" autoComplete="current-password" value={oldPw} onChange={(e) => setOld(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="new">
              New password
            </label>
            <input id="new" type="password" className="input" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="new2">
              Repeat new password
            </label>
            <input id="new2" type="password" className="input" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} aria-invalid={mismatch} />
            {mismatch && <p className="mt-1 text-sm text-breach">Passwords don't match.</p>}
          </div>
        </div>
        <button className="btn-primary mt-6 w-full" disabled={busy || !oldPw || pw.length < 8 || pw !== pw2}>
          Save password
        </button>
      </form>
    </Page>
  );
}
