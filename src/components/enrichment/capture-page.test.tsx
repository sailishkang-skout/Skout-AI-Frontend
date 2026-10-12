import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CapturePage, SALES_NAVIGATOR_FUNCTIONS, type CaptureRun } from "./capture-page";

const { mockApiFetch, mockHasPermission } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockHasPermission: vi.fn<(permission: string) => boolean>(),
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
    useAuthReady: () => true,
    formatQueryError: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
  };
});

vi.mock("@/lib/workspace-role", () => ({
  useWorkspaceRole: () => ({ hasPermission: mockHasPermission }),
}));

const status = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  disabledReason: null,
  caps: { maxPagesPerRun: 10, maxLeadsPerRun: 250, dailyLeadLimit: 1000 },
  usage: { leadsToday: 183, remainingToday: 817 },
  ...overrides,
});

const run = (overrides: Partial<CaptureRun> = {}): CaptureRun => ({
  id: "run-1",
  kind: "sales_search",
  status: "completed",
  terminal: true,
  sourceUrl: "https://www.linkedin.com/sales/search/people",
  pagesRead: 8,
  leadsReceived: 183,
  leadsCreated: 180,
  leadsMerged: 3,
  leadsRejected: 0,
  errorCode: null,
  errorMessage: null,
  startedAt: "2026-10-08T10:00:00.000Z",
  completedAt: "2026-10-08T10:00:02.000Z",
  ...overrides,
});

function serve({ captureStatus = status(), runs = [run()] }: { captureStatus?: unknown; runs?: CaptureRun[] } = {}) {
  mockApiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/capture/settings")) return status({ enabled: JSON.parse(String(init?.body)).enabled });
    if (url.endsWith("/capture/status")) return captureStatus;
    if (url.endsWith("/capture/runs")) return { runs };
    if (url.endsWith("/enrichment/companies")) return { companies: [{ id: "c1", name: "Blinkit" }] };
    throw new Error(`Unexpected request: ${url}`);
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CapturePage />
    </QueryClientProvider>
  );
}

describe("CapturePage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockHasPermission.mockReturnValue(false);
    serve();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the 10-page / 250-lead cap and the daily allowance", async () => {
    renderPage();
    expect(await screen.findByText("Enabled")).toBeTruthy();
    expect(screen.getByText(/Each run reads at most 10 pages or 250 leads\./)).toBeTruthy();
    expect(screen.getByText("817 of 1000")).toBeTruthy();
  });

  it("walks the Sales Navigator search one department at a time and remembers progress", async () => {
    const { unmount } = renderPage();
    await screen.findByText("Enabled");
    expect(screen.getByText("Enter the company to start the guided flow.")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Company name, as it appears on LinkedIn"), { target: { value: "Blinkit" } });
    expect(screen.getByText(`Department 1 of ${SALES_NAVIGATOR_FUNCTIONS.length}: Sales`)).toBeTruthy();
    const link = screen.getByRole("link", { name: /Open Sales Navigator people search/ });
    expect(link.getAttribute("href")).toBe("https://www.linkedin.com/sales/search/people");

    fireEvent.click(screen.getByRole("button", { name: "Mark captured, next department" }));
    expect(screen.getByText(`Department 2 of ${SALES_NAVIGATOR_FUNCTIONS.length}: Marketing`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip this department" }));
    expect(screen.getByText(/: Business Development$/)).toBeTruthy();
    expect(screen.getByText("1 captured")).toBeTruthy();

    unmount();
    renderPage();
    await screen.findByText("Enabled");
    fireEvent.change(screen.getByPlaceholderText("Company name, as it appears on LinkedIn"), { target: { value: "blinkit" } });
    expect(screen.getByText(/: Business Development$/)).toBeTruthy();
  });

  it("makes a failed or halted run visible with its reason", async () => {
    serve({
      runs: [
        run(),
        run({ id: "run-2", status: "halted", errorCode: "capture_disabled", errorMessage: "LinkedIn warning under review" }),
        run({ id: "run-3", status: "failed", errorCode: "abandoned", errorMessage: "The capture was interrupted before it reported a result." }),
      ],
    });
    renderPage();
    expect(await screen.findByText("Halted by kill switch")).toBeTruthy();
    expect(screen.getByText("LinkedIn warning under review")).toBeTruthy();
    expect(screen.getByText("Failed")).toBeTruthy();
    expect(screen.getByText("The capture was interrupted before it reported a result.")).toBeTruthy();
    expect(screen.getAllByText(/8 pages · 183 leads received · 180 new · 3 merged · 0 rejected/)).toHaveLength(3);
  });

  it("shows a disabled workspace and blocks the guided flow", async () => {
    serve({ captureStatus: status({ enabled: false, disabledReason: "LinkedIn warning under review" }) });
    renderPage();
    expect(await screen.findByText("Disabled")).toBeTruthy();
    expect(screen.getByText(/Capture is disabled for this workspace: LinkedIn warning under review/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Company name, as it appears on LinkedIn"), { target: { value: "Blinkit" } });
    expect((screen.getByRole("button", { name: "Mark captured, next department" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Re-enable capture" })).toBeNull();
  });

  it("lets an enrichment admin turn the kill switch on, with a reason", async () => {
    mockHasPermission.mockImplementation((permission) => permission === "enrichment:admin");
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Disable capture now" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "LinkedIn warning under review" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Disable capture" }));
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/v1/enrichment/capture/settings",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ enabled: false, reason: "LinkedIn warning under review" }) })
      )
    );
  });

  it("hides the kill switch from members without the admin permission", async () => {
    renderPage();
    await screen.findByText("Enabled");
    expect(screen.queryByRole("button", { name: "Disable capture now" })).toBeNull();
  });
});
