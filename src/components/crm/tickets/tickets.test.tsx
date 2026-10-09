import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  prefill: vi.fn(),
  create: vi.fn(),
  comment: vi.fn(),
  transition: vi.fn(),
  escalate: vi.fn(),
  forAccount: vi.fn(),
}));
const perms = vi.hoisted(() => ({ list: [] as string[] }));
vi.mock("@/lib/cops-tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cops-tickets")>()),
  useCopsTicketsApi: () => api,
}));
vi.mock("@/lib/cops-commercial", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cops-commercial")>()),
  useMyPermissions: () => ({ permissions: perms.list }),
}));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  useAuthReady: () => true,
}));

import { CreateTicketDialog } from "./create-ticket-dialog";
import { TicketDrawer } from "./ticket-drawer";
import { AccountEngineeringTab } from "./account-engineering-tab";

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const prefill = {
  data: {
    account_id: "a1",
    contact_id: "c1",
    milestone_id: null,
    title: "Acme: integration error",
    category: "integration",
    severity: "high",
    priority: "p2",
    impact: "Onboarding is blocked for this account",
    affected_feature: "CRM integration",
    environment: "production",
    diagnostics: { activation_pct: 35, blocker: "integration_error" },
  },
};

const detail = (over: Record<string, unknown> = {}) => ({
  data: {
    id: "t1",
    account_id: "a1",
    title: "CRM sync fails",
    description: null,
    category: "integration",
    severity: "medium",
    priority: "p2",
    impact: null,
    affected_feature: null,
    environment: "production",
    repro_steps: null,
    log_refs: [],
    diagnostics: { activation_pct: 35 },
    status: "triage",
    team: null,
    assignee_id: null,
    account_tier: "enterprise",
    created_at: "2026-10-09T00:00:00Z",
    context: {
      account: { id: "a1", name: "Acme", domain: "acme.test", tier: "enterprise" },
      contact: { id: "c1", name: "Ada Lovelace", email: "ada@acme.test" },
      opportunity: null,
      milestone: null,
      summary: { open_count: 2, max_severity: "high" },
    },
    comments: [
      { id: "n1", visibility: "internal", kind: "note", body: "Root cause: token refresh", ai_generated: false, created_at: "2026-10-09T01:00:00Z" },
      { id: "u1", visibility: "customer", kind: "update", body: "We are on it", ai_generated: false, created_at: "2026-10-09T02:00:00Z" },
    ],
    history: [],
    ...over,
  },
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  perms.list = [];
});
afterEach(() => cleanup());

