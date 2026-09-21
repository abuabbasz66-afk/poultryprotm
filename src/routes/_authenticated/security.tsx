import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { TwoFactorCard } from "@/components/security/two-factor-card";
import { SessionCard } from "@/components/security/session-card";

export const Route = createFileRoute("/_authenticated/security")({
  head: () => ({
    meta: [
      { title: "Account Security — PoultryPro" },
      { name: "description", content: "Turn on two-step sign-in, review the device you are signed in on and sign out of other devices." },
      { property: "og:title", content: "Account Security — PoultryPro" },
      { property: "og:description", content: "Two-step sign-in and device session controls for your PoultryPro account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-gradient-to-br from-[color:var(--forest)] to-[color:var(--ink)] text-primary-foreground">
        <div className="mx-auto max-w-4xl px-4 py-8 md:py-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
            <ShieldCheck className="h-3.5 w-3.5" /> Account
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold">Security</h1>
          <p className="mt-1 text-sm text-primary-foreground/80">
            Protect your account with a second step at sign-in and control where you are signed in.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <TwoFactorCard />
        <SessionCard />
      </main>
    </div>
  );
}
