import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { useSyncState } from "@/lib/offline/status";
import { syncNow, retryFailed, discardFailed } from "@/lib/offline/sync-engine";
import { listOutbox, type OutboxItem } from "@/lib/offline/outbox";
import { supabase } from "@/integrations/supabase/client";
import { ConflictDialog } from "@/components/conflict-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function formatLastSync(iso: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return sameDay
    ? `Today ${time}`
    : `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
}

/**
 * Header pill showing connectivity + synchronisation state, pending record
 * count, last sync time and a manual "Sync Now" action.
 */
export function SyncStatus({ compact = false }: { compact?: boolean }) {
  const s = useSyncState();
  const [open, setOpen] = useState(false);
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [failedItems, setFailedItems] = useState<OutboxItem[]>([]);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open || s.failed === 0) {
      setFailedItems([]);
      return;
    }
    void supabase.auth.getSession().then(async ({ data }) => {
      const all = await listOutbox(data.session?.user?.id ?? null);
      setFailedItems(all.filter((i) => i.status === "error"));
    });
  }, [open, s.failed]);
  if (!mounted) return null;

  const label =
    s.phase === "offline"
      ? "Offline"
      : s.phase === "syncing"
        ? "Syncing…"
        : s.failed > 0
          ? "Failed"
          : s.pending > 0
            ? "Pending"
            : s.conflicts > 0
              ? "Conflict"
              : "All synced";

  const Icon =
    s.phase === "offline"
      ? WifiOff
      : s.phase === "syncing"
        ? RefreshCw
        : s.failed > 0 || s.conflicts > 0
          ? AlertTriangle
          : s.pending > 0
            ? CloudOff
            : Cloud;

  const tone =
    s.phase === "offline"
      ? "bg-red-500/15 text-red-100 border-red-400/40"
      : s.failed > 0
        ? "bg-red-500/15 text-red-100 border-red-400/40"
        : s.phase === "syncing"
          ? "bg-amber-400/15 text-amber-100 border-amber-300/40"
          : s.pending > 0
            ? "bg-amber-400/15 text-amber-100 border-amber-300/40"
            : "bg-emerald-400/15 text-emerald-100 border-emerald-300/40";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Connection status: ${label}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
          tone,
          compact && "px-2",
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", s.phase === "syncing" && "animate-spin")} />
        {!compact && <span>{label}</span>}
        {s.pending + s.failed + s.conflicts > 0 && (
          <span className="rounded-full bg-white/20 px-1.5 py-px text-[10px] tabular-nums">
            {s.pending + s.failed + s.conflicts}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {s.online ? (
                <Wifi className="h-4 w-4 text-emerald-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              {s.online ? "Online" : "Working offline"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {s.online
                ? s.phase === "syncing"
                  ? "Syncing farm records..."
                  : s.lastError
                    ? "Some records could not sync. Tap Sync now to retry."
                    : s.pending > 0
                      ? "Records are waiting to upload (Pending Sync)."
                      : "All farm records are synced."
                : "You're offline. Your farm records will sync when connection returns."}
            </p>

            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Pending records</dt>
                <dd className="font-semibold tabular-nums">{s.pending}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Failed</dt>
                <dd
                  className={cn("font-semibold tabular-nums", s.failed > 0 && "text-destructive")}
                >
                  {s.failed}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Need review</dt>
                <dd className="font-semibold tabular-nums">{s.conflicts}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Last sync</dt>
                <dd className="font-semibold">{formatLastSync(s.lastSyncAt)}</dd>
              </div>
            </dl>

            {failedItems.length > 0 && (
              <div className="mt-3 space-y-1.5 rounded-lg border border-destructive/40 bg-destructive/5 p-2">
                <p className="text-xs font-semibold text-destructive">Could not save</p>
                <ul className="max-h-32 space-y-1 overflow-y-auto">
                  {failedItems.map((i) => (
                    <li key={i.id} className="flex items-start justify-between gap-2 text-[11px]">
                      <span>
                        <span className="font-medium capitalize">{i.table.replace(/_/g, " ")}</span>
                        {typeof i.payload.date === "string" ? ` · ${i.payload.date}` : ""}
                        <span className="block text-muted-foreground">
                          {i.lastError ?? "Unknown error"}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="shrink-0 text-muted-foreground underline"
                        onClick={() => {
                          if (window.confirm("Discard this unsynced record? It will not be saved."))
                            void discardFailed(i.id);
                        }}
                      >
                        Discard
                      </button>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!s.online || s.phase === "syncing"}
                  onClick={() => void retryFailed()}
                  className="w-full"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry failed records
                </Button>
              </div>
            )}

            {s.conflicts > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setConflictsOpen(true);
                }}
                className="mt-3 h-auto w-full justify-start whitespace-normal border-amber-400/50 bg-amber-50 px-2.5 py-2 text-left text-xs text-amber-900 hover:bg-amber-100"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {s.conflicts} record{s.conflicts > 1 ? "s" : ""} need review
              </Button>
            )}

            <Button
              type="button"
              disabled={!s.online || s.phase === "syncing"}
              onClick={() => void syncNow()}
              className="mt-3 w-full"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", s.phase === "syncing" && "animate-spin")} />
              Sync now
            </Button>
          </div>
        </>
      )}

      <ConflictDialog open={conflictsOpen} onOpenChange={setConflictsOpen} />
    </div>
  );
}
