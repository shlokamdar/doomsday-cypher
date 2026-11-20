import { useState, type FormEvent } from "react";
import { clockTime } from "../../components/Bits";
import { Icon } from "../../components/Icons";
import type { NotificationLevel } from "../../core/types";
import { useBackend } from "../../hooks/store";
import { useRun, useUi } from "../../hooks/ui";
import { AdminTitle } from "./CommandApp";

export function AdminTransmissions() {
  const { view, actions } = useBackend();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<NotificationLevel>("info");
  const { run, busy } = useRun();
  const { confirm } = useUi();

  const post = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => actions.postNotification(title, body, level), "Transmission sent.")) {
      setTitle("");
      setBody("");
      setLevel("info");
    }
  };

  return (
    <div>
      <AdminTitle sub="Players get a toast and an unread badge.">Transmissions</AdminTitle>
      <form onSubmit={post} className="plate mb-6 grid gap-3 p-5">
        <div>
          <label className="label" htmlFor="tx-title">
            Title
          </label>
          <input id="tx-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>
        <div>
          <label className="label" htmlFor="tx-body">
            Message
          </label>
          <textarea id="tx-body" className="input min-h-[80px]" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <fieldset className="flex gap-2">
            <legend className="sr-only">Level</legend>
            {(["info", "important"] as const).map((l) => (
              <button type="button" key={l} aria-pressed={level === l} onClick={() => setLevel(l)} className={`rounded-md border px-3 py-1.5 text-sm font-semibold capitalize ${level === l ? (l === "important" ? "border-breach bg-breach/15 text-breach" : "border-gold bg-gold/15 text-gold") : "border-white/10 text-steel"}`}>
                {l}
              </button>
            ))}
          </fieldset>
          <button className="btn-primary" disabled={busy || !title.trim()}>
            <Icon.Send size={16} /> Send transmission
          </button>
        </div>
      </form>
      <ul className="grid gap-2">
        {view.notifications.map((n) => (
          <li key={n.id} className={`plate flex items-start gap-3 p-3 ${n.level === "important" ? "border-breach/50" : ""}`}>
            <Icon.Bell className={n.level === "important" ? "mt-0.5 text-breach" : "mt-0.5 text-gold"} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-white">{n.title}</div>
              {n.body && <div className="text-sm text-steel/80">{n.body}</div>}
              <div className="text-xs text-steel/50">{clockTime(n.at)}</div>
            </div>
            <button
              className="btn-ghost btn-sm"
              aria-label={`Delete ${n.title}`}
              onClick={async () => {
                if (await confirm({ title: "Delete transmission?", body: n.title, danger: true, confirmLabel: "Delete" })) await run(() => actions.deleteNotification(n.id), "Transmission deleted.");
              }}
            >
              <Icon.Trash />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
