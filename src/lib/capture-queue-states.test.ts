import { describe, expect, it } from "vitest";
import { STATE_FILTERS, STATE_LABELS, STATE_TONES, jobActions } from "./capture-queue";

describe("capture queue states", () => {
  it("has a label, a tone and a filter for the retrying state", () => {
    expect(STATE_LABELS.retrying).toBe("Retrying");
    expect(STATE_TONES.retrying).toBe("info");
    expect(STATE_FILTERS).toContain("retrying");
    for (const state of STATE_FILTERS) expect(STATE_LABELS[state]).toBeTruthy();
  });

  it("lets a retrying job be cancelled but not restarted over itself, and a stuck or failed one be resumed or retried", () => {
    expect(jobActions({ state: "retrying", mode: "extension" })).toEqual(["start", "cancel"]);
    expect(jobActions({ state: "retrying", mode: "unipile" })).toEqual(["pause", "cancel"]);
    expect(jobActions({ state: "interrupted", mode: "extension" })).toEqual(["resume", "cancel"]);
    expect(jobActions({ state: "failed", mode: "extension" })).toEqual(["retry"]);
    expect(jobActions({ state: "completed", mode: "extension" })).toEqual([]);
  });
});
