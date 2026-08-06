import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

const TITLE = "Terms of Service — PoultryPro™";
const DESC =
  "The terms governing your use of PoultryPro: accounts and staff roles, subscriptions and billing, acceptable use, data ownership, availability and liability.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://poultrypro.life/terms" },
    ],
    links: [{ rel: "canonical", href: "https://poultrypro.life/terms" }],
  }),
  component: TermsPage,
});

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold tracking-tight">{heading}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function TermsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="container-x flex items-center justify-between py-4">
          <Link to="/" className="font-bold tracking-tight">PoultryPro™</Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Create free account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <article className="container-x max-w-3xl py-12 sm:py-16">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--forest)] font-semibold">Legal</div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: 6 August 2026</p>

          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            These terms form an agreement between you and Greenfield Contracts &amp; Agro Limited
            ("PoultryPro", "we") covering your use of the PoultryPro™ platform. By creating an account you
            accept them.
          </p>

          <Section heading="1. Your account">
            <p>You must give accurate registration details and keep your password confidential. You are responsible for everything done under your account and under the staff accounts you invite.</p>
            <p>Farm owners control roles and permissions for their staff. Removing a staff member immediately ends their access to that farm.</p>
          </Section>

          <Section heading="2. Subscriptions and billing">
            <p>PoultryPro offers a free Basic plan and paid Standard and Premium plans, billed monthly in Nigerian Naira through our payment processor. New farms may receive a trial period; when it ends the account continues on the Basic plan unless you subscribe.</p>
            <p>Subscriptions renew automatically until cancelled. You may cancel at any time and keep access until the end of the paid period. Except where the law requires otherwise, payments already made are non-refundable. We may change prices with at least 30 days' notice.</p>
          </Section>

          <Section heading="3. Acceptable use">
            <p>Do not use PoultryPro to break the law, upload malicious code, attempt to access another farm's data, reverse engineer the platform, resell access, or place excessive automated load on the service. We may suspend accounts that do.</p>
          </Section>

          <Section heading="4. Your data">
            <p>You own the farm records you enter. You grant us the limited licence needed to store, process and display that data to you and to run the analytics and AI features you use. We may use aggregated, de-identified statistics that cannot identify you or your farm to improve the product.</p>
            <p>You can export your records at any time. See our <Link to="/privacy" className="text-primary underline">Privacy Policy</Link> for how we handle your data.</p>
          </Section>

          <Section heading="5. Insights are guidance, not advice">
            <p>Analytics, forecasts and AI insights are generated from the records you enter and may be incomplete or wrong. They are decision support only, not veterinary, financial or legal advice. Always confirm important decisions with a qualified professional.</p>
          </Section>

          <Section heading="6. Availability">
            <p>We work to keep PoultryPro available and to sync offline records reliably, but we do not guarantee uninterrupted service. Maintenance, provider outages or connectivity problems may interrupt access.</p>
          </Section>

          <Section heading="7. Liability">
            <p>To the maximum extent permitted by law, PoultryPro is provided "as is", and our total liability for any claim relating to the service is limited to the subscription fees you paid in the 12 months before the claim. We are not liable for lost profits, lost livestock or indirect losses.</p>
          </Section>

          <Section heading="8. Suspension and termination">
            <p>You may close your account at any time. We may suspend or terminate an account that breaches these terms or that is used unlawfully, and will give notice where we reasonably can.</p>
          </Section>

          <Section heading="9. Changes and governing law">
            <p>We may update these terms; material changes will be announced in the app before taking effect. These terms are governed by the laws of the Federal Republic of Nigeria.</p>
          </Section>

          <Section heading="10. Contact">
            <p>
              <a className="text-primary underline" href="mailto:greenfieldcontractsagroltd@gmail.com">
                greenfieldcontractsagroltd@gmail.com
              </a>
            </p>
          </Section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
