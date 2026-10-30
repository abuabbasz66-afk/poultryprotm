import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Baby, Drumstick, ArrowRight, AlertTriangle, CalendarDays, MapPin, ChevronDown, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/rbac";
import { useLayerBatches, useLayerDaily, useLayerHealth, useRearingSettings } from "@/lib/layer-rearing";
import { useBroilerBatches, useBroilerDaily } from "@/lib/broiler-data";
import { buildActiveOperations, summariseOperations, OPERATION_LABELS, type ActiveOperation } from "@/lib/active-operations";

const n = (v: number) => v.toLocaleString("en-NG");
const VISIBLE = 4;

/** Read-only overview of ongoing brooding/rearing batches, built from the existing batch records. */
export function ActiveFlockOperations() {
  const { can } = usePermissions();
  const allowed = can("rooms.read") || can("production.read");
  const layers = useLayerBatches();
  const layerDaily = useLayerDaily();
  const layerHealth = useLayerHealth();
  const settings = useRearingSettings();
  const broilers = useBroilerBatches();
  const broilerDaily = useBroilerDaily();
  const [expanded, setExpanded] = useState(false);

  const ops = useMemo(
    () =>
      buildActiveOperations({
        layerBatches: layers.data ?? [],
        layerDaily: layerDaily.data ?? [],
        layerHealth: layerHealth.data ?? [],
        layerSettings: settings.data,
        broilerBatches: broilers.data ?? [],
        broilerDaily: broilerDaily.data ?? [],
      }),
    [layers.data, layerDaily.data, layerHealth.data, settings.data, broilers.data, broilerDaily.data],
  );
  const s = summariseOperations(ops);

  if (!allowed) return null;
  if (layers.isLoading || broilers.isLoading) return null;

  const shown = expanded ? ops : ops.slice(0, VISIBLE);

  return (
    <section aria-labelledby="afo-title" className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="afo-title" className="inline-flex items-center gap-2 font-display text-lg font-semibold tracking-wide text-[color:var(--forest)]">
            <Activity className="h-5 w-5" /> ACTIVE FLOCK OPERATIONS
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Monitor ongoing brooding and rearing activities across your farm.</p>
        </div>
        <Link to="/rearing" className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--forest)] hover:underline">
          View All Operations <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Active batches" value={n(s.batches)} hint={`${n(s.liveBirds)} live birds`} />
        <Stat label="Active Brooding Batches" value={n(s.broodingBatches)} />
        <Stat label="Active Rearing Batches" value={n(s.rearingBatches)} />
        <Stat label="Total Birds in Brooding" value={n(s.broodingBirds)} />
        <Stat label="Total Birds in Rearing" value={n(s.rearingBirds)} />
        <Stat label="Upcoming Management Tasks" value={n(s.tasks)} />
      </dl>

      {ops.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          No brooding or rearing batches are active. Start one in{" "}
          <Link to="/rearing" className="font-medium text-[color:var(--forest)] underline">Layer Brooding & Rearing</Link> or{" "}
          <Link to="/broilers" className="font-medium text-[color:var(--forest)] underline">Broilers</Link>.
        </div>
      ) : (
        <>
          <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {shown.map((op) => (
              <li key={op.id}><OperationCard op={op} /></li>
            ))}
          </ul>
          {ops.length > VISIBLE && (
            <button onClick={() => setExpanded((v) => !v)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--forest)]">
              {expanded ? "Show fewer" : `Show all ${ops.length} operations`}
              <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
            </button>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Age is calculated daily from each batch's placement date. Reminders come only from your configured rearing schedule and saved records. Broiler brooding is read as the first 21 days.
          </p>
        </>
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-3">
      <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold leading-none">{value}</dd>
      {hint && <dd className="mt-1 text-[11px] text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function OperationCard({ op }: { op: ActiveOperation }) {
  const Icon = op.species === "layer" ? Baby : Drumstick;
  const attention = op.status === "Attention Required";
  const to = op.species === "layer" ? "/rearing" : "/broilers";
  return (
    <Link
      to={to}
      search={{ batch: op.id }}
      aria-label={`Open ${OPERATION_LABELS[op.kind]} batch ${op.name}`}
      className={cn(
        "group block h-full cursor-pointer rounded-2xl border bg-background p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        attention ? "border-destructive/40" : "border-border hover:border-[color:var(--forest)]/50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", op.species === "layer" ? "bg-[color:var(--forest)]/10 text-[color:var(--forest)]" : "bg-gold/20 text-foreground")}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{OPERATION_LABELS[op.kind]}</p>
            <p className="truncate font-semibold">{op.name}</p>
          </div>
        </div>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium", attention ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-[color:var(--forest)]/30 bg-[color:var(--forest)]/10 text-[color:var(--forest)]")}>
          {op.status}
        </span>
      </div>

      <p className="mt-3 text-lg font-semibold leading-tight">{op.ageText} <span className="text-sm font-normal text-muted-foreground">· {op.ageDays} days · {op.stageLabel}</span></p>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div><dt className="text-muted-foreground">Live birds</dt><dd className="font-medium">{n(op.liveBirds)} of {n(op.birdsPlaced)} stocked</dd></div>
        <div><dt className="text-muted-foreground">Category</dt><dd className="truncate font-medium">{op.category}</dd></div>
        <div className="flex items-center gap-1"><CalendarDays className="h-3 w-3 text-muted-foreground" /><dd>Placed {op.startDate}</dd></div>
        <div className="flex items-center gap-1 min-w-0"><MapPin className="h-3 w-3 shrink-0 text-muted-foreground" /><dd className="truncate">{op.location || "No house/room set"}</dd></div>
      </dl>
      {op.nextMilestone && <p className="mt-2 text-xs"><span className="text-muted-foreground">Next milestone: </span>{op.nextMilestone}</p>}

      {op.reminders.length > 0 && (
        <ul className="mt-2 space-y-1">
          {op.reminders.slice(0, 3).map((r, i) => (
            <li key={i} className={cn("flex items-start gap-1.5 text-xs", r.overdue ? "text-destructive" : "text-muted-foreground")}>
              {r.overdue ? <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> : <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current" />}
              {r.text}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--forest)]">
        View Details <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}
