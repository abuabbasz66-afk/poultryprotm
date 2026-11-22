import { Building2, Cpu, Layers3, Leaf } from "lucide-react";
import { OFFICIAL_PROFILE } from "@/lib/official-profile";

const identity = [
  { label: "Corporate Ownership", value: OFFICIAL_PROFILE.corporateOwnership, icon: Building2 },
  { label: "Product Name", value: OFFICIAL_PROFILE.productName, icon: Layers3 },
  { label: "Industry", value: OFFICIAL_PROFILE.industry, icon: Leaf },
  { label: "Product Category", value: OFFICIAL_PROFILE.productCategory, icon: Cpu },
];

export function OfficialProfile() {
  return (
    <section
      id="about"
      aria-labelledby="official-profile-title"
      className="scroll-mt-24 border-y border-border bg-[color:var(--cream)]/35 py-20 md:py-24"
    >
      <div className="container-x grid items-start gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[color:var(--forest)]">
            Official Product Profile
          </span>
          <h2
            id="official-profile-title"
            className="mt-4 font-display text-4xl font-semibold leading-tight md:text-5xl"
          >
            {OFFICIAL_PROFILE.productName}
          </h2>
          <p className="mt-4 max-w-3xl font-display text-2xl font-semibold leading-snug text-[color:var(--forest)] md:text-3xl">
            {OFFICIAL_PROFILE.tagline}
          </p>
          <div className="mt-7 max-w-3xl space-y-5 text-base leading-relaxed text-muted-foreground md:text-lg">
            <p>{OFFICIAL_PROFILE.description}</p>
            <p>{OFFICIAL_PROFILE.ownershipDescription}</p>
          </div>
        </div>

        <aside className="rounded-3xl bg-[color:var(--forest)] p-6 text-primary-foreground shadow-[var(--shadow-lift)] sm:p-8 lg:col-span-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--gold)]">
            Corporate Identity
          </h3>
          <dl className="mt-6 divide-y divide-primary-foreground/15">
            {identity.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-foreground/10 text-[color:var(--gold)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary-foreground/65">
                    {label}
                  </dt>
                  <dd className="mt-1.5 break-words font-display text-lg font-semibold leading-snug">
                    {value}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </section>
  );
}
