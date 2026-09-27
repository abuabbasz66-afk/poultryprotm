import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import type { IntelAlert, IntelCategory, IntelSeverity } from "@/lib/intelligence/engine";
import type { AlertStatus } from "@/lib/intelligence/use-farm-intelligence";
import { cn } from "@/lib/utils";

export const INTEL_SEVERITY_META: Record<IntelSeverity, { label: string; dot: string; badge: string; ring: string }> = {
  normal: { label: "Normal", dot: "bg-emerald-500", badge: "bg-emerald-500/12 text-emerald-700 border-emerald-500/30", ring: "border-border" },
  watch: { label: "Watch", dot: "bg-yellow-400", badge: "bg-yellow-400/15 text-yellow-800 border-yellow-500/30", ring: "border-yellow-400/40" },
  warning: { label: "Warning", dot: "bg-amber-500", badge: "bg-amber-500/12 text-amber-700 border-amber-500/30", ring: "border-amber-400/50" },
  critical: { label: "Critical", dot: "bg-destructive", badge: "bg-destructive/12 text-destructive border-destructive/30", ring: "border-destructive/40" },
};

export const INTEL_CATEGORY_LABELS: Record<IntelCategory, string> = {
  production: "Production", mortality: "Mortality", feed: "Feed", health: "Health",
  weather: "Weather", finance: "Finance", inventory: "Inventory", operations: "Operations",
};

export function SeverityBadge({ severity }: { severity: IntelSeverity }) {
  const m = INTEL_SEVERITY_META[severity];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-px text-[10px] font-semibold uppercase tracking-wider", m.badge)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} /> {m.label}
    </span>
  );
}

/** Full "What happened / Why it matters / What to check" card. */
export function IntelAlertCard({
  alert, status, onAcknowledge, compact = false,
}: { alert: IntelAlert; status?: AlertStatus; onAcknowledge?: () => void; compact?: boolean }) {
  const m = INTEL_SEVERITY_META[alert.severity];
  return (
    <article className={cn("rounded-2xl border bg-card p-4", m.ring)}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={alert.severity} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {INTEL_CATEGORY_LABELS[alert.category]}{alert.room ? ` · ${alert.room}` : ""}
        </span>
        {status === "acknowledged" && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Check className="h-3 w-3" /> Seen</span>
        )}
      </div>
      <h3 className="mt-2 text-sm font-semibold text-foreground">{alert.title}</h3>
      {compact ? (
        <p className="mt-1 text-[13px] text-muted-foreground">{alert.happened}</p>
      ) : (
        <dl className="mt-2 space-y-2 text-[13px]">
          <div><dt className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">What happened</dt><dd className="text-foreground">{alert.happened}</dd></div>
          <div><dt className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Why it matters</dt><dd className="text-muted-foreground">{alert.why}</dd></div>
          {alert.checks.length > 0 && (
            <div>
              <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">What to check</dt>
              <dd><ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-muted-foreground">{alert.checks.map((c) => <li key={c}>{c}</li>)}</ul></dd>
            </div>
          )}
        </dl>
      )}
      {!compact && alert.figures.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {alert.figures.map((f) => (
            <span key={f.label} className="rounded-lg bg-secondary/60 px-2.5 py-1 text-[11.5px]">
              <span className="text-muted-foreground">{f.label}: </span><span className="font-semibold tabular-nums">{f.value}</span>
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          to={alert.action.to}
          search={alert.action.search as never}
          hash={alert.action.hash as never}
          className="inline-flex items-center gap-1 rounded-full bg-[color:var(--forest)] px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          {alert.action.label} <ArrowRight className="h-3 w-3" />
        </Link>
        {onAcknowledge && status !== "acknowledged" && (
          <button onClick={onAcknowledge} className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">
            Mark as seen
          </button>
        )}
      </div>
    </article>
  );
}
