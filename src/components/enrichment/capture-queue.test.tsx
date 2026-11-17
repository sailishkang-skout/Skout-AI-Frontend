import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureQueuePage, lastSevenDays } from "./capture-queue";
import {
  companyIdFromUrl,
  jobActions,
  jobProgress,
  queueQueryString,
  type CaptureJob,
  type CaptureJobDetails,
  type CaptureJobState,
} from "@/lib/capture-queue";

const { mockApiFetch, mockHasPermission, mockContinue, mockDetect } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockHasPermission: vi.fn<(permission: string) => boolean>(),
  mockContinue: vi.fn<(companyPublicId: string, name?: string) => Promise<void>>(),
  mockDetect: vi.fn(),
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
vi.mock("@/lib/extension-connect", () => ({ continueCaptureQueueInExtension: mockContinue, detectExtension: mockDetect }));

const job = (state: CaptureJobState, overrides: Partial<CaptureJob> = {}): CaptureJob => ({
  companyPublicId: `co-${state}`,
  companyName: `Company ${state}`,
  sourceUrl: `https://www.linkedin.com/company/co-${state}/`,
  pagesRead: 25,
  peopleFound: 240,
  expectedPeople: 960,
  remainingPeople: 720,
  batches: 1,
  peopleCreated: 200,
  peopleMerged: 38,
  peopleRejected: 2,
  complete: state === "completed",
  status: state === "interrupted" ? "running" : state === "partial" ? "failed" : state,
  state,
  error: state === "failed" || state === "partial" ? "LinkedIn stopped showing results" : null,
  mode: "extension",
  nextRunAt: null,
  attempts: 0,
  startedBy: "Priya",
  stopReason: null,
  createdAt: new Date(Date.now() - 3600_000).toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const stats = { total: 24, running: 3, completed: 18, failed: 3, paused: 0, peopleCaptured: 4000, daily: [] };
const details = (item: CaptureJob): CaptureJobDetails => ({
  item,
  batches: [
    { id: "r1", status: "completed", startedAt: new Date().toISOString(), completedAt: null, pagesRead: 25, received: 240, created: 200, merged: 38, rejected: 2, error: null },
    { id: "r2", status: "failed", startedAt: new Date().toISOString(), completedAt: null, pagesRead: 3, received: 0, created: 0, merged: 0, rejected: 0, error: "LinkedIn rate limit exceeded" },
  ],
  peopleTotal: 240,
  people: [{ id: "p1", name: "Jane Doe", title: "Engineer", linkedinUrl: "https://www.linkedin.com/in/jane/", verified: false, savedAt: new Date().toISOString() }],
});

type Serve = { jobs?: CaptureJob[]; failed?: CaptureJob[]; status?: unknown; auto?: unknown; companies?: unknown[]; runs?: unknown[] };
function serve({ jobs = [], failed = [], status = { enabled: true, caps: { maxPagesPerRun: 25, maxLeadsPerRun: 250, dailyLeadLimit: 1000 }, usage: { remainingToday: 500 } }, auto = { available: true, reason: null, accountName: "Owner LinkedIn" }, companies = [], runs = [] }: Serve = {}) {
  mockApiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.startsWith("/api/v1/enrichment/capture/queue?")) {
      const params = new URLSearchParams(url.split("?")[1]);
      const items = params.get("state") === "failed" ? failed : jobs;
      return { items, total: items.length, page: Number(params.get("page")), pageSize: Number(params.get("pageSize")), stats };
    }
    const one = url.match(/^\/api\/v1\/enrichment\/capture\/queue\/([^/]+)$/);
    if (one && !init?.method) return details([...jobs, ...failed].find((item) => item.companyPublicId === one[1])!);
    if (url === "/api/v1/enrichment/capture/status") return status;
    if (url === "/api/v1/enrichment/capture/auto" && !init?.method) return auto;
    if (url === "/api/v1/enrichment/capture/auto") return { queued: JSON.parse(String(init!.body)).companyPublicIds, skipped: [] };
    if (url === "/api/v1/enrichment/capture/companies") return { companies };
    if (url === "/api/v1/enrichment/capture/runs") return { runs };
    if (init?.method) return { item: {} };
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
    mockDetect.mockResolvedValue({ connected: true, version: "0.11.22", supportsQueue: true });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("calls the API's real /api/v1 paths (a path without it is a 404 page)", async () => {
    serve({ jobs: [job("running")] });
    renderPage();
    await screen.findByText("Company running");
    const urls = mockApiFetch.mock.calls.map(([url]) => url as string);
    expect(urls.length).toBeGreaterThan(3);
    expect(urls.every((url) => url.startsWith("/api/v1/enrichment/"))).toBe(true);
  });

  it("shows the dashboard totals, the capture sources and the extension status", async () => {
    serve({ jobs: [job("running")] });
    renderPage();
    expect(await screen.findByLabelText("Total jobs: 24")).toBeTruthy();
    expect(screen.getByLabelText("Running: 3")).toBeTruthy();
    expect(screen.getByLabelText("Completed: 18")).toBeTruthy();
    expect(screen.getByLabelText("Failed: 3")).toBeTruthy();
    expect(screen.getByText("System operational")).toBeTruthy();
    expect(await screen.findByText("Connected · v0.11.22")).toBeTruthy();
    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.getByText(/with Owner LinkedIn/)).toBeTruthy();
  });

  it("lists jobs with source, requested and captured people, progress, status and who started them", async () => {
    serve({ jobs: [job("running"), job("completed", { mode: "unipile", peopleFound: 960 })] });
    renderPage();
    const row = (await screen.findByText("Company running")).closest("tr")!;
    expect(within(row).getByText("Manual")).toBeTruthy();
    expect(within(row).getByText("960")).toBeTruthy();
    expect(within(row).getByText("240")).toBeTruthy();
    expect(within(row).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
    expect(within(row).getByText("Running")).toBeTruthy();
    expect(within(row).getByText("Priya")).toBeTruthy();
    const done = screen.getByText("Company completed").closest("tr")!;
    expect(within(done).getByText("Automatic")).toBeTruthy();
    expect(within(done).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  });

  it("filters by method, status, company and date through the API", async () => {
    serve({ jobs: [job("running")] });
    renderPage();
    await screen.findByText("Company running");
    fireEvent.change(screen.getByLabelText("Capture method"), { target: { value: "unipile" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "partial" } });
    fireEvent.change(screen.getByLabelText("Created from"), { target: { value: "2026-11-01" } });
    await waitFor(() => {
      const last = mockApiFetch.mock.calls.map(([url]) => url as string).filter((url) => url.startsWith("/api/v1/enrichment/capture/queue?") && !url.includes("state=failed&")).at(-1)!;
      expect(last).toContain("mode=unipile");
      expect(last).toContain("state=partial");
      expect(last).toContain("from=");
    });
    fireEvent.change(screen.getByLabelText("Search companies"), { target: { value: "acme" } });
    await waitFor(() => expect(mockApiFetch.mock.calls.some(([url]) => String(url).includes("q=acme"))).toBe(true), { timeout: 2000 });
  });

  it("opens a job's details: progress, duplicates, refused records, errors and the people captured", async () => {
    serve({ jobs: [job("partial")] });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    expect(await screen.findByText("38 already in the workspace")).toBeTruthy();
    expect(screen.getByText("200 new people")).toBeTruthy();
    expect(screen.getByText("2 records")).toBeTruthy();
    expect(screen.getByText(/LinkedIn rate limit exceeded/)).toBeTruthy();
    expect(screen.getByText("Jane Doe")).toBeTruthy();
    expect(screen.getByText("People captured (240)")).toBeTruthy();
  });

  it("pauses an automatic job on the server", async () => {
    serve({ jobs: [job("running", { mode: "unipile" })] });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Pause Company running" }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/enrichment/capture/queue/co-running/pause", { method: "POST" }));
    expect(await screen.findByText(/is paused/)).toBeTruthy();
  });

  it("resumes a manual job through the extension, or queues it for the extension when unreachable", async () => {
    serve({ jobs: [job("paused")] });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Resume Company paused" }));
    await waitFor(() => expect(mockContinue).toHaveBeenCalledWith("co-paused", "Company paused"));
    mockContinue.mockRejectedValueOnce(new Error("extension-unavailable"));
    fireEvent.click(await screen.findByRole("button", { name: "Resume Company paused" }));
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/enrichment/capture/queue/co-paused", { method: "PUT", body: JSON.stringify({ status: "queued", companyName: "Company paused" }) })
    );
    expect(await screen.findByText(/choose Start requested jobs/)).toBeTruthy();
  });

  it("cancels a job from its details", async () => {
    serve({ jobs: [job("queued")] });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/enrichment/capture/queue/co-queued/cancel", { method: "POST" }));
  });

  it("lists failed jobs with their error and retries them", async () => {
    serve({ jobs: [], failed: [job("failed", { mode: "unipile" })] });
    renderPage();
    const failedList = await screen.findByRole("list", { name: "Failed jobs" });
    expect(within(failedList).getByText("Error: LinkedIn stopped showing results")).toBeTruthy();
    fireEvent.click(within(failedList).getByRole("button", { name: "Retry Company failed" }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/enrichment/capture/queue/co-failed/resume", { method: "POST" }));
  });

  it("shows recent batches by company name", async () => {
    serve({
      jobs: [job("running", { companyPublicId: "acme", companyName: "Acme" })],
      runs: [{ id: "r1", kind: "company", status: "completed", sourceUrl: "https://www.linkedin.com/company/acme/people/", leadsReceived: 250, leadsCreated: 240, leadsMerged: 10, leadsRejected: 0, errorMessage: null, startedAt: new Date().toISOString(), completedAt: null }],
    });
    renderPage();
    const activity = await screen.findByRole("list", { name: "Recent activity" });
    expect(within(activity).getByText("Acme")).toBeTruthy();
    expect(within(activity).getByText(/240 added · 10 already saved/)).toBeTruthy();
  });

  it("picks companies (select all) and starts automatic capture", async () => {
    serve({ companies: [
      { companyPublicId: "acme", name: "Acme", peopleSaved: 12, peopleFound: 0, expectedPeople: null, complete: null, status: null, mode: null },
      { companyPublicId: "beta", name: "Beta", peopleSaved: 0, peopleFound: 40, expectedPeople: 900, complete: false, status: "running", mode: "extension" },
    ] });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Configure/ }));
    await screen.findByText("Beta");
    fireEvent.click(screen.getByLabelText(/Select all/));
    expect(screen.getByText(/already running; it will not start twice/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Start automatic capture \(2\)/ }));
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/enrichment/capture/auto", { method: "POST", body: JSON.stringify({ companyPublicIds: ["acme", "beta"] }) })
    );
    expect(await screen.findByText(/2 companies are being read automatically/)).toBeTruthy();
  });

  it("sends picked companies to the extension one at a time", async () => {
    serve({ companies: [{ companyPublicId: "acme", name: "Acme", peopleSaved: 12, peopleFound: 0, expectedPeople: null, complete: null, status: null, mode: null }] });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Pick companies" }));
    fireEvent.click(await screen.findByLabelText("Select Acme"));
    fireEvent.click(screen.getByRole("button", { name: /Send to extension \(1\)/ }));
    await waitFor(() => expect(mockContinue).toHaveBeenCalledWith("acme", "Acme"));
    expect(await screen.findByText(/1 company was added to the Skout extension's queue/)).toBeTruthy();
  });

  it("explains why automatic capture is not set up and disables it", async () => {
    serve({ auto: { available: false, reason: "Connect a LinkedIn account to this workspace.", accountName: null }, companies: [{ companyPublicId: "acme", name: "Acme", peopleSaved: 1, peopleFound: 0, expectedPeople: null, complete: null, status: null, mode: null }] });
    renderPage();
    expect(await screen.findByText("Not set up")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Configure/ }));
    fireEvent.click(await screen.findByLabelText("Select Acme"));
    expect((screen.getByRole("button", { name: /Start automatic capture/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows read-only members the jobs without actions", async () => {
    mockHasPermission.mockImplementation((permission) => permission === "enrichment:read");
    serve({ jobs: [job("paused")] });
    renderPage();
    expect(await screen.findByText("Company paused")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Resume/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Configure/ })).toBeNull();
  });

  it("shows an empty state, and a clear error with retry", async () => {
    serve({ jobs: [] });
    renderPage();
    expect(await screen.findByText("No capture jobs yet")).toBeTruthy();
    cleanup();
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url.startsWith("/api/v1/enrichment/capture/queue?")) throw new Error("Request failed (500)");
      return {};
    });
    renderPage();
    expect(await screen.findByText("Request failed (500)")).toBeTruthy();
    expect(screen.getByText("Capture service unreachable")).toBeTruthy();
    await act(async () => {});
  });
});

