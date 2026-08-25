"use client";

import { useApiFetch } from "./api-client";
import { WORKSPACE_ID } from "./enrichment";
import type { IdentityMergeProposal } from "@/types/api";

interface ListResponse<T> {
  data: T[];
  total: number;
}

export const IDENTITY_MERGE_PROPOSALS_QUERY_KEY = ["identity-merge", "proposals"] as const;

/**
 * §5.2 (Enterprise Completion Plan, Task 22) — client for apps/api's identity-merge routes
 * (apps/api/src/routes/identity-merge.routes.ts). Only wraps what that API actually exposes
 * today: list + resolve (approve/reject) pending proposals. There is no GET endpoint for past
 * identity_merge_events yet, so a "view/undo an already-approved merge" surface isn't buildable
 * against the shipped API — see the identity-merge review page's own comment for the same note.
 */
export function useIdentityMergeApi() {
  const fetchApi = useApiFetch();

  return {
    listProposals: () =>
      fetchApi<ListResponse<IdentityMergeProposal>>("/api/v1/identity-merge/proposals", {
        workspaceId: WORKSPACE_ID,
      }),

    /**
     * `beforeSnapshot` is required by the backend when decision === "approved" (it's what makes
     * the merge reversible later) and ignored otherwise. The backend accepts any JSON shape
     * (z.unknown()) — this UI sends `{ left: <full left entity>, right: <full right entity> }`
     * using whatever this page already fetched to render the comparison, so the snapshot is the
     * same data the reviewer actually looked at.
     */
    resolveProposal: (
      proposalId: string,
      decision: "approved" | "rejected",
      beforeSnapshot?: unknown
    ) =>
      fetchApi<IdentityMergeProposal>(`/api/v1/identity-merge/proposals/${proposalId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ decision, beforeSnapshot }),
        workspaceId: WORKSPACE_ID,
      }),
  };
}
