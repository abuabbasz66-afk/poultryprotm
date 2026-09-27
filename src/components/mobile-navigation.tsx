import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, LogOut, Menu, Sparkles, X } from "lucide-react";
import {
  isNavLeafActive,
  navDestinationKey,
  NAV_SECTIONS,
  type NavLeaf,
  type NavLocation,
} from "@/lib/nav-config";
import { usePermissions } from "@/lib/rbac";
import { flushCurrentLocation } from "@/lib/last-location";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function getMobilePrimary() {
  return NAV_SECTIONS.flatMap((section) => section.items).filter(
    (item): item is NavLeaf & { mobileLabel: string } => typeof item.mobileLabel === "string",
  );
}

export function MobileNavigation() {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const { can } = usePermissions();
  const location = useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      search: state.location.search as Record<string, unknown>,
      hash: state.location.hash,
    }),
  });

  const { primary, sections } = useMemo(() => {
    const allowed = (item: NavLeaf) => !item.permission || can(item.permission);
    const visiblePrimary = getMobilePrimary().filter(allowed);
    const primaryKeys = new Set(visiblePrimary.map(navDestinationKey));
    const seen = new Set(primaryKeys);
    const visibleSections = NAV_SECTIONS.map((section) => {
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
    return { primary: visiblePrimary, sections: visibleSections };
  }, [can]);

  const primaryActive = primary.some((item) => isNavLeafActive(item, location));
  const secondaryActive = sections.some((section) =>
    section.items.some((item) => isNavLeafActive(item, location)),
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname, JSON.stringify(location.search), location.hash]);

  useEffect(() => {
    if (!moreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [moreOpen]);

  const handleSignOut = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { logSecurityEvent } = await import("@/lib/security-events");
    await logSecurityEvent("logout");
    try { await flushCurrentLocation(); } catch { /* non-blocking */ }
    await supabase.auth.signOut();
    setMoreOpen(false);
    navigate({ to: "/auth", replace: true });
  };

  return (
    <>
      <nav aria-label="Primary mobile navigation" className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 px-1 pt-1">
          {primary.map((item) => {
            const Icon = item.icon;
            const active = isNavLeafActive(item, location);
            return (
              <Link
                key={item.mobileLabel}
                to={item.to}
                search={item.search as never}
                hash={item.hash}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[10px] font-medium text-muted-foreground", active && "text-primary")}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">{item.mobileLabel}</span>
              </Link>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMoreOpen(true)}
            aria-label="Open more modules"
            aria-expanded={moreOpen}
            className={cn(
              "flex min-h-12 h-auto min-w-0 flex-col gap-0.5 rounded-md px-1 text-[10px] text-muted-foreground",
              (moreOpen || secondaryActive || !primaryActive) && "text-primary",
            )}
          >
            <Menu className="h-5 w-5" />
            <span>More</span>
          </Button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="More PoultryPro modules">
          <Button variant="ghost" className="absolute inset-0 h-auto w-full rounded-none bg-foreground/45 hover:bg-foreground/45" onClick={() => setMoreOpen(false)} aria-label="Close more modules" />
          <section className="mobile-safe-bottom absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-y-auto rounded-t-2xl bg-background shadow-2xl">
            <header className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border bg-background px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">More</h2>
                <p className="text-xs text-muted-foreground">All modules available to your role</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMoreOpen(false)} aria-label="Close more modules"><X /></Button>
            </header>
            <div className="space-y-5 p-4 pb-6">
              {sections.map((section) => (
                <div key={section.heading}>
                  <h3 className="mb-2 font-sans text-xs font-semibold uppercase text-muted-foreground">{section.heading}</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {section.items.map((item) => (
                      <MoreLink key={navDestinationKey(item)} item={item} location={location} />
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <h3 className="mb-2 font-sans text-xs font-semibold uppercase text-muted-foreground">Account</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Link to="/" className="flex min-h-14 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground">
                    <Home className="h-4 w-4 shrink-0 text-primary" />
                    <span>Back to site</span>
                  </Link>
                  <Button type="button" variant="outline" onClick={handleSignOut} className="h-auto min-h-14 justify-start px-3 py-2 text-sm">
                    <LogOut className="h-4 w-4 shrink-0 text-primary" />
                    <span>Sign out</span>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function MoreLink({ item, location }: { item: NavLeaf; location: NavLocation }) {
  const active = isNavLeafActive(item, location);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      search={item.search as never}
      hash={item.hash}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-14 min-w-0 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground",
        active && "border-primary bg-primary/10 text-primary",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 leading-tight">{item.label}</span>
      {item.premium && (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5 text-[9px] uppercase text-secondary-foreground">
          <Sparkles className="h-2.5 w-2.5" /> Pro
        </span>
      )}
    </Link>
  );
}