import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CrmSettingsPage from "./page";
import type { CrmConnectionsResponse, CrmSyncStatus } from "@/types/api";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const mockListConnections = vi.fn();
const mockGetSyncStatus = vi.fn();
vi.mock("@/lib/crm", () => ({
  useCrmApi: () => ({
    listConnections: mockListConnections,
    connectHubSpot: vi.fn(),
    disconnectHubSpot: vi.fn(),
    listHubSpotLists: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    importFromHubSpot: vi.fn(),
    getSyncStatus: mockGetSyncStatus,
  }),
}));

vi.mock("@/lib/enrichment", () => ({
  useEnrichmentApi: () => ({ listLists: vi.fn().mockResolvedValue({ data: [], total: 0 }) }),
}));

const CONNECTED: CrmConnectionsResponse = {
  workspaceId: "ws-1",
  total: 1,
  data: [
    {
      id: "conn-1",
      provider: "hubspot",
      status: "connected",
      externalAccountId: "12345",
      connectedAt: "2026-01-01T00:00:00.000Z",
      tokenExpiresAt: null,
    },
  ],
};

const NOT_CONNECTED: CrmConnectionsResponse = { workspaceId: "ws-1", total: 0, data: [] };

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CrmSettingsPage />
    </QueryClientProvider>
  );
}

describe("CrmSettingsPage — sync status (ADI-18)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("does not show the sync status card when HubSpot isn't connected", async () => {
    mockListConnections.mockResolvedValue(NOT_CONNECTED);
    renderPage();
    await screen.findByText("Connect HubSpot");

    expect(screen.queryByText("Sync status")).toBeNull();
    expect(mockGetSyncStatus).not.toHaveBeenCalled();
  });

  it("shows checkpoint status per entity type once connected", async () => {
    mockListConnections.mockResolvedValue(CONNECTED);
    const status: CrmSyncStatus = {
      connected: true,
      checkpoints: [
        {
          entityType: "contact",
          lastRunStatus: "succeeded",
          lastRunStartedAt: "2026-09-07T00:00:00.000Z",
          lastRunCompletedAt: "2026-09-07T00:01:00.000Z",
          lastError: null,
        },
        {
          entityType: "deal",
          lastRunStatus: "failed",
          lastRunStartedAt: "2026-09-07T00:00:00.000Z",
          lastRunCompletedAt: "2026-09-07T00:01:00.000Z",
          lastError: "hubspot_rate_limited",
        },
      ],
      recentOutboundWrites: [],
    };
    mockGetSyncStatus.mockResolvedValue({ data: status });
    renderPage();

    await screen.findByText("Sync status");
    await screen.findByText("succeeded");
    await screen.findByText("failed");
    screen.getByText(/hubspot_rate_limited/);
  });

  it("distinguishes a push-back conflict from a real failure", async () => {
    mockListConnections.mockResolvedValue(CONNECTED);
    const status: CrmSyncStatus = {
      connected: true,
      checkpoints: [
        {
          entityType: "contact",
          lastRunStatus: "succeeded",
          lastRunStartedAt: null,
          lastRunCompletedAt: "2026-09-07T00:01:00.000Z",
          lastError: null,
        },
      ],
      recentOutboundWrites: [
        {
          id: "w1",
          entityType: "contact",
          entityId: "p1",
          status: "failed",
          isConflict: true,
          lastError: "conflict_hubspot_newer",
          createdAt: "2026-09-07T00:00:00.000Z",
          updatedAt: "2026-09-07T00:00:00.000Z",
        },
        {
          id: "w2",
          entityType: "deal",
          entityId: "d1",
          status: "failed",
          isConflict: false,
          lastError: "hubspot_500",
          createdAt: "2026-09-07T00:00:00.000Z",
          updatedAt: "2026-09-07T00:00:00.000Z",
        },
      ],
    };
    mockGetSyncStatus.mockResolvedValue({ data: status });
    renderPage();

    await screen.findByText(/skipped.*hubspot value newer/i);
    screen.getByText("Failed");
  });
});
