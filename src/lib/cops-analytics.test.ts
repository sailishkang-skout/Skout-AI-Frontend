import { beforeEach, describe, expect, it, vi } from "vitest";

const ph = vi.hoisted(() => ({ __loaded: true, capture: vi.fn() }));
vi.mock("posthog-js", () => ({ default: ph }));

import { COPS_ANALYTICS_EVENTS, trackCops, withCopsTracking } from "./cops-analytics";

describe("cops-analytics", () => {
  beforeEach(() => {
    ph.__loaded = true;
    ph.capture.mockReset();
  });

  it("adds schema_version and surface to every event", () => {
    trackCops("cops.proposal_sent", { proposal_id: "p1" });
    expect(ph.capture).toHaveBeenCalledWith("cops.proposal_sent", { proposal_id: "p1", schema_version: 1, surface: "web" });
  });

  it("does nothing when PostHog is not configured", () => {
    ph.__loaded = false;
    trackCops("cops.proposal_sent");
    expect(ph.capture).not.toHaveBeenCalled();
  });

  it("never lets an analytics failure break the action", () => {
    ph.capture.mockImplementation(() => {
      throw new Error("blocked by an ad blocker");
    });
    expect(() => trackCops("cops.credits_granted")).not.toThrow();
  });

  it("records the event only after the write succeeds, with props from the result", async () => {
    const res = await withCopsTracking("cops.gate_overridden", async () => ({ data: { fired_now: true } }), (r) => ({ fired_now: r.data.fired_now }));
    expect(res.data.fired_now).toBe(true);
    expect(ph.capture).toHaveBeenCalledWith("cops.gate_overridden", expect.objectContaining({ fired_now: true }));

    ph.capture.mockReset();
    await expect(withCopsTracking("cops.gate_overridden", async () => Promise.reject(new Error("409")))).rejects.toThrow("409");
    expect(ph.capture).not.toHaveBeenCalled();
  });

  it("uses one canonical name per action", () => {
    expect(new Set(COPS_ANALYTICS_EVENTS).size).toBe(COPS_ANALYTICS_EVENTS.length);
    for (const name of COPS_ANALYTICS_EVENTS) expect(name).toMatch(/^cops\.[a-z_]+$/);
  });
});
