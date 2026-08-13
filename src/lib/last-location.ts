/**
 * "Resume where I left off".
 *
 * Every meaningful navigation inside the authenticated shell is persisted for
 * the SIGNED-IN USER (never globally for the farm) in `public.user_last_location`,
 * with a localStorage mirror so a refresh restores instantly even offline.
 *
 * On sign-in the saved location is re-validated against the user's CURRENT
 * effective permissions before it is used; anything stale, unknown or now
 * forbidden silently falls back to the user's permitted home route.
 */
import { supabase } from "@/integrations/supabase/client";
import { NAV_SECTIONS, type NavLeaf } from "@/lib/nav-config";
import { grants, homeRouteForRole } from "@/lib/rbac";

export type SavedLocation = {
  pathname: string;
  search: Record<string, string>;
  hash: string | null;
  farmId: string | null;
  contextKind: string | null;
  contextId: string | null;
};

/** Pages that must never be resumed (auth, transient or dead-end screens). */
const NEVER_SAVE = [
  "/auth",
  "/reset-password",
  "/onboarding",
  "/logout",
  "/presentation",
  "/lovable",
];

const STORAGE_KEY = "pp:last-location";

export function isResumablePath(pathname: string) {
  if (!pathname || !pathname.startsWith("/")) return false;
  if (pathname === "/" || pathname.startsWith("/api")) return false;
  return !NEVER_SAVE.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function allLeaves(): NavLeaf[] {
  const out: NavLeaf[] = [];
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      out.push(item);
      for (const child of item.children ?? []) out.push(child);
    }
  }
  return out;
}

/**
 * Permissions that would grant access to a path. The most specific nav entry
 * wins (same path + matching search keys), otherwise every entry on that path
 * is considered — access is allowed when the user holds ANY of them.
 */
function permissionsForLocation(pathname: string, search: Record<string, string>) {
  const leaves = allLeaves().filter((l) => l.to === pathname);
  if (!leaves.length) return null; // unknown to the nav config: no gate declared
  const exact = leaves.filter((l) => {
    const s = l.search ?? {};
    return Object.entries(s).every(([k, v]) => search[k] === v);
  });
  const pool = exact.length ? exact : leaves;
  return pool.map((l) => l.permission).filter((p): p is string => !!p);
}

export function canAccessLocation(
  loc: Pick<SavedLocation, "pathname" | "search">,
  permissions: string[] | undefined,
) {
  if (!isResumablePath(loc.pathname)) return false;
  const required = permissionsForLocation(loc.pathname, loc.search ?? {});
  if (required === null) return false; // not a known app page anymore
  if (!required.length) return true;
  return required.some((p) => grants(permissions, p));
}

export function toHref(loc: SavedLocation) {
  const qs = new URLSearchParams(loc.search ?? {}).toString();
  return `${loc.pathname}${qs ? `?${qs}` : ""}${loc.hash ? `#${loc.hash}` : ""}`;
}

/* ------------------------------- persistence ------------------------------ */

function readLocal(userId: string): SavedLocation | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedLocation;
    return parsed && typeof parsed.pathname === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocal(userId: string, loc: SavedLocation) {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(loc));
  } catch {
    /* storage disabled — the database copy is authoritative anyway */
  }
}

let lastSavedHref = "";

export async function saveLastLocation(
  userId: string,
  loc: SavedLocation,
  opts: { immediate?: boolean } = {},
) {
  if (!userId || !isResumablePath(loc.pathname)) return;
  const href = toHref(loc);
  if (!opts.immediate && href === lastSavedHref) return;
  lastSavedHref = href;
  writeLocal(userId, loc);
  try {
    await supabase.from("user_last_location").upsert(
      {
        user_id: userId,
        pathname: loc.pathname,
        search: loc.search ?? {},
        hash: loc.hash,
        farm_id: loc.farmId,
        context_kind: loc.contextKind,
        context_id: loc.contextId,
        label: null,
      },
      { onConflict: "user_id" },
    );
  } catch {
    /* offline / transient — localStorage still holds the latest value */
  }
}

export async function fetchLastLocation(userId: string): Promise<SavedLocation | null> {
  try {
    const { data } = await supabase
      .from("user_last_location")
      .select("pathname, search, hash, farm_id, context_kind, context_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.pathname) {
      return {
        pathname: data.pathname,
        search: (data.search ?? {}) as Record<string, string>,
        hash: data.hash ?? null,
        farmId: data.farm_id ?? null,
        contextKind: data.context_kind ?? null,
        contextId: data.context_id ?? null,
      };
    }
  } catch {
    /* fall through to the local mirror */
  }
  return readLocal(userId);
}

/**
 * Resolve the post-login destination:
 * 1. last valid page (+ farm / room / flock context)
 * 2. last valid page
 * 3. the user's permitted default dashboard
 */
export async function resolveResumeDestination(opts: {
  userId: string;
  role: string;
  permissions: string[];
  farmIds?: string[];
}): Promise<string> {
  const fallback = homeRouteForRole(opts.role);
  const saved = await fetchLastLocation(opts.userId);
  if (!saved) return fallback;
  if (!canAccessLocation(saved, opts.permissions)) return fallback;
  // Farm context that no longer exists (or is no longer accessible) is dropped,
  // but the page itself is still a valid resume target.
  if (saved.farmId && opts.farmIds && opts.farmIds.length && !opts.farmIds.includes(saved.farmId)) {
    return `${saved.pathname}${new URLSearchParams(saved.search ?? {}).toString() ? `?${new URLSearchParams(saved.search).toString()}` : ""}`;
  }
  return toHref(saved);
}

/**
 * Flush the location currently shown in the browser. Called right before
 * sign-out so the session ends with the user's real last page saved.
 * Logout never clears the saved location — it only ends the session.
 */
export async function flushCurrentLocation(farmId?: string | null) {
  if (typeof window === "undefined") return;
  const { pathname, search, hash } = window.location;
  if (!isResumablePath(pathname)) return;
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return;
  const params: Record<string, string> = {};
  new URLSearchParams(search).forEach((v, k) => { params[k] = v; });
  await saveLastLocation(
    userId,
    {
      pathname,
      search: params,
      hash: hash ? hash.replace(/^#/, "") : null,
      farmId: farmId ?? null,
      contextKind: null,
      contextId: null,
    },
    { immediate: true },
  );
}
