import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  useEggs, useFarmId, useFeed, useHealth, useMortality, usePriceHistory, useRooms,
  type EggRow, type Feed,
} from "@/lib/farm-data";
import { useEffectivePlan } from "@/lib/subscription";
import { usePermissions } from "@/lib/rbac";
import { useSecurityEvents } from "@/routes/_authenticated/activity";
import { detectProductionDecline } from "@/lib/production-decline";
import { detectMortalityPatterns } from "@/lib/mortality-pattern";
import { describeEvent } from "@/lib/security-events";
import { toDateKey } from "@/lib/date-key";

/**
 * Smart Alerts engine.
 *
 * Alerts are DERIVED, never stored: every alert is recomputed from the farm's
 * own records (prices, production, mortality, feed, security events) so the
 * feed is always consistent with the data and works offline. Only the
 * read/dismissed state is persisted locally, keyed by a stable alert id.
 */

export type AlertCategory = "price" | "health" | "operations" | "activity";
export type AlertSeverity = "critical" | "warning" | "info";

export type FarmAlert = {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  /** ISO timestamp used for ordering and display. */
  at: string;
  /** Optional in-app destination. */
  to?: string;
  search?: Record<string, string>;
  hash?: string;
  /** Premium-only insight (AI based). */
  premium?: boolean;
};

export const CATEGORY_LABELS: Record<AlertCategory, string> = {
  price: "Price",
  health: "Health",
  operations: "Operations",
  activity: "Activity",
};

export const SEVERITY_STYLES: Record<AlertSeverity, { badge: string; dot: string; ring: string }> = {
  critical: { badge: "bg-destructive/12 text-destructive border-destructive/30", dot: "bg-destructive", ring: "border-destructive/40" },
  warning: { badge: "bg-amber-500/12 text-amber-700 border-amber-500/30", dot: "bg-amber-500", ring: "border-amber-400/40" },
  info: { badge: "bg-sky-500/12 text-sky-700 border-sky-500/30", dot: "bg-sky-500", ring: "border-sky-400/40" },
};

// ---------------------------------------------------------------------------
// Read-state store (localStorage + cross-component subscription)
// ---------------------------------------------------------------------------

const READ_KEY = (farmId: string | null | undefined) => `pp.alerts.read.${farmId ?? "none"}`;
const MAX_REMEMBERED = 800;
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

