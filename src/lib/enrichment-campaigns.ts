import { useMemo } from "react";
import { useApiFetch } from "./api-client";
import type { PersonSummary } from "./enrichment-research";

/** ENR-05 — audiences, the campaign composer, approval and launch. */

export interface AudienceFilters {
  q?: string;
  role?: string;
  department?: string;
  seniority?: string;
  location?: string;
  industry?: string;
  evidenceState?: "verified" | "discovery";
  freshness?: "fresh" | "stale";
}

export interface AudienceCounts {
  total: number;
  verifiedEmployment: number;
  discoveryOnly: number;
  fresh: number;
  stale: number;
  withEmail: number;
  verifiedEmail: number;
  suppressed: number;
  freshnessDays: number;
}

export interface AudiencePreview {
  counts: AudienceCounts;
  sample: PersonSummary[];
  maxAudienceSize: number;
  tooLarge: boolean;
}

export interface Audience {
  id: string;
  name: string;
  filters: AudienceFilters;
  listId: string | null;
  stats: { counts?: AudienceCounts; outcomes?: Partial<Record<"sent" | "replied" | "bounced" | "unsubscribed", number>> };
  updatedAt: string;
}

export type CampaignStatus = "draft" | "pending_review" | "approved" | "rejected" | "changes_required" | "launched" | "dismissed";

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  trigger: "manual" | "job_change";
  audienceId: string | null;
  sequenceId: string | null;
  recipientCount: number;
  consentBasis: string | null;
  reviewComment: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  launchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One sentence of copy that states a fact, with the evidence it words. */
export interface Claim {
  kind: "role" | "job_change" | "company";
  text: string;
  evidenceId: string;
  attribute: string;
  source: string;
  sourceUrl: string | null;
  capturedAt: string;
  observedAt: string;
  confidence: number;
  state: "verified" | "discovery" | "unverified";
  stale: boolean;
  usable: boolean;
  excludedReason: "discovery_only" | "stale" | "unverified" | null;
}

export interface RecipientClaims {
  reason: Claim | null;
  talkingPoints: Claim[];
  flagged: Claim[];
  opening: string;
}

export interface Recipient {
  prospectId: string;
  fullName: string | null;
  email: string | null;
  eligibility: "eligible" | "excluded";
  exclusionReason: string | null;
  exclusionMessage: string | null;
  emailVerification: string;
  consentStatus: "active" | "missing";
  suppressed: boolean;
  decision: "included" | "removed";
  decisionComment: string | null;
  claims: RecipientClaims;
  enrolled: boolean;
  outcome: { sentAt: string | null; repliedAt: string | null; bouncedAt: string | null; unsubscribedAt: string | null };
}

export interface DraftStep {
  order: number;
  delayDays: number;
  subject: string;
  body: string;
}

export interface CampaignDetail {
  campaign: Campaign;
  draft: { steps: DraftStep[] };
  problems: string[];
  recipients: Recipient[];
  counts: { total: number; eligible: number; excluded: number; included: number; withoutTalkingPoint: number; consentMissing: number };
  outcomes: { enrolled: number; sent: number; replied: number; bounced: number; unsubscribed: number };
  reviews: Array<{ id: string; decision: "approved" | "rejected" | "invalidated"; comment: string | null; reviewerId: string | null; recipientCount: number; createdAt: string }>;
  /** True only when an approval is on record for the campaign as it stands. */
  sendEnabled: boolean;
  consentEnforced: boolean;
  sandbox: { active: boolean; allowedRecipients: string[] };
  openingToken: string;
}

export interface ReviewQueueItem {
  campaign: Campaign;
  recipient: Recipient | null;
  claimsInCopy: Claim[];
}

const BASE = "/api/v1/enrichment";
const send = (method: "POST" | "PUT", body: unknown = {}): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Empty strings are not filters. */
export function cleanFilters(filters: AudienceFilters): AudienceFilters {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => typeof value === "string" && value.trim() !== "").map(([key, value]) => [key, (value as string).trim()])) as AudienceFilters;
}

