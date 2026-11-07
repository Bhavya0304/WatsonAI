import { Activity, BookOpen, Bot, FileText, LayoutDashboard, LogOut, MessagesSquare, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import Background from "../../components/Background";
import Orb from "../../components/Orb";
import { api, ApiError } from "../../lib/api";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/sessions", label: "Sessions", icon: MessagesSquare },
  { to: "/admin/requests", label: "Requests", icon: Activity },
  { to: "/admin/models", label: "Model calls", icon: Bot },
  { to: "/admin/logs", label: "Log files", icon: FileText },
  { to: "/admin/content", label: "Content", icon: BookOpen },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api("/api/admin/me")
      .then(() => setReady(true))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) navigate("/admin/login", { replace: true });
      });
  }, [navigate]);

  const logout = async () => {
    await api("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    navigate("/admin/login", { replace: true });
  };

  if (!ready) {
    return (
      <div className="grid h-[100dvh] place-items-center">
        <Background />
        <Orb size={56} thinking />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <Background />
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <Orb size={28} />
            <span className="font-semibold text-white">Watson</span>
            <span className="font-mono text-xs text-slate-500">admin</span>
          </div>
          <nav className="no-scrollbar flex flex-1 gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                    isActive ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                  }`
                }
              >
                <n.icon className="h-4 w-4" /> <span className="hidden sm:inline">{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <button type="button" onClick={logout} className="btn-ghost py-1.5 text-xs" aria-label="Log out">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
