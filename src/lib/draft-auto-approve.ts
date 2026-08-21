import { useApiFetch } from "./api-client";
import type { DraftAutoApproveSettings } from "@/types/api";

export interface DraftAutoApproveInput {
  enabled: boolean;
  minIcpScore?: number | null;
  minConfidence?: number | null;
  alwaysReviewListIds?: string[];
}

/**
 * R13.2 — workspace AI-draft auto-approve thresholds.
 * Backend: apps/api/src/routes/ai.routes.ts (GET/PUT /ai/draft-auto-approve-settings).
 */
export function useDraftAutoApproveApi() {
  const fetchApi = useApiFetch();
  return {
    get: () => fetchApi<{ data: DraftAutoApproveSettings }>("/api/v1/ai/draft-auto-approve-settings"),

    update: (input: DraftAutoApproveInput) =>
      fetchApi<{ data: DraftAutoApproveSettings }>("/api/v1/ai/draft-auto-approve-settings", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
  };
}
