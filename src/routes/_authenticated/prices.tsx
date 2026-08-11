import { createFileRoute, Link } from "@tanstack/react-router";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PricingDashboard } from "@/components/pricing-dashboard";

export const Route = createFileRoute("/_authenticated/prices")({
  component: () => (
    <RequirePermission permission="prices.read" hint="Price management is not part of your access.">
      <PricesPage />
    </RequirePermission>
  ),
  head: () => ({
    meta: [
      { title: "Pricing Control Centre | PoultryPro" },
      { name: "description", content: "Manage egg, feed and ingredient prices with effective-dated history and live financial impact for your poultry farm." },
      { property: "og:title", content: "Pricing Control Centre | PoultryPro" },
      { property: "og:description", content: "Effective-dated pricing, full audit history and financial impact analysis for your poultry operation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function PricesPage() {
  return (
    <div className="container-x space-y-8 py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl">Pricing Control Centre</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              Every price is effective from the exact moment you set it. Existing records keep the price that was active on their own date.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/price-history"><History className="mr-1.5 h-4 w-4" /> Price history</Link>
          </Button>
        </header>
      <PricingDashboard />
    </div>
  );
}
