import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { AcademyBrowser } from "@/components/academy/academy-browser";
import { TutorialCard } from "@/components/academy/tutorial-card";
import { useAcademyCategories, useAcademyTutorials } from "@/lib/academy";
import { AcademyPublicHeader } from "@/components/academy/public-header";
import { SiteFooter } from "@/components/site-footer";

const TITLE = "PoultryPro Academy | Poultry Farm Management Tutorials";
const DESC =
  "Short, practical PoultryPro tutorials on farm setup, egg production records, feed management, poultry health, mortality, farm finance and analytics.";

export const Route = createFileRoute("/academy/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://poultrypro.life/academy" }],
  }),
  component: AcademyIndex,
});

function AcademyIndex() {
  const { data: tutorials = [] } = useAcademyTutorials();
  const { data: categories = [] } = useAcademyCategories();
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const featured = tutorials.filter((tutorial) => tutorial.is_featured);
  return (
    <div className="min-h-screen bg-background">
      <AcademyPublicHeader />
      <main className="container-x py-12 md:py-16">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5" /> Academy
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold md:text-5xl">PoultryPro Academy</h1>
          <p className="mt-2 text-lg font-medium text-[color:var(--gold)]">
            Learn PoultryPro in minutes.
          </p>
          <p className="mt-3 text-muted-foreground">
             Short, practical tutorials that help you manage your farm, record data and
            get more value from PoultryPro.
          </p>
        </div>
        {featured.length > 0 && (
          <section className="mt-10" aria-labelledby="featured-tutorials">
            <h2 id="featured-tutorials" className="font-display text-2xl font-semibold">Featured Tutorials</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((tutorial) => <TutorialCard key={tutorial.id} tutorial={tutorial} categoryName={categoryNames.get(tutorial.category_id)} />)}
            </div>
          </section>
        )}
        <div className="mt-10">
          <h2 className="mb-5 font-display text-2xl font-semibold">Browse Academy</h2>
          <AcademyBrowser searchPlaceholder="What do you want to learn?" />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
