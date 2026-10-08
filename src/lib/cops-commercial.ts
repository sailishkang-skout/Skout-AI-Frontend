import { useQuery } from "@tanstack/react-query";
import { withCopsTracking } from "./cops-analytics";
import { useApiFetch, useAuthReady } from "@/lib/api-client";
import { copsFetch, CopsRequestError } from "@/lib/cops-fetch";

/**
 * COPS-03 commercial workspace client. Contract: Skout-AI-Backend docs/api/copos-03-commercial.openapi.yaml.
 * Money is integer minor units (paise, cents) with an ISO currency, as the API returns it.
 */

/** How often the Commercial tab re-reads proposal, contract, payment and gate status (acceptance: no manual refresh). */
export const COMMERCIAL_POLL_MS = 10_000;

export const LINE_KINDS = ["product", "seats", "credits", "fee"] as const;
export type LineKind = (typeof LINE_KINDS)[number];
export const BILLING_CADENCES = ["one_time", "monthly", "quarterly", "annual"] as const;
export type BillingCadence = (typeof BILLING_CADENCES)[number];
export const GATE_POLICIES = ["trial_approval_only", "signature", "payment", "signature+payment", "manual_override"] as const;
export type GatePolicy = (typeof GATE_POLICIES)[number];

export interface LineItemInput {
  kind: LineKind;
  description: string;
  quantity: number;
  unit_amount_minor: number;
  discount_pct: number;
}

export interface ProposalTermsInput {
  currency: string;
  billing_cadence: BillingCadence;
  term_months: number;
  discount_pct: number;
  tax_pct: number;
  notes?: string | null;
  line_items: LineItemInput[];
}

export interface Totals {
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
}

export interface ProposalVersion {
  id: string;
  version: number;
  currency: string;
  billing_cadence: BillingCadence;
  term_months: number;
  discount_pct: number;
  tax_pct: number;
  notes: string | null;
  totals: Totals;
  line_items: Array<LineItemInput & { id: string; position: number; gross_minor: number; discount_minor: number; net_minor: number }>;
  sent_at: string | null;
  sent_by: string | null;
  content_hash: string | null;
  hash_valid: boolean | null;
  created_at: string;
}

export type ProposalStatus = "draft" | "sent" | "accepted" | "declined" | "expired";
export interface Proposal {
  id: string;
  opportunity_id: string;
  title: string;
  status: ProposalStatus;
  current_version: number;
  status_reason: string | null;
  status_changed_at: string | null;
  created_at: string;
  versions: ProposalVersion[];
}

export type ContractKind = "msa" | "order_form" | "dpa";
export type ContractStatus = "draft" | "sent" | "signed" | "declined" | "expired";
export interface Contract {
  id: string;
  opportunity_id: string;
  proposal_id: string | null;
  kind: ContractKind;
  title: string;
  status: ContractStatus;
  current_version: number;
  status_reason: string | null;
  status_changed_at: string | null;
  signed_at: string | null;
  created_at: string;
  versions: Array<{ id: string; version: number; document_url: string; file_name: string | null; file_sha256: string; sent_at: string | null; created_at: string }>;
}

export type PaymentStatus = "requested" | "paid" | "failed" | "expired" | "cancelled" | "refunded";
export interface PaymentRequest {
  id: string;
  opportunity_id: string;
  proposal_id: string | null;
  amount_minor: number;
  currency: string;
  description: string | null;
  status: PaymentStatus;
  provider: string;
  provider_ref: string;
  checkout_url: string;
  paid_at: string | null;
  expires_at: string | null;
  status_changed_at: string | null;
  created_at: string;
}

export interface Gate {
  opportunity_id: string;
  deal_type: string | null;
  policy: GatePolicy;
  policy_source: "deal_type" | "workspace_default" | "system_default";
  conditions: { trial_approved: boolean; signature_complete: boolean; payment_complete: boolean; overridden: boolean };
  open: boolean;
  fired_at: string | null;
  trial_approved_at: string | null;
  override: { by: string | null; reason: string | null; at: string } | null;
}

export interface CommercialSummary {
  opportunity: {
    id: string;
    name: string;
    amount: string | null;
    currency: string;
    deal_type: string | null;
    status: string;
    commercial_state: "proposal_sent" | "msa_pending" | "payment_pending" | "complete" | null;
  };
  proposals: Proposal[];
  contracts: Contract[];
  payment_requests: PaymentRequest[];
  gate: Gate;
}

