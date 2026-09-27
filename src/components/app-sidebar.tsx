import { useEffect, useMemo } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Building2, ChevronDown, Home, LogOut, Settings, Sparkles, UserCircle } from "lucide-react";
import {
  isNavLeafActive,
  navDestinationKey,
  NAV_SECTIONS,
  type NavLeaf,
  type NavLocation,
} from "@/lib/nav-config";
import { useFarm } from "@/lib/farm-data";
import { usePermissions } from "@/lib/rbac";
import { flushCurrentLocation } from "@/lib/last-location";
import { SyncStatus } from "@/components/sync-status";
import { AlertsBell } from "@/components/alerts-bell";
import { MobileNavigation } from "@/components/mobile-navigation";
import { AlertNotifier } from "@/components/pwa/alert-notifier";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/poultrypro-logo.png.asset.json";
import { cn } from "@/lib/utils";

function useCurrent(): NavLocation {
  return useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      search: state.location.search as Record<string, unknown>,
      hash: state.location.hash,
    }),
  });
}

function useHashScroll() {
  const { hash, pathname, search } = useCurrent();
  useEffect(() => {
    if (!hash) return;
    const id = hash.replace(/^#/, "");
    let tries = 0;
    const tick = () => {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (tries++ < 20) window.setTimeout(tick, 60);
    };
    tick();
  }, [hash, pathname, JSON.stringify(search)]);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  useHashScroll();
  return (
    <div className="min-h-screen bg-background">
      <AlertNotifier />
      <DesktopNavigation />
      <MobileHeader />
      <div className="mobile-app-content">{children}</div>
      <MobileNavigation />
    </div>
  );
}

function MobileHeader() {
  return (
    <div className="mobile-safe-top sticky top-0 z-40 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-primary-foreground/10 bg-[color:var(--forest)] px-4 py-2.5 text-primary-foreground md:hidden">
      <Link to="/dashboard" search={{ area: "records" }} className="flex min-w-0 items-center gap-2">
        <img src={logoAsset.url} alt="" width={26} height={26} className="h-6.5 w-6.5 shrink-0 object-contain" />
        <span className="truncate font-display text-[15px] font-semibold">PoultryPro™</span>
      </Link>
      <div className="flex shrink-0 items-center gap-2"><AlertsBell /><SyncStatus /></div>
    </div>
  );
}

function DesktopNavigation() {
  const current = useCurrent();
  const navigate = useNavigate();
  const farm = useFarm();
  const { can, ctx, roleLabel } = usePermissions();

  const { primary, secondary } = useMemo(() => {
    const allowed = (item: NavLeaf) => !item.permission || can(item.permission);
    const visiblePrimary = NAV_SECTIONS.flatMap((section) => section.items).filter(
      (item): item is NavLeaf & { desktopLabel: string } => typeof item.desktopLabel === "string" && allowed(item),
    );
    const seen = new Set(visiblePrimary.map(navDestinationKey));
    const visibleSecondary = NAV_SECTIONS.map((section) => {
      const items: NavLeaf[] = [];
      for (const parent of section.items) {
        if (!allowed(parent)) continue;
        for (const candidate of [parent, ...(parent.children ?? [])]) {
          const key = navDestinationKey(candidate);
          if (!allowed(candidate) || seen.has(key)) continue;
          seen.add(key);
          items.push(candidate);
        }
      }
      return { heading: section.heading, items };
    }).filter((section) => section.items.length > 0);
    return { primary: visiblePrimary, secondary: visibleSecondary };
  }, [can]);

  const moreActive = secondary.some((section) => section.items.some((item) => isNavLeafActive(item, current)));
  const handleSignOut = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { logSecurityEvent } = await import("@/lib/security-events");
    await logSecurityEvent("logout");
    try { await flushCurrentLocation(); } catch { /* non-blocking */ }
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-background/95 shadow-sm backdrop-blur md:block">
      <div className="mx-auto grid min-h-14 max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 xl:px-6">
        <Link to="/dashboard" search={{ area: "records" }} className="flex min-w-0 items-center gap-2.5">
          <img src={logoAsset.url} alt="" width={34} height={34} className="h-8 w-8 shrink-0 object-contain" />
          <div className="min-w-0">
            <div className="truncate font-display text-base font-semibold text-foreground">PoultryPro™</div>
            <div className="truncate text-[10px] font-medium uppercase text-muted-foreground">{farm.data?.name ?? "Your farm"}</div>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <AlertsBell tone="dark" />
          <SyncStatus surface />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="max-w-48 gap-2 px-3"><Building2 className="text-primary" /><span className="truncate">{farm.data?.name ?? "Farm"}</span><ChevronDown className="text-muted-foreground" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Active farm</DropdownMenuLabel>
              <DropdownMenuItem asChild><Link to="/settings" hash="profile" className="flex min-w-0 flex-col items-start"><span className="max-w-full truncate font-medium">{farm.data?.name ?? "Your farm"}</span><span className="text-xs text-muted-foreground">View farm profile</span></Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="max-w-44 gap-2 px-2.5"><UserCircle className="text-primary" /><span className="hidden min-w-0 text-left xl:block"><span className="block truncate text-xs font-semibold">{ctx.fullName || "Profile"}</span><span className="block truncate text-[10px] text-muted-foreground">{roleLabel}</span></span><ChevronDown className="text-muted-foreground" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel><span className="block truncate">{ctx.fullName || "Your account"}</span><span className="block truncate text-xs font-normal text-muted-foreground">{ctx.email ?? roleLabel}</span></DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/settings" hash="profile"><UserCircle />Profile</Link></DropdownMenuItem>
              {can("settings.write") && <DropdownMenuItem asChild><Link to="/settings"><Settings />Settings</Link></DropdownMenuItem>}
              <DropdownMenuItem asChild><Link to="/"><Home />Back to site</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void handleSignOut()} className="text-destructive focus:text-destructive"><LogOut />Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <nav aria-label="Primary desktop navigation" className="border-t border-border/70">
        <div className="mx-auto flex h-11 max-w-[1600px] min-w-0 items-center gap-1 px-4 xl:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {primary.map((item) => <DesktopPrimaryLink key={navDestinationKey(item)} item={item} current={current} />)}
          </div>
          <MoreMenu sections={secondary} current={current} active={moreActive} />
        </div>
      </nav>
    </header>
  );
}

