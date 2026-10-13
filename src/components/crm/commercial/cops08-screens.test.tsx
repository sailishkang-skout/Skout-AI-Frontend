// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Approval, Subscription } from "@/lib/cops-commercial-advanced";

const api = {
  subscription: vi.fn(),
  createSubscription: vi.fn(),
  amendSubscription: vi.fn(),
  invoicePaymentLink: vi.fn(),
  markInvoicePaid: vi.fn(),
  approvalQueue: vi.fn(),
  decideApproval: vi.fn(),
  failedPayments: vi.fn(),
  reconciliation: vi.fn(),
  financeSubscriptions: vi.fn(),
  financePayments: vi.fn(),
  creditActivity: vi.fn(),
  grandfathered: vi.fn(),
};
let permissions: string[] = [];
vi.mock("@/lib/api-client", () => ({ useAuthReady: () => true, useApiFetch: () => vi.fn() }));
vi.mock("@/lib/cops-commercial-advanced", async (original) => ({ ...(await original<typeof import("@/lib/cops-commercial-advanced")>()), useCopsAdvancedApi: () => api }));
vi.mock("@/lib/cops-commercial", async (original) => ({
  ...(await original<typeof import("@/lib/cops-commercial")>()),
  useMyPermissions: () => ({ permissions, loaded: true }),
  useCopsCommercialApi: () => ({ accountCommercial: vi.fn().mockResolvedValue({ data: [{ opportunity: { id: "o1", name: "Acme annual", currency: "USD" } }] }) }),
}));
vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));

import { CopsRequestError } from "@/lib/cops-fetch";
import { SubscriptionPanel } from "./subscription-panel";
import ApprovalsPage from "@/app/(dashboard)/approvals/page";
import FinancePage from "@/app/(dashboard)/finance/page";

const wrap = (node: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>);

const subscription = (over: Partial<Subscription> = {}): Subscription => ({
  id: "s1",
  account_id: "acc1",
  opportunity_id: "o1",
  status: "active",
  billing: "payment_link",
  currency: "USD",
  cadence: "monthly",
  term_months: 12,
  term_start: "2026-10-13T00:00:00Z",
  renews_at: "2027-10-13T00:00:00Z",
  renewal_opportunity_id: null,
  seats: 10,
  items: [{ id: "i1", kind: "seats", quantity: 10, unit_amount_minor: 9480 }],
  invoices: [{ id: "b1", period_start: "2026-10-13T00:00:00Z", period_end: "2026-11-13T00:00:00Z", due_at: "2026-10-13T00:00:00Z", amount_minor: 94_800, currency: "USD", status: "open", payment_request_id: null, paid_at: null }],
  amendments: [],
  dunning: null,
  ...over,
});
const terms = { currency: "USD", discount_pct: 25, seats: 10, contract_value_minor: 711_000, term_months: 12, free_credits: 0, payment_terms_net_days: 30, custom_clauses: false, non_standard_sla: false };
const approval: Approval = {
  id: "a1",
  opportunity_id: "o1",
  proposal_id: "p1",
  proposal_version: 2,
  status: "pending",
  required_approvers: ["sales_manager", "finance"],
  matched_rules: [{ rule: "discount_pct", value: 25, approvers: ["sales_manager", "finance"] }],
  terms,
  requested_at: "2026-10-13T10:00:00Z",
  expires_at: "2026-10-27T10:00:00Z",
  status_reason: null,
  decisions: [
    { role: "sales_manager", decision: "approved", decided_by: "u1", decided_at: "2026-10-13T11:00:00Z", comment: "Fine for this account" },
    { role: "finance", decision: "pending", decided_by: null, decided_at: null, comment: null },
  ],
};
const forbidden = () => new CopsRequestError("forbidden", { code: "FORBIDDEN", message: "No" } as never, null);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  permissions = ["billing:read", "billing:write", "commercial:approve"];
});
afterEach(cleanup);

