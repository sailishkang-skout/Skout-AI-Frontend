import { useApiFetch } from "@/lib/api-client";
import { copsFetch, CopsRequestError } from "@/lib/cops-fetch";
import { withCopsTracking } from "./cops-analytics";
import type { Proposal } from "./cops-commercial";

/**
 * COPS-08 client: approvals, e-signature, subscriptions and the Finance views.
 * Contract: Skout-AI-Backend docs/api/copos-08-commercial-advanced.openapi.yaml and
 * docs/tickets/copos-08-audit.md (section 11 lists the paths as built).
 * Money is integer minor units with an ISO currency, as the API returns it.
 */

// ---- Approvals ----

export const APPROVER_ROLES = ["sales_manager", "finance", "legal_revops", "executive"] as const;
export type ApproverRole = (typeof APPROVER_ROLES)[number];
export const APPROVER_LABEL: Record<ApproverRole, string> = { sales_manager: "Sales Manager", finance: "Finance", legal_revops: "Legal / RevOps", executive: "Executive (Admin)" };

export type ApprovalRule = "discount_pct" | "seats" | "contract_value" | "term_months" | "free_credits" | "payment_terms" | "custom_clauses" | "non_standard_sla";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "voided" | "expired";

export interface ApprovalTerms {
  currency: string;
  discount_pct: number;
  seats: number;
  contract_value_minor: number;
  term_months: number;
  free_credits: number;
  payment_terms_net_days: number;
  custom_clauses: boolean;
  non_standard_sla: boolean;
}
export interface MatchedRule {
  rule: ApprovalRule;
  value: number | null;
  approvers: ApproverRole[];
}
export interface ApprovalDecision {
  role: ApproverRole;
  decision: "pending" | "approved" | "rejected";
  decided_by: string | null;
  decided_at: string | null;
  comment: string | null;
}
export interface Approval {
  id: string;
  opportunity_id: string;
  /** Present on the approval queue. */
  opportunity_name?: string | null;
  account_id?: string | null;
  account_name?: string | null;
  proposal_id: string;
  proposal_version: number;
  status: ApprovalStatus;
  required_approvers: ApproverRole[];
  matched_rules: MatchedRule[];
  terms: ApprovalTerms;
  requested_at: string;
  expires_at: string;
  status_reason: string | null;
  decisions: ApprovalDecision[];
}
export interface ApprovalEvaluation {
  proposal_id: string;
  proposal_version: number;
  currency: string;
  terms: ApprovalTerms;
  required_approvers: ApproverRole[];
  matched_rules: MatchedRule[];
  unevaluated: ApprovalRule[];
  /** A deal already in progress before approvals existed: the rules are shown and not enforced. */
  grandfathered: boolean;
  required: boolean;
  satisfied: boolean;
  approval: Approval | null;
}

// ---- E-signature ----

export const REDLINE_STATUSES = ["customer_redline", "internal_review", "agreed"] as const;
export type RedlineStatus = (typeof REDLINE_STATUSES)[number];
export const REDLINE_LABEL: Record<RedlineStatus, string> = { customer_redline: "Customer redline", internal_review: "Internal review", agreed: "Redline agreed" };

export type EnvelopeStatus = "pending_send" | "failed" | "sent" | "viewed" | "expired" | "declined" | "signed";
export interface EnvelopeSigner {
  name: string;
  email: string;
  role?: string;
}
export interface Envelope {
  id: string;
  contract_id: string;
  contract_version: number;
  provider: string;
  status: EnvelopeStatus;
  template_key: string | null;
  signers: EnvelopeSigner[];
  sent_at: string | null;
  status_changed_at: string;
  events: Array<{ event_type: string; status: string | null; occurred_at: string | null; received_at: string; outcome: string }>;
}

// ---- Subscriptions ----

export type SubscriptionStatus = "active" | "past_due" | "restricted" | "suspended" | "closed";
export type SubscriptionBilling = "payment_link" | "invoiced" | "provider";
export interface SubscriptionInvoice {
  id: string;
  period_start: string;
  period_end: string;
  due_at: string;
  amount_minor: number;
  currency: string;
  status: "open" | "paid" | "void";
  payment_request_id: string | null;
  paid_at: string | null;
}
export interface SubscriptionAmendment {
  id: string;
  seq: number;
  seats: number | null;
  term_months: number | null;
  reason: string;
  effective_at: string;
  before: { seats: number; term_months: number; renews_at: string };
  after: { seats: number; term_months: number; renews_at: string };
  created_at: string;
}
export interface Subscription {
  id: string;
  account_id: string;
  opportunity_id: string;
  status: SubscriptionStatus;
  billing: SubscriptionBilling;
  currency: string;
  cadence: "monthly" | "annual";
  term_months: number;
  term_start: string;
  renews_at: string;
  renewal_opportunity_id: string | null;
  seats: number;
  items: Array<{ id: string; kind: string; quantity: number; unit_amount_minor: number }>;
  invoices: SubscriptionInvoice[];
  amendments: SubscriptionAmendment[];
  dunning: { overdue_invoice_id: string; due_at: string; day: number; next_status: SubscriptionStatus | null; next_status_at: string | null } | null;
}

