import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import RegionalBriefPage from "./page";

const mockAdminCheck = vi.fn();
const mockListCountries = vi.fn();
const mockListSlots = vi.fn();
const mockListVersions = vi.fn();
const mockResolve = vi.fn();
const mockGetTam = vi.fn();
const mockCreateSlot = vi.fn();
const mockCreateVersion = vi.fn();
const mockApproveVersion = vi.fn();
const mockRejectVersion = vi.fn();

vi.mock("@/lib/regional-brief", () => ({
  useRegionalBriefApi: () => ({
    adminCheck: mockAdminCheck,
    listCountries: mockListCountries,
    listSlots: mockListSlots,
    listVersions: mockListVersions,
    resolve: mockResolve,
    getTam: mockGetTam,
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
    mockListCountries.mockResolvedValue({
      data: [
        { id: "c-1", isoCode: "US", isoAlpha3: "USA", name: "United States" },
        { id: "c-2", isoCode: "GB", isoAlpha3: "GBR", name: "United Kingdom" },
      ],
      total: 2,
    });
    mockResolve.mockResolvedValue({
      country: "US",
      countryIso3: "USA",
      industry: "51",
      industryName: "Information",
      workspaceId: null,
      entries: [
        {
          fieldCategory: "market_economics",
          content: { summary: "US software market is largest globally", details: [] },
          resolvedFromLayer: "country",
          source: "US Census Bureau",
          confidence: 0.9,
          effectiveDate: "2026-01-01",
          evidence: "census.gov",
          isStale: false,
        },
      ],
    });
    mockGetTam.mockResolvedValue({
      countryIso2: "US",
      countryIso3: "USA",
      countryName: "United States",
      industryCode: "51",
      industryName: "Information",
      isDataLoaded: true,
      targetAccountsTam: 16201,
      annualRevenueTamUsd: 405025000,
      assumptions: {
        establishments: 162006,
        icpFitPct: 0.1,
        acvUsd: 25000,
        icpFitSource: "default",
        acvSource: "default",
        canonicalInclude: true,
        dataSource: "US Census Bureau Statistics of U.S. Businesses (SUSB) 2021",
        dataYear: 2021,
      },
    });
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

  it("renders slot cards and resolved market intelligence with live TAM calculations", async () => {
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
          scopeKey: "country:USA:market_economics",
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
          content: { summary: "US market is largest", details: [] },
          source: "IMF 2026",
          effectiveDate: "2026-01-01",
          confidence: 0.9,
          evidence: "imf.org",
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

    // Verify slot heading
    const headings = await screen.findAllByRole("heading", { name: /market economics/i });
    expect(headings.length).toBeGreaterThan(0);

    // Verify TAM metrics rendered
    expect(await screen.findByText(/\$405/i)).toBeTruthy();
    expect(await screen.findByText(/16.*201/i)).toBeTruthy();
    expect(await screen.findByText(/62.*006/i)).toBeTruthy();
  });

  it("displays not-loaded state when TAM data is not yet loaded", async () => {
    mockListSlots.mockResolvedValue({ data: [], total: 0 });
    mockGetTam.mockResolvedValue({
      countryIso2: "US",
      countryIso3: "USA",
      countryName: "United States",
      industryCode: "98",
      industryName: "Unloaded Sector",
      isDataLoaded: false,
      targetAccountsTam: null,
      annualRevenueTamUsd: null,
      assumptions: {
        establishments: null,
        icpFitPct: 0.1,
        acvUsd: 25000,
        icpFitSource: "default",
        acvSource: "default",
        canonicalInclude: true,
        dataSource: null,
        dataYear: null,
      },
    });

    renderPage();

    expect(await screen.findByText(/Data not yet loaded for this market/i)).toBeTruthy();
  });

  it("requests slots from the API one page of 10 at a time", async () => {
    window.scrollTo = vi.fn();
    const slots = Array.from({ length: 25 }, (_, i) => ({
      id: `slot-${i}`,
      layerType: "country",
      regionId: null,
      countryId: "c-2",
      industry: null,
      workspaceId: null,
      fieldCategory: "market_economics",
      scopeKey: `country:GBR:${String(i).padStart(2, "0")}`,
      currentVersionId: null,
    }));
    mockListSlots.mockImplementation(async (f: { limit: number; offset: number }) => ({
      data: slots.slice(f.offset, f.offset + f.limit),
      total: slots.length,
    }));
    mockListVersions.mockResolvedValue({ data: [], total: 0 });

    renderPage();

    expect((await screen.findAllByText(/Showing 1–10 of 25/)).length).toBeGreaterThan(0);
    expect(mockListSlots).toHaveBeenCalledWith({ limit: 10, offset: 0 });
    await waitFor(() => expect(mockListVersions).toHaveBeenCalledTimes(10));

    fireEvent.click(screen.getAllByRole("button", { name: "Next" })[0]!);
    expect((await screen.findAllByText(/Showing 11–20 of 25/)).length).toBeGreaterThan(0);
    expect(mockListSlots).toHaveBeenCalledWith({ limit: 10, offset: 10 });
    await waitFor(() => expect(mockListVersions).toHaveBeenCalledWith("slot-10"));
    expect(mockListVersions).not.toHaveBeenCalledWith("slot-20");
  });

  it("pages locally when an older API ignores limit and returns every slot", async () => {
    window.scrollTo = vi.fn();
    const slots = Array.from({ length: 25 }, (_, i) => ({
      id: `slot-${i}`,
      layerType: "country",
      regionId: null,
      countryId: "c-2",
      industry: null,
      workspaceId: null,
      fieldCategory: "market_economics",
      scopeKey: `country:GBR:${String(i).padStart(2, "0")}`,
      currentVersionId: null,
    }));
    mockListSlots.mockResolvedValue({ data: slots, total: slots.length });
    mockListVersions.mockResolvedValue({ data: [], total: 0 });

    renderPage();

    expect((await screen.findAllByText(/Showing 1–10 of 25/)).length).toBeGreaterThan(0);
    // Country slots show the country name, not the raw id
    expect((await screen.findAllByText("United Kingdom")).length).toBeGreaterThan(0);
    await waitFor(() => expect(mockListVersions).toHaveBeenCalledTimes(10));
    expect(mockListVersions).toHaveBeenCalledWith("slot-0");
    expect(mockListVersions).not.toHaveBeenCalledWith("slot-10");

    fireEvent.click(screen.getAllByRole("button", { name: "Next" })[0]!);
    expect((await screen.findAllByText(/Showing 11–20 of 25/)).length).toBeGreaterThan(0);
    await waitFor(() => expect(mockListVersions).toHaveBeenCalledWith("slot-10"));
    expect(mockListVersions).not.toHaveBeenCalledWith("slot-20");

    fireEvent.click(screen.getAllByRole("button", { name: "Next" })[0]!);
    expect((await screen.findAllByText(/Showing 21–25 of 25/)).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Next" })[0]!.hasAttribute("disabled")).toBe(true);
  });

  it("allows approving a pending version when authorized", async () => {
    mockAdminCheck.mockResolvedValue({ platformAdmin: true });
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
          scopeKey: "country:USA:market_economics",
          currentVersionId: null,
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
          content: { summary: "US draft summary", details: [] },
          source: "IMF",
          effectiveDate: "2026-01-01",
          confidence: 0.9,
          evidence: "imf.org",
          expiryDate: null,
          status: "pending_review",
          reviewerId: null,
          reviewedAt: null,
          createdBy: "u-2",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      total: 1,
    });
    mockApproveVersion.mockResolvedValue({ id: "v-1", status: "approved" });

    renderPage();

    const approveBtn = await screen.findByRole("button", { name: /^Approve$/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(mockApproveVersion).toHaveBeenCalledWith("v-1");
    });
  });
});
