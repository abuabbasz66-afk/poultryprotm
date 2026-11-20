import { describe, expect, it } from "vitest";
import { orderAcademyTutorials } from "./academy";

describe("Academy lesson ordering", () => {
  it("keeps previous and next navigation in the published series order", () => {
    const lessons = orderAcademyTutorials([
      { slug: "poultrypro-ai-intelligence", sort_order: 11 },
      { slug: "getting-started-dashboard", sort_order: 1 },
      { slug: "record-daily-egg-production", sort_order: 2 },
    ]);

    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      "getting-started-dashboard",
      "record-daily-egg-production",
      "poultrypro-ai-intelligence",
    ]);
  });
});