// ---- Finance ----

export interface ReconciliationIssue {
  kind: "payment_event_not_applied" | "bill_paid_at_provider_open_here" | "envelope_contract_mismatch" | "envelope_never_confirmed";
  entity_type: string;
  entity_id: string;
  provider_state: string;
  skout_state: string;
  detail: string;
  since: string;
}
export interface FinanceSubscriptionRow {
  id: string;
  account_id: string;
  status: SubscriptionStatus;
  billing: SubscriptionBilling;
  currency: string;
  cadence: string;
  term_months: number;
  renews_at: string;
  renewal_opportunity_id: string | null;
  seats: number;
}
export interface FinancePaymentRow {
  id: string;
  opportunity_id: string;
  opportunity_name: string;
  account_id: string | null;
  amount_minor: number;
  currency: string;
  description: string | null;
  status: string;
  provider: string;
  provider_ref: string;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
}
export interface CreditActivityRow {
  id: string;
  account_id: string;
  account_name: string | null;
  kind: "purchase" | "grant" | "adjustment" | "refund";
  amount: number;
  balance_after: number | null;
  action: string;
  reason: string | null;
  actor_type: string | null;
  actor_id: string | null;
  created_at: string;
}
export interface GrandfatheredDeal {
  opportunity_id: string;
  opportunity_name: string;
  amount: number | null;
  currency: string;
  grandfathered_at: string | null;
  reasons: string[];
}

function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** COPS-08: the account details that pick the contract template (stored as custom fields). */
export interface AccountContractFields {
  region?: string;
  segment?: string;
  legal_entity?: string;
}

export function useCopsAdvancedApi() {
  const request = useApiFetch();
  const get = <T>(path: string) => copsFetch<{ data: T }>(path, undefined, { request });
  /** One Idempotency-Key per user action. */
  const post = <T>(path: string, body: unknown) =>
    copsFetch<{ data: T }>(path, { method: "POST", headers: { "Idempotency-Key": newIdempotencyKey() }, body: JSON.stringify(body ?? {}) }, { request });
  return {
    evaluateApprovals: (proposalId: string) => get<ApprovalEvaluation>(`/api/v1/proposals/${proposalId}/approvals/evaluate`),
    requestApproval: (proposalId: string) =>
      withCopsTracking("cops.approval_requested", () => post<Approval>(`/api/v1/proposals/${proposalId}/approvals`, {}), (res) => ({ proposal_id: proposalId, approvers: res.data.required_approvers.length })),
    approvalQueue: (status: ApprovalStatus = "pending") => get<Approval[]>(`/api/v1/approvals?status=${status}`),
    decideApproval: (approvalId: string, body: { role: ApproverRole; decision: "approved" | "rejected"; comment?: string }) =>
      withCopsTracking("cops.approval_decided", () => post<Approval>(`/api/v1/approvals/${approvalId}/decisions`, body), { approval_id: approvalId, role: body.role, decision: body.decision }),
    grandfathered: () => get<GrandfatheredDeal[]>("/api/v1/approvals/grandfathered"),

    /** A version negotiated outside Skout, attached as a new contract version with where the redline stands. */
    attachNegotiatedVersion: (contractId: string, body: { document_url: string; file_name?: string; file_sha256: string; redline_status: RedlineStatus }) =>
      post<unknown>(`/api/v1/contracts/${contractId}/negotiated-versions`, body),
    envelopes: (contractId: string) => get<Envelope[]>(`/api/v1/contracts/${contractId}/envelopes`),
    contractFields: (accountId: string) => get<AccountContractFields>(`/api/v1/accounts/${accountId}/contract-fields`),
    setContractFields: (accountId: string, body: AccountContractFields) =>
      copsFetch<{ data: AccountContractFields }>(`/api/v1/accounts/${accountId}/contract-fields`, { method: "PUT", body: JSON.stringify(body) }, { request }),
    sendEnvelope: (contractId: string, body: { signers: EnvelopeSigner[]; message?: string }) =>
      withCopsTracking("cops.envelope_sent", () => post<Envelope>(`/api/v1/contracts/${contractId}/envelopes`, body), { contract_id: contractId, signers: body.signers.length }),

    subscription: (accountId: string) => get<Subscription | null>(`/api/v1/accounts/${accountId}/subscription`),
    createSubscription: (accountId: string, body: { opportunity_id: string; seats: number; cadence: "monthly" | "annual"; term_months: number; billing: SubscriptionBilling; payment_terms_net_days?: number; seat_month_minor?: number }) =>
      withCopsTracking("cops.subscription_created", () => post<Subscription>(`/api/v1/accounts/${accountId}/subscription`, body), { account_id: accountId, seats: body.seats, cadence: body.cadence, billing: body.billing }),
    amendSubscription: (subscriptionId: string, body: { seats?: number; term_months?: number; reason: string }) =>
      withCopsTracking("cops.subscription_amended", () => post<Subscription>(`/api/v1/subscriptions/${subscriptionId}/amendments`, body), { subscription_id: subscriptionId, seats: body.seats != null, term: body.term_months != null }),
    invoicePaymentLink: (invoiceId: string) =>
      post<{ invoice_id: string; payment_request_id: string; payment_request: { checkout_url: string; status: string } }>(`/api/v1/subscription-invoices/${invoiceId}/payment-link`, {}),
    markInvoicePaid: (invoiceId: string, reason: string) => post<{ ok: boolean }>(`/api/v1/subscription-invoices/${invoiceId}/mark-paid`, { reason }),

    failedPayments: () => get<Subscription[]>("/api/v1/finance/failed-payments"),
    reconciliation: () => get<{ generated_at: string; counts: Record<string, number>; issues: ReconciliationIssue[] }>("/api/v1/finance/reconciliation"),
    financeSubscriptions: (renewingWithinDays?: number) =>
      get<FinanceSubscriptionRow[]>(`/api/v1/finance/subscriptions${renewingWithinDays ? `?renewing_within_days=${renewingWithinDays}` : ""}`),
    creditActivity: () => get<CreditActivityRow[]>("/api/v1/finance/credit-activity"),
    financePayments: (status?: string) => get<FinancePaymentRow[]>(`/api/v1/finance/payment-requests${status ? `?status=${status}` : ""}`),
  };
}

