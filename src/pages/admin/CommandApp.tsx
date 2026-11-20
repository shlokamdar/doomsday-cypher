import { NavLink, Route, Routes } from "react-router-dom";
import { Icon } from "../../components/Icons";
import { IS_REMOTE } from "../../backend";
import { Dashboard } from "./Dashboard";
import { Library } from "./Library";
import { PostBreaches } from "./PostBreaches";
import { AdminSettings } from "./Settings";
import { Squads } from "./Squads";
import { Submissions } from "./Submissions";
import { AdminTransmissions } from "./Transmissions";

const NAV = [
  { to: "/command", label: "Dashboard", icon: Icon.Grid, end: true },
  { to: "/command/post", label: "Post breaches", icon: Icon.Send },
  { to: "/command/library", label: "Breach library", icon: Icon.Library },
  { to: "/command/squads", label: "Squads & members", icon: Icon.Users },
  { to: "/command/transmissions", label: "Transmissions", icon: Icon.Bell },
  { to: "/command/submissions", label: "Submissions", icon: Icon.List },
  { to: "/command/settings", label: "Settings", icon: Icon.Gear },
];

export default function CommandApp() {
  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-0 md:grid-cols-[230px_1fr]">
      <aside className="border-b border-white/5 bg-[#0B0E13] md:min-h-[calc(100vh-64px)] md:border-b-0 md:border-r no-print">
        <div className="px-4 pb-2 pt-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-steel/50">Command</div>
          {!IS_REMOTE && (
            <span className="chip mt-2 border-gold/40 text-gold" title="Demo mode: data is saved in this browser only. Other devices won't see changes.">
              <Icon.Info size={12} /> This browser only
            </span>
          )}
        </div>
        <nav className="scrollbar-thin flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible" aria-label="Command">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition ${isActive ? "bg-reactor/15 text-reactor" : "text-steel/80 hover:bg-white/5 hover:text-white"}`
              }
            >
              <n.icon size={17} />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-6">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="post" element={<PostBreaches />} />
          <Route path="library" element={<Library />} />
          <Route path="squads" element={<Squads />} />
          <Route path="transmissions" element={<AdminTransmissions />} />
          <Route path="submissions" element={<Submissions />} />
          <Route path="settings" element={<AdminSettings />} />
        </Routes>
      </main>
    </div>
  );
}

export function AdminTitle({ children, sub, right }: { children: React.ReactNode; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="h-display text-4xl">{children}</h1>
        {sub && <p className="text-sm text-steel/70">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
