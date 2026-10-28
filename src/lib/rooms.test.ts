import { describe, expect, it } from "vitest";
import { eggSlots, productionRooms } from "./rooms";
import { totalEggsFromRow } from "./egg-normalize";
import { computeDailyProduction } from "./production-percent";
import type { Room } from "./farm-data";

const rooms: Room[] = [
  { id: "one", name: "ROOM 1", current: 1750, initial: 1750, status: "active", egg_column: "r2" },
  { id: "two", name: "ROOM 2", current: 1750, initial: 1750, status: "active", egg_column: "r3" },
  { id: "three", name: "ROOM 3", current: 1750, initial: 1750, status: "active", egg_column: "r4" },
  { id: "four", name: "ROOM 4", current: 2940, initial: 2940, status: "active", egg_column: "r1" },
];
describe("four usable rooms without remapping history", () => {
  it("includes the owner-confirmed 2,940-bird Room 4 among four active rooms", () => {
    expect(productionRooms(rooms)).toHaveLength(4);
    expect(productionRooms(rooms).find(r => r.name === "ROOM 4")?.current).toBe(2940);
  });
  it("preserves original three slots and assigns Room 4 separate storage", () => {
    expect(eggSlots(rooms).map(s => [s.room.name,s.key])).toEqual([
      ["ROOM 1","r2"],["ROOM 2","r3"],["ROOM 3","r4"],["ROOM 4","r1"],
    ]);
  });
  it("leaves other farms' legacy positional and numbered mappings unchanged", () => {
    expect(eggSlots(rooms.slice(0,3).map(r => ({...r,egg_column:null}))).map(s=>s.key)).toEqual(["r2","r3","r4"]);
    expect(eggSlots(rooms.slice(1).map(r => ({...r,egg_column:null}))).map(s=>s.key)).toEqual(["r2","r3","r4"]);
  });
  it("counts fourth-room crates, loose eggs and breakage exactly once", () => {
    const row={id:"sample",date:"2026-10-27",label:"sample",r1:10,r2:1,r3:2,r4:3,extra:5,extra_r1:5,broken_r1:2};
    expect(totalEggsFromRow(row)).toBe(483);
    const daily=computeDailyProduction(row,rooms,[]);
    expect(daily.rooms.find(r=>r.roomName==="ROOM 4")?.eggs).toBe(303);
    expect(daily.totalBirds).toBe(8190);
  });
  it("preserves legacy production quantities with no additional slot", () => {
    expect(totalEggsFromRow({r2:1,r3:2,r4:3,extra:5})).toBe(185);
  });
});