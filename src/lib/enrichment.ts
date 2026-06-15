import { QueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api-client";
import type {
  ActivationRecord,
  CreditsResponse,
  EnrichField,
  EnrichmentBatch,
  EnrichmentJob,
  EnrichTriggerResponse,
  ProspectList,
  ProspectSnapshotInput,
} from "@/types/api";

export const CREDITS_QUERY_KEY = ["enrichment", "credits"] as const;
export const JOBS_QUERY_KEY = ["enrichment", "jobs"] as const;

/** Immediately adjust cached balance after an enrich call; then refetch from API. */
export function syncCreditsAfterEnrich(queryClient: QueryClient, creditsUsed: number) {
  if (creditsUsed > 0) {
    queryClient.setQueryData<CreditsResponse>(CREDITS_QUERY_KEY, (old) =>
      old ? { ...old, balance: Math.max(0, old.balance - creditsUsed) } : old
    );
  }
  void queryClient.refetchQueries({ queryKey: CREDITS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEY });
}

/**
 * Demo workspace — matches the API's default tenant context
 * (apps/api workspace-context plugin). Override via NEXT_PUBLIC_WORKSPACE_ID;
 * replace with the authenticated workspace id once auth lands.
 */
export const WORKSPACE_ID =
  process.env.NEXT_PUBLIC_WORKSPACE_ID ?? "00000000-0000-4000-8000-000000000001";

interface ListEnvelope<T> {
  workspaceId: string;
  data: T[];
  total: number;
}

export const enrichmentApi = {
  getCredits: () =>
    apiFetch<CreditsResponse>("/api/v1/enrichment/credits", { workspaceId: WORKSPACE_ID }),

  listJobs: () =>
    apiFetch<ListEnvelope<EnrichmentJob>>("/api/v1/enrichment/jobs", {
      workspaceId: WORKSPACE_ID,
    }),

  getJob: (jobId: string) =>
    apiFetch<EnrichmentJob>(`/api/v1/enrichment/jobs/${jobId}`, { workspaceId: WORKSPACE_ID }),

  getBatch: (batchId: string) =>
    apiFetch<EnrichmentBatch>(`/api/v1/enrichment/batches/${batchId}`, {
      workspaceId: WORKSPACE_ID,
    }),

  listActivations: () =>
    apiFetch<ListEnvelope<ActivationRecord>>("/api/v1/prospects", { workspaceId: WORKSPACE_ID }),

  enrichProspect: (
    prospectId: string,
    prospect: ProspectSnapshotInput,
    fields?: EnrichField[]
  ) =>
    apiFetch<EnrichTriggerResponse>(`/api/v1/prospects/${encodeURIComponent(prospectId)}/enrich`, {
      method: "POST",
      body: JSON.stringify({ prospect, fields }),
      workspaceId: WORKSPACE_ID,
    }),

  activate: (prospects: ProspectSnapshotInput[]) =>
    apiFetch<{ activated: number }>("/api/v1/prospects/activate", {
      method: "POST",
      body: JSON.stringify({ prospects }),
      workspaceId: WORKSPACE_ID,
    }),

  listLists: () =>
    apiFetch<ListEnvelope<ProspectList>>("/api/v1/lists", { workspaceId: WORKSPACE_ID }),

  createList: (name: string, prospects: ProspectSnapshotInput[]) =>
    apiFetch<ProspectList>("/api/v1/lists", {
      method: "POST",
      body: JSON.stringify({ name, prospects }),
      workspaceId: WORKSPACE_ID,
    }),

  enrichList: (listId: string, fields?: EnrichField[]) =>
    apiFetch<{ batchId: string; status: string; total: number }>(
      `/api/v1/lists/${listId}/enrich`,
      {
        method: "POST",
        body: JSON.stringify({ fields }),
        workspaceId: WORKSPACE_ID,
      }
    ),

  addToList: (listId: string, prospects: ProspectSnapshotInput[]) =>
    apiFetch<ProspectList>(`/api/v1/lists/${listId}/members`, {
      method: "POST",
      body: JSON.stringify({ prospects }),
      workspaceId: WORKSPACE_ID,
    }),
};
