import { describe, expect, it } from "vitest";
import { aiDraftStatusLabel, aiDraftStatusTone } from "./ai-drafts";

describe("ai-drafts helpers", () => {
  it("maps status labels", () => {
    expect(aiDraftStatusLabel("pending_review")).toBe("Pending");
    expect(aiDraftStatusLabel("approved")).toBe("Approved");
    expect(aiDraftStatusLabel("rejected")).toBe("Rejected");
    expect(aiDraftStatusLabel("edited")).toBe("Edited");
  });

  it("maps status tones", () => {
    expect(aiDraftStatusTone("pending_review")).toBe("info");
    expect(aiDraftStatusTone("approved")).toBe("success");
    expect(aiDraftStatusTone("rejected")).toBe("danger");
    expect(aiDraftStatusTone("edited")).toBe("warning");
  });
});