describe("CreateTicketDialog", () => {
  it("opens prefilled from the account and creates with one key per open dialog", async () => {
    api.prefill.mockResolvedValue(prefill);
    api.create.mockRejectedValueOnce(new Error("network")).mockResolvedValue({ data: { id: "t1" } });
    const onCreated = vi.fn();
    wrap(<CreateTicketDialog open onClose={() => {}} accountId="a1" blocker="integration_error" source="onboarding_blocker" onCreated={onCreated} />);
    const title = (await screen.findByLabelText("Title")) as HTMLInputElement;
    expect(title.value).toBe("Acme: integration error");
    expect((screen.getByLabelText("Severity") as HTMLSelectElement).value).toBe("high");
    expect((screen.getByLabelText("Affected feature") as HTMLInputElement).value).toBe("CRM integration");
    expect(screen.getByTestId("ticket-safe-diagnostics").textContent).toContain("activation pct");
    expect(api.prefill).toHaveBeenCalledWith({ account_id: "a1", milestone_id: undefined, blocker: "integration_error" });

    // Nothing else to fill in: submit straight away, and a retry reuses the key.
    const submit = screen.getByTestId("create-ticket-submit") as HTMLButtonElement;
    fireEvent.click(submit);
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.click(submit);
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(api.create.mock.calls[1]![1]).toBe(api.create.mock.calls[0]![1]);
    expect(api.create.mock.calls[0]![0]).toMatchObject({ account_id: "a1", contact_id: "c1", severity: "high", diagnostics: prefill.data.diagnostics });
    expect(api.create.mock.calls[0]![2]).toBe("onboarding_blocker");
  });

  it("cannot be submitted without a title", async () => {
    api.prefill.mockResolvedValue(prefill);
    wrap(<CreateTicketDialog open onClose={() => {}} accountId="a1" source="account" />);
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "  " } });
    expect((screen.getByTestId("create-ticket-submit") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("TicketDrawer", () => {
  it("labels every comment with its visibility and keeps two separate composers", async () => {
    perms.list = ["tickets:read", "tickets:write", "tickets:send"];
    api.get.mockResolvedValue(detail());
    api.comment.mockResolvedValue({ data: {} });
    wrap(<TicketDrawer ticketId="t1" onClose={() => {}} />);
    const comments = await screen.findByTestId("ticket-comments");
    const items = comments.querySelectorAll("li");
    expect(items[0]!.getAttribute("data-visibility")).toBe("internal");
    expect(items[0]!.textContent).toContain("Internal");
    expect(items[1]!.getAttribute("data-visibility")).toBe("customer");
    expect(items[1]!.textContent).toContain("Visible to customer");

    const internal = screen.getByTestId("ticket-composer-internal");
    const customer = screen.getByTestId("ticket-composer-customer");
    expect(internal.textContent).toContain("The customer never sees this");
    expect(customer.textContent).toContain("The customer can see this");
    expect(screen.getByTestId("ticket-composer-customer-submit").textContent).toContain("Publish to customer");

    // Text typed as an internal note is sent as internal, and only from its own button.
    fireEvent.change(screen.getByLabelText("Internal note"), { target: { value: "Bad deploy" } });
    expect((screen.getByTestId("ticket-composer-customer-submit") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("ticket-composer-internal-submit"));
    await waitFor(() => expect(api.comment).toHaveBeenCalledWith("t1", "Bad deploy", "internal"));

    fireEvent.change(screen.getByLabelText("Customer update"), { target: { value: "Fix is live" } });
    fireEvent.click(screen.getByTestId("ticket-composer-customer-submit"));
    await waitFor(() => expect(api.comment).toHaveBeenCalledWith("t1", "Fix is live", "customer"));
  });

  it("without tickets:send the customer composer is disabled and says why", async () => {
    perms.list = ["tickets:read", "tickets:write"];
    api.get.mockResolvedValue(detail());
    wrap(<TicketDrawer ticketId="t1" onClose={() => {}} />);
    const customer = await screen.findByTestId("ticket-composer-customer");
    expect((screen.getByLabelText("Customer update") as HTMLTextAreaElement).disabled).toBe(true);
    expect(customer.textContent).toContain("Only Customer Success can publish");
    expect((screen.getByLabelText("Internal note") as HTMLTextAreaElement).disabled).toBe(false);
  });

  it("offers only the allowed status moves and shows customer context without commercial data", async () => {
    perms.list = ["tickets:read", "tickets:write"];
    api.get.mockResolvedValue(detail());
    api.transition.mockResolvedValue({ data: {} });
    wrap(<TicketDrawer ticketId="t1" onClose={() => {}} />);
    const context = await screen.findByTestId("ticket-customer-context");
    expect(context.textContent).toContain("Acme");
    expect(context.textContent).toContain("2 open tickets on this account, highest high");
    expect(screen.getByTestId("ticket-move-assigned")).toBeTruthy();
    expect(screen.queryByTestId("ticket-move-resolved")).toBeNull();
    fireEvent.click(screen.getByTestId("ticket-move-assigned"));
    await waitFor(() => expect(api.transition).toHaveBeenCalledWith("t1", "assigned"));
  });

  it("a reader without tickets:write sees no composer and no workflow buttons", async () => {
    perms.list = ["tickets:read"];
    api.get.mockResolvedValue(detail());
    wrap(<TicketDrawer ticketId="t1" onClose={() => {}} />);
    await screen.findByTestId("ticket-comments");
    expect(screen.queryByTestId("ticket-composer-internal")).toBeNull();
    expect(screen.queryByTestId("ticket-move-assigned")).toBeNull();
  });
});

describe("AccountEngineeringTab", () => {
  it("shows the Appendix G empty state with an enabled Create ticket", async () => {
    perms.list = ["crm:write"];
    api.forAccount.mockResolvedValue({ data: { summary: { open_count: 0, max_severity: null }, tickets: [] } });
    wrap(<AccountEngineeringTab accountId="a1" accountName="Acme" />);
    expect((await screen.findByTestId("empty-tab-engineering")).textContent).toContain("No open tickets: this account is healthy");
    expect((screen.getByTestId("account-create-ticket") as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows the open count and the highest severity", async () => {
    perms.list = ["tickets:read"];
    api.forAccount.mockResolvedValue({
      data: {
        summary: { open_count: 2, max_severity: "critical" },
        tickets: [{ id: "t1", title: "CRM sync fails", status: "in_progress", severity: "critical", created_at: "2026-10-09T00:00:00Z" }],
      },
    });
    wrap(<AccountEngineeringTab accountId="a1" />);
    const summary = await screen.findByTestId("account-ticket-summary");
    expect(summary.textContent).toContain("2 open tickets");
    expect(summary.textContent).toContain("Highest: critical");
    expect(screen.queryByTestId("account-create-ticket")).toBeNull();
  });
});
