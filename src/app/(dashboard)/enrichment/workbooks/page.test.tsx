import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkbooksPage from "./page";
import type { EnrichmentWorkbook, WorkbookRun } from "@/types/api";

const mockList = vi.fn();
const mockListRuns = vi.fn();
vi.mock("@/lib/workbooks", () => ({
  WORKBOOKS_QUERY_KEY: ["workbooks"],
  workbookRunsQueryKey: (id: string) => ["workbooks", id, "runs"],
  useWorkbooksApi: () => ({
    list: mockList,
    listRuns: mockListRuns,
    listMembers: vi.fn(),
    get: vi.fn(),
    getRun: vi.fn(),
    activate: vi.fn(),
    pauseRun: vi.fn(),
    resumeRun: vi.fn(),
    rerunFailed: vi.fn(),
    create: vi.fn(),
    startRun: vi.fn(),
  }),
}));

vi.mock("@/lib/enrichment", () => ({
  useEnrichmentApi: () => ({ listLists: vi.fn() }),
}));

const DRAFT_WORKBOOK: EnrichmentWorkbook = {
  id: "wb-1",
  workspaceId: "ws-1",
  name: "Test Workbook",
  fields: ["company", "email"],
  emailQualityThreshold: null,
  budgetCreditsPerRun: null,
  status: "draft",
  activatedAt: null,
  resultListId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const ACTIVE_WORKBOOK: EnrichmentWorkbook = {
  ...DRAFT_WORKBOOK,
  status: "active",
  activatedAt: "2026-01-02T00:00:00.000Z",
  resultListId: "list-1",
};

const NO_RUNS: { data: WorkbookRun[]; total: number } = { data: [], total: 0 };

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkbooksPage />
    </QueryClientProvider>
  );
}

describe("WorkbooksPage — activation results list (ADI-13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListRuns.mockResolvedValue(NO_RUNS);
  });

  afterEach(() => cleanup());

  it("does not show a results-list link for a draft workbook", async () => {
    mockList.mockResolvedValue({ data: [DRAFT_WORKBOOK], total: 1 });
    renderPage();
    await screen.findByText("Test Workbook");

    fireEvent.click(screen.getByRole("button", { name: /execution runs/i }));
    await screen.findByText(/draft mode/i);

    expect(screen.queryByRole("link", { name: /view results list/i })).toBeNull();
  });

  it("shows a link to the linked results list once the workbook is active", async () => {
    mockList.mockResolvedValue({ data: [ACTIVE_WORKBOOK], total: 1 });
    renderPage();
    await screen.findByText("Test Workbook");

    fireEvent.click(screen.getByRole("button", { name: /execution runs/i }));

    const link = await screen.findByRole("link", { name: /view results list/i });
    expect(link.getAttribute("href")).toBe("/lists/list-1");
  });
});
