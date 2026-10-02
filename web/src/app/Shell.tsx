import { Bell, Download, LayoutDashboard, LineChart, LogOut, Menu, PanelLeft, Settings, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OrbMark } from "@/components/OrbMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAlerts } from "@/features/apiHooks";
import { useChildren, useLogout, useMe } from "@/lib/queries";
import { cn } from "@/lib/cn";
import { ChildSelectionProvider, useChild } from "./childSelection";

function useUnreadAlerts() {
  const query = useAlerts();
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
        className="min-h-11 rounded-control border border-border bg-surface px-2 py-1.5 text-secondary"
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

function navGroups(unread: number): { label: string; items: { to: string; label: string; Icon: typeof Bell; end: boolean }[] }[] {
  return [
  {
    label: "Monitor",
    items: [
      { to: "/", label: "Overview", Icon: LayoutDashboard, end: true },
      { to: "__analytics__", label: "Analytics", Icon: LineChart, end: false },
      { to: "/alerts", label: unread > 0 ? `Alerts (${unread} unread)` : "Alerts", Icon: Bell, end: false },
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
}

function NavLinks({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { child } = useChild();
  const unread = useUnreadAlerts().unread;
  return (
    <nav aria-label="Main" className="space-y-3">
      {navGroups(unread).map((group) => (
        <div key={group.label}>
          {!collapsed ? (
            <p className="mb-1 hidden px-3 text-caption font-medium text-text-subtle lg:block">{group.label}</p>
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
                      "relative flex min-h-11 min-w-11 items-center gap-3 rounded-control px-3 py-2 text-secondary font-medium",
                      collapsed && "justify-center px-0",
                      isActive
                        ? "bg-primary-soft text-primary shadow-[inset_3px_0_0_var(--primary)]"
                        : "text-text-muted hover:bg-surface-2 hover:text-text",
                    )
                  }
                >
                  <item.Icon size={18} aria-hidden />
                  {!collapsed ? (
                    <>
                      <span className="hidden lg:inline">{item.label}</span>
                      <span className="sr-only lg:hidden">{item.label}</span>
                      {item.label.startsWith("Alerts") && unread > 0 ? (
                        <span className="tnum ml-auto rounded-pill bg-stress-fg px-1.5 text-[12px] leading-none font-semibold text-on-primary">
                          {unread}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className="sr-only">{item.label}</span>
                      {item.label.startsWith("Alerts") && unread > 0 ? (
                        <span aria-hidden className="absolute right-1 top-1 h-2 w-2 rounded-pill bg-stress" />
                      ) : null}
                    </>
                  )}
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
      <div className="min-h-screen bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-[clamp(8px,2.5vw,1rem)] lg:hidden">
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
          className="flex h-11 w-11 items-center justify-center rounded-control hover:bg-surface-2"
        >
          <Menu size={20} aria-hidden />
        </button>
        <span className="flex min-w-0 items-center gap-2 font-semibold">
          <OrbMark size={22} />
          <span className="truncate" title="SenseHeaven" data-allow-truncate>SenseHeaven</span>
        </span>
        <Link
          to="/alerts"
          aria-label={unread > 0 ? `${unread} unread alerts` : "Alerts"}
          className="relative flex h-11 w-11 items-center justify-center rounded-control hover:bg-surface-2"
        >
          <Bell size={20} aria-hidden />
          {unread > 0 ? (
            <span className="tnum absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-stress-fg px-1 text-[12px] leading-none font-semibold text-on-primary">
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
            <div className="mb-4 flex flex-col items-center gap-1 lg:flex-row lg:justify-between">
              <Link to="/" className="flex min-h-11 w-11 items-center justify-center gap-2 px-2 py-1 font-semibold lg:min-h-9 lg:w-auto">
                <OrbMark size={24} />
                <span className="sr-only lg:hidden">SenseHeaven</span>
                <span className={cn("hidden lg:inline", collapsed && "sr-only")}>SenseHeaven</span>
              </Link>
              <button
                type="button"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={() => setCollapsed((value) => !value)}
                className="hidden h-11 w-11 items-center justify-center rounded-control text-text-muted hover:bg-surface-2 hover:text-text md:flex lg:h-7 lg:w-7"
              >
                <PanelLeft size={16} aria-hidden />
              </button>
            </div>
            <div className="mb-4 px-1">
              <ChildSwitcher />
            </div>
            <NavLinks collapsed={collapsed} />
          </div>
          <div className="flex flex-col items-center gap-2 border-t border-border pt-3 lg:flex-row lg:justify-between">
            <span className="sr-only truncate px-1 text-caption text-text-subtle lg:not-sr-only" title={me?.email} data-allow-truncate>
              {me?.display_name}
            </span>
            <div className="hidden lg:block">
              <ThemeToggle />
            </div>
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

        <main id="main" className="min-w-0 flex-1 px-[clamp(8px,2.5vw,2rem)] py-4 lg:px-8 lg:py-8">
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

