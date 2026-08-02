import { ShieldAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";

/**
 * Rendered wherever a signed-in user reaches a module their role does not
 * include. Never leaks what the page would have contained.
 */
export function PermissionDenied({ hint }: { hint?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-lift)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="mt-5 font-display text-xl font-semibold text-foreground">
          You do not have permission to access this page.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {hint ?? "Ask your Farm Owner if you need access to this module."}
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-[color:var(--forest)] px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Back to my dashboard
        </Link>
      </div>
    </div>
  );
}

/** Small inline role chip used in headers, tables and the sidebar. */
export function RoleBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide " +
        (className ?? "bg-muted text-muted-foreground border-border")
      }
    >
      {label}
    </span>
  );
}
