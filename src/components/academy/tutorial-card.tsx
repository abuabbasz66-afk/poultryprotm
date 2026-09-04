import { Link } from "@tanstack/react-router";
import { Clock, Play, CheckCircle2, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, type AcademyTutorial, type AcademyDifficulty } from "@/lib/academy";

export const DIFFICULTY_CLASS: Record<AcademyDifficulty, string> = {
  Beginner: "bg-primary/10 text-primary",
  Intermediate: "bg-[color:var(--gold)]/25 text-[color:var(--ink)]",
  Advanced: "bg-secondary text-secondary-foreground",
};

function Thumbnail({ tutorial }: { tutorial: AcademyTutorial }) {
  if (tutorial.thumbnail_url) {
    return (
      <img
        src={tutorial.thumbnail_url}
        alt={`${tutorial.title} tutorial thumbnail`}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-[color:var(--forest)]">
      <GraduationCap aria-hidden="true" className="h-10 w-10 text-primary-foreground/80" />
    </div>
  );
}

export function TutorialCard({
  tutorial,
  categoryName,
  completed = false,
}: {
  tutorial: AcademyTutorial;
  categoryName?: string;
  completed?: boolean;
}) {
  const duration = formatDuration(tutorial.duration_seconds);
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:-translate-y-0.5">
      <Link
        to="/academy/$slug"
        params={{ slug: tutorial.slug }}
        aria-label={`Play tutorial: ${tutorial.title}`}
        className="relative block aspect-video w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Thumbnail tutorial={tutorial} />
        <span className="absolute inset-0 flex items-center justify-center bg-black/10">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--gold)] text-[color:var(--ink)] shadow-lg transition-transform duration-200 group-hover:scale-105">
            <Play className="h-5 w-5 fill-current" />
          </span>
        </span>
        {completed && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-xs font-semibold text-primary shadow-sm">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {categoryName && (
            <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
              {categoryName}
            </span>
          )}
          <span className={cn("rounded-full px-2.5 py-1 font-medium", DIFFICULTY_CLASS[tutorial.difficulty])}>
            {tutorial.difficulty}
          </span>
        </div>
        <h3 className="font-display text-base font-semibold leading-snug sm:text-lg">
          <Link to="/academy/$slug" params={{ slug: tutorial.slug }} className="hover:underline">
            {tutorial.title}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground">{tutorial.description}</p>
        {duration && (
          <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{duration}</span>
          </div>
        )}
      </div>
    </article>
  );
}
