import { describe, expect, it } from "vitest";
import { hasSmartListFilters, summarizeSmartListFilters } from "./smart-lists";

describe("summarizeSmartListFilters", () => {
  it("lists every filter, including multi-value ones, with readable seniority labels", () => {
    expect(
      summarizeSmartListFilters({
        query: "Razorpay",
        jobTitle: "Head of Sales",
        industries: ["FinTech", "Financial Services"],
        countries: ["India"],
        seniorities: ["vp", "c_level"],
        minEmployees: 10,
        maxEmployees: 500,
      })
    ).toBe('"Razorpay" · Head of Sales · FinTech, Financial Services · India · VP, C-Level · 10–500 employees');
  });

  it("still shows lists saved with the older single-value fields", () => {
    expect(summarizeSmartListFilters({ industry: "Software & SaaS", country: "US", seniority: "vp" })).toBe(
      "Software & SaaS · US · VP"
    );
  });

  it("handles open-ended employee ranges and empty filters", () => {
    expect(summarizeSmartListFilters({ minEmployees: 50 })).toBe("50+ employees");
    expect(summarizeSmartListFilters({ maxEmployees: 200 })).toBe("up to 200 employees");
    expect(summarizeSmartListFilters({})).toBe("No filters");
  });
});

describe("hasSmartListFilters", () => {
  it("is false for empty filters and empty arrays", () => {
    expect(hasSmartListFilters({})).toBe(false);
    expect(hasSmartListFilters({ industries: [], query: "" })).toBe(false);
  });

  it("is true once any filter is set", () => {
    expect(hasSmartListFilters({ countries: ["IN"] })).toBe(true);
    expect(hasSmartListFilters({ minEmployees: 0 })).toBe(true);
  });
});
