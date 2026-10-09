import { useApiFetch } from "@/lib/api-client";
import { withCopsTracking } from "./cops-analytics";
import { copsFetch, CopsRequestError } from "@/lib/cops-fetch";
import { newIdempotencyKey } from "./cops-provisioning";

/**
 * COPS-05 frontend client: onboarding email, follow-up, activation, rep queue.
 * Contract: Skout-AI-Backend docs/api/copos-05-onboarding.openapi.yaml.
 */

export const ONBOARDING_POLL_MS = 15_000;

export type EmailStatus = "queued" | "sent" | "delivered" | "bounced" | "failed";

export interface EmailSend {
  id: string;
  account_id: string;
  contact_id: string | null;
  to: string;
  template_key: string;
  template_version: number;
  subject: string;
  status: EmailStatus;
  is_resend: boolean;
  reason: string | null;
  error: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface EmailPreview {
  template_key: string;
  template_version: number;
  to: string;
  subject: string;
  html: string;
  text: string;
  blocked: string | null;
}

export interface Milestone {
  key: string;
  label: string;
  weight: number;
  required: boolean;
  source: "event" | "manual";
  completed_at: string | null;
  evidence: Record<string, unknown> | null;
}

export interface Activation {
  instance_id: string;
  template_key: string;
  template_version: number;
  activation_pct: number;
  activated_at: string | null;
  first_login_at: string | null;
  milestones: Milestone[];
}

export type EnrollmentStatus = "active" | "paused" | "stopped" | "completed" | "replied" | "bounced";

export interface FollowUp {
  mode: "sequence" | "task";
  task_reason: string | null;
  enrollment: {
    id: string;
    sequence_id: string;
    template_version: number | null;
    status: EnrollmentStatus;
    stop_reason: string | null;
    current_step: number | null;
    next_action: { kind: string; scheduled_at: string | null } | null;
  } | null;
  task: { id: string; title: string; due_at: string | null; status: string } | null;
}

export interface Blocker {
  kind: string;
  detail: string;
  since: string;
  task_id: string | null;
}

export type IntegrationState = "connected" | "error" | "not_connected" | "not_available";

export interface IntegrationStatus {
  key: "crm" | "email" | "calendar";
  status: IntegrationState;
  detail: string | null;
}

export const INTEGRATION_LABEL: Record<IntegrationStatus["key"], string> = { crm: "CRM", email: "Email", calendar: "Calendar" };
export const INTEGRATION_STATE_LABEL: Record<IntegrationState, string> = {
  connected: "connected",
  error: "needs attention",
  not_connected: "not connected",
  not_available: "not tracked yet",
};
export function integrationTone(s: IntegrationState): "success" | "danger" | "muted" {
  return s === "connected" ? "success" : s === "error" ? "danger" : "muted";
}

export interface OnboardingState {
  account_id: string;
  trial_ends_at: string | null;
  trial_days_left: number | null;
  activation: Activation | null;
  follow_up: FollowUp | null;
  emails: EmailSend[];
  blockers: Blocker[];
  handoff: { task_id: string; created_at: string | null } | null;
  integrations: IntegrationStatus[];
}

export const QUEUE_REASONS = ["reply", "commercial_blocker", "trial_expiry", "stalled_milestone", "due_task", "high_intent_usage"] as const;
export type QueueReason = (typeof QUEUE_REASONS)[number];
export type ActionKind = "call" | "email" | "meeting" | "task";

export interface QueueItem {
  id: string;
  reason: QueueReason;
  priority: number;
  account: { id: string; name: string };
  contact: { id: string; name: string; email: string | null } | null;
  active_sequence: { enrollment_id: string; current_step: number | null } | null;
  last_touch_at: string | null;
  signals: QueueReason[];
  recommended_action: { kind: ActionKind; label: string };
  due_at: string | null;
  detail: string;
}

export interface OnboardingSendInput {
  contact_id?: string;
  template_key?: string;
  booking_url?: string;
  resend?: boolean;
  reason?: string;
}

export interface FollowUpActionInput {
  kind: ActionKind;
  account_id: string;
  contact_id?: string;
  queue_item_id?: string;
  subject?: string;
  body?: string;
  due_at?: string;
  outcome?: string;
}

export function useCopsOnboardingApi() {
  const request = useApiFetch();
  const post = <T>(path: string, body: unknown, key: string = newIdempotencyKey()) =>
    copsFetch<{ data: T }>(path, { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(body ?? {}) }, { request });
  return {
    onboarding: (accountId: string) => copsFetch<{ data: OnboardingState }>(`/api/v1/accounts/${accountId}/onboarding`, undefined, { request }),
    preview: (accountId: string, body: OnboardingSendInput) => post<EmailPreview>(`/api/v1/accounts/${accountId}/onboarding/preview`, body),
    /** The key is fixed for the open dialog, so a double click or a retry after a 502 sends once. */
    send: (accountId: string, body: OnboardingSendInput, key: string) =>
      withCopsTracking(body.resend ? "cops.onboarding_email_resent" : "cops.onboarding_email_sent", () => post<EmailSend>(`/api/v1/accounts/${accountId}/onboarding/send`, body, key), {
        account_id: accountId,
        template_key: body.template_key ?? null,
      }),
    pause: (enrollmentId: string, reason: string) =>
      withCopsTracking("cops.follow_up_paused", () => post(`/api/v1/follow-up/enrollments/${enrollmentId}/pause`, { reason }), { enrollment_id: enrollmentId }),
    resume: (enrollmentId: string) =>
      withCopsTracking("cops.follow_up_resumed", () => post(`/api/v1/follow-up/enrollments/${enrollmentId}/resume`, {}), { enrollment_id: enrollmentId }),
    stop: (enrollmentId: string, reason: string) =>
      withCopsTracking("cops.follow_up_stopped", () => post(`/api/v1/follow-up/enrollments/${enrollmentId}/stop`, { reason }), { enrollment_id: enrollmentId }),
    completeMilestone: (accountId: string, key: string, reason: string) =>
      withCopsTracking("cops.milestone_completed", () => post<Activation>(`/api/v1/accounts/${accountId}/activation/milestones/${key}/complete`, { reason }), {
        account_id: accountId,
        milestone: key,
      }),
    queue: (params: { owner?: "me" | "all"; reason?: QueueReason | ""; cursor?: number | null }) => {
      const q = new URLSearchParams({ owner: params.owner ?? "me", limit: "25" });
      if (params.reason) q.set("reason", params.reason);
      if (params.cursor) q.set("cursor", String(params.cursor));
      return copsFetch<{ data: QueueItem[]; next_cursor: number | null }>(`/api/v1/follow-up/queue?${q.toString()}`, undefined, { request });
    },
    action: (body: FollowUpActionInput, key: string) =>
      withCopsTracking(
        "cops.follow_up_action_logged",
        () => post<{ activity_id: string; task_id: string | null; meeting_id: string | null }>("/api/v1/follow-up/actions", body, key),
        { kind: body.kind, account_id: body.account_id, from_queue: Boolean(body.queue_item_id) }
      ),
  };
}

// ---- Pure helpers ----

export const STOP_REASON_LABEL: Record<string, string> = {
  REPLIED: "Customer replied",
  POSITIVE_REPLY: "Customer replied",
  MEETING_BOOKED: "Meeting booked",
  ACTIVATED: "Customer activated",
  OPPORTUNITY_CLOSED: "Opportunity closed",
  OPTED_OUT: "Opted out",
  HARD_BOUNCE: "Email hard-bounced",
  BOUNCED: "Email bounced",
  REP_STOPPED: "Stopped by the rep",
  CRITICAL_ESCALATION: "Critical escalation",
  SEQUENCE_COMPLETED: "Cadence completed",
};

export const BLOCKED_LABEL: Record<string, string> = {
  invalid_email: "the contact has no valid email",
  suppressed: "the address unsubscribed or is blocked",
  channel_suppressed: "the contact is marked do-not-contact",
  hard_bounce: "the address hard-bounced",
  ineligible: "the address failed the send-eligibility check",
  no_consent: "there is no email consent",
};

export const QUEUE_REASON_LABEL: Record<QueueReason, string> = {
  reply: "Reply",
  commercial_blocker: "Commercial blocker",
  trial_expiry: "Trial ending",
  stalled_milestone: "Stalled onboarding",
  due_task: "Due task",
  high_intent_usage: "High usage",
};

export function queueTone(reason: QueueReason): "danger" | "warning" | "info" | "success" | "muted" {
  if (reason === "reply" || reason === "commercial_blocker") return "danger";
  if (reason === "trial_expiry" || reason === "stalled_milestone") return "warning";
  if (reason === "high_intent_usage") return "success";
  return "info";
}

export const BLOCKER_LABEL: Record<string, string> = {
  no_delivery: "Email not delivered",
  delivered_no_login: "No sign-in after the email",
  first_login: "First sign-in: guide to the next step",
  login_no_value: "Signed in, no first result",
  no_activity_72h: "No activity for 72h",
  integration_error: "Integration error",
  low_credits: "Low credits",
  trial_ending: "Trial ending",
  hard_bounce: "Email hard-bounced",
};

export function emailStatusTone(e: EmailSend): "success" | "warning" | "danger" | "info" | "muted" {
  if (e.status === "bounced" || e.status === "failed") return "danger";
  if (e.clicked_at || e.opened_at || e.status === "delivered") return "success";
  if (e.status === "sent") return "info";
  return "muted";
}

/** The furthest tracking state an email reached, for one short label. */
export function emailProgress(e: EmailSend): string {
  if (e.status === "failed") return "failed";
  if (e.status === "bounced") return "bounced";
  if (e.clicked_at) return "clicked";
  if (e.opened_at) return "opened";
  if (e.status === "delivered") return "delivered";
  return e.status;
}

/** Days and hours left in the trial, or null when there is no trial end. */
export function trialTimer(trialEndsAt: string | null, now = new Date()): { days: number; hours: number; ended: boolean } | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - now.getTime();
  if (ms <= 0) return { days: 0, hours: 0, ended: true };
  return { days: Math.floor(ms / 86_400_000), hours: Math.floor((ms % 86_400_000) / 3_600_000), ended: false };
}

