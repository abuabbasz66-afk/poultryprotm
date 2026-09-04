import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { GraduationCap, Sparkles, Clock3, ArrowRight } from "lucide-react";
import { AcademyBrowser } from "@/components/academy/academy-browser";
import { TutorialCard } from "@/components/academy/tutorial-card";
import { useAcademyCategories, useAcademyProgress, useAcademyTutorials } from "@/lib/academy";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({
    meta: [
      { title: "Help Centre — PoultryPro Academy" },
      {
        name: "description",
        content:
          "Search PoultryPro tutorials, browse categories and learn how to record production, feed, health, mortality and farm finance.",
      },
      { property: "og:title", content: "Help Centre — PoultryPro Academy" },
      {
        property: "og:description",
        content: "Search and watch short PoultryPro tutorials from inside your farm dashboard.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HelpCentre,
});

function HelpCentre() {
  const { data: tutorials = [] } = useAcademyTutorials();
  const { data: categories = [] } = useAcademyCategories();
  const { data: completed } = useAcademyProgress();

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const featured = tutorials.filter((t) => t.is_featured).slice(0, 3);
  const recent = useMemo(
    () =>
      [...tutorials]
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 3),
    [tutorials],
  );
  const gettingStartedId = categories.find((c) => c.slug === "getting-started")?.id;
  const gettingStarted = tutorials.filter((t) => t.category_id === gettingStartedId).slice(0, 3);
  // Recommended = what this user has not completed yet, easiest first.
  const recommended = useMemo(
    () =>
      tutorials
        .filter((t) => !completed?.has(t.id))
        .sort((a, b) => a.sort_order - b.sort_order)
        .slice(0, 3),
    [tutorials, completed],
  );

  return (
    <div className="space-y-10 pb-12">
      <header className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] md:p-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-secondary-foreground">
          <GraduationCap className="h-3.5 w-3.5" /> PoultryPro Academy
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold md:text-3xl">Help Centre</h1>
        <p className="mt-2 text-muted-foreground">
          What do you want to learn? Search a topic or browse a category below.
        </p>
        <Link
          to="/academy"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          Open the full Academy <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <Shelf title="Recommended for you" icon={Sparkles} items={recommended} catName={catName} completed={completed} />
      <Shelf title="Featured" icon={GraduationCap} items={featured} catName={catName} completed={completed} />
      <Shelf title="Getting started" icon={GraduationCap} items={gettingStarted} catName={catName} completed={completed} />
      <Shelf title="Recently added" icon={Clock3} items={recent} catName={catName} completed={completed} />

      <section className="space-y-5">
        <h2 className="font-display text-xl font-semibold">Browse all tutorials</h2>
        <AcademyBrowser searchPlaceholder="What do you want to learn?" showProgress />
      </section>
    </div>
  );
}

function Shelf({
  title, icon: Icon, items, catName, completed,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: ReturnType<typeof useAcademyTutorials>["data"];
  catName: Map<string, string>;
  completed: Set<string> | undefined;
}) {
  if (!items || items.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
        <Icon className="h-5 w-5 text-muted-foreground" /> {title}
      </h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => (
          <TutorialCard
            key={t.id}
            tutorial={t}
            categoryName={catName.get(t.category_id)}
            completed={!!completed?.has(t.id)}
          />
        ))}
      </div>
    </section>
  );
}
