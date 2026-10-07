import { describe, expect, it } from "vitest";
import { CopsRequestError } from "@/lib/cops-fetch";
import { isStale, nextActionByDeal, stageMoveErrorMessage } from "./cops-crm";

function conflict(details: Record<string, unknown>) {
  return new CopsRequestError(
    "Illegal opportunity transition",
    { code: "BUSINESS_STATE_CONFLICT", message: "Illegal opportunity transition", details, request_id: "r", retryable: false },
    null
  );
}

describe("stageMoveErrorMessage", () => {
  it("explains a 409 with the current state and the allowed next moves", () => {
    const msg = stageMoveErrorMessage(
      conflict({ current_state: { state: "demo" }, requested_state: "won", allowed_transitions: ["commercial", "lost"] }),
      "Acme renewal"
    );
    expect(msg).toBe('"Acme renewal" can\'t go from Demo to Won. It can move to Commercial or Lost next.');
  });

  it("says a closed deal cannot move", () => {
    const msg = stageMoveErrorMessage(conflict({ current_state: { state: "won" }, requested_state: "demo", allowed_transitions: [] }));
    expect(msg).toBe("This deal can't go from Won to Demo. It is closed and cannot move.");
  });

  it("explains a permission error without a raw status", () => {
    const err = new CopsRequestError("nope", { code: "FORBIDDEN", message: "nope", request_id: "r", retryable: false }, null);
    expect(stageMoveErrorMessage(err)).toBe("You don't have permission to move deals.");
  });

  it("falls back to a generic message for unknown errors", () => {
    expect(stageMoveErrorMessage(new Error("network"))).toBe("Could not move this deal. Please try again.");
  });
});

describe("isStale", () => {
  const now = new Date("2026-10-07T00:00:00Z");
  it("flags an account untouched for more than 30 days", () => {
    expect(isStale("2026-08-23T00:00:00Z", now)).toBe(true);
  });
  it("does not flag a recently updated account", () => {
    expect(isStale("2026-10-01T00:00:00Z", now)).toBe(false);
  });
});

describe("nextActionByDeal", () => {
  it("picks the open task due soonest per deal, with undated tasks last", () => {
    const map = nextActionByDeal([
      { id: "t1", title: "Later", type: "call", due_at: "2026-10-20T00:00:00Z", related_entity_id: "d1" },
      { id: "t2", title: "Sooner", type: "email", due_at: "2026-10-10T00:00:00Z", related_entity_id: "d1" },
      { id: "t3", title: "No date", type: "note", due_at: null, related_entity_id: "d1" },
      { id: "t4", title: "Only one", type: "call", due_at: null, related_entity_id: "d2" },
      { id: "t5", title: "Orphan", type: "call", due_at: null, related_entity_id: null },
    ]);
    expect(map.get("d1")?.title).toBe("Sooner");
    expect(map.get("d2")?.title).toBe("Only one");
    expect(map.size).toBe(2);
  });
});
