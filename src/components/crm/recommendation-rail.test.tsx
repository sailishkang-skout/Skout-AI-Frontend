import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const api = vi.hoisted(() => ({
  recommendations: vi.fn(),
  generate: vi.fn(),
  approve: vi.fn(),
  dismiss: vi.fn(),
}));
const perms = vi.hoisted(() => ({ list: [] as string[] }));
vi.mock("@/lib/cops-insights", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/cops-insights")>()), useCopsInsightsApi: () => api }));
vi.mock("@/lib/cops-commercial", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/cops-commercial")>()), useMyPermissions: () => ({ permissions: perms.list }) }));
vi.mock("@/lib/api-client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api-client")>()), useAuthReady: () => true }));

import { confidenceText, evidenceHref, kpiText, rowValueText } from "@/lib/cops-insights";
import { RecommendationRail } from "./recommendation-rail";

const wrap = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
const rec = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  account_id: "a1",
  type: "sla_breached",
  headline: 'SLA breached on P1 "Checkout down"',
  rationale: "The P1 ticket has breached its SLA. Send the customer a status update.",
  evidence_refs: [
    { kind: "ticket", id: "t1", label: "P1 Checkout down" },
    { kind: "sla_clock", id: "c1", label: "SLA clock breached" },
  ],
  suggested_action: { kind: "create_task", params: { title: "Update the customer", priority: "high", due_in_hours: 4, assign_to: "csm" } },
  confidence: 0.9,
  status: "pending",
  source: "llm",
  evidence_id: "e1",
  decided_by: null,
  decided_at: null,
  decision_reason: null,
  effect: null,
  created_at: "2026-10-21T00:00:00Z",
  ...over,
});

beforeEach(() => {
  perms.list = ["crm:read", "crm:write"];
  api.recommendations.mockResolvedValue({ data: [rec()] });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("COPS-13 helpers", () => {
  it("formats KPIs by unit, money per currency, and restricted numbers", () => {
    expect(kpiText({ unit: "percent", value: 0.5, restricted: false })).toBe("50%");
    expect(kpiText({ unit: "minutes", value: 120, restricted: false })).toBe("2.0h");
    expect(kpiText({ unit: "minutes", value: 2880, restricted: false })).toBe("2.0d");
    expect(kpiText({ unit: "count", value: 3, restricted: false })).toBe("3");
    expect(kpiText({ unit: "count", value: null, restricted: false })).toBe("—");
    expect(kpiText({ unit: "money", value: null, restricted: true })).toBe("Restricted");
    expect(kpiText({ unit: "money", value: 0, by_currency: [], restricted: false })).toBe("0");
    expect(kpiText({ unit: "money", value: null, by_currency: [{ currency: "INR", value: 1_200_000 }, { currency: "USD", value: 50_000 }], restricted: false })).toMatch(/12,000.*\+.*500/);
    expect(rowValueText("percent", { counted: true } as never)).toBe("Counted");
    expect(confidenceText(0.654)).toBe("65%");
    expect(evidenceHref({ kind: "ticket", id: "t1", label: "x" }, "a1")).toBe("/crm/360?mode=account&id=a1&tab=engineering");
  });
});

describe("COPS-13 recommendation rail", () => {
  it("shows the recommendation with its evidence and confidence, and approves its one action", async () => {
    api.approve.mockResolvedValue({ data: rec({ status: "approved", effect: { kind: "task", id: "task1" } }) });
    wrap(<RecommendationRail accountId="a1" />);
    const item = await screen.findByTestId("recommendation");
    expect(item.textContent).toContain('SLA breached on P1 "Checkout down"');
    expect(screen.getByTestId("recommendation-confidence").textContent).toBe("90% confidence");
    const links = screen.getByTestId("recommendation-evidence").querySelectorAll("a");
    expect(links).toHaveLength(2);
    expect(links[0]!.getAttribute("href")).toBe("/crm/360?mode=account&id=a1&tab=engineering");
    expect(item.textContent).toContain("runs only if you approve");
    fireEvent.click(screen.getByTestId("recommendation-approve"));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith("r1"));
  });

  it("dismiss asks why and sends the reason", async () => {
    api.dismiss.mockResolvedValue({ data: rec({ status: "dismissed" }) });
    wrap(<RecommendationRail accountId="a1" />);
    fireEvent.click(await screen.findByTestId("recommendation-dismiss"));
    const confirm = screen.getByTestId("recommendation-dismiss-confirm");
    expect(confirm).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText("Why dismiss"), { target: { value: "Already handled on a call" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api.dismiss).toHaveBeenCalledWith("r1", "Already handled on a call"));
  });

  it("checks for new recommendations on request; read-only users see them without actions", async () => {
    api.generate.mockResolvedValue({ data: [], generated: 0 });
    api.recommendations.mockResolvedValue({ data: [] });
    wrap(<RecommendationRail accountId="a1" />);
    fireEvent.click(await screen.findByTestId("recommendations-generate"));
    await waitFor(() => expect(api.generate).toHaveBeenCalledWith("a1"));
    expect((await screen.findByTestId("recommendations-empty")).textContent).toBe("Nothing to recommend right now.");
    cleanup();

    perms.list = ["crm:read"];
    api.recommendations.mockResolvedValue({ data: [rec()] });
    wrap(<RecommendationRail accountId="a1" />);
    await screen.findByTestId("recommendation");
    expect(screen.queryByTestId("recommendation-approve")).toBeNull();
    expect(screen.queryByTestId("recommendations-generate")).toBeNull();
  });

  it("stays compact: three recommendations, then 'Show N more'", async () => {
    api.recommendations.mockResolvedValue({ data: [1, 2, 3, 4, 5].map((i) => rec({ id: `r${i}` })) });
    wrap(<RecommendationRail accountId="a1" />);
    expect(await screen.findAllByTestId("recommendation")).toHaveLength(3);
    expect(screen.getAllByTestId("recommendation-rationale")[0]!.className).toContain("line-clamp-3");
    fireEvent.click(screen.getByTestId("recommendations-show-all"));
    expect(screen.getAllByTestId("recommendation")).toHaveLength(5);
  });
});
