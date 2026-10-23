import { describe, expect, it } from "vitest";
import { buildPublicSitemap, loadPublicTutorials } from "./public-sitemap";

const tutorial = (slug: string, is_published = true, is_archived = false) => ({ slug, is_published, is_archived });

describe("public sitemap eligibility", () => {
  it("includes Academy, demo and achievements without private or auth destinations", () => {
    const xml = buildPublicSitemap([]);
    for (const path of ["/academy", "/presentation", "/achievements"]) {
      expect(xml).toContain(`<loc>https://poultrypro.life${path}</loc>`);
    }
    for (const path of ["/dashboard", "/super-admin", "/feed", "/auth", "/onboarding"]) {
      expect(xml).not.toContain(`<loc>https://poultrypro.life${path}</loc>`);
    }
  });
  it("excludes draft and archived tutorials and deduplicates published tutorials", () => {
    const xml = buildPublicSitemap([tutorial("egg-records"), tutorial("egg-records"), tutorial("draft", false), tutorial("archived", true, true)]);
    expect(xml.match(/\/academy\/egg-records/g)).toHaveLength(1);
    expect(xml).not.toContain("/academy/draft");
    expect(xml).not.toContain("/academy/archived");
  });
  it("reads beyond the first page", async () => {
    const calls: number[] = [];
    const rows = await loadPublicTutorials(async (offset, limit) => {
      calls.push(offset);
      return offset === 0 ? Array.from({ length: limit }, (_, i) => tutorial(`first-${i}`)) : [tutorial("last")];
    });
    expect(calls).toEqual([0, 500]);
    expect(rows).toHaveLength(501);
    expect(rows[500].slug).toBe("last");
  });
  it("rejects a failed later page instead of returning a partial catalogue", async () => {
    await expect(loadPublicTutorials(async (offset, limit) => {
      if (offset > 0) throw new Error("Public tutorial read failed");
      return Array.from({ length: limit }, (_, i) => tutorial(`first-${i}`));
    })).rejects.toThrow("Public tutorial read failed");
  });
});