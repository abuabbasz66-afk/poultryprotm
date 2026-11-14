import { Check, ExternalLink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWhatsAppCommunity } from "@/lib/whatsapp-community";

export function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.03 3C8.84 3 3 8.84 3 16.03c0 2.3.6 4.55 1.75 6.53L3 29l6.6-1.73a13.02 13.02 0 0 0 6.43 1.68h.01c7.18 0 13.03-5.84 13.03-13.03C29.07 8.84 23.22 3 16.03 3Zm0 23.75h-.01a10.8 10.8 0 0 1-5.5-1.51l-.4-.24-3.92 1.03 1.05-3.82-.26-.39a10.77 10.77 0 0 1-1.66-5.79C5.33 10.1 10.13 5.3 16.03 5.3c2.88 0 5.59 1.12 7.62 3.16a10.72 10.72 0 0 1 3.15 7.62c0 5.9-4.87 10.67-10.77 10.67Zm5.91-8.02c-.32-.16-1.92-.95-2.22-1.06-.3-.1-.51-.16-.73.16-.22.32-.84 1.06-1.03 1.28-.19.21-.38.24-.7.08-.33-.16-1.38-.51-2.63-1.62a9.86 9.86 0 0 1-1.82-2.26c-.19-.33-.02-.5.14-.67.15-.14.33-.38.49-.57.16-.19.22-.33.32-.54.11-.22.06-.41-.02-.57-.08-.16-.73-1.76-1-2.41-.26-.63-.53-.55-.73-.56h-.62c-.22 0-.57.08-.87.41-.3.32-1.14 1.12-1.14 2.73 0 1.62 1.17 3.18 1.33 3.4.16.22 2.3 3.51 5.57 4.92.78.34 1.39.54 1.86.69.78.25 1.5.21 2.06.13.63-.1 1.92-.79 2.19-1.54.27-.76.27-1.41.19-1.54-.08-.14-.3-.22-.62-.38Z" />
    </svg>
  );
}

const DASHBOARD_MESSAGE = "Stay connected with PoultryPro! Join our official WhatsApp community to receive platform updates, learn about new features, get important announcements, share experiences and receive prompt assistance from our support team.";
const PUBLIC_MESSAGE = "Be part of a growing community of poultry farmers using technology to improve their farm operations. Connect with fellow farmers, receive important PoultryPro announcements, discover new features, learn how to use the platform and get assistance from our support team.";
const BENEFITS = [
  "Get updates about new PoultryPro features and improvements.",
  "Receive important platform announcements.",
  "Get guidance on using PoultryPro effectively.",
  "Ask questions and receive support from the PoultryPro team.",
  "Connect and share experiences with other poultry farmers.",
  "Learn about training sessions, demonstrations and community activities.",
];

type Props = {
  variant?: "dashboard" | "onboarding" | "public";
  heading?: string;
  message?: string;
};

export function WhatsAppCommunityInvitation({ variant = "dashboard", heading, message }: Props) {
  const community = useWhatsAppCommunity();
  const config = community.data ?? { enabled: false, url: null };
  const isPublic = variant === "public";
  const isOnboarding = variant === "onboarding";
  const title = heading ?? (isPublic ? "Join the PoultryPro Farmers Community!" : "Join the PoultryPro Farmers Community");
  const body = message ?? (isPublic ? PUBLIC_MESSAGE : DASHBOARD_MESSAGE);
  const buttonLabel = isPublic ? "Join Our WhatsApp Community" : "Join WhatsApp Group";

  const action = config.enabled && config.url ? (
    <Button asChild size="lg" className="min-h-12 w-full rounded-full bg-gold px-6 text-ink hover:bg-gold/90 sm:w-auto">
      <a href={config.url} target="_blank" rel="noopener noreferrer">
        <WhatsAppIcon /> {buttonLabel} <ExternalLink aria-hidden="true" />
      </a>
    </Button>
  ) : (
    <Button size="lg" disabled className="min-h-12 w-full rounded-full px-6 sm:w-auto" title="The official invitation link has not been configured yet">
      <WhatsAppIcon /> {buttonLabel}
    </Button>
  );

  if (isPublic) {
    return (
      <section id="community" aria-labelledby="community-heading" className="scroll-mt-24 border-t border-border bg-secondary/40 py-20 md:py-24">
        <div className="container-x grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lift">
              <WhatsAppIcon className="h-8 w-8" />
            </span>
            <span className="mt-6 block text-xs font-medium uppercase tracking-[0.2em] text-primary">Official farmer community</span>
            <h2 id="community-heading" className="mt-3 font-display text-3xl font-semibold leading-tight md:text-5xl">{title}</h2>
            <p className="mt-5 max-w-2xl leading-relaxed text-muted-foreground">{body}</p>
            <div className="mt-7">{action}</div>
            {!community.isPending && !config.enabled && (
              <p role="status" className="mt-3 text-sm text-muted-foreground">The official invitation link is being set up. Please check back soon.</p>
            )}
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-sm leading-relaxed text-muted-foreground">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="WhatsApp farmers community" className={`rounded-2xl border border-primary/20 bg-card ${isOnboarding ? "p-5" : "p-5 sm:p-6"}`}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <WhatsAppIcon className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold leading-tight">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{body}</p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> Free for every registered farmer</div>
          </div>
        </div>
        <div className="shrink-0 sm:max-w-xs">
          {action}
          {!community.isPending && !config.enabled && (
            <p role="status" className="mt-2 text-xs leading-relaxed text-muted-foreground">Invitation link coming soon.</p>
          )}
        </div>
      </div>
    </section>
  );
}
