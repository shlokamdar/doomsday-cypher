import { motion } from "framer-motion";
import { clockTime, timeAgo } from "../components/Bits";
import { Icon } from "../components/Icons";
import { Page } from "../components/Layout";
import { useBackend, useNow } from "../hooks/store";

export function TransmissionsPage() {
  const { view } = useBackend();
  const now = useNow(30000);
  return (
    <Page className="max-w-3xl">
      <div className="text-xs font-semibold uppercase tracking-[0.3em] text-reactor">From the organisers</div>
      <h1 className="h-display mb-6 text-5xl">Announcements</h1>
      {view.notifications.length === 0 && <p className="text-steel/70">Radio silence. Nothing from the organisers yet.</p>}
      <ol className="grid gap-3">
        {view.notifications.map((n, i) => (
          <motion.li
            key={n.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i, 10) * 0.03 }}
            className={`plate p-4 ${n.level === "important" ? "border-breach/60 bg-breach/10" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Icon.Bell className={n.level === "important" ? "text-breach" : "text-gold"} />
              <h2 className="font-display text-2xl tracking-wide text-white">{n.title}</h2>
              {n.level === "important" && <span className="chip border-breach/60 text-breach">Important</span>}
              <span className="ml-auto text-xs text-steel/60" title={new Date(n.at).toLocaleString()}>
                {clockTime(n.at)} · {timeAgo(n.at, now)}
              </span>
            </div>
            {n.body && <p className="mt-1 whitespace-pre-line text-steel">{n.body}</p>}
          </motion.li>
        ))}
      </ol>
    </Page>
  );
}
