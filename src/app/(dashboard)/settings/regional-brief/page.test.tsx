import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import RegionalBriefPage from "./page";

const mockAdminCheck = vi.fn();
const mockListSlots = vi.fn();
const mockListVersions = vi.fn();
const mockResolve = vi.fn();
const mockCreateSlot = vi.fn();
const mockCreateVersion = vi.fn();
const mockApproveVersion = vi.fn();
const mockRejectVersion = vi.fn();

vi.mock("@/lib/regional-brief", () => ({
  useRegionalBriefApi: () => ({
    adminCheck: mockAdminCheck,
    listSlots: mockListSlots,
    listVersions: mockListVersions,
    resolve: mockResolve,
    createSlot: mockCreateSlot,
    createVersion: mockCreateVersion,
    approveVersion: mockApproveVersion,
    rejectVersion: mockRejectVersion,
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RegionalBriefPage />
    </QueryClientProvider>
  );
}

describe("RegionalBriefPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminCheck.mockResolvedValue({ platformAdmin: false });
    mockResolve.mockResolvedValue({ country: "US", industry: null, workspaceId: null, entries: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders loading skeletons while the slots query is pending", async () => {
    mockListSlots.mockImplementation(() => new Promise(() => {}));

    const { container } = renderPage();

    await waitFor(() => {
      expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    });
  });

  it("renders an error alert when the slots query fails", async () => {
    mockListSlots.mockRejectedValue(new ApiError("Slots service failed", 500));

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
  });

  it("renders each slot's layer, field category, and scope, and its version history", async () => {
    mockListSlots.mockResolvedValue({
      data: [
        {
          id: "slot-1",
          layerType: "country",
          regionId: null,
          countryId: "US",
          industry: null,
          workspaceId: null,
          fieldCategory: "market_economics",
          scopeKey: "country:US:market_economics",
          currentVersionId: "v-1",
        },
      ],
      total: 1,
    });
    mockListVersions.mockResolvedValue({
      data: [
        {
          id: "v-1",
          slotId: "slot-1",
          version: 1,
          content: { summary: "US market is large", details: [] },
          source: "IMF 2026",
          effectiveDate: "2026-01-01",
          confidence: 0.9,
          evidence: "imf.org/report",
          expiryDate: null,
          status: "approved",
          reviewerId: "u-1",
          reviewedAt: "2026-01-02T00:00:00.000Z",
          createdBy: "u-2",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      total: 1,
    });

    renderPage();

    const heading = await screen.findByRole("heading", { name: /market_economics/i });
    expect(heading.textContent).toContain("US");
    expect(await screen.findByText(/US market is large/)).toBeTruthy();
  });

  function countrySlot(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "slot-1",
      layerType: "country",
      regionId: null,
      countryId: "US",
      industry: null,
      workspaceId: null,
      fieldCategory: "market_economics",
      scopeKey: "country:US:market_economics",
      currentVersionId: null,
      ...overrides,
    };
  }

  function pendingVersion(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "v-1",
      slotId: "slot-1",
      version: 1,
      content: { summary: "US market is large", details: [] },
      source: "IMF 2026",
      effectiveDate: "2026-01-01",
      confidence: 0.9,
      evidence: "imf.org/report",
      expiryDate: null,
      status: "pending_review",
      reviewerId: null,
      reviewedAt: null,
      createdBy: "u-2",
      createdAt: "2026-01-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("hides approve/reject actions on a global-tier slot for a non-admin", async () => {
    mockAdminCheck.mockResolvedValue({ platformAdmin: false });
    mockListSlots.mockResolvedValue({ data: [countrySlot()], total: 1 });
    mockListVersions.mockResolvedValue({ data: [pendingVersion()], total: 1 });

    renderPage();

    await screen.findByText(/US market is large/);
    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /reject/i })).toBeNull();
  });

  it("shows approve/reject actions on a global-tier slot for a platform admin", async () => {
    mockAdminCheck.mockResolvedValue({ platformAdmin: true });
    mockListSlots.mockResolvedValue({ data: [countrySlot()], total: 1 });
    mockListVersions.mockResolvedValue({ data: [pendingVersion()], total: 1 });

    renderPage();

    expect(await screen.findByRole("button", { name: /approve/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /reject/i })).toBeTruthy();
  });

  it("shows approve/reject actions on a tenant-tier slot even for a non-admin", async () => {
    mockAdminCheck.mockResolvedValue({ platformAdmin: false });
    mockListSlots.mockResolvedValue({
      data: [countrySlot({ layerType: "tenant", countryId: null, workspaceId: "ws-1" })],
      total: 1,
    });
    mockListVersions.mockResolvedValue({ data: [pendingVersion()], total: 1 });

    renderPage();

    expect(await screen.findByRole("button", { name: /approve/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /reject/i })).toBeTruthy();
  });

  it("calls approveVersion with the version id when Approve is clicked, then refetches versions", async () => {
    mockAdminCheck.mockResolvedValue({ platformAdmin: true });
    mockListSlots.mockResolvedValue({ data: [countrySlot()], total: 1 });
    mockListVersions.mockResolvedValue({ data: [pendingVersion()], total: 1 });
    mockApproveVersion.mockResolvedValue(pendingVersion({ status: "approved" }));

    renderPage();

    const approveButton = await screen.findByRole("button", { name: /approve/i });
    approveButton.click();

    await waitFor(() => {
      expect(mockApproveVersion).toHaveBeenCalledWith("v-1");
    });
    await waitFor(() => {
      expect(mockListVersions.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it("prompts for a reason and calls rejectVersion when Reject is confirmed", async () => {
    mockAdminCheck.mockResolvedValue({ platformAdmin: true });
    mockListSlots.mockResolvedValue({ data: [countrySlot()], total: 1 });
    mockListVersions.mockResolvedValue({ data: [pendingVersion()], total: 1 });
    mockRejectVersion.mockResolvedValue(pendingVersion({ status: "rejected" }));
    vi.spyOn(window, "prompt").mockReturnValue("Not accurate");

    renderPage();

    const rejectButton = await screen.findByRole("button", { name: /reject/i });
    rejectButton.click();

    await waitFor(() => {
      expect(mockRejectVersion).toHaveBeenCalledWith("v-1", "Not accurate");
    });
  });

  it("does not call rejectVersion when the reason prompt is cancelled", async () => {
    mockAdminCheck.mockResolvedValue({ platformAdmin: true });
    mockListSlots.mockResolvedValue({ data: [countrySlot()], total: 1 });
    mockListVersions.mockResolvedValue({ data: [pendingVersion()], total: 1 });
    vi.spyOn(window, "prompt").mockReturnValue(null);

    renderPage();

    const rejectButton = await screen.findByRole("button", { name: /reject/i });
    rejectButton.click();

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockRejectVersion).not.toHaveBeenCalled();
  });

  it("shows the resolve preview for the default country, flagging stale entries", async () => {
    mockListSlots.mockResolvedValue({ data: [], total: 0 });
    mockResolve.mockResolvedValue({
      country: "US",
      industry: null,
      workspaceId: null,
      entries: [
        {
          fieldCategory: "market_economics",
          content: { summary: "US market is large", details: [] },
          resolvedFromLayer: "country",
          source: "IMF 2026",
          confidence: 0.9,
          effectiveDate: "2026-01-01",
          evidence: "imf.org/report",
          isStale: true,
        },
      ],
    });

    renderPage();

    await waitFor(() => {
      expect(mockResolve).toHaveBeenCalledWith("US");
    });
    expect(await screen.findByText(/US market is large/)).toBeTruthy();
    expect(screen.getByText(/stale/i)).toBeTruthy();
  });

  it("re-queries slots with the chosen status when the status filter changes", async () => {
    mockListSlots.mockResolvedValue({ data: [], total: 0 });

    renderPage();

    await waitFor(() => {
      expect(mockListSlots).toHaveBeenCalledWith(undefined);
    });

    const select = await screen.findByLabelText(/filter by status/i);
    fireEvent.change(select, { target: { value: "approved" } });

    await waitFor(() => {
      expect(mockListSlots).toHaveBeenCalledWith({ status: "approved" });
    });
  });

  it("creates a slot and a version from the inline draft form, then shows a success message", async () => {
    mockAdminCheck.mockResolvedValue({ platformAdmin: true });
    mockListSlots.mockResolvedValue({ data: [], total: 0 });
    mockCreateSlot.mockResolvedValue(countrySlot());
    mockCreateVersion.mockResolvedValue(pendingVersion());

    renderPage();

    fireEvent.change(await screen.findByLabelText(/summary/i), {
      target: { value: "US market is large" },
    });
    fireEvent.change(screen.getByLabelText(/^source$/i), { target: { value: "IMF 2026" } });
    fireEvent.change(screen.getByLabelText(/effective date/i), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText(/evidence/i), { target: { value: "imf.org/report" } });

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /create draft/i }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });
    fireEvent.click(screen.getByRole("button", { name: /create draft/i }));

    await waitFor(() => {
      expect(mockCreateSlot).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockCreateVersion).toHaveBeenCalledWith(
        "slot-1",
        expect.objectContaining({
          content: expect.objectContaining({ summary: "US market is large" }),
          source: "IMF 2026",
          effectiveDate: "2026-01-01",
          evidence: "imf.org/report",
        })
      );
    });
    expect(await screen.findByText(/awaits review/i)).toBeTruthy();
  });
});
