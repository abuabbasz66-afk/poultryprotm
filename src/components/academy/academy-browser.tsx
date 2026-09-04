import { useMemo, useState } from "react";
import { Search, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { TutorialCard } from "@/components/academy/tutorial-card";
import {
  searchAcademy, useAcademyCategories, useAcademyProgress, useAcademyTutorials,
} from "@/lib/academy";

/**
 * Shared catalogue browser: search + category filter + responsive card grid.
 * Used by the public Academy page and the authenticated Help Centre so the two
 * can never drift apart.
 */
export function AcademyBrowser({
  searchPlaceholder = "Search tutorials…",
  showProgress = false,
}: {
  searchPlaceholder?: string;
  showProgress?: boolean;
}) {
  const { data: categories = [] } = useAcademyCategories();
  const { data: tutorials = [], isPending } = useAcademyTutorials();
  const { data: completed } = useAcademyProgress();

  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string>("all");

  const catName = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const visible = useMemo(() => {
    const byCat = active === "all" ? tutorials : tutorials.filter((t) => t.category_id === active);
    return searchAcademy(byCat, query);
  }, [tutorials, active, query]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Search tutorials"
          className="w-full rounded-full border border-border bg-card py-3 pl-11 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={active === "all"} onClick={() => setActive("all")}>
          All
        </FilterChip>
        {categories.map((c) => (
          <FilterChip key={c.id} active={active === c.id} onClick={() => setActive(c.id)}>
            {c.name}
          </FilterChip>
        ))}
      </div>

      {isPending ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl border border-border bg-muted/40" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No tutorial matches that search</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try another word, or browse a category above.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <TutorialCard
              key={t.id}
              tutorial={t}
              categoryName={catName.get(t.category_id)}
              completed={showProgress && !!completed?.has(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition",
        active
          ? "border-transparent bg-[color:var(--forest)] text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
