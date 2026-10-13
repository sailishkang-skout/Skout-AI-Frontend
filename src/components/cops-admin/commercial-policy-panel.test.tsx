// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { approvalPolicyProblem, bandsProblem, describeBand, dunningDays, dunningProblem, withDunningDays, type ApprovalPolicy, type DunningPolicy } from "@/lib/cops-commercial-policy";

const api = { list: vi.fn(), save: vi.fn() };
vi.mock("@/lib/api-client", () => ({ useAuthReady: () => true, useApiFetch: () => vi.fn() }));
vi.mock("@/lib/cops-admin", async (original) => ({ ...(await original<typeof import("@/lib/cops-admin")>()), useCopsAdminApi: () => api }));

import { CommercialPolicyPanel } from "./commercial-policy-panel";

const approval: ApprovalPolicy = {
  expires_after_days: 14,
  discount_pct: [
    { over: 10, up_to: 20, approvers: ["sales_manager"] },
    { over: 20, up_to: null, approvers: ["sales_manager", "finance"] },
  ],
  seats: [{ over: 25, up_to: null, approvers: ["sales_manager"] }],
  contract_value_minor: { USD: [{ over: 2_500_000, up_to: null, approvers: ["sales_manager"] }], EUR: null },
  term_months: [{ over: 24, up_to: null, approvers: ["finance"] }],
  free_credits: null,
  payment_terms_net_days: [{ over: 30, up_to: null, approvers: ["finance"] }],
  custom_clauses: { approvers: ["legal_revops"] },
  non_standard_sla: null,
};
const dunning: DunningPolicy = { stages: [{ state: "past_due", from_day: 0 }, { state: "restricted", from_day: 8 }, { state: "suspended", from_day: 15 }, { state: "closed", from_day: 45 }], suspend_when_provider_halted: true, invoiced_accounts_auto_suspend: false };
const values: Record<string, unknown> = {
  approval_policy: approval,
  dunning_policy: dunning,
  price_book: { month_to_month_surcharge_pct: 20, currencies: { USD: { seat_month_annual_minor: 7900, status: "benchmarked" }, EUR: { seat_month_annual_minor: 7500, status: "suggested" } } },
  renewal_policy: { lead_days: 90 },
};
const row = (kind: string, version = 0) => ({ kind, key: "default", version, value: values[kind], reason: null, restored_from_version: null, created_by: null, created_at: null, is_system_default: version === 0 });

const wrap = (canWrite: boolean) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CommercialPolicyPanel canWrite={canWrite} /></QueryClientProvider>);

beforeEach(() => {
  api.list.mockReset().mockImplementation(async (kind: string) => ({ data: [row(kind, kind === "price_book" ? 3 : 0)] }));
  api.save.mockReset().mockResolvedValue({ data: {} });
});
afterEach(cleanup);

describe("commercial policy rules in words", () => {
  it("reads a band as a range and who approves", () => {
    expect(describeBand({ over: 10, up_to: 20, approvers: ["sales_manager"] })).toBe("over 10 up to 20: Sales Manager");
    expect(describeBand({ over: 30, up_to: null, approvers: ["sales_manager", "finance", "executive"] })).toBe("over 30: Sales Manager + Finance + Executive (Admin)");
  });

  it("explains why a set of bands would be refused", () => {
    expect(bandsProblem(approval.discount_pct)).toBeNull();
    expect(bandsProblem([{ over: 10, up_to: 20, approvers: ["finance"] }, { over: 15, up_to: null, approvers: ["finance"] }])).toMatch(/without overlapping/);
    expect(bandsProblem([{ over: 10, up_to: null, approvers: ["finance"] }, { over: 20, up_to: null, approvers: ["finance"] }])).toMatch(/Only the last band/);
    expect(bandsProblem([{ over: 10, up_to: 5, approvers: ["finance"] }])).toMatch(/end above/);
    expect(bandsProblem([{ over: 10, up_to: null, approvers: [] }])).toMatch(/at least one approver/);
    expect(approvalPolicyProblem({ ...approval, seats: [{ over: 10, up_to: null, approvers: [] }] })).toBe("Seats: Every band needs at least one approver.");
    expect(approvalPolicyProblem(approval)).toBeNull();
  });

  it("keeps the unpaid-bill stages in order", () => {
    expect(dunningDays(dunning)).toEqual({ restricted: 8, suspended: 15, closed: 45 });
    expect(withDunningDays(dunning, { restricted: 5, suspended: 10, closed: 30 }).stages.map((s) => s.from_day)).toEqual([0, 5, 10, 30]);
    expect(dunningProblem({ restricted: 8, suspended: 15, closed: 45 })).toBeNull();
    expect(dunningProblem({ restricted: 20, suspended: 15, closed: 45 })).toMatch(/in order/);
    expect(dunningProblem({ restricted: 0, suspended: 15, closed: 45 })).toMatch(/1 or more/);
  });
});

