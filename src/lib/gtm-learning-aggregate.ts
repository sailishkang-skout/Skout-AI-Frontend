import type { GtmLearningOutcome } from "./gtm-learning";

export interface GtmLearningSliceRow {
  key: string;
  touchpointCount: number;
  /** Outcome fields (replied/meetingBooked/opportunityCreated/pipeline/revenue) are enrollment-
   * level, duplicated across every touchpoint row for that enrollment — this is the deduped
   * count they were computed over, distinct from touchpointCount above. */
  enrollmentCount: number;
  repliedCount: number;
  meetingBookedCount: number;
  opportunityCount: number;
  pipelineAmount: number;
  revenueAmount: number;
}

function parseAmount(v: string | null): number {
  if (v === null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * §8.15 SP-16 — groups touchpoint rows by a dimension (channel, signalType, ...) and sums
 * pipeline/revenue as the primary metric. Rows sharing an enrollmentId carry the SAME
 * pipeline/revenue/replied/meetingBooked/opportunityCreated values (they're enrollment-level
 * context, not per-touchpoint) — summing them per raw row would double/triple-count every
 * enrollment with more than one touchpoint in a bucket. This dedupes by enrollmentId within each
 * slice bucket before summing, so a 3-email sequence's pipeline is counted once, not 3 times.
 */
export function aggregateGtmLearningOutcomes(
  rows: GtmLearningOutcome[],
  dimension: (row: GtmLearningOutcome) => string | null
): GtmLearningSliceRow[] {
  const buckets = new Map<string, GtmLearningOutcome[]>();
  for (const row of rows) {
    const key = dimension(row) ?? "(unknown)";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  const result: GtmLearningSliceRow[] = [];
  for (const [key, bucketRows] of Array.from(buckets.entries())) {
    const byEnrollment = new Map<string, GtmLearningOutcome>();
    for (const row of bucketRows) {
      if (!byEnrollment.has(row.enrollmentId)) byEnrollment.set(row.enrollmentId, row);
    }
    const deduped = Array.from(byEnrollment.values());

    result.push({
      key,
      touchpointCount: bucketRows.length,
      enrollmentCount: deduped.length,
      repliedCount: deduped.filter((r) => r.replied).length,
      meetingBookedCount: deduped.filter((r) => r.meetingBooked).length,
      opportunityCount: deduped.filter((r) => r.opportunityCreated).length,
      pipelineAmount: deduped.reduce((sum, r) => sum + parseAmount(r.pipelineAmount), 0),
      revenueAmount: deduped.reduce((sum, r) => sum + parseAmount(r.revenueAmount), 0),
    });
  }

  return result.sort((a, b) => b.pipelineAmount - a.pipelineAmount);
}
