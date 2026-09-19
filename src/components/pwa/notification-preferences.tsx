import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAuthUserId } from "@/lib/farm-data";
import { usePermissions } from "@/lib/rbac";

const CATEGORIES = [
  { key: "production", label: "Production", permission: "production.read" },
  { key: "feed", label: "Feed", permission: "feed.read" },
  { key: "mortality", label: "Mortality", permission: "mortality.read" },
  { key: "health", label: "Health & medication", permission: "health.read" },
  { key: "vaccination", label: "Vaccination", permission: "health.read" },
  { key: "finance", label: "Finance", permission: "financials.read" },
  { key: "system", label: "System & sync" },
] as const;

type PreferenceMap = Record<string, boolean>;

export function NotificationPreferences() {
  const { data: userId } = useAuthUserId();
  const { can } = usePermissions();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [prefs, setPrefs] = useState<PreferenceMap>({});
  const storageKey = userId ? `pp-notification-preferences:${userId}` : null;
  const visible = useMemo(
    () => CATEGORIES.filter((item) => !("permission" in item) || can(item.permission)),
    [can],
  );

  useEffect(() => {
    const available = typeof window !== "undefined" && "Notification" in window;
    setSupported(available);
    if (available) setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as PreferenceMap;
      setPrefs(saved);
    } catch {
      setPrefs({});
    }
  }, [storageKey]);

  const persist = (next: PreferenceMap) => {
    setPrefs(next);
    if (storageKey) window.localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const requestPermission = async () => {
    if (!supported) return;
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next === "granted") toast.success("Notifications enabled on this device.");
    else if (next === "denied") toast.error("Notifications are blocked in this browser’s settings.");
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-6">
      <div className="flex items-start gap-3">
        {permission === "denied" ? <BellOff className="mt-0.5 h-5 w-5 text-muted-foreground" /> : <Bell className="mt-0.5 h-5 w-5 text-primary" />}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold">Notifications</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose which farm reminders this device may show.</p>
          {!supported ? (
            <p className="mt-4 text-sm text-muted-foreground">Notifications are not available in this browser.</p>
          ) : permission !== "granted" ? (
            <div className="mt-4">
              <Button type="button" variant="outline" onClick={requestPermission} disabled={permission === "denied"}>
                <Bell /> {permission === "denied" ? "Blocked in browser settings" : "Enable notifications"}
              </Button>
            </div>
          ) : null}
          <div className="mt-5 divide-y divide-border">
            {visible.map((item) => (
              <label key={item.key} className="flex min-h-12 items-center justify-between gap-4 py-2 text-sm">
                <span>{item.label}</span>
                <Switch
                  aria-label={`${item.label} notifications`}
                  checked={prefs[item.key] ?? true}
                  onCheckedChange={(checked) => persist({ ...prefs, [item.key]: checked })}
                />
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Remote background alerts will become available when push delivery is configured.</p>
        </div>
      </div>
    </section>
  );
}