function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `web-${crypto.randomUUID()}`
    : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type DeskStateFilter = "none" | "proposal_sent" | "msa_pending" | "payment_pending" | "complete";
export const DESK_STATE_FILTERS: DeskStateFilter[] = ["none", "proposal_sent", "msa_pending", "payment_pending", "complete"];
export type DeskRow = CommercialSummary & { account: { id: string; name: string | null } | null };

export interface DeskRowStatus {
  proposal: string | null;
  msa: string | null;
  payment: string | null;
  gate: "fired" | "open" | "waiting";
}

/** One line per opportunity on the Commercial Desk: the newest proposal, MSA and payment link and the gate. */
export function deskRowStatus(row: CommercialSummary): DeskRowStatus {
  const newest = <T extends { created_at: string }>(items: T[]) =>
    items.reduce<T | null>((best, item) => (!best || item.created_at > best.created_at ? item : best), null);
  return {
    proposal: newest(row.proposals)?.status ?? null,
    msa: newest(row.contracts.filter((c) => c.kind === "msa"))?.status ?? null,
    payment: newest(row.payment_requests)?.status ?? null,
    gate: row.gate.fired_at ? "fired" : row.gate.open ? "open" : "waiting",
  };
}

export function useCopsCommercialApi() {
  const request = useApiFetch();
  /** One Idempotency-Key per user action; a retried click would need a new action anyway. */
  const write = <T>(method: "POST" | "PUT", path: string, body: unknown) =>
    copsFetch<{ data: T }>(path, { method, headers: { "Idempotency-Key": newIdempotencyKey() }, body: JSON.stringify(body ?? {}) }, { request });
  return {
    accountCommercial: (accountId: string) =>
      copsFetch<{ data: CommercialSummary[] }>(`/api/v1/accounts/${accountId}/commercial`, undefined, { request }),
    /** Commercial Desk across accounts: open and won opportunities, most recently changed first. */
    desk: (params: { state?: DeskStateFilter; cursor?: string | null }) => {
      const q = new URLSearchParams({ limit: "25" });
      if (params.state) q.set("state", params.state);
      if (params.cursor) q.set("cursor", params.cursor);
      return copsFetch<{ data: DeskRow[]; next_cursor: string | null }>(`/api/v1/commercial/opportunities?${q.toString()}`, undefined, { request });
    },
    opportunityCommercial: (opportunityId: string) =>
      copsFetch<{ data: CommercialSummary }>(`/api/v1/opportunities/${opportunityId}/commercial`, undefined, { request }),
    createProposal: (opportunityId: string, body: ProposalTermsInput & { title: string }) =>
      withCopsTracking("cops.proposal_created", () => write<Proposal>("POST", `/api/v1/opportunities/${opportunityId}/proposals`, body), {
        opportunity_id: opportunityId,
        line_count: body.line_items?.length ?? 0,
      }),
    addProposalVersion: (proposalId: string, body: ProposalTermsInput) =>
      write<Proposal>("POST", `/api/v1/proposals/${proposalId}/versions`, body),
    sendProposal: (proposalId: string) =>
      withCopsTracking("cops.proposal_sent", () => write<Proposal>("POST", `/api/v1/proposals/${proposalId}/send`, {}), { proposal_id: proposalId }),
    setProposalStatus: (proposalId: string, status: "accepted" | "declined" | "expired", reason: string) =>
      write<Proposal>("POST", `/api/v1/proposals/${proposalId}/status`, { status, reason }),
    createContract: (
      opportunityId: string,
      body: { kind: ContractKind; title?: string; proposal_id?: string; document_url: string; file_name?: string; file_sha256: string }
    ) =>
      withCopsTracking("cops.contract_created", () => write<Contract>("POST", `/api/v1/opportunities/${opportunityId}/contracts`, body), {
        opportunity_id: opportunityId,
        kind: body.kind,
      }),
    addContractVersion: (contractId: string, body: { document_url: string; file_name?: string; file_sha256: string }) =>
      write<Contract>("POST", `/api/v1/contracts/${contractId}/versions`, body),
    sendContract: (contractId: string) =>
      withCopsTracking("cops.contract_sent", () => write<Contract>("POST", `/api/v1/contracts/${contractId}/send`, {}), { contract_id: contractId }),
    setContractStatus: (contractId: string, status: "signed" | "declined" | "expired", reason: string) =>
      write<Contract>("POST", `/api/v1/contracts/${contractId}/status`, { status, reason }),
    createPaymentRequest: (body: {
      opportunity_id: string;
      proposal_id?: string;
      amount_minor?: number;
      currency?: string;
      description?: string;
      customer?: { name?: string; email?: string };
    }) =>
      withCopsTracking("cops.payment_link_created", () => write<PaymentRequest>("POST", "/api/v1/payment-requests", body), {
        opportunity_id: body.opportunity_id,
        from_proposal: Boolean(body.proposal_id),
        currency: body.currency,
      }),
    approveTrial: (opportunityId: string, reason: string) =>
      withCopsTracking(
        "cops.gate_trial_approved",
        () => write<Gate & { fired_now: boolean }>("POST", `/api/v1/opportunities/${opportunityId}/gate/approve-trial`, { reason }),
        (res) => ({ opportunity_id: opportunityId, fired_now: res.data.fired_now })
      ),
    overrideGate: (opportunityId: string, reason: string) =>
      withCopsTracking(
        "cops.gate_overridden",
        () => write<Gate & { fired_now: boolean }>("POST", `/api/v1/opportunities/${opportunityId}/gate/override`, { reason }),
        (res) => ({ opportunity_id: opportunityId, fired_now: res.data.fired_now })
      ),
  };
}

