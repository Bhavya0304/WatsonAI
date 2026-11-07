import { AnimatePresence, motion } from "framer-motion";
import { Activity, BookOpen, Bot, FileText, LayoutDashboard, LogOut, Menu, MessagesSquare, Settings as SettingsIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    api("/api/admin/me")
      .then(() => setReady(true))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) navigate("/admin/login", { replace: true });
      });
  }, [navigate]);

  useEffect(() => setMenuOpen(false), [pathname]);

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

  const current =
    NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to))) ?? NAV[0];

  return (
    <div className="min-h-[100dvh] overflow-x-clip">
      <Background />
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <div className="flex shrink-0 items-center gap-2">
            <Orb size={28} />
            <span className="font-semibold text-white">Watson</span>
            <span className="hidden font-mono text-xs text-slate-500 sm:inline">admin</span>
          </div>

          {/* Desktop / tablet: inline nav */}
          <nav className="hidden flex-1 gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                    isActive ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                  }`
                }
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </NavLink>
            ))}
          </nav>
          <button type="button" onClick={logout} className="btn-ghost ml-auto hidden py-1.5 text-xs lg:inline-flex">
            <LogOut className="h-4 w-4" /> Log out
          </button>

          {/* Mobile: current page + menu button */}
          <div className="ml-auto flex min-w-0 items-center gap-2 lg:hidden">
            <span className="flex min-w-0 items-center gap-1.5 truncate text-sm text-slate-300">
              <current.icon className="h-4 w-4 shrink-0 text-cyan-300" />
              <span className="truncate">{current.label}</span>
            </span>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-white/5 lg:hidden"
            >
              <div className="grid grid-cols-2 gap-2 p-3">
                {NAV.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-xl border px-3 py-3 text-sm transition ${
                        isActive ? "border-violet-400/40 bg-violet-500/15 text-white" : "border-white/10 bg-white/[0.03] text-slate-300"
                      }`
                    }
                  >
                    <n.icon className="h-4 w-4 text-cyan-300" /> {n.label}
                  </NavLink>
                ))}
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-rose-300"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}
