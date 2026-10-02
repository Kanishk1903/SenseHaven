import { useQuery } from "@tanstack/react-query";
import { Bell, Download, LayoutDashboard, LineChart, LogOut, Menu, PanelLeft, Settings, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OrbMark } from "@/components/OrbMark";
import { ThemeToggle } from "@/components/ThemeToggle";
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
        className="rounded-control border border-border bg-surface px-2 py-1.5 text-secondary"
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

const NAV_GROUPS: { label: string; items: { to: string; label: string; Icon: typeof Bell; end: boolean }[] }[] = [
  {
    label: "Monitor",
    items: [
      { to: "/", label: "Overview", Icon: LayoutDashboard, end: true },
      { to: "__analytics__", label: "Analytics", Icon: LineChart, end: false },
      { to: "/alerts", label: "Alerts", Icon: Bell, end: false },
    ],
  },
  {
    label: "Manage",
    items: [
      { to: "__settings__", label: "Settings", Icon: Settings, end: false },
      { to: "/download", label: "Download", Icon: Download, end: false },
      { to: "/account", label: "Account", Icon: UserRound, end: false },
    ],
  },
];

function NavLinks({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { child } = useChild();
  return (
    <nav aria-label="Main" className="space-y-3">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          {!collapsed ? (
            <p className="mb-1 px-3 text-caption font-medium text-text-subtle">{group.label}</p>
          ) : (
            <div aria-hidden className="mx-3 mb-2 border-t border-border" />
          )}
          <div className="space-y-1">
            {group.items.map((item) => {
              const to = item.to === "__analytics__"
                ? `/children/${child?.id ?? "?"}/analytics`
                : item.to === "__settings__"
                  ? `/children/${child?.id ?? "?"}/settings`
                  : item.to;
              return (
                <NavLink
                  key={item.to}
                  to={to}
                  end={item.end}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  aria-current="page"
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-control px-3 py-2 text-secondary font-medium",
                      collapsed && "justify-center px-0",
                      isActive
                        ? "bg-primary-soft text-primary shadow-[inset_3px_0_0_var(--primary)]"
                        : "text-text-muted hover:bg-surface-2 hover:text-text",
                    )
                  }
                >
                  <item.Icon size={18} aria-hidden />
                  {!collapsed ? item.label : <span className="sr-only">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        </div>
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
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sh-sidebar-collapsed") === "1",
  );
  useEffect(() => {
    localStorage.setItem("sh-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <ChildSelectionProvider>
      <div className="min-h-screen bg-bg pb-16 md:pb-0">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
          className="rounded-control p-2 hover:bg-surface-2"
        >
          <Menu size={20} aria-hidden />
        </button>
        <span className="flex items-center gap-2 font-semibold">
          <OrbMark size={22} /> SenseHeaven
        </span>
        <Link
          to="/alerts"
          aria-label={unread > 0 ? `${unread} unread alerts` : "Alerts"}
          className="relative rounded-control p-2 hover:bg-surface-2"
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
          <div className="mt-3 border-t border-border pt-3">
            <ThemeToggle />
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-[1200px]">
        {/* tablet rail (md) + full sidebar (lg+), user-toggleable collapse */}
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col justify-between border-r border-border bg-surface p-4 md:flex",
            collapsed ? "w-[72px]" : "md:w-[72px] lg:w-[248px]",
          )}
        >
          <div>
            <div className="mb-4 flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2 px-2 py-1 font-semibold">
                <OrbMark size={24} />
                {!collapsed ? "SenseHeaven" : <span className="sr-only">SenseHeaven</span>}
              </Link>
              <button
                type="button"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={() => setCollapsed((value) => !value)}
                className="hidden rounded-control p-1.5 text-text-muted hover:bg-surface-2 hover:text-text md:block"
              >
                <PanelLeft size={16} aria-hidden />
              </button>
            </div>
            <div className={cn("mb-4 flex items-center px-1", collapsed ? "justify-center" : "justify-between")}>
              {!collapsed ? <ChildSwitcher /> : null}
              <Link
                to="/alerts"
                aria-label={unread > 0 ? `${unread} unread alerts` : "Alerts"}
                className="relative rounded-control p-2 text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <Bell size={18} aria-hidden />
                {unread > 0 ? (
                  <span className="tnum absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-stress px-1 text-[10px] font-semibold text-on-primary">
                    {unread}
                  </span>
                ) : null}
              </Link>
            </div>
            <NavLinks collapsed={collapsed} />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <span className="truncate px-1 text-caption text-text-subtle" title={me?.email}>
              {me?.display_name}
            </span>
            <ThemeToggle />
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

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-border bg-surface md:hidden"
      >
        {[
          { to: "/", label: "Overview", Icon: LayoutDashboard },
          { to: "__analytics__", label: "Analytics", Icon: LineChart },
          { to: "/alerts", label: "Alerts", Icon: Bell },
          { to: "__settings__", label: "Settings", Icon: Settings },
        ].map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-caption",
                isActive ? "text-primary" : "text-text-muted",
              )
            }
          >
            <tab.Icon size={20} aria-hidden />
            {tab.label}
          </NavLink>
        ))}
      </nav>

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