/** The signed-in user's permission keys from /me, sharing the sidebar's ["me"] cache. */
export function useMyPermissions(): { permissions: readonly string[]; loaded: boolean } {
  const request = useApiFetch();
  const authReady = useAuthReady();
  const me = useQuery<{ permissions?: string[] }>({
    queryKey: ["me"],
    queryFn: () => request("/api/v1/me"),
    enabled: authReady,
    staleTime: 30_000,
  });
  return { permissions: me.data?.permissions ?? [], loaded: me.isSuccess };
}

export const can = (granted: readonly string[], anyOf: readonly string[]) => anyOf.some((k) => granted.includes(k));

/** Permission keys per action, mirroring the backend route gates. */
export const COMMERCIAL_PERMS = {
  read: ["commercial:read"],
  proposalWrite: ["commercial:send", "commercial:write"],
  send: ["commercial:send"],
  status: ["commercial:write", "legal:write"],
  contractWrite: ["commercial:write", "legal:write", "commercial:send"],
  payment: ["commercial:send", "billing:write"],
  approve: ["commercial:approve"],
} as const;

// ---- Pure helpers ----

function bp(pct: number): bigint {
  return BigInt(Math.round((Number.isFinite(pct) ? pct : 0) * 100));
}
const applyBp = (amount: bigint, basisPoints: bigint) => (amount * basisPoints + BigInt(5000)) / BigInt(10000);

/**
 * Live preview of the totals in the proposal builder. Same order and rounding as the backend
 * (@skout/shared computeProposalTotals); the server's numbers are what gets stored and sent.
 */
export function previewTotals(terms: Pick<ProposalTermsInput, "line_items" | "discount_pct" | "tax_pct">): Totals {
  let subtotal = BigInt(0);
  let lineDiscounts = BigInt(0);
  for (const line of terms.line_items) {
    const quantity = Number.isInteger(line.quantity) && line.quantity > 0 ? line.quantity : 0;
    const unit = Number.isInteger(line.unit_amount_minor) && line.unit_amount_minor > 0 ? line.unit_amount_minor : 0;
    const gross = BigInt(quantity) * BigInt(unit);
    subtotal += gross;
    lineDiscounts += applyBp(gross, bp(line.discount_pct));
  }
  const after = subtotal - lineDiscounts;
  const header = applyBp(after, bp(terms.discount_pct));
  const taxable = after - header;
  const tax = applyBp(taxable, bp(terms.tax_pct));
  return {
    subtotal_minor: Number(subtotal),
    discount_minor: Number(lineDiscounts + header),
    tax_minor: Number(tax),
    total_minor: Number(taxable + tax),
  };
}