describe("capture queue helpers", () => {
  it("offers actions that fit each state and source", () => {
    expect(jobActions({ state: "queued", mode: "extension" })).toEqual(["start", "cancel"]);
    expect(jobActions({ state: "running", mode: "unipile" })).toEqual(["pause", "cancel"]);
    expect(jobActions({ state: "running", mode: "extension" })).toEqual(["cancel"]);
    expect(jobActions({ state: "interrupted", mode: "extension" })).toEqual(["resume", "cancel"]);
    expect(jobActions({ state: "partial", mode: "unipile" })).toEqual(["retry"]);
    expect(jobActions({ state: "completed", mode: "unipile" })).toEqual([]);
  });

  it("builds the list query and reads progress, company ids and trends", () => {
    const query = new URLSearchParams(queueQueryString({ q: " acme ", mode: "unipile", state: "failed", page: 2, pageSize: 10 }));
    expect(Object.fromEntries(query)).toEqual({ q: "acme", mode: "unipile", state: "failed", page: "2", pageSize: "10" });
    expect(jobProgress({ state: "running", complete: false, peopleFound: 50, expectedPeople: 200 })).toBe(25);
    expect(jobProgress({ state: "running", complete: false, peopleFound: 50, expectedPeople: null })).toBeNull();
    expect(companyIdFromUrl("https://www.linkedin.com/company/Acme%20Co/people/")).toBe("acme co");
    expect(companyIdFromUrl("https://www.linkedin.com/sales/search/people")).toBeNull();
    const now = new Date("2026-11-17T12:00:00Z");
    expect(lastSevenDays([{ day: "2026-11-17", created: 4, completed: 1, failed: 0 }, { day: "2026-11-15", created: 2, completed: 0, failed: 1 }], (d) => d.created, now)).toEqual([0, 0, 0, 0, 2, 0, 4]);
  });
});
