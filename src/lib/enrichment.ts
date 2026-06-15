import { QueryClient } from "@tanstack/react-query";
import { useApiFetch } from "./api-client";
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

export function useEnrichmentApi() {
  const fetchApi = useApiFetch();
  return {
    getCredits: () =>
      fetchApi<CreditsResponse>("/api/v1/enrichment/credits", { workspaceId: WORKSPACE_ID }),

    listJobs: () =>
      fetchApi<ListEnvelope<EnrichmentJob>>("/api/v1/enrichment/jobs", {
        workspaceId: WORKSPACE_ID,
      }),

    getJob: (jobId: string) =>
      fetchApi<EnrichmentJob>(`/api/v1/enrichment/jobs/${jobId}`, { workspaceId: WORKSPACE_ID }),

    getBatch: (batchId: string) =>
      fetchApi<EnrichmentBatch>(`/api/v1/enrichment/batches/${batchId}`, {
        workspaceId: WORKSPACE_ID,
      }),

    listActivations: () =>
      fetchApi<ListEnvelope<ActivationRecord>>("/api/v1/prospects", { workspaceId: WORKSPACE_ID }),

    enrichProspect: (
      prospectId: string,
      prospect: ProspectSnapshotInput,
      fields?: EnrichField[]
    ) =>
      fetchApi<EnrichTriggerResponse>(`/api/v1/prospects/${encodeURIComponent(prospectId)}/enrich`, {
        method: "POST",
        body: JSON.stringify({ prospect, fields }),
        workspaceId: WORKSPACE_ID,
      }),

    activate: (prospects: ProspectSnapshotInput[]) =>
      fetchApi<{ activated: number }>("/api/v1/prospects/activate", {
        method: "POST",
        body: JSON.stringify({ prospects }),
        workspaceId: WORKSPACE_ID,
      }),

    listLists: () =>
      fetchApi<ListEnvelope<ProspectList>>("/api/v1/lists", { workspaceId: WORKSPACE_ID }),

    createList: (name: string, prospects: ProspectSnapshotInput[]) =>
      fetchApi<ProspectList>("/api/v1/lists", {
        method: "POST",
        body: JSON.stringify({ name, prospects }),
        workspaceId: WORKSPACE_ID,
      }),

    enrichList: (listId: string, fields?: EnrichField[]) =>
      fetchApi<{ batchId: string; status: string; total: number }>(
        `/api/v1/lists/${listId}/enrich`,
        {
          method: "POST",
          body: JSON.stringify({ fields }),
          workspaceId: WORKSPACE_ID,
        }
      ),

    addToList: (listId: string, prospects: ProspectSnapshotInput[]) =>
      fetchApi<ProspectList>(`/api/v1/lists/${listId}/members`, {
        method: "POST",
        body: JSON.stringify({ prospects }),
        workspaceId: WORKSPACE_ID,
      }),
  };
}
