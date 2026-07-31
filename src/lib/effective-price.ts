// PoultryPro — centralised effective-price hook.
//
// The Current Prices table is the single source of truth for every financial
// calculation on the platform. No module keeps its own copy of an egg, feed or
// ingredient price: they all resolve through `getEffectivePrice(item, date)`,
// which honours the effective-dated audit trail so historical records keep the
// price that was active on their own date.

import { useMemo } from "react";
import { usePrices, usePriceHistory, useFarm } from "@/lib/farm-data";
import { useActiveFormulaCostPerKg } from "@/lib/feed-formulas-data";
import { buildFarmTimelines, getEffectivePrice, type FarmPriceTimelines } from "@/lib/price-timeline";

export type EffectivePriceService = FarmPriceTimelines & {
  isLoading: boolean;
  bagWeightKg: number;
  /** Price of any item (eggs, feed, an ingredient…) on a given YYYY-MM-DD. */
  getEffectivePrice: (item: string, dateKey?: string | null) => number;
};

export function useEffectivePrice(): EffectivePriceService {
  const farm = useFarm();
  const pricesQ = usePrices();
  const historyQ = usePriceHistory();
  const formulaCost = useActiveFormulaCostPerKg();

  const bagWeightKg =
    farm.data?.bag_weight_kg && farm.data.bag_weight_kg > 0 ? farm.data.bag_weight_kg : 25;
  const useFormula = farm.data?.feed_source === "self_produced";

  const prices = pricesQ.data ?? [];
  const history = historyQ.data ?? [];

  return useMemo(() => {
    const timelines = buildFarmTimelines({
      prices,
      history,
      bagWeightKg,
      costPerKgOverride: useFormula ? formulaCost : null,
    });
    return {
      ...timelines,
      isLoading: pricesQ.isLoading || historyQ.isLoading || farm.isLoading,
      bagWeightKg,
      getEffectivePrice: (item, dateKey) => getEffectivePrice({ prices, history }, item, dateKey),
    };
  }, [prices, history, bagWeightKg, useFormula, formulaCost, pricesQ.isLoading, historyQ.isLoading, farm.isLoading]);
}
