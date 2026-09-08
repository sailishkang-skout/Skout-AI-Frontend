import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WarmupHealthPage from "./page";

const mockListMailboxes = vi.fn();
const mockGetIntelligence = vi.fn();
const mockGetRisk = vi.fn();
const mockGetReputation = vi.fn();
const mockRefreshIntelligence = vi.fn();

vi.mock("@/lib/warmup-tool", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/warmup-tool")>();
  return {
    ...actual,
    useWarmupToolApi: () => ({
      listMailboxes: mockListMailboxes,
      getIntelligence: mockGetIntelligence,
      getRisk: mockGetRisk,
      getReputation: mockGetReputation,
      refreshIntelligence: mockRefreshIntelligence,
    }),
  };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <WarmupHealthPage />
    </QueryClientProvider>
  );
}

describe("WarmupHealthPage — real field mappings for health/risk/capacity", () => {
  afterEach(() => cleanup());

  it("reads the real riskScore/riskLevel and per-dimension health status instead of nonexistent fields", async () => {
    mockListMailboxes.mockResolvedValue([{ id: "mb1", emailAddress: "a@b.com" }]);
    mockGetIntelligence.mockResolvedValue({
      health: {
        connection: "HEALTHY",
        authentication: "HEALTHY",
        sending: "DEGRADED",
        receiving: "HEALTHY",
        domain: "UNKNOWN",
        configuration: "HEALTHY",
      },
      eligibility: { decision: "CONDITIONALLY_ELIGIBLE", reasons: ["Domain not fully authenticated"] },
      capacity: { recommendedDailyVolume: 20, minimumDailyVolume: 10, maximumDailyVolume: 30, confidence: "MEDIUM" },
    });
    mockGetRisk.mockResolvedValue({
      riskLevel: "MEDIUM",
      riskScore: 42,
      riskFactors: [{ code: "SEND_DEGRADED", description: "Sending capability is degraded", severity: "MEDIUM" }],
    });
    mockGetReputation.mockResolvedValue(null);

    renderPage();

    await screen.findByText("a@b.com");
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "mb1" } });

    await screen.findByText("42");
    screen.getByText(/medium risk/i);
    screen.getByText("DEGRADED");
    screen.getByText("Sending capability is degraded");
    screen.getByText(/20 \(10–30 range\)/);
    screen.getByText("Domain not fully authenticated");

    await waitFor(() => expect(screen.queryByText("No risk factors yet — connect the mailbox and refresh.")).toBeNull());
  });
});
