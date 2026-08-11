import { useMemo, useState } from "react";
import { RequirePermission } from "@/components/require-permission";
import { createFileRoute } from "@tanstack/react-router";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePriceHistory, useFarm } from "@/lib/farm-data";
import { formatEffective, priceKeyOf } from "@/lib/price-timeline";
import { naira } from "@/components/pricing-dashboard";

type Search = { item?: string };

export const Route = createFileRoute("/_authenticated/price-history")({
  validateSearch: (s: Record<string, unknown>): Search => ({ item: typeof s.item === "string" ? s.item : undefined }),
  component: () => (
    <RequirePermission permission="prices.read" hint="Price history is not part of your access.">
      <PriceHistoryPage />
    </RequirePermission>
  ),
  head: () => ({
    meta: [
      { title: "Price History | PoultryPro" },
      { name: "description", content: "Immutable audit trail of every egg, feed and ingredient price change on your farm, with effective dates and who made the change." },
      { property: "og:title", content: "Price History | PoultryPro" },
      { property: "og:description", content: "Every price change on your farm, with old price, new price and effective date and time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function PriceHistoryPage() {
  const search = Route.useSearch();
  const historyQ = usePriceHistory();
  const farmQ = useFarm();
  const [item, setItem] = useState(search.item ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rows = useMemo(() => {
    const list = historyQ.data ?? [];
    const wanted = item.trim() ? priceKeyOf(item.trim()) : null;
    const filtered = list.filter(h => {
      // Filter by logical item: every egg price belongs to one timeline, so
      // "Table Egg" and "Egg" show together as a single continuous history.
      if (wanted && priceKeyOf(h.item, h.category) !== wanted &&
          !h.item.toLowerCase().includes(item.trim().toLowerCase())) return false;
      const day = String(h.effective_from).slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
    const sorted = filtered.slice().sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
    // The newest entry per logical item is the price currently in force.
    const currentIds = new Set<string>();
    const seen = new Set<string>();
    for (const h of sorted) {
      const k = priceKeyOf(h.item, h.category);
      if (!seen.has(k)) { seen.add(k); currentIds.add(h.id); }
    }
    return sorted.map(h => ({ ...h, isCurrent: currentIds.has(h.id) }));
  }, [historyQ.data, item, from, to]);

  return (
    <div className="container-x space-y-8 py-8">
        <header>
          <h1 className="text-3xl">Price History</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Immutable audit trail for {farmQ.data?.name ?? "your farm"} — every change keeps its effective date, so historical records never change value.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input value={item} onChange={e => setItem(e.target.value)} placeholder="Filter by item…" className="h-11 rounded-2xl" />
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-11 rounded-2xl" />
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-11 rounded-2xl" />
        </div>

        <div className="overflow-hidden rounded-[20px] border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_28px_rgba(20,60,40,0.05)]">
          {historyQ.isLoading ? (
            <div className="space-y-2 p-6">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No price changes recorded for these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Old price</th>
                    <th className="px-4 py-3">New price</th>
                    <th className="px-4 py-3">Change</th>
                    <th className="px-4 py-3">Effective from</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(h => {
                    const delta = h.old_price == null ? 0 : Number(h.new_price) - Number(h.old_price);
                    return (
                      <tr key={h.id} className="border-t transition-colors hover:bg-muted/40">
                        <td className="px-4 py-3 font-medium">{h.item}</td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{h.category}</td>
                        <td className="px-4 py-3">{h.old_price == null ? "—" : naira(Number(h.old_price))}</td>
                        <td className="px-4 py-3 font-medium">{naira(Number(h.new_price))}</td>
                        <td className={"px-4 py-3 " + (delta > 0 ? "text-emerald-700" : delta < 0 ? "text-destructive" : "text-muted-foreground")}>
                          {delta === 0 ? "—" : `${delta > 0 ? "+" : "-"}${naira(Math.abs(delta))}`}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatEffective(h.effective_from)}</td>
                        <td className="px-4 py-3">
                          {h.isCurrent ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Current
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Historical</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{h.device ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </div>
  );
}
