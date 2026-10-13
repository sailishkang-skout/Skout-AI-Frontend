import { useMemo } from "react";
import { useApiFetch } from "./api-client";

/** ENR-04 — provider enrichment jobs, provider connections and contact data. */

export type ProviderJobStatus = "queued" | "running" | "partial" | "action_required" | "failed" | "done";

export interface ProviderJob {
  id: string;
  correlationId: string;
  status: ProviderJobStatus;
  /** True once the job will not change again. */
  terminal: boolean;
  targetType: "person" | "company";
  targetId: string;
  sourceUrl: string | null;
  normalizedUrl: string | null;
  provider: string | null;
  trigger: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  result: {
    message?: string;
    mode?: string;
    promoted?: string[];
    evidenceOnly?: Array<{ attribute: string; mappingStatus: string; contactData: boolean }>;
    absent?: string[];
  } | null;
  testMode: boolean;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface ProviderJobAttempt {
  id: string;
  order: number;
  provider: string;
  operation: string;
  status: string;
  latencyMs: number | null;
  errorMessage: string | null;
  attemptedAt: string;
  hasRawResponse: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  purpose: string;
  legalStatus: "approved" | "pending_legal_review" | "prohibited";
  permitted: boolean;
  reason: string | null;
  rawResponseRetentionDays: number;
}

export interface ProviderConnection {
  id: string;
  provider: string;
  externalAccountId: string;
  status: "active" | "paused" | "revoked";
  credentialSource: "workspace" | "platform";
  lastCheckedAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProvidersResponse {
  testMode: boolean;
  providers: ProviderInfo[];
  connections: ProviderConnection[];
}

export type VerificationStatus = "valid" | "invalid" | "catch_all" | "risky" | "unknown" | "unverified";

export interface ContactValue {
  value: string;
  provenance: {
    kind: "provider" | "workspace_record" | "pattern_verified" | "manual" | "crm_record";
    provider: string;
    jobId: string | null;
    correlationId: string | null;
    confidence: number | null;
    observedAt: string | null;
  };
  verification: {
    status: VerificationStatus;
    provider: string | null;
    verifiedAt: string | null;
    deliverabilityScore: number | null;
  };
  freshness: { observedAt: string | null; ageDays: number | null; stale: boolean };
}

export interface ContactData {
  prospectId: string;
  contactId: string | null;
  email: ContactValue | null;
  phone: ContactValue | null;
  otherPhones: Array<{ type: "direct" | "hq"; value: string }>;
  lastRun: { jobId: string; status: string; completedAt: string | null; queuedAt: string } | null;
  freshnessDays: number;
}

const BASE = "/api/v1/enrichment";
const post = (body: unknown = {}): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function useProviderApi() {
  const apiFetch = useApiFetch();
  return useMemo(
    () => ({
      createJob: (url: string) => apiFetch<{ job: ProviderJob; reused: boolean; testMode: boolean }>(`${BASE}/provider-jobs`, post({ url })),
      job: (id: string) => apiFetch<{ job: ProviderJob; attempts: ProviderJobAttempt[] }>(`${BASE}/provider-jobs/${id}`),
      jobs: (filters: { targetId?: string; pageSize?: number } = {}) => {
        const search = new URLSearchParams();
        if (filters.targetId) search.set("targetId", filters.targetId);
        search.set("pageSize", String(filters.pageSize ?? 10));
        return apiFetch<{ data: ProviderJob[]; total: number }>(`${BASE}/provider-jobs?${search}`);
      },
      providers: () => apiFetch<ProvidersResponse>(`${BASE}/providers`),
      connectUnipile: (externalAccountId: string) =>
        apiFetch<{ connection: ProviderConnection }>(`${BASE}/provider-connections/unipile`, post({ externalAccountId })),
      checkConnection: (id: string) => apiFetch<{ connection: ProviderConnection }>(`${BASE}/provider-connections/${id}/check`, post()),
      disconnect: (id: string) => apiFetch<{ connection: ProviderConnection }>(`${BASE}/provider-connections/${id}`, { method: "DELETE" }),
      contactData: (prospectId: string) => apiFetch<{ contactData: ContactData }>(`${BASE}/people/${encodeURIComponent(prospectId)}/contact-data`),
      verifyEmail: (prospectId: string) =>
        apiFetch<{ contactData: ContactData }>(`${BASE}/people/${encodeURIComponent(prospectId)}/contact-data/verify-email`, post()),
    }),
    [apiFetch]
  );
}

type Tone = "success" | "warning" | "danger" | "info" | "muted";

export const JOB_STATUS: Record<ProviderJobStatus, { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "info" },
  running: { label: "Running", tone: "info" },
  partial: { label: "Partial", tone: "warning" },
  action_required: { label: "Action required", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
  done: { label: "Done", tone: "success" },
};

/** An unknown status is shown as not finished, never as success. */
export function jobStatus(status: string): { label: string; tone: Tone } {
  return JOB_STATUS[status as ProviderJobStatus] ?? { label: status.replace(/_/g, " "), tone: "muted" };
}

export interface JobAction {
  label: string;
  href: string;
}

/** What the user can do about a job that stopped, by error code. */
export function jobAction(job: Pick<ProviderJob, "errorCode">): JobAction | null {
  switch (job.errorCode) {
    case "PROVIDER_CONNECTION_REQUIRED":
    case "PROVIDER_ACCOUNT_UNAVAILABLE":
      return { label: "Connect a provider", href: "/enrichment/providers" };
    case "PROVIDER_CREDENTIAL_REQUIRED":
    case "PROVIDER_CREDENTIAL_REJECTED":
      return { label: "Update the provider key", href: "/settings/integrations" };
    case "PROVIDER_NOT_PERMITTED":
      return { label: "See provider status", href: "/enrichment/providers" };
    default:
      return null;
  }
}

/** One sentence on where the job stands, for a job that has no error message of its own. */
export function jobSummary(job: ProviderJob): string {
  if (job.errorMessage) return job.errorMessage;
  if (job.result?.message) return job.result.message;
  if (job.status === "queued") return "Waiting for a worker.";
  if (job.status === "running") return `Running (attempt ${job.attemptCount} of ${job.maxAttempts}).`;
  if (job.status === "done") return "Finished.";
  return "";
}

export const VERIFICATION: Record<VerificationStatus, { label: string; tone: Tone }> = {
  valid: { label: "Verified valid", tone: "success" },
  invalid: { label: "Invalid", tone: "danger" },
  catch_all: { label: "Catch-all domain", tone: "warning" },
  risky: { label: "Risky", tone: "warning" },
  unknown: { label: "Could not be verified", tone: "muted" },
  unverified: { label: "Not verified", tone: "muted" },
};

const PROVENANCE: Record<ContactValue["provenance"]["kind"], (provider: string) => string> = {
  provider: (provider) => `Supplied by ${provider}`,
  workspace_record: () => "Already on this workspace's record",
  pattern_verified: () => "Built from a name pattern, then confirmed by verification",
  manual: () => "Entered by a teammate",
  crm_record: () => "On the CRM contact, source not recorded",
};

export function provenanceLabel(provenance: ContactValue["provenance"]): string {
  return PROVENANCE[provenance.kind]?.(provenance.provider) ?? provenance.provider;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "unknown"
    : date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
