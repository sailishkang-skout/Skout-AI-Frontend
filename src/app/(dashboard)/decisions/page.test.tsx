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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DecisionsPage />
    </QueryClientProvider>
  );
}

describe("DecisionsPage — visual hierarchy for open vs resolved decisions", () => {
  afterEach(() => cleanup());

  it("shows the real per-decision options as buttons instead of a generic Decide/Dismiss pair", async () => {
    mockListDecisions.mockResolvedValue({
      data: [
        {
          id: "d1",
          title: "Follow up with Jane",
          kind: "next_best_action",
          status: "open",
          recommendation: "No reply in 5 days.",
          options: [
            { id: "act", label: "Send follow-up email", primary: true },
            { id: "wait", label: "Wait" },
            { id: "dismiss", label: "Dismiss" },
          ],
          evidenceIds: [],
          expectedOutcome: { actionType: "send_email" },
          entityType: "contact",
          entityId: "c1",
          createdAt: new Date().toISOString(),
          decidedAt: null,
        },
      ],
    });

    renderPage();

    await screen.findByText("Follow up with Jane");
    screen.getByRole("button", { name: "Send follow-up email" });
    screen.getByRole("button", { name: "Wait" });
    screen.getByRole("button", { name: "Dismiss" });
    screen.getByText(/suggested: send email/i);
  });

  it("groups decided/dismissed decisions into a collapsed Resolved section", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: /resolved \(1\)/i }));
    await waitFor(() => screen.getByText("Already decided"));
  });
});
