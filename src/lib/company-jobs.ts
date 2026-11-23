import { useMemo } from "react";
import { useApiFetch } from "@/lib/api-client";

/**
 * Latest Job Roles: the job listings captured for a company with the Skout extension, and the scans
 * that found them. Every path here is the API's full `/api/v1/...` path.
 */

export type ScanStatus =
  | "requested"
  | "in_progress"
  | "completed_verified"
  | "verification_required"
  | "partial"
  | "not_found"
  | "restricted"
  | "not_loaded"
  | "failed";

export interface JobRole {
  id: string;
  title: string;
  companyName: string | null;
  department: string | null;
  location: string | null;
  country: string | null;
  employmentType: string | null;
  workplaceType: "remote" | "hybrid" | "on_site" | null;
  description: string | null;
  requirements: string | null;
  postedAt: string | null;
  postedText: string | null;
  jobUrl: string | null;
  jobId: string | null;
  source: string;
  /** open: in the latest verified scan | not_seen: missed by later verified scans. Never "closed". */
  status: "open" | "not_seen";
  detailsComplete: boolean;
  firstDetectedAt: string;
  lastSeenAt: string;
  lastVerifiedAt: string | null;
  changedAt: string | null;
  isNew: boolean;
  isUpdated: boolean;
}

export interface JobScan {
  id: string;
  status: ScanStatus;
  /** The status, or "interrupted" for a scan that said it was running and stopped. */
  state: ScanStatus | "interrupted";
  source: string | null;
  passes: number;
  jobsFound: number;
  jobsNew: number;
  jobsUpdated: number;
  verified: boolean;
  details: { passes?: Array<{ pass: number; method?: string; found: number; complete: boolean; note?: string }>; notes?: string[] };
  error: string | null;
  requestedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CompanyJobs {
  jobs: JobRole[];
  total: number;
  notSeen: number;
  lastScan: JobScan | null;
  activeScan: JobScan | null;
  scans: JobScan[];
}

export function useCompanyJobsApi() {
  const apiFetch = useApiFetch();
  return useMemo(
    () => ({
      jobs: (companyId: string, includeNotSeen: boolean) =>
        apiFetch<CompanyJobs>(`/api/v1/enrichment/companies/${encodeURIComponent(companyId)}/jobs?includeNotSeen=${includeNotSeen}&limit=200`),
      rescan: (companyId: string) =>
        apiFetch<{ scan: JobScan; alreadyRequested: boolean }>(`/api/v1/enrichment/companies/${encodeURIComponent(companyId)}/jobs/rescan`, { method: "POST" }),
    }),
    [apiFetch]
  );
}

export const SCAN_LABELS: Record<ScanStatus | "interrupted", string> = {
  requested: "Rescan requested",
  in_progress: "In progress",
  interrupted: "Interrupted",
  completed_verified: "Completed & verified",
  verification_required: "Verification required",
  partial: "Partial capture",
  not_found: "Not found",
  restricted: "Restricted by LinkedIn",
  not_loaded: "Not loaded",
  failed: "Failed",
};

export const SCAN_TONES: Record<ScanStatus | "interrupted", "success" | "warning" | "danger" | "info" | "muted"> = {
  requested: "info",
  in_progress: "info",
  interrupted: "warning",
  completed_verified: "success",
  verification_required: "warning",
  partial: "warning",
  not_found: "muted",
  restricted: "danger",
  not_loaded: "warning",
  failed: "danger",
};

/** What a scan means for the person reading the list, in a sentence. */
export function scanExplanation(scan: JobScan): string {
  switch (scan.state) {
    case "completed_verified":
      return `Two scans agreed${scan.jobsFound ? ` on ${scan.jobsFound} role${scan.jobsFound === 1 ? "" : "s"}` : ""}.`;
    case "verification_required":
      return "The scans could not confirm that the list is complete. Rescan to verify.";
    case "partial":
      return "Only part of the list could be read. Rescan to capture the rest.";
    case "not_found":
      return "Two complete scans found no open roles.";
    case "restricted":
      return "LinkedIn restricted the page, so the scan stopped. Check your LinkedIn account before scanning again.";
    case "not_loaded":
      return "LinkedIn's jobs did not finish loading, so nothing can be said about open roles. Rescan.";
    case "failed":
      return scan.error ? `The scan failed: ${scan.error}` : "The scan failed.";
    case "interrupted":
      return "The scan stopped reporting before it finished. Rescan to continue.";
    case "in_progress":
      return "The extension is scanning this company's jobs now.";
    case "requested":
      return "Waiting for the extension: open its side panel on LinkedIn and start the scan.";
  }
}

export const WORK_MODE_LABELS = { remote: "Remote", hybrid: "Hybrid", on_site: "On-site" } as const;

/** The posting date as it should be shown: the exact date when LinkedIn gave one, else its own wording. */
export function postedLabel(job: Pick<JobRole, "postedAt" | "postedText">, locale?: string): string | null {
  if (job.postedAt) return new Date(job.postedAt).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  return job.postedText ? job.postedText : null;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}

/** Only LinkedIn job pages are linked from the list. */
export function safeJobUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ["www.linkedin.com", "linkedin.com"].includes(parsed.hostname) ? parsed.href : null;
  } catch {
    return null;
  }
}

/** The verification a capture stored (see the extension's capture-verify.js). */
export interface CaptureVerification {
  status: "verified" | "missing_data" | "verification_required" | "partial" | "not_loaded" | "restricted" | "failed";
  passes: number;
  sections?: Record<string, { found: number; expected?: number; state: "complete" | "incomplete" | "none" | "not_loaded" | "restricted" | "failed"; note?: string }>;
  missing?: string[];
  notes?: string[];
  verifiedAt?: string;
}

export const VERIFICATION_LABELS: Record<CaptureVerification["status"], string> = {
  verified: "Completed & verified",
  missing_data: "Completed with missing data",
  verification_required: "Verification required",
  partial: "Partial capture",
  not_loaded: "Not loaded",
  restricted: "Restricted by LinkedIn",
  failed: "Failed",
};

export const VERIFICATION_TONES: Record<CaptureVerification["status"], "success" | "warning" | "danger" | "info" | "muted"> = {
  verified: "success",
  missing_data: "info",
  verification_required: "warning",
  partial: "warning",
  not_loaded: "warning",
  restricted: "danger",
  failed: "danger",
};

export const SECTION_STATE_WORDS: Record<NonNullable<CaptureVerification["sections"]>[string]["state"], string> = {
  complete: "Matches what LinkedIn shows",
  incomplete: "Short of what LinkedIn shows",
  none: "None on LinkedIn (confirmed)",
  not_loaded: "Did not load",
  restricted: "Restricted by LinkedIn",
  failed: "Could not be read",
};
