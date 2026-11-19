import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./page";

const mockGetSummary = vi.fn();
const mockGetFunnel = vi.fn();
vi.mock("@/lib/dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dashboard")>();
  return {
    ...actual,
    useDashboardApi: () => ({ getSummary: mockGetSummary, getFunnel: mockGetFunnel }),
  };
});

const mockGetCreatedCount = vi.fn();
const mockGetSummaryDeals = vi.fn();
vi.mock("@/lib/crm/deals", () => ({
  useDealsApi: () => ({ getCreatedCount: mockGetCreatedCount, getSummary: mockGetSummaryDeals }),
}));

const mockGetBookedCount = vi.fn();
vi.mock("@/lib/crm/meetings", () => ({
  useMeetingsApi: () => ({ getBookedCount: mockGetBookedCount }),
}));

vi.mock("@/components/dashboard/dashboard-command-center", () => ({
  DashboardCommandCenter: () => null,
}));
vi.mock("@/components/dashboard/setup-checklist-card", () => ({
  SetupChecklistCard: () => null,
}));
vi.mock("@/components/dashboard/ai-insights-feed", () => ({
  AiInsightsFeed: () => null,
}));
vi.mock("@/components/dashboard/dashboard-activity-feed", () => ({
  DashboardActivityFeed: () => null,
}));

function renderPage(features?: Record<string, boolean>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (features) queryClient.setQueryData(["access"], { status: "active", features, request: null });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>
  );
}

describe("DashboardPage — GTM Funnel and KPI cards wired to real data", () => {
  afterEach(() => cleanup());

  it("shows real activeInSequence and openDeals counts instead of the old '—' placeholders", async () => {
    mockGetSummary.mockResolvedValue({
      data: { workspaceName: "Acme", credits: 100, totalProspectsInLists: 5, icpConfigured: true, enrichedThisWeek: 2 },
    });
    mockGetFunnel.mockResolvedValue({
      data: { discovered: 10, enriched: 4, inSequence: 3, replied: 1, activeInSequence: 7 },
    });
    mockGetCreatedCount.mockResolvedValue({ workspaceId: "ws-1", count: 2 });
    mockGetSummaryDeals.mockResolvedValue({ workspaceId: "ws-1", openDeals: 12, valueByCurrency: [], stages: [] });
    mockGetBookedCount.mockResolvedValue({ workspaceId: "ws-1", count: 5 });

    renderPage();

    await screen.findByText("7");
    screen.getByText("12");
    screen.getByText("Active in Sequence");
    screen.getByText("Pipeline Ops");
  });

  it("does not show a funnel until every composed source (apps/api + apps/crm) has resolved", async () => {
    mockGetSummary.mockResolvedValue({
      data: { workspaceName: "Acme", credits: 100, totalProspectsInLists: 5, icpConfigured: true, enrichedThisWeek: 2 },
    });
    mockGetFunnel.mockResolvedValue({
      data: { discovered: 10, enriched: 4, inSequence: 3, replied: 1, activeInSequence: 7 },
    });
    mockGetCreatedCount.mockReturnValue(new Promise(() => {})); // never resolves
    mockGetSummaryDeals.mockResolvedValue({ workspaceId: "ws-1", openDeals: 12, valueByCurrency: [], stages: [] });
    mockGetBookedCount.mockResolvedValue({ workspaceId: "ws-1", count: 5 });

    renderPage();

    await screen.findByText(/loading funnel data/i);
  });
});

describe("DashboardPage — areas not on the plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSummary.mockResolvedValue({
      data: { workspaceName: "Acme", credits: 449, totalProspectsInLists: 5, icpConfigured: true, enrichedThisWeek: 2 },
    });
    mockGetFunnel.mockResolvedValue({
      data: { discovered: 10, enriched: 4, inSequence: 3, replied: 1, activeInSequence: 7 },
    });
    mockGetCreatedCount.mockResolvedValue({ workspaceId: "ws-1", count: 2 });
    mockGetSummaryDeals.mockResolvedValue({ workspaceId: "ws-1", openDeals: 12, valueByCurrency: [], stages: [] });
    mockGetBookedCount.mockResolvedValue({ workspaceId: "ws-1", count: 5 });
  });
  afterEach(() => cleanup());

  it("with CRM off, never calls the CRM service and blurs Pipeline Ops", async () => {
    renderPage({ crm: false });
    await screen.findByText("449");
    expect(mockGetCreatedCount).not.toHaveBeenCalled();
    expect(mockGetSummaryDeals).not.toHaveBeenCalled();
    expect(mockGetBookedCount).not.toHaveBeenCalled();
    const locked = screen.getByTestId("feature-locked-crm");
    expect(locked.textContent).toContain("Pipeline Ops");
    expect(locked.textContent).toContain("Not on your plan");
  });

  it("with CRM off, the funnel still renders from the non-CRM stages instead of waiting forever", async () => {
    renderPage({ crm: false });
    await screen.findByText("449");
    await waitFor(() => expect(screen.queryByText("Loading funnel data...")).toBeNull());
    expect(screen.queryByText(/Not enough data to generate funnel/)).toBeNull();
  });

  it("with Sequences off, blurs Active in Sequence and keeps the rest", async () => {
    renderPage({ sequences: false });
    await screen.findByText("449");
    expect(screen.getByTestId("feature-locked-sequences").textContent).toContain("Active in Sequence");
    expect(screen.queryByTestId("feature-locked-crm")).toBeNull();
    await screen.findByText("12");
  });
});

