/**
 * Device notifications for farm alerts.
 *
 * Alerts are derived locally (see `src/lib/alerts.ts`), so notifications are
 * raised on the device itself through the service worker. No alert text ever
 * leaves the phone. Remote background push (delivery while the app is fully
 * closed) needs a push provider and is not configured yet.
 */
import type { AlertCategory, AlertSeverity, FarmAlert } from "@/lib/alerts";
import { ensureServiceWorkerRegistration } from "@/pwa/register";

export const NOTIFY_CATEGORIES: { key: AlertCategory; label: string; hint: string }[] = [
  { key: "health", label: "Health & disease risk", hint: "Mortality spikes, disease and vaccination risk" },
  { key: "operations", label: "Daily operations", hint: "Missing records, feed and production issues" },
  { key: "price", label: "Prices", hint: "Egg and feed price movements" },
  { key: "activity", label: "Staff activity", hint: "Logins and account activity on your farm" },
];

export type NotifyPrefs = { enabled: boolean } & Partial<Record<AlertCategory, boolean>>;

const PREFS_KEY = (userId: string | null | undefined) => `pp.notify.prefs.${userId ?? "none"}`;
const SENT_KEY = (userId: string | null | undefined) => `pp.notify.sent.${userId ?? "none"}`;
const MAX_REMEMBERED = 300;
/** Never raise more than this many notifications at once. */
const MAX_PER_BURST = 3;

export function loadPrefs(userId: string | null | undefined): NotifyPrefs {
  if (typeof window === "undefined") return { enabled: true };
  try {
    const raw = window.localStorage.getItem(PREFS_KEY(userId));
    const parsed = raw ? (JSON.parse(raw) as NotifyPrefs) : null;
    if (!parsed || typeof parsed !== "object") return { enabled: true };
    return { ...parsed, enabled: parsed.enabled !== false };

  } catch {
    return { enabled: true };
  }
}

export function savePrefs(userId: string | null | undefined, prefs: NotifyPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFS_KEY(userId), JSON.stringify(prefs));
  } catch {
    /* storage full or blocked */
  }
}

export function categoryEnabled(prefs: NotifyPrefs, category: AlertCategory): boolean {
  if (prefs.enabled === false) return false;
  return prefs[category] ?? true;
}

function readSent(userId: string | null | undefined): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SENT_KEY(userId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function writeSent(userId: string | null | undefined, ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SENT_KEY(userId), JSON.stringify(ids.slice(-MAX_REMEMBERED)));
  } catch {
    /* ignore */
  }
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : "denied";
}

async function swRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  return ensureServiceWorkerRegistration();
}

export async function notificationServiceReady(): Promise<boolean> {
  return Boolean(await swRegistration());
}

const URGENCY: Record<AlertSeverity, boolean> = { critical: true, warning: false, info: false };

/** Show one notification through the active app worker (required on mobile browsers). */
export async function showNotification(options: {
  tag: string;
  title: string;
  body: string;
  url?: string;
  severity?: AlertSeverity;
}): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  const payload: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body: options.body,
    tag: options.tag,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: options.url ?? "/alerts" },
    requireInteraction: options.severity ? URGENCY[options.severity] : false,
    vibrate: [100, 50, 100],
  };
  const reg = await swRegistration();
  if (!reg) return false;
  try {
    await reg.showNotification(options.title, payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * Raise notifications for alerts that have not been notified on this device.
 * Returns the number shown.
 */
export async function notifyNewAlerts(
  userId: string | null | undefined,
  alerts: FarmAlert[],
  prefs: NotifyPrefs,
): Promise<number> {
  if (!notificationsSupported() || Notification.permission !== "granted") return 0;
  if (prefs.enabled === false) return 0;

  const sent = readSent(userId);
  const seen = new Set(sent);
  const fresh = alerts.filter((a) => !seen.has(a.id) && categoryEnabled(prefs, a.category));
  if (fresh.length === 0) return 0;

  // Remember every alert we consider so a burst is never repeated later.
  writeSent(userId, [...sent, ...fresh.map((a) => a.id)]);

  const order: AlertSeverity[] = ["critical", "warning", "info"];
  const ranked = [...fresh].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  const top = ranked.slice(0, MAX_PER_BURST);
  let shown = 0;
  for (const alert of top) {
    const ok = await showNotification({
      tag: alert.id,
      title: alert.title,
      body: alert.message,
      url: alert.to ?? "/alerts",
      severity: alert.severity,
    });
    if (ok) shown += 1;
  }
  const rest = ranked.length - top.length;
  if (rest > 0) {
    await showNotification({
      tag: "pp-more-alerts",
      title: `${rest} more farm alert${rest === 1 ? "" : "s"}`,
      body: "Open PoultryPro to review the full alert list.",
      url: "/alerts",
    });
  }
  return shown;
}

/** Marks existing alerts as already notified (used the first time a device opts in). */
export function markAllNotified(userId: string | null | undefined, alerts: FarmAlert[]) {
  writeSent(userId, [...readSent(userId), ...alerts.map((a) => a.id)]);
}