/** Permission keys per action, mirroring the backend route gates. */
export const ADVANCED_PERMS = {
  approve: ["commercial:approve", "legal:approve"],
  billingRead: ["billing:read"],
  billingWrite: ["billing:write"],
  subscriptionRead: ["billing:read", "commercial:read"],
} as const;

// ---- Pure helpers ----

const RULE_LABEL: Record<ApprovalRule, string> = {
  discount_pct: "Discount",
  seats: "Seats",
  contract_value: "Contract value",
  term_months: "Term",
  free_credits: "Free credits",
  payment_terms: "Payment terms",
  custom_clauses: "Custom clauses",
  non_standard_sla: "Non-standard SLA",
};

/** "Discount 15%", "Contract value USD 28,440.00", "Custom clauses": why a rule matched, in words. */
export function describeRule(rule: MatchedRule, currency: string, formatMoney: (minor: number, currency: string) => string): string {
  const label = RULE_LABEL[rule.rule];
  if (rule.value == null) return label;
  switch (rule.rule) {
    case "discount_pct":
      return `${label} ${rule.value}%`;
    case "contract_value":
      return `${label} ${formatMoney(rule.value, currency)}`;
    case "term_months":
      return `${label} ${rule.value} months`;
    case "payment_terms":
      return `${label} net ${rule.value}`;
    default:
      return `${label} ${rule.value.toLocaleString()}`;
  }
}

export type ApprovalBanner =
  | { state: "none" }
  | { state: "grandfathered" }
  | { state: "needed"; approvers: ApproverRole[] }
  | { state: "pending"; waiting: ApproverRole[]; approved: ApproverRole[] }
  | { state: "approved" };

/** What to show next to a proposal: nothing, ask for approval, who is still to decide, or approved. */
export function approvalBanner(evaluation: ApprovalEvaluation): ApprovalBanner {
  if (evaluation.grandfathered) return evaluation.required_approvers.length > 0 ? { state: "grandfathered" } : { state: "none" };
  if (!evaluation.required) return { state: "none" };
  if (evaluation.satisfied) return { state: "approved" };
  if (evaluation.approval?.status === "pending") {
    const by = (decision: string) => evaluation.approval!.decisions.filter((d) => d.decision === decision).map((d) => d.role);
    return { state: "pending", waiting: by("pending"), approved: by("approved") };
  }
  return { state: "needed", approvers: evaluation.required_approvers };
}

