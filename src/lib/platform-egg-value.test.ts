import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

describe("all-farm public egg valuation", () => {
  const db = new PGlite();
  beforeAll(async () => {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE farms(id text PRIMARY KEY,country text);
      CREATE TABLE prices(id text,farm_id text,item text,price numeric,effective_from timestamptz,created_at timestamptz);
      CREATE TABLE price_history(farm_id text,item text,new_price numeric,effective_from timestamptz);
      CREATE TABLE egg_production(farm_id text,date text,r2 integer,r3 integer,r4 integer,extra integer,
        broken_r2 integer,broken_r3 integer,broken_r4 integer,broken_extra integer,UNIQUE(farm_id,date));
      ALTER TABLE egg_production ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON egg_production TO anon;
      INSERT INTO farms VALUES ('a','Nigeria'),('b','Nigeria'),('c','Zambia');`);
    await db.exec(readFileSync("drizzle/migrations/0023_public_all_farm_egg_value.sql", "utf8"));
    await db.exec(`ALTER TABLE egg_production ADD COLUMN r1 integer DEFAULT 0, ADD COLUMN broken_r1 integer DEFAULT 0;`);
    await db.exec(readFileSync("drizzle/migrations/0029_four_room_aggregate_compatibility.sql", "utf8"));
  });
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await db.exec(`DELETE FROM egg_production; DELETE FROM prices; DELETE FROM price_history;
      INSERT INTO prices VALUES ('1','a','Table Eggs',6000,'2020-01-01','2020-01-01'),('2','b','Egg',5000,'2020-01-01','2020-01-01');`);
  });
  async function stats() {
    return (await db.query<{ s: { egg_value: number | null; currency: string; excluded_records: number } }>(
      "SELECT landing_all_farm_egg_value() s")).rows[0]?.s;
  }
  it("combines all eligible farms instead of a fixed ABZ value", async () => {
    await db.exec(`INSERT INTO egg_production(farm_id,date,r2,r3,r4,extra) VALUES
      ('a','2020-02-01',10,0,0,0),('b','2020-02-01',2,0,0,0);`);
    expect((await stats())?.egg_value).toBe(70000);
  });
  it("uses historical prices and earliest fallback", async () => {
    await db.exec(`DELETE FROM prices WHERE farm_id='a';
      INSERT INTO price_history VALUES ('a','Egg',3000,'2020-02-01'),('a','Egg',6000,'2020-03-01');
      INSERT INTO egg_production(farm_id,date,r2,r3,r4,extra) VALUES
      ('a','2020-01-01',1,0,0,0),('a','2020-02-02',1,0,0,0),('a','2020-03-02',1,0,0,0);`);
    expect((await stats())?.egg_value).toBe(12000);
  });
  it("subtracts broken eggs and values loose eggs at one thirtieth of a crate", async () => {
    await db.exec(`INSERT INTO egg_production(farm_id,date,r2,r3,r4,extra,broken_r2,broken_r3,broken_r4,broken_extra) VALUES ('a','2020-02-01',1,0,0,15,5,0,0,0);`);
    expect((await stats())?.egg_value).toBe(8000);
  });
  it("excludes foreign currency, missing prices, invalid quantities and future production", async () => {
    await db.exec(`DELETE FROM prices WHERE farm_id='b';
      INSERT INTO egg_production(farm_id,date,r2,r3,r4,extra) VALUES
      ('a','2020-02-01',1,0,0,0),('a','2020-02-02',-1,0,0,0),
      ('a','2999-01-01',100,0,0,0),('b','2020-02-01',1,0,0,0),('c','2020-02-01',1,0,0,0);`);
    expect(await stats()).toEqual({ egg_value: 6000, currency: "NGN", excluded_records: 3 });
  });
  it("does not substitute a hardcoded value when no records qualify", async () => {
    expect((await stats())?.egg_value).toBeNull();
  });
  it("includes the additional configured slot without double counting loose eggs or breakage", async () => {
    await db.exec(`INSERT INTO egg_production(farm_id,date,r1,r2,r3,r4,extra,broken_r1) VALUES ('a','2020-02-01',2,1,0,0,5,2);`);
    expect((await stats())?.egg_value).toBe(18600);
  });
  it("returns only a combined total and coverage without exposing farm rows", async () => {
    await db.exec(`INSERT INTO egg_production(farm_id,date,r2,r3,r4,extra) VALUES ('a','2020-02-01',1,0,0,0); SET ROLE anon;`);
    try {
      expect((await db.query("SELECT * FROM egg_production")).rows).toHaveLength(0);
      expect(await stats()).toEqual({ egg_value: 6000, currency: "NGN", excluded_records: 0 });
    } finally { await db.exec("RESET ROLE;"); }
  });
});