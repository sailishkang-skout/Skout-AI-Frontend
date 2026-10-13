// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ApprovalEvaluation, Envelope } from "@/lib/cops-commercial-advanced";

const api = {
  evaluateApprovals: vi.fn(),
  requestApproval: vi.fn(),
  envelopes: vi.fn(),
  sendEnvelope: vi.fn(),
};
vi.mock("@/lib/api-client", () => ({ useAuthReady: () => true, useApiFetch: () => vi.fn() }));
vi.mock("@/lib/cops-commercial-advanced", async (original) => ({ ...(await original<typeof import("@/lib/cops-commercial-advanced")>()), useCopsAdvancedApi: () => api }));
vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));

import { ApprovalPanel } from "./approval-panel";
import { EnvelopePanel } from "./envelope-panel";

const wrap = (node: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>);

const terms = { currency: "USD", discount_pct: 25, seats: 10, contract_value_minor: 711_000, term_months: 12, free_credits: 0, payment_terms_net_days: 30, custom_clauses: false, non_standard_sla: false };
const evaluation = (over: Partial<ApprovalEvaluation> = {}): { data: ApprovalEvaluation } => ({
  data: {
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
  },
});
const envelope = (over: Partial<Envelope> = {}): Envelope => ({
  id: "e1",
  contract_id: "c1",
  contract_version: 1,
  provider: "mock",
  status: "sent",
  template_key: null,
  signers: [{ name: "Asha Rao", email: "asha@example.test" }],
  sent_at: "2026-10-13T09:00:00Z",
  status_changed_at: "2026-10-13T09:00:00Z",
  events: [],
  ...over,
});

beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));
afterEach(cleanup);

describe("ApprovalPanel", () => {
  it("renders nothing for a deal under every threshold", async () => {
    api.evaluateApprovals.mockResolvedValue(evaluation({ required: false, satisfied: true, required_approvers: [], matched_rules: [] }));
    const { container } = wrap(<ApprovalPanel proposalId="p1" version={1} canRequest onChanged={() => {}} />);
    await waitFor(() => expect(api.evaluateApprovals).toHaveBeenCalledWith("p1"));
    expect(container.querySelector("[data-testid='approval-panel-p1']")).toBeNull();
  });

  it("says who has to approve and why, and requests the approval", async () => {
    api.evaluateApprovals.mockResolvedValue(evaluation());
    api.requestApproval.mockResolvedValue({ data: {} });
    const onChanged = vi.fn();
    wrap(<ApprovalPanel proposalId="p1" version={1} canRequest onChanged={onChanged} />);
    expect(await screen.findByText("Needs approval from Sales Manager, Finance")).toBeTruthy();
    expect(screen.getByText("Discount 25%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Request approval" }));
    await waitFor(() => expect(api.requestApproval).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("hides the request button from a role that cannot send", async () => {
    api.evaluateApprovals.mockResolvedValue(evaluation());
    wrap(<ApprovalPanel proposalId="p1" version={1} canRequest={false} onChanged={() => {}} />);
    await screen.findByText("Needs approval from Sales Manager, Finance");
    expect(screen.queryByRole("button", { name: "Request approval" })).toBeNull();
  });

  it("shows who is still to decide while pending, and approved when all have", async () => {
    const decision = (role: "sales_manager" | "finance", d: "pending" | "approved") => ({ role, decision: d, decided_by: null, decided_at: null, comment: null });
    const approval = { id: "a1", opportunity_id: "o1", proposal_id: "p1", proposal_version: 1, status: "pending" as const, required_approvers: ["sales_manager" as const, "finance" as const], matched_rules: [], terms, requested_at: "2026-10-13T10:00:00Z", expires_at: "2026-10-27T10:00:00Z", status_reason: null, decisions: [decision("sales_manager", "approved"), decision("finance", "pending")] };
    api.evaluateApprovals.mockResolvedValue(evaluation({ approval }));
    wrap(<ApprovalPanel proposalId="p1" version={1} canRequest onChanged={() => {}} />);
    expect(await screen.findByText("Waiting for Finance")).toBeTruthy();
    expect(screen.getByText("Approved by Sales Manager")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Request approval" })).toBeNull();
    cleanup();
    api.evaluateApprovals.mockResolvedValue(evaluation({ satisfied: true, approval: { ...approval, status: "approved" } }));
    wrap(<ApprovalPanel proposalId="p1" version={2} canRequest onChanged={() => {}} />);
    expect(await screen.findByText("Approved")).toBeTruthy();
  });
});

describe("EnvelopePanel", () => {
  it("offers to send for signature when nothing is out, and needs a valid signer", async () => {
    api.envelopes.mockResolvedValue({ data: [] });
    api.sendEnvelope.mockResolvedValue({ data: envelope() });
    wrap(<EnvelopePanel contractId="c1" version={1} contractTitle="MSA" canSend closed={false} onChanged={() => {}} />);
    expect(await screen.findByText("Not sent for signature yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send for signature" }));
    const submit = screen.getAllByRole("button", { name: "Send for signature" }).at(-1) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Signer 1 name"), { target: { value: "Asha Rao" } });
    fireEvent.change(screen.getByLabelText("Signer 1 email"), { target: { value: "not-an-email" } });
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Signer 1 email"), { target: { value: "asha@example.test" } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => expect(api.sendEnvelope).toHaveBeenCalledWith("c1", { signers: [{ name: "Asha Rao", email: "asha@example.test" }] }));
  });

  it("shows the status and timeline of a live envelope and does not offer a second send", async () => {
    api.envelopes.mockResolvedValue({
      data: [envelope({ status: "viewed", events: [{ event_type: "envelope.sent", status: "sent", occurred_at: "2026-10-13T09:00:00Z", received_at: "2026-10-13T09:00:01Z", outcome: "applied" }, { event_type: "envelope.viewed", status: "viewed", occurred_at: "2026-10-13T09:20:00Z", received_at: "2026-10-13T09:20:01Z", outcome: "applied" }] })],
    });
    wrap(<EnvelopePanel contractId="c1" version={1} contractTitle="MSA" canSend closed={false} onChanged={() => {}} />);
    expect((await screen.findByTestId("envelope-status")).textContent).toBe("Viewed");
    expect(screen.getByTestId("envelope-timeline").textContent).toMatch(/Sent .*Viewed /);
    expect(screen.queryByRole("button", { name: "Send for signature" })).toBeNull();
  });

  it("offers a new send after a decline, and never on a closed contract or without permission", async () => {
    api.envelopes.mockResolvedValue({ data: [envelope({ status: "declined" })] });
    wrap(<EnvelopePanel contractId="c1" version={2} contractTitle="MSA" canSend closed={false} onChanged={() => {}} />);
    expect((await screen.findByTestId("envelope-status")).textContent).toBe("Declined");
    expect(screen.getByRole("button", { name: "Send for signature" })).toBeTruthy();
    cleanup();
    wrap(<EnvelopePanel contractId="c1" version={2} contractTitle="MSA" canSend closed onChanged={() => {}} />);
    await screen.findByTestId("envelope-status");
    expect(screen.queryByRole("button", { name: "Send for signature" })).toBeNull();
    cleanup();
    wrap(<EnvelopePanel contractId="c1" version={2} contractTitle="MSA" canSend={false} closed={false} onChanged={() => {}} />);
    await screen.findByTestId("envelope-status");
    expect(screen.queryByRole("button", { name: "Send for signature" })).toBeNull();
  });
});
