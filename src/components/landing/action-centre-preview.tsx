import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ClipboardCheck,
  ShieldCheck,
  Wheat,
  Egg,
  HeartPulse,
  FileQuestion,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LANDING_ACTION_EXAMPLES } from "@/lib/landing-action-examples";
import { cn } from "@/lib/utils";

const icons = [Wheat, Egg, HeartPulse, FileQuestion];

export function ActionCentrePreview() {
  const [selected, setSelected] = useState(0);
  const item = LANDING_ACTION_EXAMPLES[selected] ?? LANDING_ACTION_EXAMPLES[0];

  return (
    <section
      id="action-centre"
      aria-labelledby="action-centre-heading"
      className="border-y border-border bg-secondary/40 py-14 md:py-20"
    >
      <div className="container-x">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              PoultryPro Action Centre
            </p>
            <h2
              id="action-centre-heading"
              className="mt-3 font-display text-3xl font-semibold leading-tight md:text-5xl"
            >
              Your Farm Data. Your Next Best Action.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              The Action Centre reviews available farm records, flags unusual patterns and presents
              practical next steps — with the evidence behind each recommendation. You decide what
              to do.
            </p>
          </div>
          <Button asChild variant="outline" className="h-11 w-fit rounded-full px-5">
            <Link to="/presentation">
              Explore the Live Demo <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <div
          className="mt-8 overflow-hidden rounded-lg border border-border bg-card shadow-soft"
          aria-label="Illustrative Action Centre"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-primary px-5 py-4 text-primary-foreground">
            <div className="flex items-center gap-3">
              <ClipboardCheck aria-hidden="true" className="h-5 w-5 text-gold" />
              <span className="font-semibold">Action Centre</span>
            </div>
            <span className="text-xs font-semibold tracking-wide text-primary-foreground">
              DEMO DATA · Illustrative examples
            </span>
          </div>
          <div className="grid md:grid-cols-[minmax(240px,0.85fr)_minmax(0,1.5fr)]">
            <div className="border-b border-border md:border-r md:border-b-0">
              <div className="px-5 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Issues requiring attention
              </div>
              <div
                className="p-2"
                role="tablist"
                aria-label="Example farm issues"
                aria-orientation="vertical"
              >
                {LANDING_ACTION_EXAMPLES.map((example, index) => {
                  const Icon = icons[index] ?? ClipboardCheck;
                  return (
                    <Button
                      key={example.id}
                      id={`example-tab-${example.id}`}
                      role="tab"
                      aria-selected={selected === index}
                      aria-controls="example-panel"
                      tabIndex={selected === index ? 0 : -1}
                      variant="ghost"
                      onClick={() => setSelected(index)}
                      onKeyDown={(event) => {
                        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                        event.preventDefault();
                        const next =
                          event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? LANDING_ACTION_EXAMPLES.length - 1
                              : (index +
                                  (event.key === "ArrowDown" ? 1 : -1) +
                                  LANDING_ACTION_EXAMPLES.length) %
                                LANDING_ACTION_EXAMPLES.length;
                        setSelected(next);
                        document
                          .getElementById(`example-tab-${LANDING_ACTION_EXAMPLES[next]?.id}`)
                          ?.focus();
                      }}
                      className={cn(
                        "h-auto min-h-16 w-full justify-start gap-3 whitespace-normal rounded-md px-3 py-3 text-left hover:bg-secondary",
                        selected === index && "bg-secondary text-foreground",
                      )}
                    >
                      <Icon aria-hidden="true" className="text-primary" />
                      <span className="min-w-0">
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {example.category}
                        </span>
                        <span className="block text-sm leading-snug">{example.title}</span>
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
            <div
              id="example-panel"
              role="tabpanel"
              aria-labelledby={`example-tab-${item.id}`}
              tabIndex={0}
              className="min-w-0 p-5 sm:p-7"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 font-semibold",
                    item.priority === "High"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-secondary text-foreground",
                  )}
                >
                  {item.priority} priority
                </span>
                <span className="text-muted-foreground">{item.status}</span>
              </div>
              <h3 className="mt-3 font-display text-2xl font-semibold">{item.title}</h3>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="font-semibold">Observed issue</dt>
                  <dd className="mt-1 text-muted-foreground">{item.issue}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Supporting evidence</dt>
                  <dd className="mt-1 text-muted-foreground">{item.evidence}</dd>
                </div>
                <div className="border-l-2 border-gold pl-4">
                  <dt className="font-semibold text-primary">Recommended action</dt>
                  <dd className="mt-1">{item.next}</dd>
                </div>
              </dl>
              <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
                {item.quality}
              </p>
              <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                In the Action Centre, authorised users can acknowledge, assign, start,
                resolve or dismiss an issue, with notes and action history, subject to farm
                permissions. The examples shown here are illustrative demo data.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-border bg-secondary/40 px-5 py-4 text-sm sm:flex-row sm:items-start sm:gap-4">
            <CalendarClock aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <span className="font-semibold">Upcoming task · Planning example</span>
              <p className="mt-1 text-muted-foreground">
                Stock count tomorrow: compare the physical count with the calculated 300 kg balance.
                Automatic operational-task reminders in the Action Centre are planned, not yet live.
              </p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Separate fictional scenarios, not customer records or a live farm. No example can be saved
          to your account. Recommendations depend on record quality; they do not diagnose disease or
          guarantee results.
        </p>
      </div>
    </section>
  );
}
