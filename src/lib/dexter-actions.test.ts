import { describe, expect, it } from "vitest";
import { pathForUiAction } from "./dexter-actions";

describe("pathForUiAction", () => {
  it("maps open routes", () => {
    expect(pathForUiAction("open_inbox")).toBe("/inbox");
    expect(pathForUiAction("open_ai_review")).toBe("/ai/review");
    expect(pathForUiAction("open_search")).toBe("/prospects/search");
    expect(pathForUiAction("open_search", { query: "VP Sales" })).toBe(
      "/prospects/search?q=VP%20Sales"
    );
  });

  it("maps entity routes", () => {
    expect(pathForUiAction("open_list", { listId: "abc" })).toBe("/lists/abc");
    expect(pathForUiAction("open_sequence", { sequenceId: "xyz" })).toBe("/sequences/xyz");
  });

  it("returns null for enroll_list (API action)", () => {
    expect(pathForUiAction("enroll_list", { listId: "a", sequenceId: "b" })).toBeNull();
  });
});
