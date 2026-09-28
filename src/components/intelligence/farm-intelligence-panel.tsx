import { Link } from "@tanstack/react-router";
import { ArrowRight, Info } from "lucide-react";
import { useAlertStates, useFarmIntelligence } from "@/lib/intelligence/use-farm-intelligence";
import type { IntelMetricStatus, RoomStatus } from "@/lib/intelligence/engine";
import { IntelAlertCard } from "@/components/intelligence/intel-alert-card";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<IntelMetricStatus, string> = {
  normal: "bg-emerald-500", watch: "bg-yellow-400", warning: "bg-amber-500", critical: "bg-destructive", unknown: "bg-border",
};
const ROOM_META: Record<RoomStatus["status"], { label: string; dot: string }> = {
  stable: { label: "Stable", dot: "bg-emerald-500" },
  monitor: { label: "Monitor", dot: "bg-yellow-400" },
  attention: { label: "Attention", dot: "bg-destructive" },
};

export function RoomStatusList({ rooms }: { rooms: RoomStatus[] }) {
  if (rooms.length === 0) return <p className="mt-2 text-[13px] text-muted-foreground">Add rooms to see each room's status.</p>;
  return (
    <ul className="mt-2 divide-y divide-border">
      {rooms.map((r) => (
        <li key={r.room} className="flex items-center gap-2 py-2 text-[13px]" title={r.reason ?? undefined}>
          <span className={cn("h-2 w-2 shrink-0 rounded-full", ROOM_META[r.status].dot)} />
          <span className="min-w-0 flex-1 truncate font-medium">{r.room}</span>
          <span className="text-xs text-muted-foreground">{ROOM_META[r.status].label}</span>
        </li>
      ))}
    </ul>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** "Today's Farm Intelligence" — headline metrics, top priorities, room status. */
export function FarmIntelligencePanel() {
  const { data: intel, loading, farmId } = useFarmIntelligence();
  const states = useAlertStates(intel, farmId, !loading);
  if (loading) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold">{greeting()} 👋</h2>
        <p className="text-sm text-muted-foreground">
          {intel.priorities.length ? "Here's what needs your attention today." : "Here's how your farm looks today."}
        </p>
        <p className="mt-2 max-w-3xl text-[13.5px] text-foreground">{intel.summary}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {intel.metrics.map((m) => (
          <div key={m.key} className="rounded-2xl border border-border bg-card p-3.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[m.status])} /> {m.label}
            </span>
            <p className={cn("mt-1.5 font-display text-xl font-semibold tabular-nums", m.value === "—" && "text-muted-foreground")}>{m.value}</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{m.detail}</p>
          </div>
        ))}
      </div>

      {intel.dataGaps.length > 0 && (
        <div className="space-y-1 text-[12px] text-muted-foreground">
          {intel.dataGaps.slice(0, 2).map((g) => <p key={g} className="flex gap-1.5"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{g}</p>)}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Today's priorities</h3>
            <Link to="/alerts" className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--forest)] hover:underline">
              All alerts <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {intel.priorities.length === 0 ? (
            <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-[13px] text-muted-foreground">
              Nothing needs your attention right now based on your latest records.
            </p>
          ) : (
            <div className="mt-2 space-y-2.5">
              {intel.priorities.map((a) => (
                <IntelAlertCard key={a.key} alert={a} compact status={states.statusOf(a.key)} onAcknowledge={() => void states.acknowledge(a)} />
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Farm status</h3>
          <RoomStatusList rooms={intel.rooms} />
        </div>
      </div>
    </section>
  );
}
