import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/tickets", label: "Tickets" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-app-bg">
      <header className="border-b border-border-soft bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo/metropolitan-logo.png"
              alt="Metropolitan School logo"
              className="h-9 w-auto object-contain"
            />
            <div className="hidden sm:block">
              <div className="font-heading text-sm font-bold leading-tight text-ink">
                Metropolitan Ticketing System
              </div>
              <div className="text-xs text-ink-muted">IT Support</div>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary-soft text-primary"
                      : "text-ink-muted hover:bg-surface hover:text-ink"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-ink">{user?.name}</div>
              <div className="text-xs text-ink-muted">{user?.roleLabel ?? ""}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
              <LogOut />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-border-soft bg-white py-4">
        <p className="text-center text-xs text-ink-muted">
          Metropolitan School &middot; Metropolitan Ticketing System
        </p>
      </footer>
    </div>
  );
}
