import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown, ChevronsLeft, ChevronsRight, LogOut, Menu, X, Home, Sparkles,
} from "lucide-react";
import { NAV_SECTIONS, type NavEntry, type NavLeaf } from "@/lib/nav-config";
import { useFarm } from "@/lib/farm-data";
import { usePermissions, roleStyle } from "@/lib/rbac";
import { SyncStatus } from "@/components/sync-status";
import logoAsset from "@/assets/poultrypro-logo.png.asset.json";
import { cn } from "@/lib/utils";


const COLLAPSE_KEY = "pp.sidebar.collapsed";

function useCurrent() {
  return useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      search: s.location.search as Record<string, unknown>,
      hash: s.location.hash,
    }),
  });
}

function isLeafActive(leaf: NavLeaf, cur: ReturnType<typeof useCurrent>) {
  if (cur.pathname !== leaf.to) return false;
  if (leaf.search) {
    for (const [k, v] of Object.entries(leaf.search)) {
      const actual = cur.search?.[k];
      // Treat a missing param as the first (default) option for that key.
      if (actual == null) {
        if (!isDefaultValue(k, v)) return false;
      } else if (String(actual) !== v) return false;
    }
  }
  if (leaf.hash) return cur.hash === leaf.hash;
  return !cur.hash;
}

function isDefaultValue(key: string, value: string) {
  if (key === "area") return value === "records";
  if (key === "tab") return value === "overview";
  return false;
}

/** Smoothly scrolls to the hash target whenever the location hash changes. */
function useHashScroll() {
  const { hash, pathname, search } = useCurrent();
  useEffect(() => {
    if (!hash) return;
    const id = hash.replace(/^#/, "");
    let tries = 0;
    const tick = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (tries++ < 20) window.setTimeout(tick, 60);
    };
    tick();
  }, [hash, pathname, JSON.stringify(search)]);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const cur = useCurrent();
  useHashScroll();

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);

  useEffect(() => { setMobileOpen(false); }, [cur.pathname, JSON.stringify(cur.search), cur.hash]);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col border-r border-white/10",
          "bg-gradient-to-b from-[color:var(--forest)] to-[color:var(--ink)] text-primary-foreground",
          "transition-[width] duration-300 ease-out",
          collapsed ? "w-[76px]" : "w-[264px]",
        )}
      >
        <SidebarBody collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} cur={cur} />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-white/10 bg-[color:var(--forest)] px-4 py-2.5 text-primary-foreground">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 transition hover:bg-white/10"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            <img src={logoAsset.url} alt="" width={26} height={26} className="h-6.5 w-6.5 shrink-0 object-contain" />
            <span className="truncate font-display text-[15px] font-semibold">PoultryPro™</span>
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AlertsBell />
          <SyncStatus />
        </div>

      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col bg-gradient-to-b from-[color:var(--forest)] to-[color:var(--ink)] text-primary-foreground shadow-[var(--shadow-lift)] animate-in slide-in-from-left duration-300">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 transition hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarBody collapsed={false} cur={cur} />
          </div>
        </div>
      )}

      <div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[264px]")}>
        {children}
      </div>
    </div>
  );
}

