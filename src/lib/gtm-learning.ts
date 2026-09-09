import { useApiFetch } from "./api-client";

/** §8.15 SP-16 — one row per executed touchpoint. ICP/signal/outcome fields are enrollment-level
 * context duplicated across every touchpoint row for that enrollment — pipelineAmount/
 * revenueAmount are the SAME value repeated across those rows, so any client-side sum MUST
 * dedupe by enrollmentId first or it will double/triple count. numeric(14,2) columns come back
 * as strings (or null) per Drizzle's default numeric mode, never a JS number. */
export interface GtmLearningOutcome {
  id: string;
  workspaceId: string;
  enrollmentId: string;
  enrollmentStepId: string;
  sequenceId: string;
  prospectId: string;
  touchpointAt: string;
  channel: string;
  sequenceVersionId: string | null;
  variantKey: string | null;
  icpScore: number | null;
  icpPriority: string | null;
  signalType: string | null;
  signalStrength: number | null;
  replied: boolean;
  meetingBooked: boolean;
  opportunityCreated: boolean;
  pipelineAmount: string | null;
  revenueAmount: string | null;
  computedAt: string;
}

export interface GtmLearningOutcomeFilters {
  channel?: string;
  signalType?: string;
  variantKey?: string;
  sequenceId?: string;
  icpPriority?: string;
  limit?: number;
  offset?: number;
}

const PAGE_SIZE = 1000;
/** Hard ceiling on how many rows a single report load will page through, so a runaway/corrupt
 * table can't hang the page in an effectively-infinite fetch loop. 200 pages * 1000 rows/page —
 * generous for any real workspace; if a workspace ever legitimately exceeds it, that's a signal
 * this needs server-side aggregation, not a bigger client-side cap. */
const MAX_PAGES = 200;

export function useGtmLearningApi() {
  const fetchApi = useApiFetch();

  const listOutcomesPage = (filters: GtmLearningOutcomeFilters = {}) => {
    const query = new URLSearchParams();
    if (filters.channel) query.set("channel", filters.channel);
    if (filters.signalType) query.set("signalType", filters.signalType);
    if (filters.variantKey) query.set("variantKey", filters.variantKey);
    if (filters.sequenceId) query.set("sequenceId", filters.sequenceId);
    if (filters.icpPriority) query.set("icpPriority", filters.icpPriority);
    if (filters.limit) query.set("limit", String(filters.limit));
    if (filters.offset != null) query.set("offset", String(filters.offset));
    const qs = query.toString();
    return fetchApi<{ data: GtmLearningOutcome[]; total: number; hasMore: boolean }>(
      `/api/v1/gtm-learning-outcomes${qs ? `?${qs}` : ""}`
    );
  };

  return {
    listOutcomesPage,

    /** Pages through every matching row (not just the first PAGE_SIZE) so totals computed from
     * the result are exact, not a capped sample. */
    listAllOutcomes: async (filters: Omit<GtmLearningOutcomeFilters, "limit" | "offset"> = {}) => {
      const all: GtmLearningOutcome[] = [];
      let offset = 0;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const res = await listOutcomesPage({ ...filters, limit: PAGE_SIZE, offset });
        all.push(...res.data);
        if (!res.hasMore) return { data: all, truncated: false };
        offset += PAGE_SIZE;
      }
      return { data: all, truncated: true };
    },

    /** On-demand refresh — useful right after a backfill/test-data seed. */
    refresh: () =>
      fetchApi<{ data: unknown }>("/api/v1/gtm-learning-outcomes/refresh", { method: "POST" }),
  };
}
