import { Link } from "@tanstack/react-router";
import { ArrowRight, GraduationCap } from "lucide-react";
import { useMemo } from "react";
import { TutorialCard } from "@/components/academy/tutorial-card";
import { useAcademyCategories, useAcademyTutorials } from "@/lib/academy";

/**
 * Public "PoultryPro Academy" section for the landing page.
 * Loads a small slice of the catalogue so the marketing page stays fast.
 */
export function AcademySection() {
  const { data: categories = [] } = useAcademyCategories();
  const { data: tutorials = [] } = useAcademyTutorials({ limit: 12 });

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const shown = useMemo(() => {
    const featured = tutorials.filter((t) => t.is_featured);
    const rest = tutorials.filter((t) => !t.is_featured);
    return [...featured, ...rest].slice(0, 6);
  }, [tutorials]);

  return (
    <section id="academy" className="py-20 md:py-28">
      <div className="container-x">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" /> Academy
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight md:text-5xl">
              PoultryPro Academy
            </h2>
            <p className="mt-2 text-lg font-medium text-[color:var(--gold)]">
              Learn PoultryPro in minutes.
            </p>
            <p className="mt-3 text-muted-foreground md:text-lg">
              Short, practical tutorials that show you exactly how to manage your farm, record data
              and get more value from PoultryPro.
            </p>
          </div>
          <Link
            to="/academy"
            className="inline-flex flex-none items-center gap-2 self-start rounded-full bg-[color:var(--forest)] px-6 py-3 font-semibold text-primary-foreground transition hover:brightness-110 md:self-auto"
          >
            View All Tutorials <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {shown.length > 0 && (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((t) => (
              <TutorialCard key={t.id} tutorial={t} categoryName={catName.get(t.category_id)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
