import { describe, expect, it } from "vitest";
import { buildActiveOperations, formatAge, summariseOperations } from "./active-operations";

const on = new Date(2026, 9, 30);
const layer = (id: string, placement: string, status = "rearing", birds = 1000, current = 990) => ({
  id, farm_id: "f", name: id, bird_type: "Layer", breed: null, birds_placed: birds, current_birds: current,
  placement_date: placement, hatch_date: null, start_age_days: 0, room: "House A", room_id: null,
  source: null, notes: null, status, transferred_at: null, transferred_room_id: null, created_at: "",
});
const broiler = (id: string, placed: string, status = "active") => ({
  id, farm_id: "f", name: id, breed: null, house: "Pen 1", date_placed: placed, birds_placed: 300,
  current_birds: 295, chick_unit_cost: 0, target_weight_kg: 2.5, status, notes: null, created_at: "",
});
const base = { layerDaily: [], layerHealth: [], layerSettings: null, broilerDaily: [], on };

describe("active flock operations", () => {
  it("formats age readably", () => {
    expect(formatAge(91)).toBe("13 weeks old");
    expect(formatAge(38)).toBe("5 weeks and 3 days old");
    expect(formatAge(3)).toBe("3 days old");
  });

  it("13-week layer batch is Layer Rearing; a new batch is Layer Brooding", () => {
    const ops = buildActiveOperations({ ...base, layerBatches: [layer("a", "2026-07-31"), layer("b", "2026-10-28")], broilerBatches: [] });
    expect(ops.find((o) => o.id === "a")?.kind).toBe("layer-rearing");
    expect(ops.find((o) => o.id === "a")?.ageText).toBe("13 weeks old");
    expect(ops.find((o) => o.id === "b")?.kind).toBe("layer-brooding");
  });

  it("broiler stages split at day 21 and sold batches leave the overview", () => {
    const ops = buildActiveOperations({ ...base, layerBatches: [], broilerBatches: [broiler("x", "2026-10-25"), broiler("y", "2026-10-01"), broiler("z", "2026-09-01", "sold")] });
    expect(ops.map((o) => [o.id, o.kind]).sort()).toEqual([["x", "broiler-brooding"], ["y", "broiler-rearing"]]);
  });

  it("transferred or closed layer batches are excluded and totals use live birds", () => {
    const ops = buildActiveOperations({ ...base, layerBatches: [layer("a", "2026-10-28", "rearing", 500, 480), layer("t", "2026-01-01", "transferred")], broilerBatches: [broiler("x", "2026-10-25")] });
    const s = summariseOperations(ops);
    expect(s.batches).toBe(2);
    expect(s.broodingBirds).toBe(480 + 295);
    expect(s.rearingBatches).toBe(0);
  });

  it("missing daily records flags Attention Required", () => {
    const [op] = buildActiveOperations({ ...base, layerBatches: [layer("a", "2026-10-20")], broilerBatches: [] });
    expect(op.status).toBe("Attention Required");
  });
});
