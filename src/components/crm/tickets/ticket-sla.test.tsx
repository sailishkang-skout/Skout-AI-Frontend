import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  transition: vi.fn(),
  release: vi.fn(),
  incidents: vi.fn(),
  linkTicket: vi.fn(),
  unlinkTicket: vi.fn(),
  metrics: vi.fn(),
  comment: vi.fn(),
  escalate: vi.fn(),
}));
const perms = vi.hoisted(() => ({ list: [] as string[] }));
vi.mock("@/lib/cops-tickets", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/cops-tickets")>()), useCopsTicketsApi: () => api }));
vi.mock("@/lib/cops-commercial", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/cops-commercial")>()), useMyPermissions: () => ({ permissions: perms.list }) }));
vi.mock("@/lib/api-client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api-client")>()), useAuthReady: () => true }));

import { slaDueText } from "@/lib/cops-tickets";
import { SlaChip, SlaPanel } from "./ticket-sla";
import { TicketDrawer } from "./ticket-drawer";
import { EngineeringDashboard } from "./engineering-dashboard";

const wrap = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
const now = Date.now();
const clock = (over: Record<string, unknown> = {}) => ({
  kind: "response",
  target_minutes: 60,
  calendar: "business",
  started_at: new Date(now - 50 * 60_000).toISOString(),
  due_at: new Date(now + 10 * 60_000).toISOString(),
  paused: false,
  used_minutes: 50,
  state: "at_risk",
  met_at: null,
  breached_at: null,
  policy_version: 0,
  ...over,
});
const release = { release_id: null, fixed_in_version: null, deployed_at: null, qa_verified_at: null, qa_verified_by: null, qa_evidence: null, customer_verified_at: null, customer_verified_by: null, customer_evidence: null };
const detail = (over: Record<string, unknown> = {}) => ({
  data: {
    id: "t1",
    account_id: "a1",
    title: "Sync fails",
    description: null,
    category: "bug",
    severity: "high",
    priority: "p2",
    impact: null,
    affected_feature: null,
    environment: "production",
    repro_steps: null,
    log_refs: [],
    diagnostics: {},
    status: "resolved",
    team: null,
    assignee_id: null,
    account_tier: "smb",
    created_at: "2026-10-20T00:00:00Z",
    updated_at: "2026-10-20T00:00:00Z",
    context: { account: { id: "a1", name: "Acme", domain: null, tier: "smb" }, contact: null, opportunity: null, milestone: null, summary: { open_count: 1, max_severity: "high" } },
    comments: [],
    history: [],
    sla: { priority: "p2", tier: "smb", clocks: [clock(), clock({ kind: "resolution", state: "met", met_at: "2026-10-20T05:00:00Z", due_at: null, used_minutes: 300, target_minutes: 540 })] },
    release,
    incident: null,
    ...over,
  },
});

beforeEach(() => {
  perms.list = ["tickets:read", "tickets:write"];
  api.incidents.mockResolvedValue({ data: [{ id: "i1", title: "Sync outage", status: "open" }] });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("COPS-12 SLA display", () => {
  it("the chip shows the state and the time left; due text reads overdue after the due time", () => {
    render(<SlaChip state="at_risk" dueAt={new Date(now + 125 * 60_000).toISOString()} />);
    expect(screen.getByTestId("sla-chip").textContent).toMatch(/SLA at risk · in 2h 5m/);
    expect(slaDueText(new Date(now - 90 * 60_000).toISOString())).toBe("1h 30m overdue");
  });

  it("the panel shows both clocks, paused clocks say why", () => {
    render(<SlaPanel clocks={[clock({ state: "paused", paused: true, due_at: null }) as never, clock({ kind: "resolution", state: "running" }) as never]} />);
    expect(screen.getByTestId("sla-clock-response").textContent).toMatch(/paused while waiting on the customer/);
    expect(screen.getByTestId("sla-clock-resolution").textContent).toMatch(/On track/);
  });
});

describe("COPS-12 ticket drawer", () => {
  it("reopen needs a reason; the reason goes with the transition", async () => {
    api.get.mockResolvedValue(detail());
    api.transition.mockResolvedValue({ data: {} });
    wrap(<TicketDrawer ticketId="t1" onClose={() => {}} />);
    const reopen = await screen.findByTestId("ticket-move-in_progress");
    expect(reopen.textContent).toBe("Reopen");
    expect(reopen).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByTestId("ticket-reopen-reason"), { target: { value: "Customer still sees it" } });
    fireEvent.click(screen.getByTestId("ticket-move-in_progress"));
    await waitFor(() => expect(api.transition).toHaveBeenCalledWith("t1", "in_progress", "Customer still sees it"));
  });

  it("records QA and customer verification evidence and links an incident", async () => {
    api.get.mockResolvedValue(detail());
    api.release.mockResolvedValue({ data: release });
    api.linkTicket.mockResolvedValue({ data: {} });
    wrap(<TicketDrawer ticketId="t1" onClose={() => {}} />);
    expect((await screen.findByTestId("ticket-sla")).textContent).toMatch(/First response/);
    expect(screen.getByText("Verified needs QA and customer verification below.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("QA evidence"), { target: { value: "Suite green" } });
    fireEvent.click(screen.getByTestId("ticket-verify-qa"));
    await waitFor(() => expect(api.release).toHaveBeenCalledWith("t1", { qa_evidence: "Suite green" }));
    await screen.findByRole("option", { name: "Sync outage" });
    fireEvent.change(screen.getByLabelText("Incident"), { target: { value: "i1" } });
    fireEvent.click(screen.getByTestId("ticket-incident-link"));
    await waitFor(() => expect(api.linkTicket).toHaveBeenCalledWith("i1", "t1"));
  });

  it("shows the incident a ticket is linked to, and a Verified refusal explains itself", async () => {
    const { CopsRequestError } = await import("@/lib/cops-fetch");
    api.get.mockResolvedValue(detail({ status: "resolved", incident: { id: "i1", title: "Sync outage", status: "investigating", owner_id: null } }));
    api.transition.mockRejectedValue(new CopsRequestError("x", { code: "VERIFICATION_REQUIRED", message: "x", details: { missing: ["qa_verification"] }, request_id: "r", retryable: false } as never, null));
    wrap(<TicketDrawer ticketId="t1" onClose={() => {}} />);
    expect((await screen.findByTestId("ticket-incident")).textContent).toMatch(/Linked to Sync outage/);
    fireEvent.click(screen.getByTestId("ticket-move-verified"));
    expect(await screen.findByText(/Record QA and customer verification/)).toBeTruthy();
  });
});

describe("COPS-12 engineering dashboard", () => {
  it("shows the metrics with their definitions as tooltips", async () => {
    api.metrics.mockResolvedValue({
      data: { window_days: 30, open: 12, aged: 3, mtta_minutes: 42, mttr_minutes: 1500, reopen_rate: 0.05, breach_rate: 0.125, incident_linked: 4, at_risk: 2, definitions: { mttr_minutes: "Mean minutes from creation to resolved" } },
    });
    wrap(<EngineeringDashboard />);
    expect((await screen.findByTestId("metric-open")).textContent).toContain("12");
    expect(screen.getByTestId("metric-mttr_minutes").textContent).toContain("1.0d");
    expect(screen.getByTestId("metric-mttr_minutes").getAttribute("title")).toBe("Mean minutes from creation to resolved");
    expect(screen.getByTestId("metric-breach_rate").textContent).toContain("12.5%");
  });
});
