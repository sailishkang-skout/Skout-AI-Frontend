import { useMemo } from "react";
import { useApiFetch } from "@/lib/api-client";

/**
 * LinkedIn Enrichment → Capture queue: people capture jobs of the workspace, read in a member's
 * browser by the Skout extension (manual) or on the server through the workspace's LinkedIn
 * account (automatic). Every path here is the API's full `/api/v1/...` path.
 */

export type CaptureJobState =
  | "queued"
  | "running"
  | "review"
  | "paused"
  | "completed"
  | "partial"
  | "failed"
  | "skipped"
  | "cancelled"
  | "interrupted";

export type CaptureMode = "extension" | "unipile";

export interface CaptureJob {
  companyPublicId: string;
  companyName: string | null;
  sourceUrl: string;
  pagesRead: number;
  peopleFound: number;
  expectedPeople: number | null;
  remainingPeople: number | null;
  batches: number;
  peopleCreated: number;
  peopleMerged: number;
  peopleRejected: number;
  complete: boolean;
  status: string;
  state: CaptureJobState;
  error: string | null;
  mode: CaptureMode;
  nextRunAt: string | null;
  attempts: number;
  startedBy: string | null;
  stopReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaptureQueueStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
  paused: number;
  peopleCaptured: number;
  daily: Array<{ day: string; created: number; completed: number; failed: number }>;
}

export interface CaptureQueuePage {
  items: CaptureJob[];
  total: number;
  page: number;
  pageSize: number;
  stats: CaptureQueueStats;
}

export interface CaptureJobDetails {
  item: CaptureJob;
  batches: Array<{
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    pagesRead: number;
    received: number;
    created: number;
    merged: number;
    rejected: number;
    error: string | null;
  }>;
  peopleTotal: number;
  people: Array<{ id: string; name: string | null; title: string | null; linkedinUrl: string | null; verified: boolean; savedAt: string }>;
}

export interface CapturableCompany {
  companyPublicId: string;
  name: string;
  peopleSaved: number;
  peopleFound: number;
  expectedPeople: number | null;
  complete: boolean | null;
  status: string | null;
  mode: string | null;
}

export interface CaptureStatus {
  enabled: boolean;
  disabledReason?: string | null;
  caps: { maxPagesPerRun: number; maxLeadsPerRun: number; dailyLeadLimit: number };
  usage: { remainingToday: number; leadsToday?: number };
}

export interface AutoCaptureStatus {
  available: boolean;
  reason: string | null;
  accountName: string | null;
}

