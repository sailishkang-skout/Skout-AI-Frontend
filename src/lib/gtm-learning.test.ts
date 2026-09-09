import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGtmLearningApi, type GtmLearningOutcome } from "./gtm-learning";

const mockFetchApi = vi.fn();

vi.mock("./api-client", () => ({
  useApiFetch: () => mockFetchApi,
  useApiFetchBlob: () => vi.fn(),
}));

function outcome(id: string): GtmLearningOutcome {
  return {
    id,
    workspaceId: "ws-1",
    enrollmentId: `enr-${id}`,
    enrollmentStepId: `step-${id}`,
    sequenceId: "seq-1",
    prospectId: "p-1",
    touchpointAt: "2026-01-01T00:00:00Z",
    channel: "email",
    sequenceVersionId: null,
    variantKey: null,
    icpScore: null,
    icpPriority: null,
    signalType: null,
    signalStrength: null,
    replied: false,
    meetingBooked: false,
    opportunityCreated: false,
    pipelineAmount: null,
    revenueAmount: null,
    computedAt: "2026-01-01T00:00:00Z",
  };
}

describe("useGtmLearningApi.listAllOutcomes — §8.15 SP-16 pagination", () => {
  beforeEach(() => mockFetchApi.mockReset());

  it("stops after the first page when hasMore is false", async () => {
    mockFetchApi.mockResolvedValueOnce({ data: [outcome("1"), outcome("2")], total: 2, hasMore: false });

    const { result } = renderHook(() => useGtmLearningApi());
    const res = await result.current.listAllOutcomes();

    expect(mockFetchApi).toHaveBeenCalledTimes(1);
    expect(res.data).toHaveLength(2);
    expect(res.truncated).toBe(false);
  });

  it("keeps requesting the next page (with an advancing offset) while hasMore is true, then stops", async () => {
    mockFetchApi
      .mockResolvedValueOnce({ data: [outcome("1")], total: 1, hasMore: true })
      .mockResolvedValueOnce({ data: [outcome("2")], total: 1, hasMore: true })
      .mockResolvedValueOnce({ data: [outcome("3")], total: 1, hasMore: false });

    const { result } = renderHook(() => useGtmLearningApi());
    const res = await result.current.listAllOutcomes();

    expect(mockFetchApi).toHaveBeenCalledTimes(3);
    expect(res.data.map((r) => r.id)).toEqual(["1", "2", "3"]);
    expect(res.truncated).toBe(false);

    const urls = mockFetchApi.mock.calls.map((call) => call[0] as string);
    expect(urls[0]).toContain("offset=0");
    expect(urls[1]).toContain("offset=1000");
    expect(urls[2]).toContain("offset=2000");
  });

  it("marks the result truncated instead of looping forever if a workspace never runs out of pages", async () => {
    mockFetchApi.mockResolvedValue({ data: [outcome("x")], total: 1, hasMore: true });

    const { result } = renderHook(() => useGtmLearningApi());
    const res = await result.current.listAllOutcomes();

    expect(res.truncated).toBe(true);
    // Bounded by MAX_PAGES, not actually infinite.
    expect(mockFetchApi.mock.calls.length).toBeLessThan(1000);
  });
});