/** Minor-unit exponent per currency (JPY has none). */
export function currencyExponent(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function formatMoney(minor: number, currency: string): string {
  const exp = currencyExponent(currency);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: exp, minimumFractionDigits: exp }).format(
      minor / 10 ** exp
    );
  } catch {
    return `${(minor / 10 ** exp).toFixed(exp)} ${currency}`;
  }
}

/** "1,234.50" typed by the user -> minor units. Null when not a valid non-negative amount. */
export function parseMajorToMinor(value: string, currency: string): number | null {
  const clean = value.replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const exp = currencyExponent(currency);
  const [whole, frac = ""] = clean.split(".");
  if (frac.length > exp) return null;
  return Number(whole) * 10 ** exp + Number((frac + "0".repeat(exp)).slice(0, exp) || "0");
}

export function minorToMajorInput(minor: number, currency: string): string {
  const exp = currencyExponent(currency);
  return exp === 0 ? String(minor) : (minor / 10 ** exp).toFixed(exp);
}

/** SHA-256 of a file in the browser; the file itself is not uploaded (status-tracking scope). */
export async function sha256OfFile(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const humanize = (v: string | null | undefined) => (v ? v.replace(/[_+]/g, (c) => (c === "+" ? " + " : " ")) : "—");

export const CONTRACT_KIND_LABEL: Record<ContractKind, string> = { msa: "MSA", order_form: "Order form", dpa: "DPA" };

export function statusTone(status: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (["accepted", "signed", "paid", "complete"].includes(status)) return "success";
  if (["declined", "failed", "cancelled", "refunded"].includes(status)) return "danger";
  if (status === "expired") return "muted";
  if (["sent", "requested", "msa_pending", "payment_pending", "proposal_sent"].includes(status)) return "info";
  return "warning";
}

export interface CommercialTimelineItem {
  at: string;
  kind: "proposal" | "contract" | "payment" | "gate";
  label: string;
  status: string;
}

/** Signature and payment timeline for the Commercial Desk, newest first, built from the summary. */
export function commercialTimeline(s: CommercialSummary): CommercialTimelineItem[] {
  const items: CommercialTimelineItem[] = [];
  for (const p of s.proposals) {
    for (const v of p.versions) if (v.sent_at) items.push({ at: v.sent_at, kind: "proposal", label: `${p.title} v${v.version} sent`, status: "sent" });
    if (p.status_changed_at && ["accepted", "declined", "expired"].includes(p.status)) {
      items.push({ at: p.status_changed_at, kind: "proposal", label: `${p.title} ${p.status}`, status: p.status });
    }
  }
  for (const c of s.contracts) {
    const name = CONTRACT_KIND_LABEL[c.kind];
    for (const v of c.versions) if (v.sent_at) items.push({ at: v.sent_at, kind: "contract", label: `${name} v${v.version} sent`, status: "sent" });
    if (c.status_changed_at && ["signed", "declined", "expired"].includes(c.status)) {
      items.push({ at: c.signed_at ?? c.status_changed_at, kind: "contract", label: `${name} ${c.status}`, status: c.status });
    }
  }
  for (const pr of s.payment_requests) {
    const amount = formatMoney(pr.amount_minor, pr.currency);
    items.push({ at: pr.created_at, kind: "payment", label: `Payment link for ${amount} created`, status: "requested" });
    if (pr.status !== "requested" && pr.status_changed_at) {
      items.push({ at: pr.paid_at ?? pr.status_changed_at, kind: "payment", label: `Payment of ${amount} ${pr.status}`, status: pr.status });
    }
  }
  if (s.gate.fired_at) items.push({ at: s.gate.fired_at, kind: "gate", label: "Provisioning requested", status: "complete" });
  return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** Plain-language message for a failed commercial action. */
export function commercialErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof CopsRequestError && error.envelope) {
    const env = error.envelope;
    if (env.code === "FORBIDDEN") return "You don't have permission for this action.";
    if (env.code === "VALIDATION_FAILED") {
      const fields = (env.details as { fields?: Array<{ path: string; message: string }> } | null)?.fields;
      return fields?.length ? fields.map((f) => `${f.path}: ${f.message}`).join("; ") : env.message;
    }
    if (env.code === "PROVIDER_UNAVAILABLE") return "Payments are not configured for this workspace yet.";
    if (env.code === "PROVIDER_ERROR") return "The payment provider did not accept the request. Try again in a moment.";
    return env.message;
  }
  return fallback;
}