export interface CaptureRunSummary {
  id: string;
  kind: "person" | "company" | "sales_search";
  status: string;
  sourceUrl: string | null;
  leadsReceived: number;
  leadsCreated: number;
  leadsMerged: number;
  leadsRejected: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface CaptureQueueFilters {
  q?: string;
  mode?: CaptureMode | "";
  state?: CaptureJobState | "";
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

const BASE = "/api/v1/enrichment/capture";
const id = (companyPublicId: string) => encodeURIComponent(companyPublicId);

export function queueQueryString(filters: CaptureQueueFilters): string {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.mode) params.set("mode", filters.mode);
  if (filters.state) params.set("state", filters.state);
  // Dates are whole days in the viewer's time zone.
  if (filters.from) params.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
  if (filters.to) params.set("to", new Date(`${filters.to}T23:59:59.999`).toISOString());
  params.set("page", String(filters.page ?? 1));
  params.set("pageSize", String(filters.pageSize ?? 10));
  return params.toString();
}

export function useCaptureQueueApi() {
  const apiFetch = useApiFetch();
  return useMemo(
    () => ({
      jobs: (filters: CaptureQueueFilters) => apiFetch<CaptureQueuePage>(`${BASE}/queue?${queueQueryString(filters)}`),
      job: (companyPublicId: string) => apiFetch<CaptureJobDetails>(`${BASE}/queue/${id(companyPublicId)}`),
      companies: () => apiFetch<{ companies: CapturableCompany[] }>(`${BASE}/companies`),
      status: () => apiFetch<CaptureStatus>(`${BASE}/status`),
      auto: () => apiFetch<AutoCaptureStatus>(`${BASE}/auto`),
      runs: () => apiFetch<{ runs: CaptureRunSummary[] }>(`${BASE}/runs`),
      startAuto: (companyPublicIds: string[]) =>
        apiFetch<{ queued: string[]; skipped: Array<{ companyPublicId: string; reason: string }> }>(`${BASE}/auto`, {
          method: "POST",
          body: JSON.stringify({ companyPublicIds }),
        }),
      queueForExtension: (companyPublicId: string, companyName: string) =>
        apiFetch(`${BASE}/queue/${id(companyPublicId)}`, { method: "PUT", body: JSON.stringify({ status: "queued", companyName }) }),
      resume: (companyPublicId: string) => apiFetch(`${BASE}/queue/${id(companyPublicId)}/resume`, { method: "POST" }),
      pause: (companyPublicId: string) => apiFetch(`${BASE}/queue/${id(companyPublicId)}/pause`, { method: "POST" }),
      cancel: (companyPublicId: string) => apiFetch(`${BASE}/queue/${id(companyPublicId)}/cancel`, { method: "POST" }),
      remove: (companyPublicId: string) => apiFetch(`${BASE}/queue/${id(companyPublicId)}`, { method: "DELETE" }),
    }),
    [apiFetch]
  );
}

export const STATE_LABELS: Record<CaptureJobState, string> = {
  queued: "Queued",
  running: "Running",
  review: "Waiting for review",
  paused: "Paused",
  completed: "Completed",
  partial: "Partially completed",
  failed: "Failed",
  skipped: "Skipped",
  cancelled: "Cancelled",
  interrupted: "Interrupted",
};

export const STATE_TONES: Record<CaptureJobState, "success" | "warning" | "danger" | "info" | "muted"> = {
  queued: "muted",
  running: "info",
  review: "info",
  paused: "warning",
  completed: "success",
  partial: "warning",
  failed: "danger",
  skipped: "muted",
  cancelled: "muted",
  interrupted: "warning",
};

/** Status filter choices, in the order the dashboard offers them. */
export const STATE_FILTERS: CaptureJobState[] = ["queued", "running", "review", "paused", "interrupted", "completed", "partial", "failed", "cancelled"];

export const isAutomatic = (job: Pick<CaptureJob, "mode">) => job.mode === "unipile";
export const sourceLabel = (job: Pick<CaptureJob, "mode">) => (isAutomatic(job) ? "Automatic" : "Manual");

export type JobAction = "pause" | "resume" | "retry" | "start" | "cancel";

/**
 * Actions that fit a job's state. Pause works on the server's automatic jobs; the extension pauses
 * its own queue from its side panel. A finished job has nothing left to do.
 */
export function jobActions(job: Pick<CaptureJob, "state" | "mode">): JobAction[] {
  const automatic = isAutomatic(job);
  switch (job.state) {
    case "queued":
      return automatic ? ["pause", "cancel"] : ["start", "cancel"];
    case "running":
      return automatic ? ["pause", "cancel"] : ["cancel"];
    case "review":
      return ["cancel"];
    case "paused":
    case "interrupted":
    case "skipped":
      return ["resume", "cancel"];
    case "failed":
    case "partial":
    case "cancelled":
      return ["retry"];
    default:
      return [];
  }
}

export const ACTION_LABELS: Record<JobAction, string> = {
  pause: "Pause",
  resume: "Resume",
  retry: "Retry",
  start: "Start in extension",
  cancel: "Cancel",
};

/** Percent of the job done: LinkedIn's member count when known, else 100 for a finished job. */
export function jobProgress(job: Pick<CaptureJob, "state" | "complete" | "peopleFound" | "expectedPeople">): number | null {
  if (job.complete || job.state === "completed") return 100;
  if (!job.expectedPeople) return null;
  return Math.min(100, Math.round((job.peopleFound / job.expectedPeople) * 100));
}

export function companyPageUrl(companyPublicId: string): string {
  return `https://www.linkedin.com/company/${encodeURIComponent(companyPublicId)}/`;
}

/** The LinkedIn company id in a capture run's source address, if it is a company page. */
export function companyIdFromUrl(url: string | null): string | null {
  const match = (url ?? "").match(/linkedin\.com\/company\/([^/?#]+)/i);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]!).toLowerCase();
  } catch {
    return match[1]!.toLowerCase();
  }
}

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}
