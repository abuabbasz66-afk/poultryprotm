import { useState } from "react";
import { Award, CalendarDays, MapPin, Share2, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RECOGNITIONS, shareLinks, type Recognition } from "@/lib/recognitions";

function AwardPhoto({ r, className = "" }: { r: Recognition; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Enlarge award photograph"
        className={`group relative block w-full overflow-hidden rounded-[1.75rem] bg-[color:var(--forest)] p-2 ring-1 ring-border shadow-[var(--shadow-lift)] transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
      >
        <img
          src={r.image.src}
          alt={r.image.alt}
          width={r.image.width}
          height={r.image.height}
          loading="lazy"
          decoding="async"
          className="aspect-[4/5] w-full rounded-[1.35rem] object-cover object-[50%_45%]"
        />
        <span className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground opacity-90 backdrop-blur transition-opacity group-hover:opacity-100">
          <ZoomIn className="h-3.5 w-3.5" /> View full photo
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(92vw,560px)] border-0 bg-background p-2 sm:p-3">
          <DialogTitle className="sr-only">{r.event} award</DialogTitle>
          <DialogDescription className="sr-only">{r.image.alt}</DialogDescription>
          <img
            src={r.image.src}
            alt={r.image.alt}
            width={r.image.width}
            height={r.image.height}
            className="max-h-[85vh] w-full rounded-xl object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ShareRow({ headline }: { headline: string }) {
  const l = shareLinks(headline);
  const cls =
    "inline-flex items-center rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold hover:bg-secondary transition-colors";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Share2 className="h-3.5 w-3.5" /> Share this milestone
      </span>
      <a className={cls} href={l.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>
      <a className={cls} href={l.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>
      <a className={cls} href={l.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>
    </div>
  );
}

export function InternationalRecognitionSection() {
  const r = RECOGNITIONS[0];
  if (!r) return null;
  const details: [string, string][] = [
    ["Event", r.event],
    ["Venue", r.venue],
    ["Date", r.date],
    ["Recognition", r.recognition],
    ["Founder", r.founder],
    ["Innovation", r.innovation],
  ];
  return (
    <section id="international-recognition" className="py-20 md:py-28 bg-secondary/40 border-y border-border">
      <div className="container-x grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5 hero-fade-up">
          <div className="mx-auto max-w-sm lg:max-w-none">
            <AwardPhoto r={r} />
          </div>
        </div>
        <div className="space-y-6 lg:col-span-7">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--forest)]">
            <Award className="h-3.5 w-3.5" /> International Recognition
          </span>
          <h2 className="font-display text-3xl md:text-5xl font-semibold leading-tight">
            Recognising Nigerian Innovation on the Global Stage
          </h2>
          <p className="max-w-2xl leading-relaxed text-muted-foreground">
            PoultryPro's innovation journey reached an important milestone at the {r.event} at {r.venue}. Our founder, {r.founder}, was recognised for transformative innovation, resilience and commitment to shaping a better future.
          </p>
          <dl className="grid gap-x-6 gap-y-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
            {details.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 text-sm font-medium leading-snug">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="border-l-2 border-primary pl-5">
            <p className="font-display text-xl font-semibold">Built in Nigeria. Recognised on the International Stage.</p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              PoultryPro is building digital tools that help poultry farmers manage farm operations, understand performance and make better-informed decisions. This milestone strengthens our commitment to advancing agricultural technology from Nigeria to the wider African market.
            </p>
          </div>
          <ShareRow headline={r.shareHeadline} />
        </div>
      </div>
    </section>
  );
}

/** Compact, reusable card (e.g. founder/About areas on dark backgrounds). */
export function RecognitionCard({ r = RECOGNITIONS[0] }: { r?: Recognition }) {
  if (!r) return null;
  return (
    <a
      href="#international-recognition"
      className="flex items-center gap-4 rounded-2xl border border-border/30 bg-background/10 p-3 pr-5 transition-colors hover:bg-background/15"
    >
      <img src={r.image.src} alt="" loading="lazy" width={64} height={80} className="h-20 w-16 flex-none rounded-xl object-cover" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70">International Recognition</div>
        <div className="mt-0.5 text-sm font-semibold leading-snug">{r.event}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs opacity-75">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.venue}</span>
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{r.date}</span>
        </div>
      </div>
    </a>
  );
}
