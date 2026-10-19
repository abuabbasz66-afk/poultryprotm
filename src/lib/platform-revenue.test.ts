import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { parseRecordedRevenue, formatRecordedRevenue } from "./platform-revenue";

describe("recorded revenue database aggregation", () => {
  const db = new PGlite();
  beforeAll(async () => {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id text);
      CREATE TABLE farms(id text PRIMARY KEY, subscription_plan text);
      CREATE TABLE rooms(current numeric);
      CREATE TABLE prices(farm_id text, price numeric, item text, created_at timestamp);
      CREATE TABLE egg_production(farm_id text,r2 numeric,r3 numeric,r4 numeric,extra numeric);
      CREATE TABLE feed_usage(farm_id text,bags numeric);
      CREATE TABLE mortality(id text); CREATE TABLE health_records(id text);
      CREATE TABLE farm_revenue(id text PRIMARY KEY,farm_id text,entry_date date,
        category text,item text,quantity numeric DEFAULT 1,unit text DEFAULT 'unit',
        unit_price numeric DEFAULT 0,amount numeric,customer text,payment_method text,notes text);
      INSERT INTO farms VALUES ('a','basic'), ('b','basic');
      ALTER TABLE farm_revenue ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON farm_revenue TO anon;
    `);
    await db.exec(readFileSync("drizzle/migrations/0021_recorded_platform_revenue.sql", "utf8"));
  });
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await db.exec("DELETE FROM farm_revenue; DELETE FROM egg_production; DELETE FROM prices;");
  });
  async function total() {
    const result = await db.query<{ stats: { recorded_farm_revenue: number | null } }>(
      "SELECT public.landing_platform_stats() AS stats",
    );
    return result.rows[0]?.stats.recorded_farm_revenue;
  }
  it("adds recorded income across farms, including the existing controlled sample amount", async () => {
    await db.exec("INSERT INTO farm_revenue(id,farm_id,entry_date,amount) VALUES ('1','a','2026-10-19',45),('2','b','2026-10-19',12500);");
    expect(await total()).toBe(12545);
  });
  it("does not add price-based egg production estimates to actual revenue", async () => {
    await db.exec(`INSERT INTO farm_revenue(id,farm_id,entry_date,amount) VALUES ('1','a','2026-10-19',45);
      INSERT INTO prices VALUES ('a',6000,'eggs',now()); INSERT INTO egg_production VALUES ('a',100,0,0,0);`);
    expect(await total()).toBe(45);
  });
  it("does not count suspected duplicate transactions", async () => {
    await db.exec("INSERT INTO farm_revenue(id,farm_id,entry_date,amount) VALUES ('1','a','2026-10-19',45),('2','a','2026-10-19',45);");
    expect(await total()).toBeNull();
  });
  it("excludes invalid, non-finite and orphan records", async () => {
    await db.exec("INSERT INTO farm_revenue(id,farm_id,entry_date,amount) VALUES ('1','a','2026-10-19',45),('2','b','2026-10-19',-1),('3','b','2026-10-19','NaN'),('4','missing','2026-10-19',100),('5','b','2026-10-19','Infinity');");
    expect(await total()).toBe(45);
  });
  it("refreshes after ledger updates and excludes removed entries", async () => {
    await db.exec("INSERT INTO farm_revenue(id,farm_id,entry_date,amount) VALUES ('1','a','2026-10-19',45);");
    expect(await total()).toBe(45);
    await db.exec("UPDATE farm_revenue SET amount=90 WHERE id='1';");
    expect(await total()).toBe(90);
    await db.exec("DELETE FROM farm_revenue WHERE id='1';");
    expect(await total()).toBeNull();
  });
  it("exposes only aggregate output to anonymous visitors while financial rows stay hidden", async () => {
    await db.exec("INSERT INTO farm_revenue(id,farm_id,entry_date,amount) VALUES ('private-id','a','2026-10-19',45); SET ROLE anon;");
    try {
      expect((await db.query("SELECT * FROM farm_revenue")).rows).toHaveLength(0);
      expect(await total()).toBe(45);
      const result = await db.query("SELECT public.landing_platform_stats() AS stats");
      expect(JSON.stringify(result.rows)).not.toContain("private-id");
      expect(Object.keys(result.rows[0]?.stats as object)).toHaveLength(14);
    } finally { await db.exec("RESET ROLE;"); }
  });
});

describe("recorded revenue parsing", () => {
  it("rejects unknown or mixed currencies instead of combining them", () => {
    expect(parseRecordedRevenue(125.4, "USD")).toBeNull();
    expect(parseRecordedRevenue(125.4, ["NGN", "USD"])).toBeNull();
    expect(parseRecordedRevenue("45", "NGN")).toBe(45);
  });
  it("preserves unavailable data rather than interpreting it as zero", () => {
    expect(parseRecordedRevenue(null, "NGN")).toBeNull();
    expect(parseRecordedRevenue(undefined, "NGN")).toBeNull();
    expect(parseRecordedRevenue("NaN", "NGN")).toBeNull();
    expect(parseRecordedRevenue(0, "NGN")).toBe(0);
  });
  it("formats NGN with appropriate magnitude and precision", () => {
    expect(formatRecordedRevenue(125400000)).toBe("₦125.4M");
    expect(formatRecordedRevenue(45)).toBe("₦45.00");
  });
});