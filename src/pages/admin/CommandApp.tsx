import { NavLink, Route, Routes } from "react-router-dom";
import { Icon } from "../../components/Icons";
import { IS_REMOTE } from "../../backend";
import { Dashboard } from "./Dashboard";
import { Archive } from "./Archive";
import { Library } from "./Library";
import { PostBreaches } from "./PostBreaches";
import { AdminSettings } from "./Settings";
import { PopupsBoard } from "./PopupsBoard";
import { Teams } from "./Squads";
import { Submissions } from "./Submissions";
import { AdminTransmissions } from "./Transmissions";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: Icon.Grid, end: true },
  { to: "/admin/post", label: "Post challenges", icon: Icon.Send },
  { to: "/admin/library", label: "Challenge library", icon: Icon.Library },
  { to: "/admin/archive", label: "Archive", icon: Icon.Archive },
  { to: "/admin/teams", label: "Teams & members", icon: Icon.Users },
  { to: "/admin/announcements", label: "Announcements", icon: Icon.Bell },
  { to: "/admin/popups", label: "Pop-ups", icon: Icon.Bolt },
  { to: "/admin/submissions", label: "Submissions", icon: Icon.List },
  { to: "/admin/settings", label: "Settings", icon: Icon.Gear },
  { to: "/all-challenge-view", label: "Test all challenges", icon: Icon.Check },
];

export default function CommandApp() {
  return (
    <div className="mx-auto grid w-full max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-0 md:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="border-b border-white/5 bg-[#0B0E13] md:min-h-[calc(100vh-64px)] md:border-b-0 md:border-r no-print">
        <div className="px-4 pb-2 pt-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-steel/50">Admin</div>
          {!IS_REMOTE && (
            <span className="chip mt-2 border-gold/40 text-gold" title="Demo mode: data is saved in this browser only. Other devices won't see changes.">
              <Icon.Info size={12} /> This browser only
            </span>
          )}
        </div>
        <nav className="scrollbar-thin flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible" aria-label="Admin">
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
          <Route path="archive" element={<Archive />} />
          <Route path="teams" element={<Teams />} />
          <Route path="announcements" element={<AdminTransmissions />} />
          <Route path="popups" element={<PopupsBoard />} />
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