/** Required milestones first (by weight), then the rest; completed ones keep their place. */
export function orderedMilestones(ms: Milestone[]): Milestone[] {
  return [...ms].sort((a, b) => Number(b.required) - Number(a.required) || b.weight - a.weight || a.label.localeCompare(b.label));
}

/** A short evidence line for a completed milestone (never shows personal data beyond the source). */
export function evidenceText(m: Milestone): string | null {
  if (!m.completed_at || !m.evidence) return null;
  const e = m.evidence as { source_type?: string; reason?: string; provider?: string; action?: string };
  if (e.source_type === "manual") return e.reason ? `Marked done: ${e.reason}` : "Marked done";
  const source: Record<string, string> = {
    "invite.accepted": "Invitation accepted",
    "auth.login_success": "Signed in",
    "integration.crm_connected": e.provider ? `${e.provider} connected` : "CRM connected",
    "product.search": "First search run",
    "product.export": e.action ? `First export (${e.action.replace(/_/g, " ")})` : "First export",
    "invite.sent": "Teammate invited",
  };
  return source[e.source_type ?? ""] ?? e.source_type ?? null;
}

export function onboardingErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof CopsRequestError) || !error.envelope) return fallback;
  const env = error.envelope;
  switch (env.code) {
    case "NOT_PROVISIONED":
      return "Provision the trial workspace first.";
    case "ALREADY_SENT":
      return "The onboarding email was already sent to this person. Re-send it with a reason.";
    case "CONTACT_BLOCKED": {
      const reason = (env.details as { reason?: string } | null)?.reason;
      return `This contact cannot be emailed: ${reason ? (BLOCKED_LABEL[reason] ?? reason) : "blocked"}.`;
    }
    case "EMAIL_NOT_SENT":
      return "The email provider did not accept the message. Try again; it will not be sent twice.";
    case "NOT_ACTIVE":
    case "NOT_PAUSED":
      return env.message;
    case "BUSINESS_STATE_CONFLICT":
      return env.message;
    case "VALIDATION_FAILED":
      return env.message;
    case "FORBIDDEN":
      return "You do not have access to this action.";
    default:
      return env.message || fallback;
  }
}

export const ONBOARDING_PERMS = {
  send: ["onboarding:send", "commercial:send"],
  followUp: ["onboarding:write", "crm:write"],
  read: ["onboarding:read", "commercial:read"],
} as const;
