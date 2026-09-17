import { useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Egg, HeartPulse, Home, Menu, Wheat, X } from "lucide-react";
import { NAV_SECTIONS, type NavLeaf } from "@/lib/nav-config";
import { usePermissions } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRIMARY: Array<NavLeaf & { shortLabel: string }> = [
  { label: "Home", shortLabel: "Home", icon: Home, to: "/dashboard", search: { area: "records" }, permission: "dashboard.view" },
  { label: "Production", shortLabel: "Production", icon: Egg, to: "/dashboard", search: { area: "records" }, hash: "production", permission: "production.read" },
  { label: "Feed", shortLabel: "Feed", icon: Wheat, to: "/feed", search: { tab: "overview" }, permission: "feed.read" },
  { label: "Health", shortLabel: "Health", icon: HeartPulse, to: "/dashboard", search: { area: "records" }, hash: "health", permission: "health.read" },
];

function isActive(item: NavLeaf, pathname: string, hash: string) {
  if (pathname !== item.to) return false;
  return item.hash ? hash === `#${item.hash}` || hash === item.hash : !hash;
}

export function MobileNavigation() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { can } = usePermissions();
  const location = useRouterState({ select: (state) => state.location });
  const primary = PRIMARY.filter((item) => !item.permission || can(item.permission));
  const sections = useMemo(() => {
    const allowed = (item: NavLeaf) => !item.permission || can(item.permission);
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(allowed).map((item) => ({ ...item, children: item.children?.filter(allowed) })),
    })).filter((section) => section.items.length > 0);
  }, [can]);

  return (
    <>
      <nav aria-label="Primary mobile navigation" className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 px-1 pt-1">
          {primary.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const active = isActive(item, location.pathname, location.hash);
            return (
              <Link
                key={item.shortLabel}
                to={item.to}
                search={item.search}
                hash={item.hash}
                className={cn("flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[10px] font-medium text-muted-foreground", active && "text-primary")}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">{item.shortLabel}</span>
              </Link>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMoreOpen(true)}
            aria-label="Open more modules"
            className="flex min-h-12 h-auto min-w-0 flex-col gap-0.5 rounded-md px-1 text-[10px] text-muted-foreground"
          >
            <Menu className="h-5 w-5" />
            <span>More</span>
          </Button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="More PoultryPro modules">
          <button className="absolute inset-0 bg-foreground/45" onClick={() => setMoreOpen(false)} aria-label="Close more modules" />
          <section className="mobile-safe-bottom absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-2xl bg-background shadow-2xl">
            <header className="mobile-safe-top sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border bg-background px-4 py-3">
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
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link key={item.label} to={item.to} search={item.search} hash={item.hash} onClick={() => setMoreOpen(false)} className="flex min-h-14 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground">
                          <Icon className="h-4 w-4 shrink-0 text-primary" />
                          <span className="min-w-0 leading-tight">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}