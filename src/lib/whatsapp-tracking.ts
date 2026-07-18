// Client-side helpers for the WhatsApp widget: session id, device/browser
// detection, referrer classification, and the fire-and-forget tracking POST.

const SESSION_KEY = "pp_session_id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36));
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function detectDevice(): "Mobile" | "Tablet" | "Desktop" | "Unknown" {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone|iPod|BlackBerry|Opera Mini/i.test(ua)) return "Mobile";
  return "Desktop";
}

export function detectBrowser(): string {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent || "";
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
  if (/MSIE|Trident/.test(ua)) return "Internet Explorer";
  return "Other";
}

export function classifyReferrer(ref: string | null | undefined): {
  referrer: string | null;
  source: string;
} {
  if (!ref) return { referrer: null, source: "Direct" };
  try {
    const host = new URL(ref).hostname.toLowerCase();
    const map: Array<[RegExp, string]> = [
      [/(^|\.)google\./, "Google"],
      [/(^|\.)bing\./, "Bing"],
      [/(^|\.)duckduckgo\./, "DuckDuckGo"],
      [/(^|\.)yahoo\./, "Yahoo"],
      [/(^|\.)facebook\.|(^|\.)fb\./, "Facebook"],
      [/(^|\.)instagram\./, "Instagram"],
      [/(^|\.)twitter\.|(^|\.)x\.com/, "Twitter / X"],
      [/(^|\.)linkedin\./, "LinkedIn"],
      [/(^|\.)tiktok\./, "TikTok"],
      [/(^|\.)whatsapp\.|(^|\.)wa\.me/, "WhatsApp"],
      [/(^|\.)youtube\./, "YouTube"],
      [/(^|\.)t\.co/, "Twitter / X"],
    ];
    for (const [re, name] of map) if (re.test(host)) return { referrer: ref, source: name };
    return { referrer: ref, source: host };
  } catch {
    return { referrer: ref, source: "Unknown" };
  }
}

export function pageLabelFromPath(path: string): string {
  const p = (path || "/").split("?")[0].replace(/\/+$/, "") || "/";
  if (p === "/") return "Landing";
  if (p === "/pricing") return "Pricing";
  if (p === "/auth") return "Auth";
  if (p === "/presentation") return "Live Demo";
  if (p === "/reset-password") return "Reset Password";
  // Fallback: capitalise first path segment.
  const seg = p.split("/").filter(Boolean)[0] ?? "Other";
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

type TrackPayload = {
  kind?: "click" | "visit";
  page_path?: string;
  page_label?: string;
  user_type?: "guest" | "registered" | "admin";
  user_id?: string | null;
};

export function sendTracking(payload: TrackPayload): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({
    kind: payload.kind ?? "click",
    page_path: payload.page_path ?? window.location.pathname,
    page_label: payload.page_label ?? pageLabelFromPath(window.location.pathname),
    user_type: payload.user_type ?? "guest",
    user_id: payload.user_id ?? null,
    device_type: detectDevice(),
    browser: detectBrowser(),
    session_id: getSessionId(),
    ...classifyReferrer(document.referrer || null),
  });
  try {
    // sendBeacon is fire-and-forget and won't delay navigation to wa.me.
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(
        "/api/public/whatsapp-click",
        new Blob([body], { type: "application/json" }),
      );
      if (ok) return;
    }
    void fetch("/api/public/whatsapp-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Silent failure — tracking must never break the user flow.
  }
}