export function useCampaignApi() {
  const apiFetch = useApiFetch();
  return useMemo(
    () => ({
      previewAudience: (filters: AudienceFilters) => apiFetch<AudiencePreview>(`${BASE}/audiences/preview`, send("POST", { filters: cleanFilters(filters) })),
      audiences: () => apiFetch<{ audiences: Audience[] }>(`${BASE}/audiences`),
      saveAudience: (name: string, filters: AudienceFilters) => apiFetch<{ audience: Audience }>(`${BASE}/audiences`, send("POST", { name, filters: cleanFilters(filters) })),
      campaigns: () => apiFetch<{ campaigns: Campaign[]; total: number }>(`${BASE}/campaigns`),
      reviewQueue: () => apiFetch<{ items: ReviewQueueItem[]; total: number }>(`${BASE}/campaigns/review-queue`),
      createCampaign: (name: string, audienceId: string) => apiFetch<{ campaign: Campaign }>(`${BASE}/campaigns`, send("POST", { name, audienceId })),
      campaign: (id: string) => apiFetch<CampaignDetail>(`${BASE}/campaigns/${id}`),
      saveDraft: (id: string, steps: DraftStep[]) => apiFetch<{ draft: { steps: DraftStep[] }; problems: string[] }>(`${BASE}/campaigns/${id}/draft`, send("PUT", { steps })),
      setRecipient: (id: string, prospectId: string, decision: "included" | "removed", comment?: string) =>
        apiFetch<{ recipient: Recipient }>(`${BASE}/campaigns/${id}/recipients/${encodeURIComponent(prospectId)}`, send("PUT", { decision, ...(comment ? { comment } : {}) })),
      refresh: (id: string) => apiFetch<CampaignDetail>(`${BASE}/campaigns/${id}/refresh`, send("POST")),
      submit: (id: string) => apiFetch<CampaignDetail>(`${BASE}/campaigns/${id}/submit`, send("POST")),
      review: (id: string, decision: "approved" | "rejected", comment: string, consentBasis?: string) =>
        apiFetch<CampaignDetail>(`${BASE}/campaigns/${id}/review`, send("POST", { decision, ...(comment ? { comment } : {}), ...(consentBasis ? { consentBasis } : {}) })),
      dismiss: (id: string, comment?: string) => apiFetch<CampaignDetail>(`${BASE}/campaigns/${id}/dismiss`, send("POST", comment ? { comment } : {})),
      launch: (id: string) => apiFetch<CampaignDetail & { enrolled: number; skipped: Array<{ prospectId: string; reason: string }> }>(`${BASE}/campaigns/${id}/launch`, send("POST")),
    }),
    [apiFetch]
  );
}

type Tone = "success" | "warning" | "danger" | "info" | "muted";

export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "muted" },
  pending_review: { label: "Awaiting review", tone: "info" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  changes_required: { label: "Needs re-review", tone: "warning" },
  launched: { label: "Launched", tone: "success" },
  dismissed: { label: "Dismissed", tone: "muted" },
};

export function campaignStatus(status: string): { label: string; tone: Tone } {
  return CAMPAIGN_STATUS[status as CampaignStatus] ?? { label: status.replace(/_/g, " "), tone: "muted" };
}

export const CLAIM_EXCLUSION: Record<NonNullable<Claim["excludedReason"]>, string> = {
  discovery_only: "Seen on a search card only — not confirmed on their own page",
  stale: "Captured too long ago to state as current",
  unverified: "No verified source",
};

/** Why the send button is disabled, or null when sending is possible. */
export function sendBlockedReason(detail: Pick<CampaignDetail, "campaign" | "sendEnabled">): string | null {
  if (detail.sendEnabled) return null;
  switch (detail.campaign.status) {
    case "launched":
      return "This campaign has already been launched.";
    case "pending_review":
      return "Waiting for a reviewer to approve the recipients and copy.";
    case "changes_required":
      return "Something changed after approval. Submit it for review again.";
    case "rejected":
      return "The reviewer rejected this campaign. Address the comment and resubmit.";
    case "dismissed":
      return "This campaign was dismissed.";
    default:
      return "No approval is recorded yet. Submit the campaign for review.";
  }
}
