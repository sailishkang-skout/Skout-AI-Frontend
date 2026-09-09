import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DecisionsPage from "./page";

const mockListDecisions = vi.fn();
const mockDecide = vi.fn();
const mockCreateDecisionFromNba = vi.fn();

vi.mock("@/lib/dexter-platform", () => ({
  useDexterPlatformApi: () => ({
    listDecisions: mockListDecisions,
    decide: mockDecide,
    createDecisionFromNba: mockCreateDecisionFromNba,
  }),
}));

vi.mock("@/lib/crm/contacts", () => ({
  useContactsApi: () => ({ list: vi.fn().mockResolvedValue({ data: [] }) }),
}));

vi.mock("@/lib/crm/deals", () => ({
  useDealsApi: () => ({ list: vi.fn().mockResolvedValue({ data: [] }) }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DecisionsPage />
    </QueryClientProvider>
  );
}

describe("DecisionsPage — tabbed queue with KPI counts", () => {
  afterEach(() => cleanup());

  it("renders a decision with its title, recommendation, and Decide/Dismiss actions", async () => {
    mockListDecisions.mockResolvedValue({
      data: [
        {
          id: "d1",
          title: "Follow up with Jane",
          kind: "next_best_action",
          status: "open",
          recommendation: "No reply in 5 days.",
          options: [],
          evidenceIds: [],
          expectedOutcome: null,
          entityType: "contact",
          entityId: "c1",
          createdAt: new Date().toISOString(),
          decidedAt: null,
        },
      ],
    });

    renderPage();

    await screen.findByText("Follow up with Jane");
    screen.getByText("No reply in 5 days.");
    screen.getByRole("button", { name: "Decide" });
    screen.getByRole("button", { name: "Dismiss" });
  });

  it("switching to the Decided tab shows resolved decisions instead of open ones", async () => {
    mockListDecisions.mockResolvedValue({
      data: [
        {
          id: "open-1",
          title: "Open one",
          kind: "custom",
          status: "open",
          recommendation: null,
          options: [],
          evidenceIds: [],
          expectedOutcome: null,
          entityType: null,
          entityId: null,
          createdAt: new Date().toISOString(),
          decidedAt: null,
        },
        {
          id: "resolved-1",
          title: "Already decided",
          kind: "custom",
          status: "decided",
          recommendation: null,
          options: [],
          evidenceIds: [],
          expectedOutcome: null,
          entityType: null,
          entityId: null,
          createdAt: new Date().toISOString(),
          decidedAt: new Date().toISOString(),
        },
      ],
    });

    renderPage();

    await screen.findByText("Open one");
    expect(screen.queryByText("Already decided")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^decided/i }));
    await waitFor(() => screen.getByText("Already decided"));
    expect(screen.queryByText("Open one")).toBeNull();
  });
});
