import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CaptureQueuePage,
  actionForState,
  companyPageUrl,
  queueProgress,
  tabForState,
  type CaptureJobState,
  type CaptureQueueItem,
} from "./capture-queue";

const { mockApiFetch, mockHasPermission, mockContinue } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockHasPermission: vi.fn<(permission: string) => boolean>(),
  mockContinue: vi.fn<(companyPublicId: string, name?: string) => Promise<void>>(),
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

const job = (state: CaptureJobState, overrides: Partial<CaptureQueueItem> = {}): CaptureQueueItem => ({
  companyPublicId: `co-${state}`,
  companyName: `Company ${state}`,
  sourceUrl: "https://www.linkedin.com/company/co/",
  pagesRead: 25,
  peopleFound: 240,
  expectedPeople: 960,
  remainingPeople: 720,
  batches: 1,
  complete: state === "completed",
  status: state === "interrupted" ? "running" : state,
  state,
  error: state === "failed" ? "Company content did not load." : null,
  stopReason: null,
  createdAt: "2026-11-12T10:00:00.000Z",
  updatedAt: new Date().toISOString(),
  ...overrides,
});

function serve(items: CaptureQueueItem[], remainingToday = 500) {
  mockApiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/enrichment/capture/queue") return { items };
    if (url === "/enrichment/capture/status") return { enabled: true, caps: { maxLeadsPerRun: 250, dailyLeadLimit: 1000 }, usage: { remainingToday } };
    if (url.endsWith("/resume") && init?.method === "POST") return { item: {} };
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

  it("groups jobs into in progress, needs attention and completed, with counts", async () => {
    serve([job("running"), job("review"), job("failed"), job("interrupted"), job("completed")]);
    renderPage();
    expect(await screen.findByRole("tab", { name: "In progress (2)" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Needs attention (2)" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Completed (1)" })).toBeTruthy();
    // Opens on what needs the user first.
    expect(screen.getByRole("tab", { name: "Needs attention (2)" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Company failed")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "In progress (2)" }));
    expect(screen.getByText("Reading people")).toBeTruthy();
    expect(screen.getByText("Waiting for your review")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Completed (1)" }));
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  });

  it("shows progress, the failure reason and the interruption", async () => {
    serve([job("failed"), job("interrupted")]);
    renderPage();
    expect((await screen.findAllByText(/240 of about 960 people saved · 1 batch · 25 result pages/)).length).toBe(2);
    expect(screen.getByText(/Company content did not load\./)).toBeTruthy();
    expect(screen.getByText(/The extension stopped reporting/)).toBeTruthy();
    expect(screen.getAllByRole("progressbar")[0].getAttribute("aria-valuenow")).toBe("25");
  });

  it("retries a failed job through the extension", async () => {
    serve([job("failed")]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Retry/ }));
    await waitFor(() => expect(mockContinue).toHaveBeenCalledWith("co-failed", "Company failed"));
    expect(await screen.findByText(/Retrying Company failed in the Skout extension/)).toBeTruthy();
  });

  it("resumes an interrupted job through the extension", async () => {
    serve([job("interrupted")]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Resume/ }));
    await waitFor(() => expect(mockContinue).toHaveBeenCalledWith("co-interrupted", "Company interrupted"));
    expect(await screen.findByText(/Resuming Company interrupted/)).toBeTruthy();
  });

  it("queues the job on the server when the extension cannot be reached", async () => {
    serve([job("paused")]);
    mockContinue.mockRejectedValue(new Error("extension-unavailable"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Resume/ }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/enrichment/capture/queue/co-paused/resume", { method: "POST" }));
    expect(await screen.findByText(/choose Start requested jobs/)).toBeTruthy();
  });

  it("tells the user to update an old extension", async () => {
    serve([job("paused")]);
    mockContinue.mockRejectedValue(new Error("extension-outdated"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Resume/ }));
    expect(await screen.findByText(/Update the Skout extension/)).toBeTruthy();
  });

  it("shows an extension error instead of hiding it", async () => {
    serve([job("failed")]);
    mockContinue.mockRejectedValue(new Error("Daily capture limit of 1000 leads reached."));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Retry/ }));
    expect(await screen.findByText(/Daily capture limit of 1000 leads reached\./)).toBeTruthy();
  });

  it("keeps resume paused but visible when the daily limit is reached", async () => {
    serve([job("paused")], 0);
    renderPage();
    expect(await screen.findByText("Daily capture limit reached")).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: /Resume/ }) as HTMLButtonElement).disabled).toBe(true));
  });

  it("has no action for a job that is running, and cannot remove it", async () => {
    serve([job("running")]);
    renderPage();
    expect(await screen.findByText("Company running")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Resume|Retry|Start in extension/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("removes a finished job", async () => {
    serve([job("completed")]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove Company completed from the capture queue" }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/enrichment/capture/queue/co-completed", { method: "DELETE" }));
  });

  it("shows read-only viewers the jobs without actions", async () => {
    mockHasPermission.mockImplementation((permission) => permission === "enrichment:read");
    serve([job("failed")]);
    renderPage();
    expect(await screen.findByText("Company failed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Retry/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("explains an empty queue", async () => {
    serve([]);
    renderPage();
    expect(await screen.findByText(/No capture jobs yet/)).toBeTruthy();
  });

  it("explains a server without the queue instead of showing a raw 404", async () => {
    const { ApiError } = await import("@/lib/api-client");
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url === "/enrichment/capture/queue") throw new ApiError("Request failed (404)", 404);
      return { enabled: true, caps: { maxLeadsPerRun: 250, dailyLeadLimit: 1000 }, usage: { remainingToday: 500 } };
    });
    renderPage();
    expect(await screen.findByText("Capture queue isn't available on this server yet")).toBeTruthy();
    expect(screen.queryByText(/Request failed/)).toBeNull();
  });

  it("maps states to tabs and actions, and builds safe links", () => {
    expect(tabForState("queued")).toBe("active");
    expect(tabForState("interrupted")).toBe("attention");
    expect(tabForState("completed")).toBe("completed");
    expect(actionForState("failed")).toBe("retry");
    expect(actionForState("paused")).toBe("resume");
    expect(actionForState("queued")).toBe("start");
    expect(actionForState("running")).toBeNull();
    expect(actionForState("completed")).toBeNull();
    expect(companyPageUrl({ companyPublicId: "a b" })).toBe("https://www.linkedin.com/company/a%20b/");
    expect(queueProgress(job("paused", { expectedPeople: null }))).toBeNull();
    expect(queueProgress(job("paused", { peopleFound: 2000, expectedPeople: 1000 }))).toBe(100);
  });
});
