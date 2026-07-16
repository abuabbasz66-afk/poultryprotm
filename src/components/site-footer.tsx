import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Linkedin, Mail, Phone, MapPin } from "lucide-react";
import logoAsset from "@/assets/poultrypro-logo.png.asset.json";

// Official social URLs are not yet configured. Icons render but are disabled
// until an administrator sets these to real URLs.
const SOCIALS: { label: string; icon: typeof Facebook; href: string | null }[] = [
  { label: "Facebook", icon: Facebook, href: null },
  { label: "Instagram", icon: Instagram, href: null },
  { label: "LinkedIn", icon: Linkedin, href: null },
];

type FooterLink =
  | { label: string; to: string; hash?: string; comingSoon?: false; external?: false }
  | { label: string; href: string; external: true; comingSoon?: false }
  | { label: string; comingSoon: true };

const PLATFORM: FooterLink[] = [
  { label: "Farm Records", to: "/dashboard", hash: "records" },
  { label: "Farm Analytics", to: "/dashboard", hash: "analytics" },
  { label: "AI Intelligence", to: "/dashboard", hash: "ai" },
  { label: "Import Records", to: "/import" },
  { label: "Subscription Plans", to: "/dashboard", hash: "plans" },
];

const RESOURCES: FooterLink[] = [
  { label: "Help Centre", comingSoon: true },
  { label: "CSV Import Guide", to: "/import" },
  { label: "Farm Data Guide", comingSoon: true },
  { label: "AI Intelligence Guide", comingSoon: true },
  { label: "Privacy Policy", comingSoon: true },
  { label: "Terms of Service", comingSoon: true },
];

const COMPANY: FooterLink[] = [
  { label: "About PoultryPro", to: "/", hash: "about" },
  { label: "Greenfield Contracts & Agro Limited", to: "/", hash: "about" },
  { label: "Contact", href: "mailto:greenfieldcontractsagroltd@gmail.com", external: true },
];

function FooterItem({ item }: { item: FooterLink }) {
  const cls =
    "text-sm text-primary-foreground/70 hover:text-[color:var(--gold)] transition-colors";
  if ("comingSoon" in item && item.comingSoon) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex items-center gap-2 text-sm text-primary-foreground/40 cursor-not-allowed"
        title="Coming soon"
      >
        {item.label}
        <span className="rounded-full border border-primary-foreground/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider">
          Soon
        </span>
      </span>
    );
  }
  if ("external" in item && item.external) {
    return (
      <a href={item.href} className={cls}>
        {item.label}
      </a>
    );
  }
  return (
    <Link to={item.to} hash={item.hash} className={cls}>
      {item.label}
    </Link>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[color:var(--forest)] text-primary-foreground border-t border-primary-foreground/10">
      <div className="container-x py-12 md:py-16">
        <div className="grid gap-10 md:gap-8 md:grid-cols-2 lg:grid-cols-12">
          {/* Brand */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2.5">
              <img
                src={logoAsset.url}
                alt="PoultryPro"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
              <span className="font-display text-xl font-semibold">PoultryPro™</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-primary-foreground/70">
              Smart poultry farm management, analytics and AI-supported decision
              intelligence for modern poultry farms.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {SOCIALS.map(({ label, icon: Icon, href }) => {
                const base =
                  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary-foreground/15 transition-colors";
                if (!href) {
                  return (
                    <span
                      key={label}
                      role="link"
                      aria-disabled="true"
                      aria-label={`${label} (link not configured)`}
                      title={`${label} — link not configured`}
                      className={`${base} text-primary-foreground/35 cursor-not-allowed`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  );
                }
                return (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    target="_blank"
                    rel="noreferrer"
                    className={`${base} text-primary-foreground/70 hover:text-[color:var(--gold)] hover:border-[color:var(--gold)]/60`}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Platform */}
          <div className="lg:col-span-2">
            <h3 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--gold)]">
              Platform
            </h3>
            <ul className="mt-4 space-y-3">
              {PLATFORM.map((item) => (
                <li key={item.label}>
                  <FooterItem item={item} />
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div className="lg:col-span-2">
            <h3 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--gold)]">
              Resources
            </h3>
            <ul className="mt-4 space-y-3">
              {RESOURCES.map((item) => (
                <li key={item.label}>
                  <FooterItem item={item} />
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="lg:col-span-2">
            <h3 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--gold)]">
              Company
            </h3>
            <ul className="mt-4 space-y-3">
              {COMPANY.map((item) => (
                <li key={item.label}>
                  <FooterItem item={item} />
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="lg:col-span-2 min-w-0">
            <h3 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--gold)]">
              Contact
            </h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-2 min-w-0">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--gold)]" />
                <a
                  href="mailto:greenfieldcontractsagroltd@gmail.com"
                  className="text-primary-foreground/70 hover:text-[color:var(--gold)] break-all"
                >
                  greenfieldcontractsagroltd@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--gold)]" />
                <a
                  href="tel:+2348065301413"
                  className="text-primary-foreground/70 hover:text-[color:var(--gold)]"
                >
                  08065301413
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--gold)]" />
                <span className="text-primary-foreground/70">
                  Katsina State, Nigeria
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-primary-foreground/10">
        <div className="container-x py-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-xs text-primary-foreground/60">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-3">
            <span>© {year} PoultryPro™. All rights reserved.</span>
            <span className="hidden md:inline text-primary-foreground/30">·</span>
            <span>Developed by GREENFIELD CONTRACTS &amp; AGRO LIMITED</span>
          </div>
          <div className="flex items-center gap-4">
            <span
              aria-disabled="true"
              className="text-primary-foreground/40 cursor-not-allowed"
              title="Coming soon"
            >
              Privacy Policy
            </span>
            <span
              aria-disabled="true"
              className="text-primary-foreground/40 cursor-not-allowed"
              title="Coming soon"
            >
              Terms of Service
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
