import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Play, Search, Clock, GraduationCap, ArrowRight, Lock,
  LayoutDashboard, ClipboardList, Wheat, HeartPulse, Wallet, Brain, Sliders,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  TUTORIAL_CATEGORIES, FEATURED_TUTORIAL, getTutorials, categoryName,
  searchTutorials, type Tutorial, type TutorialCategoryId,
} from "@/lib/tutorials";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<TutorialCategoryId, typeof Play> = {
  "getting-started": LayoutDashboard,
  "daily-records": ClipboardList,
  feed: Wheat,
  health: HeartPulse,
  finance: Wallet,
  "analytics-ai": Brain,
  advanced: Sliders,
};

const DIFFICULTY_CLASS: Record<Tutorial["difficulty"], string> = {
  Beginner: "bg-primary/10 text-primary",
  Intermediate: "bg-[color:var(--gold)]/25 text-[color:var(--ink)]",
  Advanced: "bg-secondary text-secondary-foreground",
};

function Thumbnail({ tutorial, large = false }: { tutorial: Tutorial; large?: boolean }) {
  const Icon = CATEGORY_ICON[tutorial.category] ?? Play;
  if (tutorial.thumbnail_url) {
    return (
      <img
        src={tutorial.thumbnail_url}
        alt={`${tutorial.title} tutorial thumbnail`}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-[color:var(--forest)]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[color:var(--gold)]/25 blur-3xl" />
      <Icon
        aria-hidden="true"
        className={cn("relative text-primary-foreground/80", large ? "h-16 w-16" : "h-10 w-10")}
      />
    </div>
  );
}

function PlayBadge({ large = false }: { large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-[color:var(--gold)] text-[color:var(--ink)] shadow-lg transition-transform duration-200 group-hover:scale-105",
        large ? "h-16 w-16" : "h-12 w-12",
      )}
    >
      <Play className={large ? "h-7 w-7 fill-current" : "h-5 w-5 fill-current"} />
    </span>
  );
}

function ComingSoonPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
      <Clock className="h-3 w-3" aria-hidden="true" /> Coming soon
    </span>
  );
}

function TutorialCard({ tutorial, onOpen }: { tutorial: Tutorial; onOpen: (t: Tutorial) => void }) {
  const available = tutorial.is_published && !!tutorial.video_url;
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-within:-translate-y-1">
      <button
        type="button"
        onClick={() => onOpen(tutorial)}
        aria-label={
          available
            ? `Play tutorial: ${tutorial.title}`
            : `${tutorial.title} — tutorial coming soon`
        }
        className="relative block aspect-video w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Thumbnail tutorial={tutorial} />
        <span className="absolute inset-0 flex items-center justify-center bg-black/10">
          {available ? <PlayBadge /> : <ComingSoonPill />}
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
            {categoryName(tutorial.category)}
          </span>
          <span className={cn("rounded-full px-2.5 py-1 font-medium", DIFFICULTY_CLASS[tutorial.difficulty])}>
            {tutorial.difficulty}
          </span>
        </div>
        <h3 className="font-display text-lg font-semibold leading-snug">{tutorial.title}</h3>
        <p className="text-sm text-muted-foreground">{tutorial.description}</p>
        <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{tutorial.duration ?? "Duration to be announced"}</span>
        </div>
      </div>
    </article>
  );
}

