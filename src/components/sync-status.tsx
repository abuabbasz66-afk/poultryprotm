import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { useSyncState } from "@/lib/offline/status";
import { syncNow } from "@/lib/offline/sync-engine";
import { ConflictDialog } from "@/components/conflict-dialog";
import { cn } from "@/lib/utils";

function formatLastSync(iso: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Today ${time}` : `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
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
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const label =
    s.phase === "offline"
      ? "Offline"
      : s.phase === "syncing"
        ? "Syncing…"
        : s.pending > 0
          ? "Pending"
          : "All synced";

  const Icon =
    s.phase === "offline" ? WifiOff : s.phase === "syncing" ? RefreshCw : s.pending > 0 ? CloudOff : Cloud;

  const tone =
    s.phase === "offline"
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
        {s.pending > 0 && (
          <span className="rounded-full bg-white/20 px-1.5 py-px text-[10px] tabular-nums">{s.pending}</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {s.online ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-red-500" />}
              {s.online ? "Online" : "Working offline"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {s.online
                ? "Records upload automatically."
                : "Your records are being saved on this device and will upload automatically."}
            </p>

            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Pending records</dt>
                <dd className="font-semibold tabular-nums">{s.pending}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Last sync</dt>
                <dd className="font-semibold">{formatLastSync(s.lastSyncAt)}</dd>
              </div>
            </dl>

            {s.conflicts > 0 && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConflictsOpen(true);
                }}
                className="mt-3 flex w-full items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-50 px-2.5 py-2 text-left text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {s.conflicts} record{s.conflicts > 1 ? "s" : ""} need review
              </button>
            )}

            <button
              type="button"
              disabled={!s.online || s.phase === "syncing"}
              onClick={() => void syncNow()}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", s.phase === "syncing" && "animate-spin")} />
              Sync now
            </button>
          </div>
        </>
      )}

      <ConflictDialog open={conflictsOpen} onOpenChange={setConflictsOpen} />
    </div>
  );
}
