import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnrichmentReleaseGate } from "./release-gate";
import { ResearchOverview } from "./research-overview";

const { mockApiFetch, mockHasPermission, mockPathname } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockHasPermission: vi.fn<(permission: string) => boolean>(),
  mockPathname: vi.fn<() => string>(),
}));

vi.mock("@/lib/api-client", () => {
  class ApiError extends Error {
    constructor(message: string, public status: number, public body?: unknown) {
      super(message);
    }
  }
  return {
    ApiError,
    useApiFetch: () => mockApiFetch,
    useApiFetchBlob: () => vi.fn(),
    useAuthReady: () => true,
    formatQueryError: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
  };
});
vi.mock("@/lib/workspace-role", () => ({ useWorkspaceRole: () => ({ hasPermission: mockHasPermission }) }));
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname(), useRouter: () => ({ push: vi.fn() }) }));

const OVERVIEW = {
  people: { total: 12, verifiedEmployment: 7, discoveryCandidates: 5, publicProfiles: 9, salesNavigatorOnly: 3 },
  companies: { total: 2 },
  jobChanges: { pendingReview: 1 },
  captures: { runsLast7Days: 4, leadsLast7Days: 30 },
};
const released = { enabled: true, stage: "general", reason: null };
const internal = { enabled: false, stage: "internal", reason: "LinkedIn enrichment is in internal release and is not enabled for this workspace." };

function renderWithClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  mockHasPermission.mockReturnValue(true);
  mockPathname.mockReturnValue("/enrichment/people");
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EnrichmentReleaseGate", () => {
  const gate = () =>
    renderWithClient(
      <EnrichmentReleaseGate>
        <p>People screen</p>
      </EnrichmentReleaseGate>
    );

  it("shows the screen when the feature is released to the workspace", async () => {
    mockApiFetch.mockResolvedValue(released);
    gate();
    expect(await screen.findByText("People screen")).toBeTruthy();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/enrichment/release");
  });

  it("explains that the feature is in internal release instead of showing the screen", async () => {
    mockApiFetch.mockResolvedValue(internal);
    gate();
    expect((await screen.findByTestId("enrichment-not-released")).textContent).toMatch(/internal release and is not enabled for this workspace/);
    expect(screen.queryByText("People screen")).toBeNull();
  });

  it("does not gate the screens that are not part of the release", async () => {
    mockApiFetch.mockResolvedValue(internal);
    for (const path of ["/enrichment", "/app/enrichment", "/enrichment/workbooks"]) {
      mockPathname.mockReturnValue(path);
      const view = gate();
      expect(screen.getByText("People screen")).toBeTruthy();
      view.unmount();
    }
    for (const path of ["/enrichment/capture", "/enrichment/campaigns/abc", "/app/enrichment/providers"]) {
      mockPathname.mockReturnValue(path);
      const view = gate();
      expect(await screen.findByTestId("enrichment-not-released")).toBeTruthy();
      view.unmount();
    }
  });

  it("shows the screen when the release state cannot be fetched; the API still decides", async () => {
    mockApiFetch.mockRejectedValue(new Error("network"));
    gate();
    expect(await screen.findByText("People screen")).toBeTruthy();
  });
});

describe("ResearchOverview states", () => {
  const serve = (overview: () => Promise<unknown>, changes: () => Promise<unknown> = async () => ({ jobChanges: [], total: 0 }), release: unknown = released) =>
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url.endsWith("/release")) return release;
      if (url.includes("/job-changes")) return changes();
      return overview();
    });

  it("shows a skeleton while loading, then the numbers", async () => {
    let resolve!: (value: unknown) => void;
    serve(() => new Promise((done) => (resolve = done)));
    renderWithClient(<ResearchOverview />);
    expect(await screen.findByTestId("research-overview-loading")).toBeTruthy();
    resolve(OVERVIEW);
    expect(await screen.findByText("Verified employees")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("shows a failed load with a retry that works, instead of disappearing", async () => {
    let fail = true;
    serve(async () => {
      if (fail) throw new Error("The API returned a server error.");
      return OVERVIEW;
    });
    renderWithClient(<ResearchOverview />);
    expect(await screen.findByText("The API returned a server error.")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Verified employees")).toBeTruthy();
  });

  it("says so when nothing has been captured, with the way to start", async () => {
    serve(async () => ({ ...OVERVIEW, people: { ...OVERVIEW.people, total: 0 }, companies: { total: 0 } }));
    renderWithClient(<ResearchOverview />);
    const empty = await screen.findByTestId("research-overview-empty");
    expect(empty.textContent).toMatch(/Nothing has been captured yet/);
    expect(screen.getByRole("link", { name: "Capture a LinkedIn profile or company" }).getAttribute("href")).toBe("/enrichment/capture");
  });

  it("reports a failed job-change feed without hiding the summary", async () => {
    serve(async () => OVERVIEW, async () => {
      throw new Error("Could not reach the API.");
    });
    renderWithClient(<ResearchOverview />);
    expect(await screen.findByText("Verified employees")).toBeTruthy();
    expect(await screen.findByText("Could not reach the API.")).toBeTruthy();
  });

  it("stays out of the way without the permission or before release, and makes no research request", async () => {
    serve(async () => OVERVIEW, undefined, internal);
    const view = renderWithClient(<ResearchOverview />);
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/enrichment/release"));
    await waitFor(() => expect(view.container.textContent).toBe(""));
    expect(mockApiFetch.mock.calls.some(([url]) => String(url).endsWith("/overview"))).toBe(false);
    view.unmount();

    mockHasPermission.mockReturnValue(false);
    const second = renderWithClient(<ResearchOverview />);
    expect(second.container.textContent).toBe("");
  });
});
