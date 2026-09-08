import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IncidentsPage from "./page";
import type { IncidentRow } from "@/lib/incidents";

const mockList = vi.fn();
vi.mock("@/lib/incidents", () => ({
  useIncidentsApi: () => ({
    list: mockList,
    create: vi.fn(),
    acknowledge: vi.fn(),
    resolve: vi.fn(),
  }),
}));

vi.mock("@/lib/workspace-role", () => ({
  useWorkspaceRole: () => ({ canDelete: true }),
}));

function makeIncident(overrides: Partial<IncidentRow> = {}): IncidentRow {
  return {
    id: "inc-1",
    workspaceId: "ws-1",
    title: "Something happened",
    severity: "medium",
    status: "open",
    source: "manual",
    description: null,
    detectedAt: "2026-09-01T00:00:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <IncidentsPage />
    </QueryClientProvider>
  );
}

describe("IncidentsPage — anomaly-sourced badge (ADI-17)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("does not show an Auto-detected badge for a manually-logged incident", async () => {
    mockList.mockResolvedValue({ data: [makeIncident({ source: "manual" })] });
    renderPage();
    await screen.findByText("Something happened");

    expect(screen.queryByText(/auto-detected/i)).toBeNull();
  });

  it("shows an Auto-detected badge for a bounce-anomaly-sourced incident", async () => {
    mockList.mockResolvedValue({ data: [makeIncident({ source: "bounce-anomaly-sweep" })] });
    renderPage();
    await screen.findByText("Something happened");

    expect(screen.getByText(/auto-detected/i)).toBeTruthy();
  });

  it("shows an Auto-detected badge for any future anomaly job's source, not just bounce", async () => {
    mockList.mockResolvedValue({ data: [makeIncident({ source: "signal-volume-drift-sweep" })] });
    renderPage();
    await screen.findByText("Something happened");

    expect(screen.getByText(/auto-detected/i)).toBeTruthy();
  });

  it("does not badge the other known manual sources (integration, provider)", async () => {
    mockList.mockResolvedValue({
      data: [
        makeIncident({ id: "a", title: "Integration incident", source: "integration" }),
        makeIncident({ id: "b", title: "Provider incident", source: "provider" }),
      ],
    });
    renderPage();
    await screen.findByText("Integration incident");
    await screen.findByText("Provider incident");

    expect(screen.queryByText(/auto-detected/i)).toBeNull();
  });
});
