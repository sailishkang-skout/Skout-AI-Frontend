import { useApiFetch } from "@/lib/api-client";
import { withCopsTracking } from "./cops-analytics";
import { copsFetch, CopsRequestError } from "@/lib/cops-fetch";
import { newIdempotencyKey } from "./cops-provisioning";

/**
 * COPS-06 frontend client: engineering tickets and customer-safe visibility.
 * Contract: Skout-AI-Backend docs/api/copos-06-tickets.openapi.yaml.
 */

export const TICKET_STATUSES = ["new", "triage", "assigned", "in_progress", "testing", "waiting_on_customer", "resolved", "verified", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type TicketSeverity = (typeof TICKET_SEVERITIES)[number];
export const TICKET_PRIORITIES = ["p1", "p2", "p3", "p4"] as const;
export const TICKET_CATEGORIES = ["bug", "integration", "data", "performance", "access", "other"] as const;
export const TICKET_ENVIRONMENTS = ["production", "sandbox", "staging"] as const;
export const TICKET_TIERS = ["smb", "mid_market", "enterprise"] as const;
export type TicketVisibility = "internal" | "customer";

/** Same table as the backend state machine (packages/shared cops-tickets). */
export const TICKET_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  new: ["triage", "closed"],
  triage: ["assigned", "waiting_on_customer", "closed"],
  assigned: ["in_progress", "triage", "waiting_on_customer"],
  in_progress: ["testing", "waiting_on_customer", "assigned"],
  testing: ["waiting_on_customer", "resolved", "in_progress"],
  waiting_on_customer: ["resolved", "in_progress", "testing", "triage"],
  resolved: ["verified", "in_progress"],
  verified: ["closed", "in_progress"],
  closed: [],
};

export interface TicketSummary {
  open_count: number;
  max_severity: TicketSeverity | null;
}