describe("SubscriptionPanel", () => {
  it("offers to create a subscription when the account has none, only to a role that can", async () => {
    api.subscription.mockResolvedValue({ data: null });
    wrap(<SubscriptionPanel accountId="acc1" />);
    expect(await screen.findByText("No subscription yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create subscription" })).toBeTruthy();
    cleanup();
    permissions = ["billing:read"];
    wrap(<SubscriptionPanel accountId="acc1" />);
    await screen.findByText("No subscription yet");
    expect(screen.queryByRole("button", { name: "Create subscription" })).toBeNull();
  });

  it("treats a response that is not a subscription as none, instead of breaking the tab", async () => {
    api.subscription.mockResolvedValue({ data: [] });
    wrap(<SubscriptionPanel accountId="acc1" />);
    expect(await screen.findByText("No subscription yet")).toBeTruthy();
  });

  it("creates a subscription against one of the account's opportunities", async () => {
    api.subscription.mockResolvedValue({ data: null });
    api.createSubscription.mockResolvedValue({ data: subscription() });
    wrap(<SubscriptionPanel accountId="acc1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Create subscription" }));
    await screen.findByText("Acme annual (USD)");
    fireEvent.change(screen.getByLabelText("Seats"), { target: { value: "25" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Create subscription" }).at(-1) as HTMLElement);
    await waitFor(() => expect(api.createSubscription).toHaveBeenCalledWith("acc1", { opportunity_id: "o1", seats: 25, cadence: "annual", term_months: 12, billing: "payment_link" }));
  });

  it("shows the state, how late the bill is, and the bill's actions", async () => {
    api.subscription.mockResolvedValue({ data: subscription({ status: "past_due", dunning: { overdue_invoice_id: "b1", due_at: "2026-10-13T00:00:00Z", day: 3, next_status: "restricted", next_status_at: "2026-10-21T00:00:00Z" } }) });
    api.markInvoicePaid.mockResolvedValue({ data: { ok: true } });
    wrap(<SubscriptionPanel accountId="acc1" />);
    expect((await screen.findByTestId("subscription-status")).textContent).toBe("Past due");
    expect(screen.getByTestId("subscription-dunning").textContent).toContain("3 days overdue · restricted on");
    const bills = within(screen.getByTestId("subscription-invoices"));
    expect(bills.getByRole("button", { name: "Copy payment link" })).toBeTruthy();
    fireEvent.click(bills.getByRole("button", { name: "Mark paid" }));
    // A reason is required before the bill can be marked paid.
    const confirm = screen.getAllByRole("button", { name: "Mark paid" }).at(-1) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Wire received" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api.markInvoicePaid).toHaveBeenCalledWith("b1", "Wire received"));
  });

  it("lists amendments in order, shows a seat change that has not started, and records a new one with a reason", async () => {
    const future = new Date(Date.now() + 20 * 86_400_000).toISOString();
    const amendment = { id: "m1", seq: 1, seats: 15, term_months: null, reason: "Five more reps", effective_at: future, before: { seats: 10, term_months: 12, renews_at: "2027-10-13T00:00:00Z" }, after: { seats: 15, term_months: 12, renews_at: "2027-10-13T00:00:00Z" }, created_at: "2026-10-14T00:00:00Z" };
    api.subscription.mockResolvedValue({ data: subscription({ amendments: [amendment] }) });
    api.amendSubscription.mockResolvedValue({ data: subscription() });
    wrap(<SubscriptionPanel accountId="acc1" />);
    expect((await screen.findByTestId("subscription-pending-change")).textContent).toContain("15 seats from");
    expect(screen.getByTestId("subscription-amendments").textContent).toContain("10 to 15 seats");
    fireEvent.click(screen.getByRole("button", { name: "Change seats or term" }));
    const save = screen.getByRole("button", { name: "Record amendment" }) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("New term in months"), { target: { value: "24" } });
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getAllByLabelText("Reason").at(-1) as HTMLElement, { target: { value: "Two year commitment" } });
    fireEvent.click(save);
    await waitFor(() => expect(api.amendSubscription).toHaveBeenCalledWith("s1", { term_months: 24, reason: "Two year commitment" }));
  });

  it("renders nothing for a role without billing access", async () => {
    api.subscription.mockRejectedValue(forbidden());
    const { container } = wrap(<SubscriptionPanel accountId="acc1" />);
    await waitFor(() => expect(api.subscription).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector(".animate-pulse")).toBeNull());
    expect(container.textContent).toBe("");
  });
});

