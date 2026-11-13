import { describe, expect, it } from "vitest";
import { buildFilterSections } from "@/components/prospects/prospect-filter-sidebar";
import { EMPTY_FILTER_DRAFT } from "@/lib/search-constants";
import { sectionCount, sectionSummary, tokensFor } from "./filter-tokens";

const noop = () => {};

describe("buildFilterSections", () => {
  it("offers every filter group, each with a category and the fields it edits", () => {
    const sections = buildFilterSections(EMPTY_FILTER_DRAFT, noop);
    expect(sections).toHaveLength(23);
    for (const s of sections) {
      expect(["person", "company", "signals"]).toContain(s.category);
      expect(s.keys.length).toBeGreaterThan(0);
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
    }
    expect(sections.map((s) => s.id)).toEqual(
      expect.arrayContaining(["job-title", "company", "location", "employee-headcount", "industry-keyword", "contact-details"])
    );
  });
});

describe("tokens and summaries", () => {
  const draft = { ...EMPTY_FILTER_DRAFT, jobTitle: "CTO", seniority: "c_level", companySizes: ["11-50"], currentlyHiring: true };
  const sections = buildFilterSections(draft, noop);

  it("colours each token by the category of the filter that owns it", () => {
    const byKey = Object.fromEntries(tokensFor(draft, sections).map((t) => [t.key, t.category]));
    expect(byKey).toMatchObject({ jobTitle: "person", seniority: "person", companySizes: "company", currentlyHiring: "signals" });
  });

  it("summarises a section with readable labels and counts its fields in use", () => {
    const jobTitle = sections.find((s) => s.id === "job-title")!;
    expect(sectionSummary(draft, jobTitle)).toBe("CTO, C-Level");
    expect(sectionCount(draft, jobTitle)).toBe(2);
    const revenue = sections.find((s) => s.id === "revenue")!;
    expect(sectionSummary(draft, revenue)).toBe("");
    expect(sectionCount(draft, revenue)).toBe(0);
  });
});
