import { describe, expect, it } from "vitest";
import { aggregateGtmLearningOutcomes } from "./gtm-learning-aggregate";
import type { GtmLearningOutcome } from "./gtm-learning";

function row(overrides: Partial<GtmLearningOutcome>): GtmLearningOutcome {
  return {
    id: overrides.id ?? "row-1",
    workspaceId: "ws-1",
    enrollmentId: "enr-1",
    enrollmentStepId: "step-1",
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
    ...overrides,
  };
}

describe("aggregateGtmLearningOutcomes — §8.15 SP-16", () => {
  it("dedupes pipeline/revenue by enrollmentId so a multi-touchpoint enrollment isn't double-counted", () => {
    const rows = [
      row({ id: "r1", enrollmentId: "enr-1", channel: "email", pipelineAmount: "1000.00", revenueAmount: "0" }),
      row({ id: "r2", enrollmentId: "enr-1", channel: "email", pipelineAmount: "1000.00", revenueAmount: "0" }),
      row({ id: "r3", enrollmentId: "enr-1", channel: "email", pipelineAmount: "1000.00", revenueAmount: "0" }),
    ];

    const result = aggregateGtmLearningOutcomes(rows, (r) => r.channel);

    expect(result).toHaveLength(1);
    expect(result[0].touchpointCount).toBe(3);
    expect(result[0].enrollmentCount).toBe(1);
    expect(result[0].pipelineAmount).toBe(1000);
  });

  it("sums pipeline/revenue correctly across distinct enrollments within the same slice", () => {
    const rows = [
      row({ id: "r1", enrollmentId: "enr-1", channel: "email", pipelineAmount: "1000.00" }),
      row({ id: "r2", enrollmentId: "enr-2", channel: "email", pipelineAmount: "500.50" }),
    ];

    const result = aggregateGtmLearningOutcomes(rows, (r) => r.channel);

    expect(result[0].pipelineAmount).toBe(1500.5);
    expect(result[0].enrollmentCount).toBe(2);
  });

  it("groups by the given dimension and sorts slices by pipeline descending", () => {
    const rows = [
      row({ id: "r1", enrollmentId: "enr-1", channel: "linkedin", pipelineAmount: "200" }),
      row({ id: "r2", enrollmentId: "enr-2", channel: "email", pipelineAmount: "9000" }),
    ];

    const result = aggregateGtmLearningOutcomes(rows, (r) => r.channel);

    expect(result.map((r) => r.key)).toEqual(["email", "linkedin"]);
  });

  it("buckets a null dimension value under '(unknown)' instead of dropping the row", () => {
    const rows = [row({ id: "r1", enrollmentId: "enr-1", signalType: null })];

    const result = aggregateGtmLearningOutcomes(rows, (r) => r.signalType);

    expect(result[0].key).toBe("(unknown)");
  });

  it("treats null pipeline/revenue amounts as zero rather than NaN", () => {
    const rows = [row({ id: "r1", enrollmentId: "enr-1", pipelineAmount: null, revenueAmount: null })];

    const result = aggregateGtmLearningOutcomes(rows, (r) => r.channel);

    expect(result[0].pipelineAmount).toBe(0);
    expect(result[0].revenueAmount).toBe(0);
  });

  it("counts replied/meetingBooked/opportunityCreated once per enrollment, not per touchpoint", () => {
    const rows = [
      row({ id: "r1", enrollmentId: "enr-1", channel: "email", replied: true, meetingBooked: true }),
      row({ id: "r2", enrollmentId: "enr-1", channel: "email", replied: true, meetingBooked: true }),
      row({ id: "r3", enrollmentId: "enr-2", channel: "email", replied: false }),
    ];

    const result = aggregateGtmLearningOutcomes(rows, (r) => r.channel);

    expect(result[0].enrollmentCount).toBe(2);
    expect(result[0].repliedCount).toBe(1);
    expect(result[0].meetingBookedCount).toBe(1);
  });
});
