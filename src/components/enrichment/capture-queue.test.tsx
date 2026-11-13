import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureQueuePage, companyPageUrl, queueProgress, type CaptureQueueItem } from "./capture-queue";

const { mockApiFetch, mockHasPermission, mockContinue } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockHasPermission: vi.fn<(permission: string) => boolean>(),
  mockContinue: vi.fn<(companyPublicId: string) => Promise<void>>(),
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
vi.mock("@/lib/workspace-role", () => ({ useWorkspaceRole: () => ({ hasPermission: mockHasPermission }) }));
vi.mock("@/lib/extension-connect", () => ({ continueCaptureQueueInExtension: mockContinue }));

const item = (overrides: Partial<CaptureQueueItem> = {}): CaptureQueueItem => ({
  companyPublicId: "blinkit",
  companyName: "Blinkit",
  sourceUrl: "https://www.linkedin.com/company/blinkit/",
  pagesRead: 25,
  peopleFound: 240,
  expectedPeople: 960,
  remainingPeople: 720,
  batches: 1,
  complete: false,
  stopReason: "more pages available",
  createdAt: "2026-11-12T10:00:00.000Z",
  updatedAt: "2026-11-12T10:00:00.000Z",
  ...overrides,
});

function serve(items: CaptureQueueItem[], remainingToday = 500) {
  mockApiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/enrichment/capture/queue") return { items };
    if (url === "/enrichment/capture/status") return { enabled: true, caps: { maxLeadsPerRun: 250, dailyLeadLimit: 1000 }, usage: { remainingToday } };
    if (url.startsWith("/enrichment/capture/queue/") && init?.method === "DELETE") return null;
    throw new Error(`Unexpected request: ${url}`);
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CaptureQueuePage />
    </QueryClientProvider>
  );
}

describe("CaptureQueuePage", () => {
  beforeEach(() => {
    mockHasPermission.mockReturnValue(true);
    mockContinue.mockResolvedValue(undefined);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists companies with people left and their progress", async () => {
    serve([item()]);
    renderPage();
    expect(await screen.findByText("Blinkit")).toBeTruthy();
    expect(screen.getByText(/240 of about 960 people found/)).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
    expect(screen.getByRole("link", { name: /LinkedIn/ }).getAttribute("href")).toBe("https://www.linkedin.com/company/blinkit/");
  });

  it("continues the next batch through the extension", async () => {
    serve([item()]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Continue capturing/ }));
    await waitFor(() => expect(mockContinue).toHaveBeenCalledWith("blinkit"));
    expect(await screen.findByText(/Reading the next batch of Blinkit/)).toBeTruthy();
  });

  it("opens LinkedIn when the extension cannot be reached", async () => {
    serve([item()]);
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mockContinue.mockRejectedValue(new Error("extension-unavailable"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Continue capturing/ }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://www.linkedin.com/company/blinkit/", "_blank", "noopener,noreferrer"));
    expect(await screen.findByText(/choose Continue capturing queue/)).toBeTruthy();
    open.mockRestore();
  });

  it("keeps the option visible but paused when the daily limit is reached", async () => {
    serve([item()], 0);
    renderPage();
    expect(await screen.findByText("Daily capture limit reached")).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: /Continue capturing/ }) as HTMLButtonElement).disabled).toBe(true));
  });

  it("removes a company from the queue", async () => {
    serve([item()]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove Blinkit from the capture queue" }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/enrichment/capture/queue/blinkit", { method: "DELETE" }));
  });

  it("shows read-only viewers the queue without capture actions", async () => {
    mockHasPermission.mockImplementation((permission) => permission === "enrichment:read");
    serve([item()]);
    renderPage();
    expect(await screen.findByText("Blinkit")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Continue capturing/ })).toBeNull();
  });

  it("explains an empty queue", async () => {
    serve([]);
    renderPage();
    expect(await screen.findByText(/No companies are waiting/)).toBeTruthy();
  });

  it("builds safe LinkedIn links and progress", () => {
    expect(companyPageUrl({ companyPublicId: "a b" })).toBe("https://www.linkedin.com/company/a%20b/");
    expect(queueProgress(item({ expectedPeople: null }))).toBeNull();
    expect(queueProgress(item({ peopleFound: 2000, expectedPeople: 1000 }))).toBe(100);
  });
});
