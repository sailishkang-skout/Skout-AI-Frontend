import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CaptureQueuePage,
  actionForJob,
  companyPageUrl,
  queueProgress,
  tabForState,
  type CapturableCompany,
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

const company = (id: string, overrides: Partial<CapturableCompany> = {}): CapturableCompany => ({
  companyPublicId: id, name: `Co ${id}`, peopleSaved: 12, peopleFound: 0, expectedPeople: null, complete: null, status: null, mode: null, ...overrides,
});

function serve(items: CaptureQueueItem[], remainingToday = 500, { companies = [] as CapturableCompany[], auto = { available: true, reason: null, accountName: "Owner" } as unknown } = {}) {
  mockApiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/enrichment/capture/queue") return { items };
    if (url === "/enrichment/capture/companies") return { companies };
    if (url === "/enrichment/capture/auto" && init?.method === "POST") {
      const ids = JSON.parse(String(init.body)).companyPublicIds as string[];
      return { queued: ids.filter((id) => id !== "nope"), skipped: ids.includes("nope") ? [{ companyPublicId: "nope", reason: "Capture this company first" }] : [] };
    }
    if (url === "/enrichment/capture/auto") return auto;
    if (url.endsWith("/pause") && init?.method === "POST") return { item: {} };
    if (url.startsWith("/enrichment/capture/queue/") && init?.method === "PUT") return { item: {} };
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
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/enrichment/capture/queue/co-paused", { method: "PUT", body: JSON.stringify({ status: "queued", companyName: "Company paused" }) }));
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
    fireEvent.click(await screen.findByRole("tab", { name: "Completed (1)" }));
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

  it("opens on the company list when nothing is running, and explains an empty queue", async () => {
    serve([]);
    renderPage();
    expect(await screen.findByText(/No captured companies yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "In progress (0)" }));
    expect(screen.getByText(/No capture jobs yet/)).toBeTruthy();
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
    expect(actionForJob({ state: "failed" })).toBe("retry");
    expect(actionForJob({ state: "paused" })).toBe("resume");
    expect(actionForJob({ state: "queued" })).toBe("start");
    expect(actionForJob({ state: "running" })).toBeNull();
    expect(actionForJob({ state: "completed" })).toBeNull();
    expect(actionForJob({ state: "running", mode: "unipile" })).toBe("pause");
    expect(actionForJob({ state: "queued", mode: "unipile" })).toBe("pause");
    expect(actionForJob({ state: "paused", mode: "unipile" })).toBe("resume");
    expect(companyPageUrl({ companyPublicId: "a b" })).toBe("https://www.linkedin.com/company/a%20b/");
    expect(queueProgress(job("paused", { expectedPeople: null }))).toBeNull();
    expect(queueProgress(job("paused", { peopleFound: 2000, expectedPeople: 1000 }))).toBe(100);
  });

  it("lists the workspace's companies with people saved, and selects all", async () => {
    serve([], 500, { companies: [company("acme", { name: "Acme" }), company("beta", { name: "Beta", peopleSaved: 0, peopleFound: 40, expectedPeople: 900 })] });
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Companies (2)" }));
    expect(await screen.findByText("Acme")).toBeTruthy();
    expect(screen.getByText("12 people saved")).toBeTruthy();
    expect(screen.getByText("40 of about 900 people saved")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Select all/));
    expect(screen.getByText(/Select all \(2 selected\)/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search companies"), { target: { value: "bet" } });
    expect(screen.queryByText("Acme")).toBeNull();
  });

  it("captures selected companies in the extension, one after another", async () => {
    serve([], 500, { companies: [company("acme", { name: "Acme" }), company("beta", { name: "Beta" })] });
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Companies (2)" }));
    fireEvent.click(await screen.findByLabelText("Select Acme"));
    fireEvent.click(screen.getByLabelText("Select Beta"));
    fireEvent.click(screen.getByRole("button", { name: /Capture in extension \(2\)/ }));
    await waitFor(() => expect(mockContinue).toHaveBeenCalledTimes(2));
    expect(mockContinue).toHaveBeenNthCalledWith(1, "acme", "Acme");
    expect(await screen.findByText(/2 companies were added to the Skout extension's queue/)).toBeTruthy();
  });

  it("queues companies for the extension when it cannot be reached", async () => {
    serve([], 500, { companies: [company("acme", { name: "Acme" })] });
    mockContinue.mockRejectedValue(new Error("extension-unavailable"));
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Companies (1)" }));
    fireEvent.click(await screen.findByLabelText("Select Acme"));
    fireEvent.click(screen.getByRole("button", { name: /Capture in extension/ }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/enrichment/capture/queue/acme", { method: "PUT", body: JSON.stringify({ status: "queued", companyName: "Acme" }) }));
    expect(await screen.findByText(/choose Start requested jobs/)).toBeTruthy();
  });

  it("captures selected companies automatically on the server", async () => {
    serve([], 500, { companies: [company("acme", { name: "Acme" }), company("nope", { name: "Nope" })] });
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Companies (2)" }));
    fireEvent.click(await screen.findByLabelText(/Select all/));
    fireEvent.click(screen.getByRole("button", { name: /Capture automatically \(2\)/ }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/enrichment/capture/auto", { method: "POST", body: JSON.stringify({ companyPublicIds: ["acme", "nope"] }) }));
    expect(await screen.findByText(/1 companies are being read automatically on the server/)).toBeTruthy();
    expect(screen.getByText(/Skipped: nope \(Capture this company first\)/)).toBeTruthy();
  });

  it("explains why automatic capture is unavailable and disables it", async () => {
    serve([], 500, { companies: [company("acme", { name: "Acme" })], auto: { available: false, reason: "Connect a LinkedIn account.", accountName: null } });
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Companies (1)" }));
    expect(await screen.findByText("Automatic capture: Connect a LinkedIn account.")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Select Acme"));
    expect((screen.getByRole("button", { name: /Capture automatically/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("pauses and resumes an automatic job on the server, and shows who started it", async () => {
    serve([job("running", { mode: "unipile", startedBy: "Priya" }), job("paused", { mode: "unipile", stopReason: "Daily capture limit of 1000 leads reached." })]);
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "In progress (1)" }));
    expect(await screen.findByText(/by Priya/)).toBeTruthy();
    expect(screen.getAllByText("Automatic").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Pause/ }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/enrichment/capture/queue/co-running/pause", { method: "POST" }));
    fireEvent.click(screen.getByRole("tab", { name: "Needs attention (1)" }));
    expect(screen.getByText("Daily capture limit of 1000 leads reached.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Resume/ }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/enrichment/capture/queue/co-paused/resume", { method: "POST" }));
    expect(mockContinue).not.toHaveBeenCalled();
  });
});
