import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

const TITLE = "Privacy Policy — PoultryPro™";
const DESC =
  "How PoultryPro collects, stores, secures and shares your poultry farm data, including encryption, tenant isolation, retention periods and your data rights.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://poultrypro.life/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://poultrypro.life/privacy" }],
  }),
  component: PrivacyPage,
});

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold tracking-tight">{heading}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPage() {
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
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: 6 August 2026</p>

          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            PoultryPro™ is a farm management platform operated by Greenfield Contracts &amp; Agro Limited
            (Nigeria). This policy explains what information we collect when you use PoultryPro, why we
            collect it, how we protect it, and the choices you have over it.
          </p>

          <Section heading="1. Information we collect">
            <p><strong>Account information.</strong> Your name, email address, phone number and password (stored only as a salted hash), plus the role assigned to you on a farm.</p>
            <p><strong>Farm records.</strong> The operational data you enter: flock and room details, egg production, feed usage and formulations, mortality, health and vaccination records, inventory, prices, expenses, revenue and customer notes.</p>
            <p><strong>Security and activity data.</strong> Sign-in events, failed sign-in attempts, device type, browser, operating system, approximate location and IP address. This exists so farm owners can monitor who accessed their account.</p>
            <p><strong>Billing data.</strong> Subscription plan, status and payment references. Card details are handled entirely by our payment processor and never reach PoultryPro's servers.</p>
          </Section>

          <Section heading="2. How we use your information">
            <p>To operate your farm dashboard, run analytics and AI insights on your own records, send account and security notifications, provide support, process subscriptions, and keep the platform secure and reliable.</p>
            <p>We do not sell your data. We do not use your individual farm records to advertise to you or to any third party.</p>
          </Section>

          <Section heading="3. Who can see your farm data">
            <p>Your records are visible only to you and to the staff accounts you invite to your farm, according to the role you give them. Every farm is isolated at the database level using row-level security, so one farm can never read another farm's records.</p>
            <p>Authorised PoultryPro platform administrators may access limited account and operational metadata to provide support, investigate abuse or comply with the law. Such access is logged.</p>
          </Section>

          <Section heading="4. Service providers">
            <p>We rely on a small number of processors to run the service: cloud database, authentication and storage hosting; email delivery for account and notification messages; and a payment processor for subscriptions. These providers process data only on our instructions.</p>
          </Section>

          <Section heading="5. Security">
            <p>Data is encrypted in transit (TLS) and at rest by our hosting provider. Offline records held on your device are encrypted before being written to local storage and are removed once synchronised. Access is controlled by role-based permissions, and sensitive actions are recorded in an immutable audit log.</p>
          </Section>

          <Section heading="6. Data retention">
            <p>We keep your farm records for as long as your account is active. If you delete your account, farm records, staff links, audit entries and uploaded files associated with it are deleted, except where we must keep limited billing records to meet legal obligations.</p>
          </Section>

          <Section heading="7. Your rights">
            <p>You can access and export your records at any time from the reports and export tools inside the app, correct them directly, or request deletion of your account. To make a request, contact us using the details below.</p>
          </Section>

          <Section heading="8. Children">
            <p>PoultryPro is a business tool and is not directed at children under 16. We do not knowingly collect their data.</p>
          </Section>

          <Section heading="9. Changes to this policy">
            <p>If we make a material change we will update the date above and notify farm owners in the app before the change takes effect.</p>
          </Section>

          <Section heading="10. Contact">
            <p>
              Questions about this policy or your data:{" "}
              <a className="text-primary underline" href="mailto:greenfieldcontractsagroltd@gmail.com">
                greenfieldcontractsagroltd@gmail.com
              </a>
            </p>
          </Section>

          <p className="mt-10 text-sm">
            See also our <Link to="/terms" className="text-primary underline">Terms of Service</Link>.
          </p>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
