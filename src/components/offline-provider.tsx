/**
 * Client-only offline runtime: starts the sync engine, tracks the signed-in
 * user, wipes local data on sign-out and surfaces connectivity toasts.
 */
import { useEffect } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startSyncEngine, setSyncUser, setSyncNotifier, setSyncCompleteHandler, syncNow, forgetUser } from "@/lib/offline/sync-engine";
import { refreshPendingCount } from "@/lib/offline/data";
import { onOutboxChange } from "@/lib/offline/outbox";
import { registerServiceWorker } from "@/pwa/register";

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();

  useEffect(() => {
    let activeUser: string | null = null;

    setSyncNotifier((kind, msg) => {
      if (kind === "offline") toast.warning(msg, { id: "pp-offline" });
      else if (kind === "restored") toast.success(msg, { id: "pp-offline" });
      else if (kind === "syncing") toast.loading(msg, { id: "pp-sync" });
      else if (kind === "done") toast.success(msg, { id: "pp-sync" });
      else if (kind === "conflict") toast.warning(msg, { id: "pp-conflict" });
      else toast.error(msg, { id: "pp-sync" });
    });

    setSyncCompleteHandler(() => {
      qc.invalidateQueries({ queryKey: ["farm"] });
    });

    startSyncEngine();
    registerServiceWorker();

    const unsubOutbox = onOutboxChange(() => {
      void refreshPendingCount(activeUser);
    });

    supabase.auth.getSession().then(({ data }) => {
      activeUser = data.session?.user?.id ?? null;
      setSyncUser(activeUser);
      if (activeUser) void syncNow({ silent: true });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const next = session?.user?.id ?? null;
      if (event === "SIGNED_OUT" && activeUser) {
        void forgetUser(activeUser);
      }
      if (next !== activeUser) {
        activeUser = next;
        setSyncUser(next);
        if (next) void syncNow({ silent: true });
      }
    });

    return () => {
      unsubOutbox();
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  return <>{children}</>;
}