export interface Ticket {
  id: string;
  account_id: string;
  contact_id: string | null;
  opportunity_id: string | null;
  milestone_id: string | null;
  title: string;
  description: string | null;
  category: string;
  severity: TicketSeverity;
  priority: string;
  impact: string | null;
  affected_feature: string | null;
  environment: string;
  repro_steps: string | null;
  log_refs: string[];
  diagnostics: Record<string, unknown>;
  status: TicketStatus;
  team: string | null;
  assignee_id: string | null;
  account_tier: string;
  escalated_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketListItem extends Ticket {
  account_name: string;
  assignee_email: string | null;
}

export interface TicketComment {
  id: string;
  visibility: TicketVisibility;
  kind: "note" | "update" | "ai_summary";
  body: string;
  author_id: string | null;
  ai_generated: boolean;
  created_at: string;
}

export interface TicketDetail extends Ticket {
  context: {
    account: { id: string; name: string; domain: string | null; tier: string } | null;
    contact: { id: string; name: string; email: string | null } | null;
    opportunity: { id: string; name: string } | null;
    milestone: { id: string; label: string; completed_at: string | null } | null;
    summary: TicketSummary;
  };
  comments: TicketComment[];
  history: { from: TicketStatus | null; to: TicketStatus; actor_id: string | null; reason: string | null; at: string }[];
}

export interface TicketPrefill {
  account_id: string;
  contact_id: string | null;
  milestone_id: string | null;
  title: string;
  category: string;
  severity: TicketSeverity;
  priority: string;
  impact: string | null;
  affected_feature: string | null;
  environment: string;
  diagnostics: Record<string, unknown>;
}

export interface CreateTicketInput {
  account_id: string;
  contact_id?: string;
  milestone_id?: string;
  title: string;
  description?: string;
  category: string;
  severity: TicketSeverity;
  priority: string;
  impact?: string;
  affected_feature?: string;
  environment: string;
  repro_steps?: string;
  log_refs?: string[];
  diagnostics?: Record<string, unknown>;
}

export interface TicketFilters {
  severity?: string;
  status?: string;
  assignee?: string;
  tier?: string;
  team?: string;
  open?: boolean;
  cursor?: number | null;
}

export function useCopsTicketsApi() {
  const request = useApiFetch();
  const send = <T>(method: "POST" | "PATCH", path: string, body: unknown, key?: string) =>
    copsFetch<T>(path, { method, headers: key ? { "Idempotency-Key": key } : undefined, body: JSON.stringify(body ?? {}) }, { request });
  return {
    list: (f: TicketFilters) => {
      const q = new URLSearchParams({ limit: "25" });
      for (const k of ["severity", "status", "assignee", "tier", "team"] as const) if (f[k]) q.set(k, f[k] as string);
      if (f.open) q.set("open", "true");
      if (f.cursor) q.set("cursor", String(f.cursor));
      return copsFetch<{ data: TicketListItem[]; next_cursor: number | null }>(`/api/v1/tickets?${q.toString()}`, undefined, { request });
    },
    get: (id: string) => copsFetch<{ data: TicketDetail }>(`/api/v1/tickets/${id}`, undefined, { request }),
    forAccount: (accountId: string) =>
      copsFetch<{ data: { summary: TicketSummary; tickets: TicketListItem[] } }>(`/api/v1/accounts/${accountId}/tickets`, undefined, { request }),
    prefill: (params: { account_id: string; milestone_id?: string; blocker?: string }) => {
      const q = new URLSearchParams({ account_id: params.account_id });
      if (params.milestone_id) q.set("milestone_id", params.milestone_id);
      if (params.blocker) q.set("blocker", params.blocker);
      return copsFetch<{ data: TicketPrefill }>(`/api/v1/tickets/prefill?${q.toString()}`, undefined, { request });
    },
    /** The key is fixed for the open dialog, so a double click creates one ticket. */
    create: (body: CreateTicketInput, key: string, source: string) =>
      withCopsTracking("cops.ticket_created", () => send<{ data: Ticket; summary: TicketSummary }>("POST", "/api/v1/tickets", body, key), {
        account_id: body.account_id,
        severity: body.severity,
        source,
      }),
    transition: (id: string, to: TicketStatus, reason?: string) =>
      withCopsTracking("cops.ticket_status_changed", () => send<{ data: Ticket }>("POST", `/api/v1/tickets/${id}/transition`, { to, ...(reason ? { reason } : {}) }), { ticket_id: id, to }),
    escalate: (id: string, severity: TicketSeverity, reason: string) =>
      withCopsTracking("cops.ticket_escalated", () => send<{ data: Ticket }>("POST", `/api/v1/tickets/${id}/escalate`, { severity, reason }), { ticket_id: id, severity }),
    update: (id: string, body: { assignee_id?: string | null; team?: string | null; priority?: string }) => send<{ data: Ticket }>("PATCH", `/api/v1/tickets/${id}`, body),
    comment: (id: string, body: string, visibility: TicketVisibility, key: string = newIdempotencyKey()) =>
      withCopsTracking(
        visibility === "customer" ? "cops.ticket_customer_update_published" : "cops.ticket_internal_note_added",
        () => send<{ data: TicketComment }>("POST", `/api/v1/tickets/${id}/comments`, { body, visibility }, key),
        { ticket_id: id }
      ),
  };
}

// ---- Pure helpers ----

export const humanizeTicket = (v: string | null | undefined) => (v ? v.replace(/_/g, " ") : "—");

export function severityTone(severity: string | null | undefined): "danger" | "warning" | "default" {
  return severity === "critical" ? "danger" : severity === "high" ? "warning" : "default";
}

/** Severities an escalation may move to: only higher than the current one. */
export function higherSeverities(current: TicketSeverity): TicketSeverity[] {
  return TICKET_SEVERITIES.slice(TICKET_SEVERITIES.indexOf(current) + 1);
}

/** Diagnostics as label/value rows for the drawer; nested values are shown as compact JSON. */
export function diagnosticRows(diagnostics: Record<string, unknown>): { label: string; value: string }[] {
  return Object.entries(diagnostics).map(([k, v]) => ({
    label: k.replace(/_/g, " "),
    value: v === null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v),
  }));
}

export function ticketErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof CopsRequestError) || !error.envelope) return fallback;
  const env = error.envelope;
  if (env.code === "FORBIDDEN") {
    const required = (env.details as { required_permission?: string } | null)?.required_permission;
    return required === "tickets:send" ? "Only Customer Success can publish updates to the customer." : "You do not have permission for this action.";
  }
  if (env.code === "BUSINESS_STATE_CONFLICT" || env.code === "VALIDATION_FAILED" || env.code === "NOT_FOUND") return env.message || fallback;
  return fallback;
}
