import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Circle, Clock, GraduationCap, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { AcademyPublicHeader } from "@/components/academy/public-header";
import { SiteFooter } from "@/components/site-footer";
import { TutorialCard } from "@/components/academy/tutorial-card";
import { DIFFICULTY_CLASS } from "@/components/academy/tutorial-card";
import { useAuthUserId } from "@/lib/farm-data";
import {
  formatDuration, trackTutorialView, useAcademyCategories, useAcademyProgress,
  useAcademyTutorial, useAcademyTutorials, useSetTutorialCompletion,
} from "@/lib/academy";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/academy/$slug")({
  head: ({ params }) => {
    const title = `PoultryPro Academy Tutorial | ${params.slug.replace(/-/g, " ")}`;
    const desc =
      "Watch this short PoultryPro tutorial and learn how to manage your poultry farm records step by step.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "video.other" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: TutorialPlayerPage,
});

function TutorialPlayerPage() {
  const { slug } = Route.useParams();
  const { data: tutorial, isPending } = useAcademyTutorial(slug);
  const { data: all = [] } = useAcademyTutorials();
  const { data: categories = [] } = useAcademyCategories();
  const { data: userId } = useAuthUserId();
  const { data: completedSet } = useAcademyProgress();
  const setCompletion = useSetTutorialCompletion();

  const category = categories.find((c) => c.id === tutorial?.category_id);
  const ordered = useMemo(
    () => [...all].sort((a, b) => a.category_id.localeCompare(b.category_id) || a.sort_order - b.sort_order),
    [all],
  );
  const index = ordered.findIndex((t) => t.slug === slug);
  const prev = index > 0 ? ordered[index - 1] : null;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;
  const related = useMemo(
    () => all.filter((t) => t.category_id === tutorial?.category_id && t.slug !== slug).slice(0, 3),
    [all, tutorial, slug],
  );

  useEffect(() => {
    if (tutorial?.id && userId) void trackTutorialView(tutorial.id, userId);
  }, [tutorial?.id, userId]);

  const completed = !!(tutorial && completedSet?.has(tutorial.id));
  const duration = formatDuration(tutorial?.duration_seconds);

  return (
    <div className="min-h-screen bg-background">
      <AcademyPublicHeader />
      <main className="container-x py-8 md:py-12">
        <Link
          to="/academy"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All tutorials
        </Link>

        {isPending ? (
          <div className="mt-8 flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !tutorial ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
            <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">This tutorial is not available</p>
            <p className="mt-1 text-sm text-muted-foreground">
              It may have been unpublished. Browse the Academy for available tutorials.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="overflow-hidden rounded-2xl border border-border bg-black">
                {tutorial.video_url ? (
                  <video
                    key={tutorial.video_url}
                    src={tutorial.video_url}
                    poster={tutorial.thumbnail_url ?? undefined}
                    controls
                    preload="metadata"
                    playsInline
                    className="aspect-video w-full"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center text-sm text-primary-foreground/70">
                    Video coming soon
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
                {category && (
                  <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                    {category.name}
                  </span>
                )}
                <span className={cn("rounded-full px-2.5 py-1 font-medium", DIFFICULTY_CLASS[tutorial.difficulty])}>
                  {tutorial.difficulty}
                </span>
                {duration && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> {duration}
                  </span>
                )}
              </div>

              <h1 className="mt-3 font-display text-2xl font-semibold md:text-3xl">{tutorial.title}</h1>
              <p className="mt-2 text-muted-foreground">{tutorial.description}</p>

              {userId && (
                <button
                  type="button"
                  disabled={setCompletion.isPending}
                  onClick={() =>
                    setCompletion.mutate(
                      { tutorialId: tutorial.id, completed: !completed },
                      {
                        onSuccess: () =>
                          toast.success(completed ? "Marked as not complete" : "Tutorial completed"),
                        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
                      },
                    )
                  }
                  className={cn(
                    "mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition",
                    completed
                      ? "bg-primary/10 text-primary"
                      : "bg-[color:var(--forest)] text-primary-foreground hover:brightness-110",
                  )}
                >
                  {completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  {completed ? "Completed" : "Mark as Complete"}
                </button>
              )}

              <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
                {prev ? (
                  <Link
                    to="/academy/$slug"
                    params={{ slug: prev.slug }}
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm hover:bg-secondary"
                  >
                    <ArrowLeft className="h-4 w-4 flex-none" />
                    <span className="text-left">
                      <span className="block text-xs text-muted-foreground">Previous</span>
                      {prev.title}
                    </span>
                  </Link>
                ) : <span />}
                {next && (
                  <Link
                    to="/academy/$slug"
                    params={{ slug: next.slug }}
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm hover:bg-secondary sm:text-right"
                  >
                    <span>
                      <span className="block text-xs text-muted-foreground">Next</span>
                      {next.title}
                    </span>
                    <ArrowRight className="h-4 w-4 flex-none" />
                  </Link>
                )}
              </div>
            </div>

            <aside className="lg:col-span-4">
              <h2 className="font-display text-lg font-semibold">Related tutorials</h2>
              <div className="mt-4 grid gap-4">
                {related.map((t) => (
                  <TutorialCard key={t.id} tutorial={t} categoryName={category?.name} />
                ))}
                {related.length === 0 && (
                  <p className="text-sm text-muted-foreground">No related tutorials yet.</p>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