function readIds(farmId: string | null | undefined): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(READ_KEY(farmId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function writeIds(farmId: string | null | undefined, ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(READ_KEY(farmId), JSON.stringify(ids.slice(-MAX_REMEMBERED)));
  } catch { /* ignore */ }
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useAlertReadState() {
  const { data: farmId } = useFarmId();
  useSyncExternalStore(subscribe, () => version, () => 0);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  const ids = useMemo(
    () => new Set(hydrated ? readIds(farmId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [farmId, hydrated, version],
  );

  const markRead = useCallback((alertIds: string[]) => {
    if (alertIds.length === 0) return;
    const next = new Set(readIds(farmId));
    alertIds.forEach((id) => next.add(id));
    writeIds(farmId, Array.from(next));
  }, [farmId]);

  const markAllRead = useCallback((alerts: FarmAlert[]) => {
    markRead(alerts.map((a) => a.id));
  }, [markRead]);

  const isRead = useCallback((id: string) => ids.has(id), [ids]);

  return { isRead, markRead, markAllRead, hydrated };
}

// ---------------------------------------------------------------------------
// Derivation helpers
// ---------------------------------------------------------------------------

const naira = (n: number) =>
  `₦${Math.round(n).toLocaleString("en-NG")}`;

function todayKey(): string {
  return toDateKey(new Date())!;
}

function dayOffsetKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return toDateKey(d)!;
}

function eggTotal(e: EggRow): number {
  return (e.r2 + e.r3 + e.r4) * 30 + e.extra;
}

function feedOnDay(feed: Feed[], key: string): number {
  return feed
    .filter((f) => toDateKey(f.date) === key)
    .reduce((s, f) => s + Number(f.bags || 0), 0);
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useFarmAlerts(): { alerts: FarmAlert[]; loading: boolean } {
  const { can, loading: permsLoading } = usePermissions();
  const plan = useEffectivePlan();
  const isPremium = plan === "premium";

  const eggsQ = useEggs();
  const roomsQ = useRooms();
  const mortQ = useMortality();
  const feedQ = useFeed();
  const healthQ = useHealth();
  const priceQ = usePriceHistory();
  const canAudit = !permsLoading && can("audit.read");
  const eventsQ = useSecurityEvents(canAudit, 60);

  const alerts = useMemo<FarmAlert[]>(() => {
    const out: FarmAlert[] = [];
    const eggs = eggsQ.data ?? [];
    const rooms = roomsQ.data ?? [];
    const mortality = mortQ.data ?? [];
    const feed = feedQ.data ?? [];
    const health = healthQ.data ?? [];

    // ---- 1. Price change alerts -------------------------------------------
    if (can("prices.read")) {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      for (const row of (priceQ.data ?? []).slice(0, 40)) {
        const at = row.effective_from ?? row.created_at;
        if (new Date(at).getTime() < cutoff) continue;
        if (row.old_price == null || row.old_price === row.new_price) continue;
        const up = row.new_price > row.old_price;
        const pct = row.old_price > 0
          ? ((row.new_price - row.old_price) / row.old_price) * 100
          : 0;
        out.push({
          id: `price:${row.id}`,
          category: "price",
          severity: Math.abs(pct) >= 15 ? "warning" : "info",
          title: `${row.item} price ${up ? "increased" : "decreased"}`,
          message: `${row.item} ${up ? "increased" : "decreased"} from ${naira(row.old_price)} to ${naira(row.new_price)} (${up ? "+" : ""}${pct.toFixed(1)}%) per ${row.unit}.`,
          at,
          to: "/price-history",
        });
      }
    }

    // ---- 2. Disease / production risk (AI, premium) -----------------------
    if (can("ai.view") && isPremium && eggs.length > 0) {
      const decline = detectProductionDecline({ eggs, rooms, mortality, feed, health });
      for (const e of decline.events) {
        if (e.risk === "Low") continue;
        const key = toDateKey(e.latestDate) ?? e.latestDate;
        out.push({
          id: `decline:${e.scopeLabel}:${key}`,
          category: "health",
          severity: e.risk === "High" ? "critical" : "warning",
          title: `⚠️ Possible risk in ${e.scopeLabel}`,
          message: `${e.title} — production is ${Math.max(0, Math.round(e.changePct))}% below the usual ${e.baselinePct.toFixed(1)}%. Check feed, water, heat and recent losses.`,
          at: new Date(`${key}T12:00:00`).toISOString(),
          to: "/dashboard",
          search: { area: "ai" },
          hash: "ai-production",
          premium: true,
        });
      }

      const mort = detectMortalityPatterns({ eggs, rooms, mortality, feed, health });
      for (const m of mort.events) {
        if (m.severity === "Monitoring" || m.severity === "Watch") continue;
        const key = toDateKey(m.latestDate) ?? m.latestDate;
        out.push({
          id: `mortality:${m.scopeLabel}:${key}`,
          category: "health",
          severity: m.severity === "Critical" ? "critical" : "warning",
          title: `Bird losses rising in ${m.scopeLabel}`,
          message: `${m.recentLoss} bird${m.recentLoss === 1 ? "" : "s"} lost in the last ${m.recentDays} days${m.mortalityRatePct != null ? ` (${m.mortalityRatePct.toFixed(2)}% of the flock)` : ""}. Expected about ${Math.round(m.expectedLoss)}.`,
          at: new Date(`${key}T12:00:00`).toISOString(),
          to: "/dashboard",
          search: { area: "ai" },
          hash: "ai-mortality",
          premium: true,
        });
      }
    }

    // ---- 3. Operational alerts --------------------------------------------
    if (can("production.read")) {
      const today = todayKey();
      const hour = new Date().getHours();
      const loggedToday = eggs.some((e) => toDateKey(e.date) === today);
      if (!loggedToday && hour >= 18 && eggs.length > 0) {
        out.push({
          id: `missed-production:${today}`,
          category: "operations",
          severity: "warning",
          title: "No production recorded today",
          message: "Egg collection has not been logged yet today. Record it before the day closes so analytics stay accurate.",
          at: new Date().toISOString(),
          to: "/dashboard",
          search: { area: "records" },
          hash: "production",
        });
      }
    }

    if (can("feed.read") && feed.length > 0) {
      const today = todayKey();
      const todayFeed = feedOnDay(feed, today);
      const prior: number[] = [];
      for (let i = 1; i <= 7; i++) prior.push(feedOnDay(feed, dayOffsetKey(i)));
      const active = prior.filter((v) => v > 0);
      const avg = active.length >= 3 ? active.reduce((s, v) => s + v, 0) / active.length : 0;
      if (avg > 0 && todayFeed > 0 && todayFeed < avg * 0.7) {
        const drop = ((avg - todayFeed) / avg) * 100;
        out.push({
          id: `feed-drop:${today}`,
          category: "operations",
          severity: drop >= 40 ? "warning" : "info",
          title: "Feed intake dropped sharply",
          message: `Feed given today is ${drop.toFixed(0)}% below the recent daily average. A sudden drop in intake often comes before a health problem.`,
          at: new Date().toISOString(),
          to: "/feed",
          search: { tab: "overview" },
        });
      }
    }

    // ---- 4. Activity alerts -----------------------------------------------
    if (canAudit) {
      for (const e of (eventsQ.data ?? []).slice(0, 25)) {
        if (e.actor_role === "owner" && e.event_type !== "room_culled") continue;
        if (!["login", "login_failed", "room_culled", "role_changed", "staff_created", "account_suspended", "password_change"].includes(e.event_type)) continue;
        out.push({
          id: `activity:${e.id}`,
          category: "activity",
          severity: e.event_type === "login_failed" ? "warning" : "info",
          title: e.event_type === "login_failed" ? "Failed login attempt" : "Team activity",
          message: describeEvent(e),
          at: e.created_at,
          to: "/activity",
        });
      }
    }

    return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }, [
    can, canAudit, isPremium,
    eggsQ.data, roomsQ.data, mortQ.data, feedQ.data, healthQ.data, priceQ.data, eventsQ.data,
  ]);

  const loading = permsLoading || eggsQ.isPending || roomsQ.isPending;

  return { alerts, loading };
}

/** Unread count helper shared by the bell and the alerts page. */
export function useUnreadAlerts() {
  const { alerts, loading } = useFarmAlerts();
  const { isRead, markRead, markAllRead, hydrated } = useAlertReadState();
  const unread = useMemo(
    () => (hydrated ? alerts.filter((a) => !isRead(a.id)) : []),
    [alerts, isRead, hydrated],
  );
  return { alerts, unread, count: unread.length, isRead, markRead, markAllRead, loading };
}

export function alertTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
