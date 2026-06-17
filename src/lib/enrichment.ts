import { QueryClient } from "@tanstack/react-query";
import { useApiFetch } from "./api-client";
import type {
  ActivationRecord,
  CreditsResponse,
  EnrichField,
  EnrichmentBatch,
  EnrichmentJob,
  EnrichTriggerResponse,
  ListDetail,
  ProspectList,
  ProspectScoreRecord,
  ProspectSnapshotInput,
  ScoreResult,
} from "@/types/api";

export const CREDITS_QUERY_KEY = ["enrichment", "credits"] as const;
export const JOBS_QUERY_KEY = ["enrichment", "jobs"] as const;
export const WORKSPACE_CURRENT_QUERY_KEY = ["workspace-current"] as const;

type WorkspaceCurrentCache = {
  data: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    balance: number | null;
  };
};

function patchCreditsBalance(queryClient: QueryClient, delta: number) {
  if (delta === 0) return;

  queryClient.setQueryData<CreditsResponse>(CREDITS_QUERY_KEY, (old) =>
    old ? { ...old, balance: Math.max(0, old.balance + delta) } : old
  );

  queryClient.setQueryData<WorkspaceCurrentCache>(WORKSPACE_CURRENT_QUERY_KEY, (old) =>
    old?.data && old.data.balance !== null && old.data.balance !== undefined
      ? {
          ...old,
          data: { ...old.data, balance: Math.max(0, old.data.balance + delta) },
        }
      : old
  );
}

/** Immediately adjust cached balance after an enrich call; then refetch from API. */
export function syncCreditsAfterEnrich(queryClient: QueryClient, creditsUsed: number) {
  if (creditsUsed > 0) {
    patchCreditsBalance(queryClient, -creditsUsed);
  }
  void queryClient.refetchQueries({ queryKey: CREDITS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: WORKSPACE_CURRENT_QUERY_KEY });
}

/** Refetch credit balance everywhere it is shown (e.g. after batch jobs finish). */
export function refreshCredits(queryClient: QueryClient) {
  void queryClient.refetchQueries({ queryKey: CREDITS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: WORKSPACE_CURRENT_QUERY_KEY });
}

export function createOptimisticJobId(): string {
  return `optimistic-${Date.now()}`;
}

export function prependOptimisticJob(
  queryClient: QueryClient,
  job: { id: string; prospectId: string; fieldsRequested: EnrichField[] }
): void {
  const now = new Date().toISOString();
  const optimistic: EnrichmentJob = {
    id: job.id,
    workspaceId: "",
    prospectId: job.prospectId,
    status: "running",
    trigger: "manual",
    fieldsRequested: job.fieldsRequested,
    results: [],
    creditsUsed: 0,
    errorMessage: null,
    queuedAt: now,
    startedAt: now,
    completedAt: null,
  };
  queryClient.setQueryData<ListEnvelope<EnrichmentJob>>(JOBS_QUERY_KEY, (old) => {
    const data = [optimistic, ...(old?.data ?? [])];
    return { workspaceId: old?.workspaceId ?? "", data, total: data.length };
  });
}

export function removeJobFromCache(queryClient: QueryClient, jobId: string): void {
  queryClient.setQueryData<ListEnvelope<EnrichmentJob>>(JOBS_QUERY_KEY, (old) => {
    if (!old) return old;
    const data = old.data.filter((j) => j.id !== jobId);
    return { ...old, data, total: data.length };
  });
}

export function upsertJobFromEnrichResponse(
  queryClient: QueryClient,
  response: EnrichTriggerResponse,
  prospectId: string,
  fields: EnrichField[],
  replaceOptimisticId?: string
): void {
  const now = new Date().toISOString();
  const job: EnrichmentJob = {
    id: response.jobId,
    workspaceId: "",
    prospectId,
    status: response.status,
    trigger: "manual",
    fieldsRequested: fields,
    results: response.results ?? [],
    attempts: response.attempts,
    creditsUsed: response.creditsUsed,
    errorMessage: null,
    queuedAt: now,
    startedAt: now,
    completedAt:
      response.status === "completed" || response.status === "failed" ? now : null,
  };
  queryClient.setQueryData<ListEnvelope<EnrichmentJob>>(JOBS_QUERY_KEY, (old) => {
    let data = old?.data ?? [];
    if (replaceOptimisticId) {
      data = data.filter((j) => j.id !== replaceOptimisticId);
    }
    const existing = data.findIndex((j) => j.id === job.id);
    if (existing >= 0) {
      data = data.map((j, i) => (i === existing ? { ...j, ...job } : j));
    } else {
      data = [job, ...data];
    }
    return { workspaceId: old?.workspaceId ?? "", data, total: data.length };
  });
  void queryClient.refetchQueries({ queryKey: JOBS_QUERY_KEY });
}

export function refreshJobs(queryClient: QueryClient) {
  void queryClient.refetchQueries({ queryKey: JOBS_QUERY_KEY });
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

    createList: (name: string) =>
      fetchApi<ProspectList>("/api/v1/lists", {
        method: "POST",
        body: JSON.stringify({ name }),
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

    addToList: (listId: string, prospectIds: string[]) =>
      fetchApi<ProspectList>(`/api/v1/lists/${listId}/members`, {
        method: "POST",
        body: JSON.stringify({ prospectIds }),
        workspaceId: WORKSPACE_ID,
      }),

    getList: (listId: string) =>
      fetchApi<ListDetail>(`/api/v1/lists/${listId}`, {
        workspaceId: WORKSPACE_ID,
      }),

    getListMembers: (listId: string) =>
      fetchApi<ListMemberDetail[]>(`/api/v1/lists/${listId}/members`, {
        workspaceId: WORKSPACE_ID,
      }),

    scoreList: (listId: string) =>
      fetchApi<{ listId: string; scored: number; results: Array<{ prospectId: string; icpScore: number; icpBand: string }> }>(
        `/api/v1/lists/${listId}/score`,
        { method: "POST", workspaceId: WORKSPACE_ID }
      ),

    lookupScores: (prospectIds: string[]) =>
      fetchApi<{ scores: Record<string, ProspectScoreRecord> }>(
        "/api/v1/enrichment/scores/lookup",
        {
          method: "POST",
          body: JSON.stringify({ prospectIds }),
          workspaceId: WORKSPACE_ID,
        }
      ),

    scoreProspect: (prospect: ProspectSnapshotInput) =>
      fetchApi<ScoreResult>("/api/v1/enrichment/score", {
        method: "POST",
        body: JSON.stringify({ prospect }),
        workspaceId: WORKSPACE_ID,
      }),
  };
}
