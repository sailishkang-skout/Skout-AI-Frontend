import { describe, expect, it } from "vitest";
import { CopsRequestError } from "@/lib/cops-fetch";
import { advancedErrorMessage, agreedSeatPrice, approvalBanner, describeRule, dunningLine, envelopeTone, subscriptionTone, type Approval, type ApprovalEvaluation } from "./cops-commercial-advanced";
import type { Proposal } from "./cops-commercial";

const money = (minor: number, currency: string) => `${currency} ${(minor / 100).toFixed(2)}`;
const terms = { currency: "USD", discount_pct: 25, seats: 10, contract_value_minor: 711_000, term_months: 12, free_credits: 0, payment_terms_net_days: 30, custom_clauses: false, non_standard_sla: false };
const evaluation = (over: Partial<ApprovalEvaluation> = {}): ApprovalEvaluation => ({
  proposal_id: "p1",
  proposal_version: 1,
  currency: "USD",
  terms,
  required_approvers: ["sales_manager", "finance"],
  matched_rules: [{ rule: "discount_pct", value: 25, approvers: ["sales_manager", "finance"] }],
  unevaluated: [],
  grandfathered: false,
  required: true,
  satisfied: false,
  approval: null,
  ...over,
});
const approval = (decisions: Approval["decisions"], status: Approval["status"] = "pending"): Approval => ({
  id: "a1",
  opportunity_id: "o1",
  proposal_id: "p1",
  proposal_version: 1,
  status,
  required_approvers: ["sales_manager", "finance"],
  matched_rules: [],
  terms,
  requested_at: "2026-10-13T10:00:00Z",
  expires_at: "2026-10-27T10:00:00Z",
  status_reason: null,
  decisions,
});
const decided = (role: "sales_manager" | "finance", decision: "pending" | "approved" | "rejected") => ({ role, decision, decided_by: null, decided_at: null, comment: null });

describe("COPS-08 approval banner", () => {
  it("shows nothing for a deal under every threshold: no added step", () => {
    expect(approvalBanner(evaluation({ required: false, satisfied: true, required_approvers: [], matched_rules: [] }))).toEqual({ state: "none" });
  });

  it("asks for approval when one is needed and none was requested, or the last one was rejected or voided", () => {
    expect(approvalBanner(evaluation())).toEqual({ state: "needed", approvers: ["sales_manager", "finance"] });
    expect(approvalBanner(evaluation({ approval: null }))).toMatchObject({ state: "needed" });
  });

  it("says who is still to decide while it is pending, and approved once all have", () => {
    const pending = evaluation({ approval: approval([decided("sales_manager", "approved"), decided("finance", "pending")]) });
    expect(approvalBanner(pending)).toEqual({ state: "pending", waiting: ["finance"], approved: ["sales_manager"] });
    expect(approvalBanner(evaluation({ satisfied: true, approval: approval([decided("sales_manager", "approved"), decided("finance", "approved")], "approved") }))).toEqual({ state: "approved" });
  });

  it("marks a deal that was in progress before approvals existed, and only when a rule would have applied", () => {
    expect(approvalBanner(evaluation({ grandfathered: true, required: false, satisfied: true }))).toEqual({ state: "grandfathered" });
    expect(approvalBanner(evaluation({ grandfathered: true, required: false, satisfied: true, required_approvers: [] }))).toEqual({ state: "none" });
  });
});

describe("COPS-08 labels", () => {
  it("says why a rule matched", () => {
    expect(describeRule({ rule: "discount_pct", value: 25, approvers: [] }, "USD", money)).toBe("Discount 25%");
    expect(describeRule({ rule: "contract_value", value: 2_844_000, approvers: [] }, "USD", money)).toBe("Contract value USD 28440.00");
    expect(describeRule({ rule: "term_months", value: 36, approvers: [] }, "USD", money)).toBe("Term 36 months");
    expect(describeRule({ rule: "payment_terms", value: 60, approvers: [] }, "USD", money)).toBe("Payment terms net 60");
    expect(describeRule({ rule: "custom_clauses", value: null, approvers: [] }, "USD", money)).toBe("Custom clauses");
  });

  it("tells Finance how late a bill is and what happens next", () => {
    const date = (iso: string) => iso.slice(0, 10);
    expect(dunningLine({ billing: "payment_link", dunning: null }, date)).toBeNull();
    expect(dunningLine({ billing: "payment_link", dunning: { overdue_invoice_id: "i", due_at: "2026-10-01T00:00:00Z", day: 3, next_status: "restricted", next_status_at: "2026-10-09T00:00:00Z" } }, date)).toBe(
      "3 days overdue · restricted on 2026-10-09"
    );
    expect(dunningLine({ billing: "invoiced", dunning: { overdue_invoice_id: "i", due_at: "2026-10-01T00:00:00Z", day: 1, next_status: null, next_status_at: null } }, date)).toBe(
      "1 day overdue · no automatic step, Finance decides"
    );
    expect(dunningLine({ billing: "payment_link", dunning: { overdue_invoice_id: "i", due_at: "2026-10-01T00:00:00Z", day: 0, next_status: "restricted", next_status_at: "2026-10-09T00:00:00Z" } }, date)).toContain("Due today");
  });

  it("uses a warning tone for trouble and success only when things are fine", () => {
    expect(envelopeTone("signed")).toBe("success");
    expect(envelopeTone("declined")).toBe("danger");
    expect(envelopeTone("viewed")).toBe("info");
    expect(subscriptionTone("active")).toBe("success");
    expect(subscriptionTone("past_due")).toBe("warning");
    expect(subscriptionTone("suspended")).toBe("danger");
  });
});

