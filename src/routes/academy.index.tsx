import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { AcademyBrowser } from "@/components/academy/academy-browser";
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
            Short, practical tutorials that show you exactly how to manage your farm, record data and
            get more value from PoultryPro.
          </p>
        </div>
        <div className="mt-10">
          <AcademyBrowser searchPlaceholder="What do you want to learn?" />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
