import { describe, expect, it, vi } from "vitest";
import { executeDexterAction, pathForUiAction } from "./dexter-actions";
import type { ChatAction } from "./ai-chat";

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

describe("executeDexterAction — enroll_list (R15.2 atomic endpoint)", () => {
  const enrollAction: Extract<ChatAction, { type: "ui_action" }> = {
    type: "ui_action",
    name: "enroll_list",
    label: "Enroll list into sequence",
    params: { listId: "list-1", sequenceId: "seq-1" },
    confirm: true,
  };

  it("calls deps.enrollList with the listId/sequenceId and navigates to the sequence", async () => {
    const enrollList = vi.fn().mockResolvedValue({ data: { enrolled: 3, skipped: 0, total: 3 } });
    const router = { push: vi.fn() };
    const result = await executeDexterAction(enrollAction, { router, enrollList });

    expect(enrollList).toHaveBeenCalledWith({ listId: "list-1", sequenceId: "seq-1" });
    expect(router.push).toHaveBeenCalledWith("/sequences/seq-1?tab=enroll");
    expect(result).toEqual({ ok: true, message: "Enrolled 3 prospects into the sequence." });
  });

  it("returns ok:false without calling enrollList when listId/sequenceId are missing", async () => {
    const enrollList = vi.fn();
    const router = { push: vi.fn() };
    const action: Extract<ChatAction, { type: "ui_action" }> = {
      type: "ui_action",
      name: "enroll_list",
      label: "Enroll list into sequence",
      params: {},
    };
    const result = await executeDexterAction(action, { router, enrollList });

    expect(enrollList).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });

  it("surfaces a failure message when the atomic endpoint rejects", async () => {
    const enrollList = vi.fn().mockRejectedValue(new Error("sequence_not_found"));
    const router = { push: vi.fn() };
    const result = await executeDexterAction(enrollAction, { router, enrollList });

    expect(result).toEqual({ ok: false, message: "Could not enroll: sequence_not_found" });
    expect(router.push).not.toHaveBeenCalled();
  });
});
