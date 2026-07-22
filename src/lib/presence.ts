// Lightweight online-presence heartbeat for signed-in users. Writes the current
// user's last_seen every ~60s while the tab is visible; Super Admin queries
// user_presence to see who is online.
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePresenceHeartbeat(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const beat = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("user_presence")
          .upsert({ user_id: userId, last_seen: new Date().toISOString(), updated_at: new Date().toISOString() });
      } catch {
        // Silent — presence is best-effort.
      }
    };

    void beat();
    const id = window.setInterval(beat, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") void beat(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [userId]);
}
