import { describe, expect, it } from "vitest";
import { EMPTY_FILTER_DRAFT } from "@/lib/search-constants";
import { clearFilterField, describeSearch } from "@/lib/search-summary";

describe("describeSearch", () => {
  it("returns no chips for an empty search", () => {
    expect(describeSearch("  ", EMPTY_FILTER_DRAFT)).toEqual([]);
  });

  it("describes the query, text filters, lists and flags", () => {
    const chips = describeSearch("fintech", {
      ...EMPTY_FILTER_DRAFT,
      jobTitle: "CTO",
      companyName: "Stripe",
      industries: ["Software", "Finance"],
      emailAvailable: true,
    });
    expect(chips).toEqual([
      { key: "query", label: "Search", value: "fintech" },
      { key: "jobTitle", label: "Job title", value: "CTO" },
      { key: "companyName", label: "Company", value: "Stripe" },
      { key: "industries", label: "Industry", value: "Software, Finance" },
      { key: "emailAvailable", label: "Has email", value: "Yes" },
    ]);
  });
});

describe("clearFilterField", () => {
  it("resets only the given field", () => {
    const next = clearFilterField(
      { ...EMPTY_FILTER_DRAFT, jobTitle: "CTO", industries: ["Software"], emailAvailable: true },
      "industries"
    );
    expect(next.industries).toEqual([]);
    expect(next.jobTitle).toBe("CTO");
    expect(next.emailAvailable).toBe(true);
  });
});
