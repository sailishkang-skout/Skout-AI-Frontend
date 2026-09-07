import { describe, expect, it } from "vitest";
import { getContextSuggestions } from "./dexter-chat";

describe("getContextSuggestions", () => {
  it("returns Discover-specific suggestions on the prospect search page", () => {
    const suggestions = getContextSuggestions({ page: "/prospects/search" });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => /workbook|list/i.test(s))).toBe(true);
  });

  it("returns Smart List-specific suggestions on the smart-lists page", () => {
    const suggestions = getContextSuggestions({ page: "/smart-lists" });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => /smart list/i.test(s))).toBe(true);
  });

  it("returns Account 360-specific suggestions on the crm/360 page", () => {
    const suggestions = getContextSuggestions({ page: "/crm/360" });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => /account/i.test(s))).toBe(true);
  });

  it("returns list-aware suggestions when a listId is present but the page doesn't match a known route", () => {
    const suggestions = getContextSuggestions({ page: "/lists/abc-123", listId: "abc-123" });
    expect(suggestions.some((s) => /this list/i.test(s))).toBe(true);
  });

  it("falls back to the generic suggestion list on an unrecognized page with no context", () => {
    const suggestions = getContextSuggestions({ page: "/settings/workspace" });
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it("the three named pages each return a distinct set from each other and from the fallback", () => {
    const discover = getContextSuggestions({ page: "/prospects/search" });
    const smartLists = getContextSuggestions({ page: "/smart-lists" });
    const account360 = getContextSuggestions({ page: "/crm/360" });
    const fallback = getContextSuggestions({ page: "/somewhere-else" });
    expect(discover).not.toEqual(smartLists);
    expect(discover).not.toEqual(account360);
    expect(smartLists).not.toEqual(account360);
    expect(discover).not.toEqual(fallback);
  });
});