describe("Approvals page", () => {
  it("shows an empty state that explains itself", async () => {
    api.approvalQueue.mockResolvedValue({ data: [] });
    wrap(<ApprovalsPage />);
    expect(await screen.findByText("Nothing is waiting for approval")).toBeTruthy();
  });

  it("shows what is being approved and lets a role approve its own slot", async () => {
    api.approvalQueue.mockResolvedValue({ data: [approval] });
    api.decideApproval.mockResolvedValue({ data: { ...approval, status: "approved" } });
    wrap(<ApprovalsPage />);
    const row = within(await screen.findByTestId("approval-a1"));
    expect(row.getByText(/Discount 25%/)).toBeTruthy();
    // The Sales Manager has decided; only Finance still has buttons.
    expect(within(row.getByTestId("decision-sales_manager")).queryByRole("button")).toBeNull();
    fireEvent.click(within(row.getByTestId("decision-finance")).getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Approve" }).at(-1) as HTMLElement);
    await waitFor(() => expect(api.decideApproval).toHaveBeenCalledWith("a1", { role: "finance", decision: "approved" }));
  });

  it("needs a comment to reject, and shows the API's words when the user does not hold the role", async () => {
    api.approvalQueue.mockResolvedValue({ data: [approval] });
    api.decideApproval.mockRejectedValue(new CopsRequestError("forbidden", { code: "FORBIDDEN", message: "Only the finance role can decide this approval" } as never, null));
    wrap(<ApprovalsPage />);
    const row = within(await screen.findByTestId("approval-a1"));
    fireEvent.click(within(row.getByTestId("decision-finance")).getByRole("button", { name: "Reject" }));
    const reject = screen.getAllByRole("button", { name: "Reject" }).at(-1) as HTMLButtonElement;
    expect(reject.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Too deep" } });
    fireEvent.click(reject);
    expect((await screen.findByTestId("decision-error")).textContent).toBe("Only the finance role can decide this approval");
    expect(api.decideApproval).toHaveBeenCalledWith("a1", { role: "finance", decision: "rejected", comment: "Too deep" });
  });

  it("says who can see the queue instead of a raw error", async () => {
    api.approvalQueue.mockRejectedValue(forbidden());
    wrap(<ApprovalsPage />);
    expect((await screen.findByTestId("approvals-error")).textContent).toContain("visible to roles that can approve");
  });
});

describe("Finance page", () => {
  it("lists failed payments with what happens next, and each other view on its tab", async () => {
    api.failedPayments.mockResolvedValue({ data: [subscription({ status: "restricted", dunning: { overdue_invoice_id: "b1", due_at: "2026-10-01T00:00:00Z", day: 9, next_status: "suspended", next_status_at: "2026-10-16T00:00:00Z" } })] });
    api.reconciliation.mockResolvedValue({ data: { generated_at: "", counts: {}, issues: [{ kind: "envelope_contract_mismatch", entity_type: "signature_envelope", entity_id: "e1", provider_state: "signed", skout_state: "sent", detail: "mock says the envelope is signed; contract c1 is sent", since: "2026-10-13T00:00:00Z" }] } });
    api.financeSubscriptions.mockResolvedValue({ data: [] });
    wrap(<FinancePage />);
    const failed = within(await screen.findByTestId("failed-s1"));
    expect(failed.getByText("Restricted")).toBeTruthy();
    expect(failed.getByText(/9 days overdue · suspended on/)).toBeTruthy();
    expect(failed.getByRole("button", { name: "Mark paid" })).toBeTruthy();

    fireEvent.click(screen.getByTestId("finance-tab-reconciliation"));
    const issues = await screen.findByTestId("finance-reconciliation-list");
    expect(issues.textContent).toContain("E-sign and contract disagree");
    expect(issues.textContent).toContain("Provider: signed · Skout: sent");

    fireEvent.click(screen.getByTestId("finance-tab-subscriptions"));
    expect(await screen.findByTestId("finance-subscriptions-empty")).toBeTruthy();

    api.creditActivity.mockResolvedValue({ data: [{ id: "t1", account_id: "acc1", account_name: "Acme Labs", kind: "adjustment", amount: -5, balance_after: 45, action: "manual_adjustment", reason: "Duplicate grant corrected", actor_type: "user", actor_id: "u1", created_at: "2026-10-13T10:00:00Z" }] });
    fireEvent.click(screen.getByTestId("finance-tab-credits"));
    const credits = await screen.findByTestId("finance-credits-table");
    expect(credits.textContent).toContain("Acme Labs");
    expect(credits.textContent).toContain("-5");
    expect(credits.textContent).toContain("Duplicate grant corrected");
  });

  it("hides the write actions from a read-only role, and explains a forbidden view", async () => {
    permissions = ["billing:read"];
    api.failedPayments.mockResolvedValue({ data: [subscription({ status: "past_due", dunning: { overdue_invoice_id: "b1", due_at: "2026-10-01T00:00:00Z", day: 2, next_status: "restricted", next_status_at: "2026-10-09T00:00:00Z" } })] });
    api.grandfathered.mockRejectedValue(forbidden());
    wrap(<FinancePage />);
    const failed = within(await screen.findByTestId("failed-s1"));
    expect(failed.queryByRole("button", { name: "Mark paid" })).toBeNull();
    expect(failed.queryByRole("button", { name: "Copy payment link" })).toBeNull();
    fireEvent.click(screen.getByTestId("finance-tab-grandfathered"));
    expect((await screen.findByTestId("finance-error")).textContent).toContain("visible to roles with billing access");
  });
});
