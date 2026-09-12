/**
 * Range-, room- and flock-aware paged record fetching.
 *
 * All reads go through the signed-in user's own database client, so existing
 * farm access rules decide what comes back — a manipulated farm/room/flock id
 * simply returns nothing.
 */

import { supabase } from "@/integrations/supabase/client";
import { rowDateKey, type ExportDescriptor, type Row } from "./registry";
import type { ResolvedRange } from "./range";

const PAGE = 1000;

export type FetchFilters = {
  farmId: string;
  range: ResolvedRange;
  roomId?: string | null;
  roomName?: string | null;
  batchId?: string | null;
};

export async function fetchDescriptorRows(
  desc: ExportDescriptor,
  filters: FetchFilters,
): Promise<Row[]> {
  const { farmId, range } = filters;
  const out: Row[] = [];
  let page = 0;

  for (;;) {
    // A deterministic order is required: paged reads without one can repeat
    // rows on one page and skip them on the next.
    let q = supabase
      .from(desc.table as never)
      .select("*")
      .eq("farm_id", farmId)
      .order(desc.dateField, { ascending: true })
      .order("id", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);


    if (desc.dateKind === "iso" && range.from) q = q.gte(desc.dateField, range.from);
    if (desc.dateKind === "iso" && range.to) {
      // Timestamp columns need the whole day, date columns ignore the suffix.
      q = q.lte(desc.dateField, `${range.to}T23:59:59.999Z`);
    }
    if (desc.roomField && filters.roomId) {
      const value = desc.roomField.kind === "id" ? filters.roomId : filters.roomName;
      if (value) q = q.eq(desc.roomField.col, value);
    }
    if (desc.batchField && filters.batchId) q = q.eq(desc.batchField, filters.batchId);

    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as unknown as Row[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    page += 1;
    if (page > 200) break; // safety valve: 200k rows
  }

  const filtered =
    desc.dateKind === "text" && (range.from || range.to)
      ? out.filter((r) => {
          const key = rowDateKey(desc, r);
          if (!key) return false;
          if (range.from && key < range.from) return false;
          if (range.to && key > range.to) return false;
          return true;
        })
      : out;

  return filtered.sort((a, b) => {
    const ka = rowDateKey(desc, a) ?? "";
    const kb = rowDateKey(desc, b) ?? "";
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/** Cheap "does this record type have anything at all for this farm?" probe. */
export async function descriptorHasData(desc: ExportDescriptor, farmId: string) {
  const { count, error } = await supabase
    .from(desc.table as never)
    .select("id", { count: "exact", head: true })
    .eq("farm_id", farmId);
  if (error) return false;
  return (count ?? 0) > 0;
}
