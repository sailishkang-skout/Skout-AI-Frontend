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
  /** COPS-12 */
  first_response_at?: string | null;
  reopen_count?: number;
  release?: TicketRelease;
  sla?: TicketSla;
}

/** COPS-12 SLA (docs/api/copos-12-ticket-sla.openapi.yaml). */
export type SlaState = "running" | "paused" | "at_risk" | "met" | "breached";
export interface SlaClock {
  kind: "response" | "resolution";
  target_minutes: number;
  calendar: "24x7" | "business";
  started_at: string;
  due_at: string | null;
  paused: boolean;
  used_minutes: number;
  state: SlaState;
  met_at: string | null;
  breached_at: string | null;
  policy_version: number;
}
export interface TicketSla {
  priority: string;
  tier: string;
  clocks: SlaClock[];
}
export interface TicketRelease {
  release_id: string | null;
  fixed_in_version: string | null;
  deployed_at: string | null;
  qa_verified_at: string | null;
  qa_verified_by: string | null;
  qa_evidence: string | null;
  customer_verified_at: string | null;
  customer_verified_by: string | null;
  customer_evidence: string | null;
}
export interface ReleasePatch {
  release_id?: string | null;
  fixed_in_version?: string | null;
  deployed_at?: string | null;
  qa_evidence?: string;
  customer_evidence?: string;
}
export interface TicketMetrics {
  window_days: number;
  open: number;
  aged: number;
  mtta_minutes: number | null;
  mttr_minutes: number | null;
  reopen_rate: number | null;
  breach_rate: number | null;
  incident_linked: number;
  at_risk: number;
  definitions: Record<string, string>;
}
export interface IncidentFollowUp {
  text: string;
  done: boolean;
}
export interface Incident {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "investigating" | "resolved";
  source?: string;
  description?: string | null;
  owner_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  workaround: string | null;
  root_cause: string | null;
  follow_ups: IncidentFollowUp[];
  customer_update: string | null;
  customer_update_at: string | null;
  tickets: { id: string; title: string; status: string; severity: string; assignee_id: string | null; account_id: string; account_name: string }[];
  affected_accounts: { id: string; name: string }[];
}
export type IncidentPatch = Partial<Pick<Incident, "title" | "severity" | "status" | "owner_id" | "started_at" | "ended_at" | "workaround" | "root_cause" | "follow_ups">>;

export interface TicketListItem extends Omit<Ticket, "sla"> {
  account_name: string;
  assignee_email: string | null;
  /** COPS-12: the ticket's worst SLA clock. */
  sla?: { state: SlaState; due_at: string | null } | null;
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
  /** COPS-12: the incident this ticket is linked to. */
  incident?: { id: string; title: string; status: string; owner_id: string | null } | null;
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
  const send = <T>(method: "POST" | "PATCH" | "DELETE", path: string, body: unknown, key?: string) =>
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
    // ---- COPS-12 ----
    release: (id: string, body: ReleasePatch) =>
      withCopsTracking("cops.ticket_release_recorded", () => send<{ data: TicketRelease }>("PATCH", `/api/v1/tickets/${id}/release`, body), {
        ticket_id: id,
        qa: Boolean(body.qa_evidence),
        customer: Boolean(body.customer_evidence),
      }),
    metrics: (days = 30, tier?: string) => {
      const q = new URLSearchParams({ days: String(days) });
      if (tier) q.set("tier", tier);
      return copsFetch<{ data: TicketMetrics }>(`/api/v1/tickets/metrics?${q.toString()}`, undefined, { request });
    },
    incidents: (status?: string) => copsFetch<{ data: Incident[] }>(`/api/v1/incidents${status ? `?status=${status}` : ""}`, undefined, { request }),
    incident: (id: string) => copsFetch<{ data: Incident }>(`/api/v1/incidents/${id}/detail`, undefined, { request }),
    createIncident: (body: { title: string; severity: Incident["severity"]; description?: string }) =>
      send<{ data: { id: string } }>("POST", "/api/v1/incidents", { ...body, source: "manual" }),
    updateIncident: (id: string, body: IncidentPatch) => send<{ data: Incident }>("PATCH", `/api/v1/incidents/${id}`, body),
    linkTicket: (incidentId: string, ticketId: string) =>
      withCopsTracking("cops.incident_ticket_linked", () => send<{ data: unknown }>("POST", `/api/v1/incidents/${incidentId}/tickets`, { ticket_id: ticketId }), { incident_id: incidentId }),
    unlinkTicket: (incidentId: string, ticketId: string) => send<null>("DELETE", `/api/v1/incidents/${incidentId}/tickets/${ticketId}`, undefined),
    incidentCustomerUpdate: (incidentId: string, body: string) =>
      withCopsTracking(
        "cops.incident_customer_update_published",
        () => send<{ data: { ticketsUpdated: number } }>("POST", `/api/v1/incidents/${incidentId}/customer-update`, { body }),
        (r) => ({ incident_id: incidentId, tickets: r.data.ticketsUpdated })
      ),
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
  if (env.code === "VERIFICATION_REQUIRED") return "Record QA and customer verification (with evidence) before marking the ticket verified.";
  if (env.code === "REASON_REQUIRED") return "Reopening a ticket needs a reason.";
  if (env.code === "TICKET_ALREADY_LINKED") return "This ticket is already linked to another incident. Unlink it there first.";
  if (env.code === "BUSINESS_STATE_CONFLICT" || env.code === "VALIDATION_FAILED" || env.code === "NOT_FOUND") return env.message || fallback;
  return fallback;
}

// ---- COPS-12 SLA display helpers ----

export const SLA_STATE_LABEL: Record<SlaState, string> = { running: "On track", paused: "Paused", at_risk: "At risk", met: "Met", breached: "Breached" };
export const SLA_STATE_TONE: Record<SlaState, "success" | "warning" | "danger" | "muted" | "info"> = {
  running: "info",
  paused: "muted",
  at_risk: "warning",
  met: "success",
  breached: "danger",
};

/** "in 2h 5m" / "3h 10m overdue" relative to now, or null without a due time. */
export function slaDueText(dueAt: string | null | undefined, now: Date = new Date()): string | null {
  if (!dueAt) return null;
  const ms = new Date(dueAt).getTime() - now.getTime();
  const mins = Math.round(Math.abs(ms) / 60_000);
  const text = mins >= 1440 ? `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h` : mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  return ms >= 0 ? `in ${text}` : `${text} overdue`;
}

export const minutesText = (m: number | null | undefined) => (m == null ? "—" : m >= 1440 ? `${(m / 1440).toFixed(1)}d` : m >= 60 ? `${(m / 60).toFixed(1)}h` : `${Math.round(m)}m`);
export const percentText = (r: number | null | undefined) => (r == null ? "—" : `${Math.round(r * 1000) / 10}%`);