describe("CommercialPolicyPanel", () => {
  it("shows each policy in words, with its version, and no edit controls for a reader", async () => {
    wrap(false);
    const rules = await screen.findByTestId("policy-summary-approval_policy");
    expect(rules.textContent).toContain("over 10 up to 20: Sales Manager; over 20: Sales Manager + Finance");
    // A currency with no thresholds is called out instead of looking like "no approval needed".
    expect(rules.textContent).toContain("Contract value (EUR)no thresholds: not checked");
    expect(rules.textContent).toContain("Free creditsswitched off");
    expect((await screen.findByTestId("policy-summary-dunning_policy")).textContent).toContain("Restricted from day 8");
    expect((await screen.findByTestId("policy-summary-price_book")).textContent).toContain("USD 79 (benchmarked)");
    expect(within(await screen.findByTestId("policy-price_book")).getByText("v3")).toBeTruthy();
    expect(within(await screen.findByTestId("policy-approval_policy")).getByText("built-in default")).toBeTruthy();
    expect(screen.queryByTestId("policy-edit-price_book")).toBeNull();
  });

  it("saves a price change as a new version, only with a reason, and in minor units", async () => {
    wrap(true);
    fireEvent.click(await screen.findByTestId("policy-edit-price_book"));
    fireEvent.change(screen.getByLabelText("EUR price per seat per month"), { target: { value: "72.50" } });
    fireEvent.change(screen.getByLabelText("EUR price status"), { target: { value: "confirmed" } });
    const save = screen.getByTestId("policy-save-price_book") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason for changing price book"), { target: { value: "Finance confirmed EUR" } });
    fireEvent.click(save);
    await waitFor(() => expect(api.save).toHaveBeenCalled());
    const [kind, key, value, reason, expected] = api.save.mock.calls[0]!;
    expect([kind, key, reason, expected]).toEqual(["price_book", "default", "Finance confirmed EUR", 3]);
    expect(value.currencies.EUR).toEqual({ seat_month_annual_minor: 7250, status: "confirmed" });
    expect(value.currencies.USD).toEqual({ seat_month_annual_minor: 7900, status: "benchmarked" });
  });

  it("edits an approval threshold, and refuses bands that overlap before anything is sent", async () => {
    wrap(true);
    fireEvent.click(await screen.findByTestId("policy-edit-approval_policy"));
    fireEvent.change(screen.getByLabelText("Reason for changing approval rules"), { target: { value: "Tighter discounts" } });
    const save = screen.getByTestId("policy-save-approval_policy") as HTMLButtonElement;
    // The second band now starts below where the first ends.
    fireEvent.change(screen.getByLabelText("Discount band 2 over"), { target: { value: "15" } });
    expect(screen.getByTestId("policy-problem-approval_policy").textContent).toContain("Discount: Bands must go up without overlapping.");
    expect(save.disabled).toBe(true);
    // Move the whole boundary instead: 10 to 15, then over 15.
    fireEvent.change(screen.getByLabelText("Discount band 1 up to"), { target: { value: "15" } });
    expect(screen.queryByTestId("policy-problem-approval_policy")).toBeNull();
    // Contract value is typed in dollars and stored in cents.
    fireEvent.change(screen.getByLabelText("Contract value USD band 1 over"), { target: { value: "30000" } });
    fireEvent.click(save);
    await waitFor(() => expect(api.save).toHaveBeenCalled());
    const [kind, , value, , expected] = api.save.mock.calls[0]!;
    expect(kind).toBe("approval_policy");
    // The first save over the built-in default sends no expected version.
    expect(expected).toBeUndefined();
    expect(value.discount_pct).toEqual([{ over: 10, up_to: 15, approvers: ["sales_manager"] }, { over: 15, up_to: null, approvers: ["sales_manager", "finance"] }]);
    expect(value.contract_value_minor.USD[0].over).toBe(3_000_000);
  });

  it("changes the unpaid-bill days and keeps them in order", async () => {
    wrap(true);
    fireEvent.click(await screen.findByTestId("policy-edit-dunning_policy"));
    fireEvent.change(screen.getByLabelText("Restricted from day day"), { target: { value: "20" } });
    expect(screen.getByTestId("policy-problem-dunning_policy").textContent).toMatch(/in order/);
    fireEvent.change(screen.getByLabelText("Restricted from day day"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Reason for changing unpaid bills"), { target: { value: "Longer grace" } });
    fireEvent.click(screen.getByTestId("policy-save-dunning_policy"));
    await waitFor(() => expect(api.save).toHaveBeenCalled());
    expect(api.save.mock.calls[0]![2].stages).toEqual([{ state: "past_due", from_day: 0 }, { state: "restricted", from_day: 10 }, { state: "suspended", from_day: 15 }, { state: "closed", from_day: 45 }]);
  });
});
