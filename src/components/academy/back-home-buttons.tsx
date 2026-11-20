import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Home } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Back / Home controls for the public Academy pages.
 *
 * Back steps through the browser history and is only offered when there is a
 * previous page to return to (a direct visit to Academy has none). Home always
 * goes to the site homepage.
 */
export function AcademyBackHome({
  compact = false,
  className,
}: {
  /** Icon-only buttons, for the slim public header. */
  compact?: boolean;
  className?: string;
}) {
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // TanStack Router keeps its own position in history.state.__TSR_index, so a
    // direct visit (index 0) has no earlier page even though the browser's
    // history.length is already above 1.
    const index = (window.history.state as { __TSR_index?: number } | null)?.__TSR_index;
    setCanGoBack(typeof index === "number" ? index > 0 : window.history.length > 1);
  }, []);

  const control = cn(
    "inline-flex items-center gap-1.5 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground",
    compact ? "h-9 w-9 justify-center" : "px-4 py-2",
  );

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {canGoBack && (
        <button
          type="button"
          onClick={() => window.history.back()}
          aria-label="Back to the previous page"
          title="Back"
          className={control}
        >
          <ArrowLeft className="h-4 w-4 flex-none" />
          {!compact && <span>Back</span>}
        </button>
      )}
      <Link
        to="/"
        aria-label="Go to the PoultryPro homepage"
        title="Home"
        className={control}
      >
        <Home className="h-4 w-4 flex-none" />
        {!compact && <span>Home</span>}
      </Link>
    </div>
  );
}
