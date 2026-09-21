import { useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAuthUserId } from "@/lib/farm-data";
import { useFarmAlerts } from "@/lib/alerts";
import {
  NOTIFY_CATEGORIES, categoryEnabled, loadPrefs, markAllNotified, notificationsSupported,
  notificationServiceReady, savePrefs, showNotification, type NotifyPrefs,
} from "@/lib/notifications";

export function NotificationPreferences() {
  const { data: userId } = useAuthUserId();
  const { alerts } = useFarmAlerts();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [prefs, setPrefs] = useState<NotifyPrefs>({ enabled: true });
  const [workerReady, setWorkerReady] = useState(false);
  const [checkingWorker, setCheckingWorker] = useState(false);

  useEffect(() => {
    const available = notificationsSupported();
    setSupported(available);
    if (available) {
      setPermission(Notification.permission);
      if (Notification.permission === "granted") {
        setCheckingWorker(true);
        void notificationServiceReady().then(setWorkerReady).finally(() => setCheckingWorker(false));
      }
    }
  }, []);

  useEffect(() => {
    setPrefs(loadPrefs(userId));
  }, [userId]);

  const update = (next: NotifyPrefs) => {
    setPrefs(next);
    savePrefs(userId, next);
  };

  const enableOnDevice = async () => {
    if (!supported) return;
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next === "granted") {
      // Existing alerts are treated as already seen so the farmer is not flooded.
      markAllNotified(userId, alerts);
      update({ ...prefs, enabled: true });
      setCheckingWorker(true);
      const ok = await showNotification({
        tag: "pp-welcome",
        title: "PoultryPro alerts are on",
        body: "You will now get farm alerts on this phone.",
        url: "/alerts",
      });
      setWorkerReady(ok);
      setCheckingWorker(false);
      if (ok) toast.success("Alerts will now show on this device.");
      else toast.error("Notification setup did not finish. Close and reopen PoultryPro, then try again.");
    } else if (next === "denied") {
      toast.error("Notifications are blocked. Allow them in your browser settings for this site.");
    }
  };

  const sendTest = async () => {
    setCheckingWorker(true);
    const ok = await showNotification({
      tag: "pp-test",
      title: "Test alert — PoultryPro",
      body: "This is how a farm alert will appear on your phone.",
      url: "/alerts",
    });
    setWorkerReady(ok);
    setCheckingWorker(false);
    if (ok) toast.success("Test alert sent.");
    else toast.error("Notification setup is not ready. Close and reopen PoultryPro, then try again.");
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-6">
      <div className="flex items-start gap-3">
        {permission === "denied" ? <BellOff className="mt-0.5 h-5 w-5 text-muted-foreground" /> : <Bell className="mt-0.5 h-5 w-5 text-primary" />}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold">Farm alerts on this phone</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Get mortality, feed, production, price and staff alerts as notifications on this device.
          </p>

          {!supported ? (
            <p className="mt-4 text-sm text-muted-foreground">
              This browser cannot show notifications. Install PoultryPro on your phone and open it from the home screen.
            </p>
          ) : permission !== "granted" ? (
            <div className="mt-4 space-y-2">
              <Button type="button" onClick={enableOnDevice} disabled={permission === "denied"}>
                <Bell /> {permission === "denied" ? "Blocked in browser settings" : "Turn on alerts"}
              </Button>
              {permission === "denied" && (
                <p className="text-xs text-muted-foreground">
                  Open your browser site settings for PoultryPro and allow notifications, then reload.
                </p>
              )}
            </div>
          ) : workerReady ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
                Alerts are active on this device
              </span>
              <Button type="button" variant="outline" size="sm" onClick={sendTest} disabled={checkingWorker}>
                <Send /> Send a test alert
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                {checkingWorker ? "Finishing notification setup…" : "Notification setup needs to be completed on this device."}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={sendTest} disabled={checkingWorker}>
                <Send /> {checkingWorker ? "Setting up…" : "Complete setup and test"}
              </Button>
            </div>
          )}

          <label className="mt-5 flex min-h-12 items-center justify-between gap-4 border-b border-border py-2 text-sm font-medium">
            <span>All farm alerts</span>
            <Switch
              aria-label="All farm alerts"
              checked={prefs.enabled !== false}
              onCheckedChange={(checked) => update({ ...prefs, enabled: checked })}
            />
          </label>

          <div className="divide-y divide-border">
            {NOTIFY_CATEGORIES.map((item) => (
              <label key={item.key} className="flex min-h-12 items-center justify-between gap-4 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.hint}</span>
                </span>
                <Switch
                  aria-label={`${item.label} alerts`}
                  disabled={prefs.enabled === false}
                  checked={categoryEnabled({ ...prefs, enabled: true }, item.key)}
                  onCheckedChange={(checked) => update({ ...prefs, [item.key]: checked })}
                />
              </label>
            ))}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Alerts appear while PoultryPro is installed and running in the background. Delivery when the app is fully
            closed for a long time needs a push service, which is not set up yet.
          </p>
        </div>
      </div>
    </section>
  );
}