describe("COPS-08 error messages", () => {
  const error = (envelope: Record<string, unknown>) => new CopsRequestError("request failed", envelope as never, null);

  it("turns the approval conflict into who has to approve", () => {
    expect(advancedErrorMessage(error({ code: "BUSINESS_STATE_CONFLICT", message: "x", details: { required_approvers: ["sales_manager", "finance"], approval_status: "not_requested" } }), "f")).toBe(
      "Needs approval from Sales Manager, Finance first."
    );
    expect(advancedErrorMessage(error({ code: "BUSINESS_STATE_CONFLICT", message: "x", details: { required_approvers: ["finance"], approval_status: "pending" } }), "f")).toBe("Waiting for approval from Finance.");
  });

  it("keeps the API's own words for other conflicts, and the fallback for anything unknown", () => {
    expect(advancedErrorMessage(error({ code: "BUSINESS_STATE_CONFLICT", message: "This version is already out for signature", details: {} }), "f")).toBe("This version is already out for signature");
    expect(advancedErrorMessage(error({ code: "FORBIDDEN", message: "Only the finance role can decide this approval" }), "f")).toBe("Only the finance role can decide this approval");
    expect(advancedErrorMessage(new Error("network"), "Could not save.")).toBe("Could not save.");
  });
});

describe("COPS-08 agreed seat price", () => {
  const proposal = (status: Proposal["status"], line: { net_minor: number; quantity: number; price_basis?: "per_month" | "per_term" | "one_time" }, discount_pct: number, sent = true): Proposal =>
    ({
      id: `p-${status}`,
      opportunity_id: "o1",
      title: `Plan ${status}`,
      status,
      current_version: 1,
      status_reason: null,
      status_changed_at: null,
      created_at: "2026-10-01T00:00:00Z",
      versions: [
        {
          id: "v1",
          version: 1,
          currency: "USD",
          billing_cadence: "annual",
          term_months: 12,
          discount_pct,
          tax_pct: 0,
          notes: null,
          totals: { subtotal_minor: 0, discount_minor: 0, tax_minor: 0, total_minor: 0 },
          line_items: [{ id: "l1", position: 0, kind: "seats", description: "Seats", quantity: line.quantity, unit_amount_minor: 0, discount_pct: 0, price_basis: line.price_basis, gross_minor: line.net_minor, discount_minor: 0, net_minor: line.net_minor }],
          sent_at: sent ? "2026-10-02T00:00:00Z" : null,
          sent_by: null,
          content_hash: null,
          hash_valid: null,
          created_at: "2026-10-01T00:00:00Z",
        },
      ],
    }) as Proposal;

  it("takes the price the customer agreed to, after every discount, per seat per month", () => {
    // $948 per seat for the year, 10 seats, 25% off the proposal: $59.25 per seat per month.
    expect(agreedSeatPrice([proposal("sent", { net_minor: 948_000, quantity: 10 }, 25)])).toMatchObject({ seat_month_minor: 5925, seats: 10, term_months: 12, version: 1 });
    expect(agreedSeatPrice([proposal("sent", { net_minor: 79_000, quantity: 10, price_basis: "per_month" }, 0)])?.seat_month_minor).toBe(7900);
  });

  it("prefers the accepted proposal, and ignores drafts and one-time lines", () => {
    const accepted = proposal("accepted", { net_minor: 600_000, quantity: 10 }, 0);
    expect(agreedSeatPrice([proposal("sent", { net_minor: 948_000, quantity: 10 }, 0), accepted])?.proposal_title).toBe("Plan accepted");
    expect(agreedSeatPrice([proposal("draft", { net_minor: 948_000, quantity: 10 }, 0, false)])).toBeNull();
    expect(agreedSeatPrice([proposal("sent", { net_minor: 948_000, quantity: 10, price_basis: "one_time" }, 0)])).toBeNull();
  });
});
