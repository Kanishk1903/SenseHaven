import { useQuery } from "@tanstack/react-query";
import { Bell, Download, LayoutDashboard, LineChart, LogOut, Menu, Settings, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OrbMark } from "@/components/OrbMark";
import { api } from "@/lib/api";
import { useChildren, useLogout, useMe } from "@/lib/queries";
import { cn } from "@/lib/cn";
import { ChildSelectionProvider, useChild } from "./childSelection";

type AlertRow = { id: string; read_at: string | null };

function useUnreadAlerts() {
  const query = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api.get<AlertRow[]>("/alerts"),
    refetchInterval: 15_000,
  });
  const unread = query.data?.filter((alert) => alert.read_at === null).length ?? 0;
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) SenseHeaven` : "SenseHeaven";
  }, [unread]);
  return { unread };
}

function ChildSwitcher() {
  const { data: kids } = useChildren();
  const { child, select } = useChild();
  if (!child || (kids?.length ?? 0) <= 1) {
    return (
      <span className="flex items-center gap-2 rounded-pill bg-surface-2 px-2.5 py-1 text-secondary">
        <OrbMark size={18} />
        {child?.name ?? "Family"}
      </span>
    );
  }
  return (
    <label className="text-secondary">
      <span className="sr-only">Selected child</span>
      <select
        className="rounded-input border border-border bg-surface px-2 py-1.5 text-secondary"
        value={child.id}
        onChange={(event) => select(event.target.value)}
      >
        {(kids ?? []).map((kid) => (
          <option key={kid.id} value={kid.id}>
            {kid.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { child } = useChild();
  const items = [
    { to: "/", label: "Overview", Icon: LayoutDashboard, end: true },
    ...(child
      ? [
          { to: `/children/${child.id}/analytics`, label: "Analytics", Icon: LineChart, end: false },
          { to: `/children/${child.id}/settings`, label: "Settings", Icon: Settings, end: false },
        ]
      : []),
    { to: "/alerts", label: "Alerts", Icon: Bell, end: false },
    { to: "/download", label: "Download", Icon: Download, end: false },
    { to: "/account", label: "Account", Icon: UserRound, end: false },
  ];
  return (
    <nav aria-label="Main" className="space-y-1">
      {items.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-input px-3 py-2 text-secondary font-medium",
              isActive ? "bg-primary-soft text-primary" : "text-text-muted hover:bg-surface-2 hover:text-text",
            )
          }
        >
          <Icon size={18} aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function Shell() {
  const navigate = useNavigate();
  const logout = useLogout();
  const { data: me } = useMe();
  const { unread } = useUnreadAlerts();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <ChildSelectionProvider>
      <div className="min-h-screen bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-input focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
          className="rounded-input p-2 hover:bg-surface-2"
        >
          <Menu size={20} aria-hidden />
        </button>
        <span className="flex items-center gap-2 font-semibold">
          <OrbMark size={22} /> SenseHeaven
        </span>
        <Link
          to="/alerts"
          aria-label={unread > 0 ? `${unread} unread alerts` : "Alerts"}
          className="relative rounded-input p-2 hover:bg-surface-2"
        >
          <Bell size={20} aria-hidden />
          {unread > 0 ? (
            <span className="tnum absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-stress px-1 text-[10px] font-semibold text-on-primary">
              {unread}
            </span>
          ) : null}
        </Link>
      </header>
      {menuOpen ? (
        <div className="border-b border-border bg-surface p-4 lg:hidden" onClick={() => setMenuOpen(false)}>
          <NavLinks onNavigate={() => setMenuOpen(false)} />
        </div>
      ) : null}

      <div className="mx-auto flex max-w-[1200px]">
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col justify-between border-r border-border bg-surface p-4 lg:flex">
          <div>
            <Link to="/" className="mb-6 flex items-center gap-2 px-2 py-1 font-semibold">
              <OrbMark size={24} /> SenseHeaven
            </Link>
            <div className="mb-4 flex items-center justify-between px-1">
              <ChildSwitcher />
              <Link
                to="/alerts"
                aria-label={unread > 0 ? `${unread} unread alerts` : "Alerts"}
                className="relative rounded-input p-2 text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <Bell size={18} aria-hidden />
                {unread > 0 ? (
                  <span className="tnum absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-stress px-1 text-[10px] font-semibold text-on-primary">
                    {unread}
                  </span>
                ) : null}
              </Link>
            </div>
            <NavLinks />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <span className="truncate px-1 text-caption text-text-subtle" title={me?.email}>
              {me?.display_name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={async () => {
                await logout();
                toast("Signed out");
                navigate("/login");
              }}
            >
              <LogOut size={18} aria-hidden />
            </Button>
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      <footer className="px-4 pb-6 pt-2 text-center text-caption text-text-subtle lg:px-8">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck size={12} aria-hidden />
          Facial-expression estimates are approximate and are not a medical or psychological assessment.
        </span>
      </footer>
      </div>
    </ChildSelectionProvider>
  );
}

export function RequireAuth() {
  const me = useMe();
  if (me.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-secondary text-text-muted">
        Connecting…
      </div>
    );
  }
  if (me.isError) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

