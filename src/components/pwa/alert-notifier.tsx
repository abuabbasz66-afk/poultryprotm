import { useEffect, useRef } from "react";
import { useUnreadAlerts } from "@/lib/alerts";
import { useAuthUserId } from "@/lib/farm-data";
import { loadPrefs, notifyNewAlerts, notificationPermission } from "@/lib/notifications";

/**
 * Raises a phone notification whenever a new farm alert appears while the app
 * is installed/open. Silent when the farmer has not granted permission.
 */
export function AlertNotifier() {
  const { data: userId } = useAuthUserId();
  const { alerts, loading } = useUnreadAlerts();
  const busy = useRef(false);

  useEffect(() => {
    if (loading || !userId || alerts.length === 0) return;
    if (notificationPermission() !== "granted") return;
    if (busy.current) return;
    busy.current = true;
    void notifyNewAlerts(userId, alerts, loadPrefs(userId)).finally(() => {
      busy.current = false;
    });
  }, [alerts, loading, userId]);

  return null;
}
