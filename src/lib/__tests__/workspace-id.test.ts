import { describe, expect, it } from "vitest";
import { WORKSPACE_ID } from "@/lib/enrichment";

describe("WORKSPACE_ID", () => {
  it("is unset unless NEXT_PUBLIC_WORKSPACE_ID is configured, so no X-Workspace-Id is sent", () => {
    // The old default was a fixed demo tenant id that the API refuses for anyone who is not a member of it.
    expect(process.env.NEXT_PUBLIC_WORKSPACE_ID).toBeUndefined();
    expect(WORKSPACE_ID).toBeUndefined();
  });
});