export const ENVELOPE_LABEL: Record<EnvelopeStatus, string> = {
  pending_send: "Sending",
  failed: "Not sent",
  sent: "Out for signature",
  viewed: "Viewed",
  expired: "Expired",
  declined: "Declined",
  signed: "Signed",
};
export function envelopeTone(status: EnvelopeStatus): "success" | "warning" | "danger" | "info" | "muted" {
  if (status === "signed") return "success";
  if (status === "declined" || status === "failed") return "danger";
  if (status === "expired") return "warning";
  return status === "pending_send" ? "muted" : "info";
}

export const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, string> = { active: "Active", past_due: "Past due", restricted: "Restricted", suspended: "Suspended", closed: "Closed" };
export function subscriptionTone(status: SubscriptionStatus): "success" | "warning" | "danger" | "info" | "muted" {
  if (status === "active") return "success";
  if (status === "past_due") return "warning";
  return status === "closed" ? "muted" : "danger";
}

/** One line for Finance: how late the bill is and what happens next, automatically or not. */
/**
 * The seat price the customer agreed to, per seat per month: from the accepted proposal, or else
 * the last one sent, on its latest sent version. Line and proposal discounts are both applied, and
 * a price for the whole term is spread over its months. Null when no sent proposal has a seat line.
 */
export function agreedSeatPrice(
  proposals: Proposal[]
): { seat_month_minor: number; seats: number; term_months: number; currency: string; proposal_title: string; version: number } | null {
  const candidates = [...proposals.filter((p) => p.status === "accepted"), ...proposals.filter((p) => p.status === "sent")];
  for (const p of candidates) {
    const v = [...p.versions].reverse().find((x) => x.sent_at);
    const line = v?.line_items.find((l) => l.kind === "seats" && l.quantity > 0 && (l.price_basis ?? "per_term") !== "one_time");
    if (!v || !line) continue;
    const months = (line.price_basis ?? "per_term") === "per_term" ? Math.max(1, v.term_months) : 1;
    const minor = Math.round((line.net_minor * (1 - v.discount_pct / 100)) / line.quantity / months);
    if (minor < 1) continue;
    return { seat_month_minor: minor, seats: line.quantity, term_months: v.term_months, currency: v.currency, proposal_title: p.title, version: v.version };
  }
  return null;
}

export function dunningLine(sub: Pick<Subscription, "dunning" | "billing">, formatDate: (iso: string) => string): string | null {
  if (!sub.dunning) return null;
  const late = sub.dunning.day === 0 ? "Due today" : `${sub.dunning.day} day${sub.dunning.day === 1 ? "" : "s"} overdue`;
  if (sub.dunning.next_status && sub.dunning.next_status_at) return `${late} · ${SUBSCRIPTION_LABEL[sub.dunning.next_status].toLowerCase()} on ${formatDate(sub.dunning.next_status_at)}`;
  return sub.billing === "invoiced" ? `${late} · no automatic step, Finance decides` : late;
}

export const RECONCILIATION_LABEL: Record<ReconciliationIssue["kind"], string> = {
  payment_event_not_applied: "Payment event not applied",
  bill_paid_at_provider_open_here: "Paid at the provider, bill still open",
  envelope_contract_mismatch: "E-sign and contract disagree",
  envelope_never_confirmed: "Envelope never confirmed",
};

/** Messages for the COPS-08 conflicts a person can act on; anything else falls back to the API's message. */
export function advancedErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof CopsRequestError && error.envelope) {
    const env = error.envelope;
    const details = (env.details ?? {}) as { required_approvers?: ApproverRole[]; approval_status?: string; fields?: Array<{ path: string; message: string }> };
    if (env.code === "FORBIDDEN") return env.message || "You don't have permission for this action.";
    if (env.code === "BUSINESS_STATE_CONFLICT" && details.required_approvers?.length) {
      const who = details.required_approvers.map((r) => APPROVER_LABEL[r]).join(", ");
      return details.approval_status === "pending" ? `Waiting for approval from ${who}.` : `Needs approval from ${who} first.`;
    }
    if (env.code === "VALIDATION_FAILED" && details.fields?.length) return details.fields.map((f) => f.message).join("; ");
    if (env.code === "PROVIDER_UNAVAILABLE") return "This is not configured for this workspace yet.";
    if ((env.code as string) === "subscription_restricted") return "This workspace has an unpaid subscription bill. Pay it on the billing page to continue.";
    if ((env.code as string) === "subscription_suspended") return "This workspace is suspended for an unpaid bill. Pay it on Settings > Workspace to use Skout again.";
    if (env.code === "PROVIDER_ERROR") return "The provider did not accept the request. Try again in a moment.";
    return env.message;
  }
  return fallback;
}