function SidebarBody({
  collapsed, onToggle, cur,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  cur: ReturnType<typeof useCurrent>;
}) {
  const navigate = useNavigate();
  const farm = useFarm();
  const { can, role, roleLabel } = usePermissions();
  const rs = roleStyle(role);

  // Permission-driven navigation: an entry appears only when the signed-in
  // user's role grants it (or when the entry declares no permission at all).
  const sections = useMemo(() => {
    const allowed = (entry: NavLeaf) => !entry.permission || can(entry.permission);
    return NAV_SECTIONS.map((section) => ({
      heading: section.heading,
      items: section.items
        .filter(allowed)
        .map((item) => ({ ...item, children: item.children?.filter(allowed) })),
    })).filter((section) => section.items.length > 0);
  }, [can]);

  const handleSignOut = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { logSecurityEvent } = await import("@/lib/security-events");
    await logSecurityEvent("logout");
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <>
      <div className={cn("flex items-center gap-2 px-4 py-4", collapsed && "justify-center px-0")}>
        <img src={logoAsset.url} alt="" width={30} height={30} className="h-7.5 w-7.5 shrink-0 object-contain" />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[16px] font-semibold leading-tight">PoultryPro™</div>
            <div className="truncate text-[11px] text-primary-foreground/60">{farm.data?.name ?? "Your farm"}</div>
          </div>
        )}
        <SyncStatus compact={collapsed} />
      </div>

      {!collapsed && (
        <div className="px-4 pb-3">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]", rs.badge)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", rs.dot)} />
            {roleLabel}
          </span>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {sections.map((section) => (
          <div key={section.heading} className="mb-3">
            {!collapsed && (
              <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/45">
                {section.heading}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem key={item.label} item={item} collapsed={collapsed} cur={cur} />
              ))}
            </div>
          </div>
        ))}


        <div className="mt-2 space-y-0.5 border-t border-white/10 pt-3">
          <Link
            to="/"
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-primary-foreground/75 transition-all hover:bg-white/10 hover:text-primary-foreground",
              collapsed && "justify-center px-0",
            )}
            title="Back to site"
          >
            <Home className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Back to site</span>}
          </Link>
          <button
            onClick={handleSignOut}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-primary-foreground/75 transition-all hover:bg-white/10 hover:text-primary-foreground",
              collapsed && "justify-center px-0",
            )}
            title="Sign out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </nav>

      {onToggle && (
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center justify-center gap-2 border-t border-white/10 px-3 py-3 text-[12px] text-primary-foreground/65 transition hover:bg-white/10 hover:text-primary-foreground"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
        </button>
      )}
    </>
  );
}

function NavItem({
  item, collapsed, cur,
}: {
  item: NavEntry;
  collapsed: boolean;
  cur: ReturnType<typeof useCurrent>;
}) {
  const childActive = useMemo(
    () => (item.children ?? []).some((c) => isLeafActive(c, cur)),
    [item, cur],
  );
  const selfActive = isLeafActive(item, cur) || childActive;
  const [open, setOpen] = useState(childActive);

  useEffect(() => { if (childActive) setOpen(true); }, [childActive]);

  const Icon = item.icon;

  return (
    <div>
      <div className="flex items-center">
        <Link
          to={item.to}
          search={item.search as never}
          hash={item.hash}
          title={item.label}
          className={cn(
            "group flex flex-1 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-200",
            collapsed && "justify-center px-0",
            selfActive
              ? "bg-white/15 text-primary-foreground shadow-[inset_2px_0_0_var(--gold)]"
              : "text-primary-foreground/75 hover:translate-x-0.5 hover:bg-white/10 hover:text-primary-foreground",
          )}
        >
          <Icon className={cn("h-4 w-4 shrink-0 transition-colors", selfActive && "text-[color:var(--gold)]")} />
          {!collapsed && <span className="truncate">{item.label}</span>}
          {!collapsed && item.premium && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[color:var(--gold)]/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[color:var(--gold)]">
              <Sparkles className="h-2.5 w-2.5" /> Pro
            </span>
          )}
        </Link>
        {!collapsed && item.children && (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
            className="mr-1 inline-flex h-7 w-7 items-center justify-center rounded-lg text-primary-foreground/60 transition hover:bg-white/10 hover:text-primary-foreground"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
          </button>
        )}
      </div>

      {!collapsed && item.children && open && (
        <div className="ml-6 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
          {item.children.map((child) => {
            const active = isLeafActive(child, cur);
            const CIcon = child.icon;
            return (
              <Link
                key={child.label}
                to={child.to}
                search={child.search as never}
                hash={child.hash}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-all duration-200",
                  active
                    ? "bg-white/12 text-[color:var(--gold)]"
                    : "text-primary-foreground/65 hover:translate-x-0.5 hover:bg-white/8 hover:text-primary-foreground",
                )}
              >
                <CIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
