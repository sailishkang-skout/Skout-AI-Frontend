import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = {
  health: vi.fn(),
  history: vi.fn(),
  recompute: vi.fn(),
  setCsm: vi.fn(),
  overview: vi.fn(),
  playbooks: vi.fn(),
  installPlaybooks: vi.fn(),
  enrollments: vi.fn(),
};
vi.mock("@/lib/api-client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api-client")>()), useAuthReady: () => true }));
vi.mock("@/lib/cops-success", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/cops-success")>()), useCopsSuccessApi: () => api }));
vi.mock("@/lib/team", () => ({ useTeamApi: () => ({ listMembers: async () => ({ data: [{ userId: "u-csm", fullName: "Cara CSM", email: "cara@x.test" }] }) }) }));

import { CopsHealthBreakdown } from "./cops-health-breakdown";
import CustomerSuccessPage from "@/app/(dashboard)/customer-success/page";

const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

const health = {
  id: "h1",
  score: 58,
  state: "watch",
  renewalRisk: "medium",
  modelVersion: 0,
  computedAt: new Date().toISOString(),
  dimensions: { adoption: { score: 100, weight: 20 }, relationship: { score: 80, weight: 20 }, support: { score: 30, weight: 20 }, commercial: { score: 85, weight: 20 }, payment: { score: 100, weight: 20 } },
  factors: [
    { dimension: "support", key: "open_tickets", kind: "leading", value: 2, points: -30, reason: "2 open ticket(s)" },
    { dimension: "support", key: "high_severity", kind: "leading", value: 1, points: -25, reason: "1 open high or critical ticket(s)" },
    { dimension: "support", key: "tickets_90d", kind: "lagging", value: 4, points: 0, reason: "4 ticket(s) in 90 days" },
  ],
};

describe("COPS-11 health breakdown and Customer Success screen", () => {
  beforeEach(() => {
    api.health.mockResolvedValue({ data: { health, csmId: null } });
    api.history.mockResolvedValue({ data: [{ score: 58, state: "watch", renewalRisk: "medium", computedAt: new Date().toISOString() }] });
    api.enrollments.mockResolvedValue({ data: [] });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the score and every factor with its kind and points", async () => {
    wrap(<CopsHealthBreakdown accountId="acc-1" />);
    expect((await screen.findByTestId("health-score")).textContent).toBe("58");
    const factors = screen.getAllByTestId("health-factor").map((f) => f.textContent);
    expect(factors).toEqual(expect.arrayContaining([expect.stringMatching(/leading2 open ticket\(s\)-30/), expect.stringMatching(/lagging4 ticket\(s\) in 90 days0/)]));
    expect(screen.getByTestId("health-trend")).toBeTruthy();
  });

  it("recomputes and assigns a CSM", async () => {
    api.recompute.mockResolvedValue({ data: { score: 60, state: "watch" } });
    api.setCsm.mockResolvedValue({ data: { csmId: "u-csm" } });
    wrap(<CopsHealthBreakdown accountId="acc-1" />);
    fireEvent.click(await screen.findByTestId("health-recompute"));
    await waitFor(() => expect(api.recompute).toHaveBeenCalledWith("acc-1"));
    await screen.findByRole("option", { name: "Cara CSM" });
    fireEvent.change(screen.getByLabelText("CSM"), { target: { value: "u-csm" } });
    await waitFor(() => expect(api.setCsm).toHaveBeenCalledWith("acc-1", "u-csm"));
  });

  it("lists at-risk accounts with the reason and the next action, and installs missing playbooks", async () => {
    api.overview.mockResolvedValue({
      data: {
        distribution: { healthy: 4, watch: 1, at_risk: 1, unscored: 0 },
        renewalExposure: [{ accountId: "a1", name: "Acme", termEnd: "2026-12-01T00:00:00Z", healthState: "at_risk", renewalRisk: "high", arrMinor: 1200000, currency: "USD" }],
        adoption: { total: 6, activated: 4, signedIn: 5, under50: 1, avgPct: 70, milestones: [{ key: "first_search", label: "First search", reached: 4, total: 6 }] },
        atRisk: [
          { accountId: "a1", name: "Acme", score: 32, state: "at_risk", renewalRisk: "high", csmId: "u-csm", reasons: ["Subscription past due", "2 open ticket(s)"], nextAction: null },
          { accountId: "a2", name: "Beta", score: 55, state: "watch", renewalRisk: "low", reasons: ["Quiet for 30 days"], nextAction: { title: "Call Beta", dueDate: "2026-10-22T00:00:00Z" } },
        ],
        expansionSignals: [{ accountId: "a3", name: "Gamma", evidence: ["New funding round signal on 2026-10-15"], at: new Date().toISOString() }],
        playbooks: [],
      },
    });
    api.playbooks.mockResolvedValue({ data: [{ key: "cs_low_adoption", name: "Playbook: low adoption", description: "d", automationId: null, status: null }] });
    api.installPlaybooks.mockResolvedValue({ data: { installed: ["cs_low_adoption"], total: 5 } });
    wrap(<CustomerSuccessPage />);
    const list = await screen.findByTestId("cs-at-risk");
    expect(list.textContent).toContain("Why: Subscription past due; 2 open ticket(s)");
    expect(list.textContent).toContain("no open task: plan the next step");
    await waitFor(() => expect(list.textContent).toContain("CSM: Cara CSM"));
    expect(screen.getByTestId("cs-renewal-exposure").textContent).toMatch(/12,000/);
    expect(list.textContent).toContain("Next: Call Beta");
    expect(screen.getByTestId("cs-expansion").textContent).toContain("New funding round signal");
    expect(screen.getByTestId("cs-milestones").textContent).toContain("First search4/6");
    fireEvent.click(await screen.findByTestId("cs-install-playbooks"));
    await waitFor(() => expect(api.installPlaybooks).toHaveBeenCalled());
  });
});
