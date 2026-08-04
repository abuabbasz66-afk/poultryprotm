import { supabase } from "@/integrations/supabase/client";

/**
 * Staff security & activity events.
 *
 * Every sensitive account action (login, failed login, logout, password
 * change, staff creation, role change, suspension, reactivation) is written to
 * `public.security_events` through a security-definer RPC. Rows are immutable
 * and readable only by roles holding `audit.read` — in practice the Farm Owner.
 */

export type SecurityEventType =
  | "login"
  | "login_failed"
  | "logout"
  | "password_change"
  | "staff_created"
  | "role_changed"
  | "account_suspended"
  | "account_reactivated";

export const EVENT_LABELS: Record<string, string> = {
  login: "Staff login",
  login_failed: "Failed login attempt",
  logout: "Logout",
  password_change: "Password change",
  staff_created: "Staff account created",
  role_changed: "Role changed",
  account_suspended: "Account suspended",
  account_reactivated: "Account reactivated",
};

type Client = {
  device: string;
  browser: string;
  os: string;
};

export function detectClient(): Client {
  if (typeof navigator === "undefined") return { device: "Unknown", browser: "Unknown", os: "Unknown" };
  const ua = navigator.userAgent;
  const mobile = /Android|iPhone|iPad|iPod|Mobile|Opera Mini/i.test(ua);
  const tablet = /iPad|Tablet/i.test(ua);

  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\//.test(ua) ? "Opera" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" :
    /Firefox\//.test(ua) ? "Firefox" : "Unknown";

  const os =
    /Windows/i.test(ua) ? "Windows" :
    /Android/i.test(ua) ? "Android" :
    /iPhone|iPad|iPod/i.test(ua) ? "iOS" :
    /Mac OS X/i.test(ua) ? "macOS" :
    /Linux/i.test(ua) ? "Linux" : "Unknown";

  return { device: tablet ? "Tablet" : mobile ? "Mobile" : "Desktop", browser, os };
}

/** Best-effort network location. Never blocks, never throws. */
async function lookupNetwork(): Promise<{ ip: string | null; location: string | null }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch("https://ipapi.co/json/", { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { ip: null, location: null };
    const j = (await res.json()) as { ip?: string; city?: string; country_name?: string };
    const place = [j.city, j.country_name].filter(Boolean).join(", ");
    return { ip: j.ip ?? null, location: place || null };
  } catch {
    return { ip: null, location: null };
  }
}

export async function logSecurityEvent(
  eventType: SecurityEventType,
  opts: { identifier?: string | null; detail?: string | null; metadata?: Record<string, unknown> } = {},
) {
  try {
    const client = detectClient();
    const net = await lookupNetwork();
    await supabase.rpc("log_security_event", {
      _event_type: eventType,
      _identifier: opts.identifier ?? null,
      _detail: opts.detail ?? null,
      _device: client.device,
      _browser: client.browser,
      _os: client.os,
      _ip: net.ip,
      _location: net.location,
      _metadata: (opts.metadata ?? {}) as never,
    });
  } catch {
    /* logging must never block the user */
  }
}

export function describeEvent(e: {
  actor_name?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  event_type: string;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  location?: string | null;
}) {
  const who = e.actor_name || e.actor_email || "A staff member";
  const role = e.actor_role ? ` (${roleLabel(e.actor_role)})` : "";
  const where = [e.browser, e.os].filter(Boolean).join(" on ");
  const place = e.location ? ` from ${e.location}` : "";
  const via = where ? ` using ${where}` : "";
  switch (e.event_type) {
    case "login": return `${who}${role} signed in${via}${place}.`;
    case "login_failed": return `Failed sign-in attempt for ${who}${role}${via}${place}.`;
    case "logout": return `${who}${role} signed out.`;
    case "password_change": return `${who}${role} changed their password.`;
    case "staff_created": return `${who}${role} account was created.`;
    case "role_changed": return `${who} role was changed${role}.`;
    case "account_suspended": return `${who}${role} was suspended.`;
    case "account_reactivated": return `${who}${role} was reactivated.`;
    default: return `${who}${role} — ${e.event_type}`;
  }
}

export function roleLabel(key: string) {
  const map: Record<string, string> = {
    owner: "Farm Owner",
    manager: "Farm Manager",
    sales: "Sales Officer",
    vet: "Veterinarian",
    accountant: "Accountant",
    store: "Store Keeper",
  };
  return map[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
