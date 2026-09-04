import { Link } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Subtle contextual help affordance. Deep-links to a specific Academy tutorial
 * (by slug) or to the Help Centre when no slug is given.
 */
export function HelpHint({
  slug,
  label,
  className,
}: {
  slug?: string;
  label: string;
  className?: string;
}) {
  const classes = cn(
    "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground",
    className,
  );
  if (slug) {
    return (
      <Link to="/academy/$slug" params={{ slug }} className={classes} title={label}>
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <Link to="/help" className={classes} title={label}>
      <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
