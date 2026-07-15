import { QueryClient } from "@tanstack/react-query";
import { useApiFetch, useApiFetchBlob, CLERK_ENABLED, ApiError, getApiBase } from "./api-client";
import type {
  ActivationRecord,
  CreditsResponse,
  CsvExportResponse,
  EnrichField,
  EnrichmentBatch,
  EnrichmentJob,
  EnrichTriggerResponse,
  ListDetail,
  ListMemberDetail,
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
    startedAt: null,
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
    queuedAt: response.queuedAt ?? new Date().toISOString(),
    startedAt: response.startedAt ?? null,
    completedAt: response.completedAt ?? null,
  };
  queryClient.setQueryData<ListEnvelope<EnrichmentJob>>(JOBS_QUERY_KEY, (old) => {
    let data = old?.data ?? [];
    if (replaceOptimisticId) {
      data = data.filter((j) => j.id !== replaceOptimisticId);
    }
    const existingIdx = data.findIndex((j) => j.id === job.id);
    const optimisticIdx = replaceOptimisticId
      ? -1
      : data.findIndex((j) => j.id.startsWith("optimistic-") && j.prospectId === prospectId);
    const prior = existingIdx >= 0 ? data[existingIdx] : optimisticIdx >= 0 ? data[optimisticIdx] : null;
    const merged: EnrichmentJob = {
      ...job,
      queuedAt: job.queuedAt ?? prior?.queuedAt ?? job.queuedAt,
      startedAt: job.startedAt ?? prior?.startedAt ?? null,
      completedAt: job.completedAt ?? prior?.completedAt ?? null,
    };
    if (existingIdx >= 0) {
      data = data.map((j, i) => (i === existingIdx ? { ...j, ...merged } : j));
    } else if (optimisticIdx >= 0) {
      data = data.map((j, i) => (i === optimisticIdx ? { ...j, ...merged } : j));
    } else {
      data = [merged, ...data];
    }
    return { workspaceId: old?.workspaceId ?? "", data, total: data.length };
  });
  void queryClient.refetchQueries({ queryKey: JOBS_QUERY_KEY });
}

/** Poll a list score job until complete (mirrors CRM export polling). */
export async function pollScoreJob(
  getJob: (jobId: string) => Promise<import("@/types/api").ListScoreJob>,
  jobId: string,
  maxAttempts = 60,
  intervalMs = 2000,
  onProgress?: (job: import("@/types/api").ListScoreJob, attempt: number) => void
): Promise<import("@/types/api").ListScoreJob> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const job = await getJob(jobId);
    onProgress?.(job, attempt);
    if (job.status === "completed" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return getJob(jobId);
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

    retryJob: (jobId: string) =>
      fetchApi<EnrichTriggerResponse>(`/api/v1/enrichment/jobs/${jobId}/retry`, {
        method: "POST",
        workspaceId: WORKSPACE_ID,
      }),

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

    renameList: (listId: string, name: string) =>
      fetchApi<ProspectList>(`/api/v1/lists/${listId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
        workspaceId: WORKSPACE_ID,
      }),

    deleteList: (listId: string) =>
      fetchApi<void>(`/api/v1/lists/${listId}`, {
        method: "DELETE",
        workspaceId: WORKSPACE_ID,
      }),

    removeMembers: (listId: string, prospectIds: string[]) =>
      fetchApi<ProspectList>(`/api/v1/lists/${listId}/members`, {
        method: "DELETE",
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

    scoreList: async (listId: string) => {
      const res = await fetchApi<
        | { jobId: string; status: "pending" }
        | {
            status: "completed";
            listId: string;
            scored: number;
            skipped?: number;
            creditsUsed?: number;
            results: Array<{ prospectId: string; icpScore: number; icpBand: string }>;
          }
      >(`/api/v1/lists/${listId}/score`, { method: "POST", workspaceId: WORKSPACE_ID });
      return res;
    },

    getScoreJob: (jobId: string) =>
      fetchApi<import("@/types/api").ListScoreJob>(`/api/v1/enrichment/score-jobs/${jobId}`, {
        workspaceId: WORKSPACE_ID,
      }),

    verifyListEmails: (listId: string) =>
      fetchApi<import("@/types/api").ListVerifySummary>(`/api/v1/lists/${listId}/verify`, {
        method: "POST",
        workspaceId: WORKSPACE_ID,
      }),

    listScrapeJobs: () =>
      fetchApi<{ data: import("@/types/api").ScrapeJobRow[]; total: number }>("/api/v1/scrape/jobs", {
        workspaceId: WORKSPACE_ID,
      }),

    triggerScrapeJob: (body: { source: string; seeds: string[] }) =>
      fetchApi<{
        jobId: string;
        source: string;
        status: string;
        seeds?: string[];
        warning?: string;
        error?: string;
      }>("/api/v1/scrape/jobs", {
        method: "POST",
        body: JSON.stringify(body),
        workspaceId: WORKSPACE_ID,
      }),

    getScrapeJob: (jobId: string) =>
      fetchApi<import("@/types/api").ScrapeJobRow>(`/api/v1/scrape/jobs/${jobId}`, {
        workspaceId: WORKSPACE_ID,
      }),

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

export const CSV_EXPORT_CREDIT_COST = 2;

export function useListExportApi() {
  const fetchApi = useApiFetch();
  const fetchBlob = useApiFetchBlob();

  return {
    exportListCsv: async (listId: string): Promise<CsvExportResponse> => {
      const meta = await fetchApi<CsvExportResponse & { content?: string }>(
        `/api/v1/lists/${listId}/export/csv`,
        { method: "GET", workspaceId: WORKSPACE_ID }
      );

      if (meta.content) {
        const blob = new Blob([meta.content], { type: "text/csv;charset=utf-8" });
        triggerBlobDownload(blob, meta.filename);
        return meta;
      }

      const key = meta.exportKey;
      if (!key) {
        throw new ApiError("export_key_missing", 500);
      }

      const blob = await fetchBlob(
        `/api/v1/lists/${listId}/export/csv/download?key=${encodeURIComponent(key)}`,
        { workspaceId: WORKSPACE_ID }
      );
      triggerBlobDownload(blob, meta.filename);
      return meta;
    },
  };
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

