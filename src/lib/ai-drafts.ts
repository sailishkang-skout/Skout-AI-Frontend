import { useApiFetch } from "./api-client";
import type { AiDraft, AiDraftStatus } from "@/types/api";

interface ListEnvelope {
  workspaceId: string;
  data: AiDraft[];
  total: number;
}

export function aiDraftStatusTone(status: AiDraftStatus) {
  switch (status) {
    case "sent":
    case "approved":
      return "success" as const;
    case "rejected":
      return "danger" as const;
    case "edited":
      return "warning" as const;
    case "pending_review":
    default:
      return "info" as const;
  }
}

export function aiDraftStatusLabel(status: AiDraftStatus) {
  switch (status) {
    case "pending_review":
      return "Pending";
    case "edited":
      return "Edited";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "sent":
      return "Sent";
    default:
      return status;
  }
}

export interface CreateAiDraftInput {
  prospectId: string;
  subject?: string;
  body?: string;
  prompt?: string;
  fullName?: string;
  title?: string;
  companyName?: string;
  companyDomain?: string;
}

export interface DraftSendResult {
  sent: boolean;
  reason?: string;
  threadId?: string;
  to?: string;
}

export interface BulkApproveResult {
  approved: number;
  skipped: number;
  sent: number;
  sendFailures: { id: string; reason?: string }[];
}

const SEND_FAILURE_LABELS: Record<string, string> = {
  prospect_email_not_found: "no email on file for this prospect",
  suppressed: "the recipient is on the suppression list",
  not_send_eligible: "the email-intelligence policy engine flagged this address (e.g. catch-all) for manual review",
  no_active_inbox: "no active sending inbox is connected",
  smtp_build_failed: "the inbox is missing SMTP credentials",
  send_failed: "the mail server rejected the send",
};

export function draftSendFailureLabel(reason?: string): string {
  return (reason && SEND_FAILURE_LABELS[reason]) || "could not be sent";
}

export function useAiDraftsApi() {
  const fetchApi = useApiFetch();

  return {
    list: (opts?: { status?: AiDraftStatus; limit?: number; offset?: number }) => {
      const params = new URLSearchParams();
      if (opts?.status) params.set("status", opts.status);
      if (opts?.limit != null) params.set("limit", String(opts.limit));
      if (opts?.offset != null) params.set("offset", String(opts.offset));
      const qs = params.toString();
      return fetchApi<ListEnvelope>(`/api/v1/ai/drafts${qs ? `?${qs}` : ""}`);
    },

    get: (id: string) => fetchApi<AiDraft>(`/api/v1/ai/drafts/${id}`),

    create: (input: CreateAiDraftInput) =>
      fetchApi<AiDraft>("/api/v1/ai/drafts", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    update: (id: string, patch: { subject?: string; body?: string }) =>
      fetchApi<AiDraft>(`/api/v1/ai/drafts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),

    approve: (id: string) =>
      fetchApi<AiDraft & { send?: DraftSendResult }>(`/api/v1/ai/drafts/${id}/approve`, {
        method: "POST",
      }),

    reject: (id: string) =>
      fetchApi<AiDraft>(`/api/v1/ai/drafts/${id}/reject`, { method: "POST" }),

    bulkApprove: (ids: string[]) =>
      fetchApi<BulkApproveResult>("/api/v1/ai/drafts/bulk-approve", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
  };
}