export function LearningCenter() {
  const all = useMemo(() => getTutorials(), []);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<"all" | TutorialCategoryId>("all");
  const [selected, setSelected] = useState<Tutorial | null>(null);

  const visible = useMemo(() => {
    const byCategory = active === "all" ? all : all.filter((t) => t.category === active);
    return searchTutorials(byCategory, query);
  }, [all, active, query]);

  const featuredAvailable = FEATURED_TUTORIAL.is_published && !!FEATURED_TUTORIAL.video_url;
  const selectedAvailable = !!selected?.is_published && !!selected?.video_url;

  return (
    <section id="learn" className="scroll-mt-20 py-20 md:py-24 bg-secondary/40 border-y border-border">
      <div className="container-x">
        <header className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" /> PoultryPro Learning Center
          </span>
          <h2 className="section-heading mt-5 font-display font-semibold">Learn PoultryPro in Minutes</h2>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            Short, practical videos showing you how to use every part of PoultryPro, from recording
            farm data to understanding your farm&apos;s performance.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Not sure how to use PoultryPro? We&apos;ve got you covered — watch short tutorials and
            learn every feature step by step. Free to watch, no account required.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="#tutorial-library"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary/90 hover:-translate-y-0.5"
            >
              Start Learning <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold transition-colors duration-200 hover:bg-secondary"
            >
              Create Your Farm
            </Link>
          </div>
        </header>

        {/* Featured tutorial */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="grid lg:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelected(FEATURED_TUTORIAL)}
              aria-label={
                featuredAvailable
                  ? `Play featured tutorial: ${FEATURED_TUTORIAL.title}`
                  : `${FEATURED_TUTORIAL.title} — coming soon`
              }
              className="relative aspect-video w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <Thumbnail tutorial={FEATURED_TUTORIAL} large />
              <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                {featuredAvailable ? <PlayBadge large /> : <ComingSoonPill />}
              </span>
            </button>
            <div className="flex flex-col justify-center gap-3 p-7 md:p-10">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Featured</span>
              <h3 className="font-display text-2xl font-semibold md:text-3xl">
                {FEATURED_TUTORIAL.title}
              </h3>
              <p className="text-muted-foreground">{FEATURED_TUTORIAL.description}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                  {categoryName(FEATURED_TUTORIAL.category)}
                </span>
                <span className={cn("rounded-full px-2.5 py-1 font-medium", DIFFICULTY_CLASS[FEATURED_TUTORIAL.difficulty])}>
                  {FEATURED_TUTORIAL.difficulty}
                </span>
                {!featuredAvailable && (
                  <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
                    Coming Soon
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search + filters */}
        <div id="tutorial-library" className="mt-12 scroll-mt-24">
          <div className="flex flex-col gap-4">
            <div className="relative w-full md:max-w-md">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <label htmlFor="tutorial-search" className="sr-only">
                Search tutorials
              </label>
              <input
                id="tutorial-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tutorials..."
                className="w-full rounded-full border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div
              role="group"
              aria-label="Filter tutorials by category"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
            >
              {[{ id: "all" as const, label: "All" }, ...TUTORIAL_CATEGORIES].map((c) => {
                const isActive = active === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActive(c.id)}
                    className={cn(
                      "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid */}
          {visible.length === 0 ? (
            <p className="mt-10 rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No tutorials match &ldquo;{query}&rdquo;. Try another feature name such as feed,
              mortality, vaccination or finance.
            </p>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((t) => (
                <TutorialCard key={t.id} tutorial={t} onOpen={setSelected} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Player modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
          {selected && (
            <>
              <div className="aspect-video w-full bg-black">
                {selectedAvailable ? (
                  <video
                    key={selected.id}
                    src={selected.video_url ?? undefined}
                    poster={selected.thumbnail_url ?? undefined}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-full w-full"
                    aria-label={`${selected.title} tutorial video`}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[color:var(--forest)] text-primary-foreground">
                    <Lock className="h-8 w-8 opacity-80" aria-hidden="true" />
                    <p className="text-sm font-semibold">Tutorial coming soon</p>
                    <p className="max-w-sm px-6 text-center text-xs text-primary-foreground/75">
                      This tutorial is being produced. Create your farm account and you&apos;ll be
                      able to watch it here as soon as it&apos;s published.
                    </p>
                  </div>
                )}
              </div>
              <DialogHeader className="space-y-2 p-6 text-left">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                    {categoryName(selected.category)}
                  </span>
                  <span className={cn("rounded-full px-2.5 py-1 font-medium", DIFFICULTY_CLASS[selected.difficulty])}>
                    {selected.difficulty}
                  </span>
                  {selected.duration && (
                    <span className="text-muted-foreground">{selected.duration}</span>
                  )}
                </div>
                <DialogTitle className="font-display text-xl">{selected.title}</DialogTitle>
                <DialogDescription>{selected.description}</DialogDescription>
              </DialogHeader>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