function DesktopPrimaryLink({ item, current }: { item: NavLeaf & { desktopLabel: string }; current: NavLocation }) {
  const active = isNavLeafActive(item, current);
  const Icon = item.icon;
  return <Link to={item.to} search={item.search as never} hash={item.hash} aria-current={active ? "page" : undefined} className={cn("flex h-9 min-w-0 shrink items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground xl:px-3 xl:text-sm", active && "bg-primary/10 text-primary")}><Icon className="h-4 w-4 shrink-0" /><span className="truncate">{item.desktopLabel}</span>{item.premium && <Sparkles className="hidden h-3 w-3 shrink-0 text-[color:var(--gold)] xl:block" />}</Link>;
}

function MoreMenu({ sections, current, active }: { sections: Array<{ heading: string; items: NavLeaf[] }>; current: NavLocation; active: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" className={cn("h-9 shrink-0 gap-1 px-3", active && "bg-primary/10 text-primary")}>More <ChevronDown /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[min(70vh,560px)] w-[min(560px,calc(100vw-2rem))] p-2">
        <div className="grid grid-cols-2 gap-x-2">
          {sections.map((section) => <div key={section.heading} className="min-w-0 py-1"><DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">{section.heading}</DropdownMenuLabel>{section.items.map((item) => { const Icon = item.icon; const itemActive = isNavLeafActive(item, current); return <DropdownMenuItem key={navDestinationKey(item)} asChild><Link to={item.to} search={item.search as never} hash={item.hash} className={cn("min-w-0", itemActive && "bg-accent text-primary")}><Icon /><span className="min-w-0 flex-1 truncate">{item.label}</span>{item.premium && <span className="text-[9px] font-semibold uppercase text-[color:var(--gold)]">Pro</span>}</Link></DropdownMenuItem>; })}</div>)}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}