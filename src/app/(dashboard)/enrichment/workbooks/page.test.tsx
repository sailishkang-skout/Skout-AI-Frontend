import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkbooksPage from "./page";
import type { EnrichmentWorkbook, WorkbookColumn, WorkbookRun, WorkbookRunRow } from "@/types/api";

const mockList = vi.fn();
const mockListRuns = vi.fn();
const mockListMembers = vi.fn();
vi.mock("@/lib/workbooks", () => ({
  WORKBOOKS_QUERY_KEY: ["workbooks"],
  workbookRunsQueryKey: (id: string) => ["workbooks", id, "runs"],
  useWorkbooksApi: () => ({
    list: mockList,
    listRuns: mockListRuns,
    listMembers: mockListMembers,
    activate: vi.fn(),
    pauseRun: vi.fn(),
    resumeRun: vi.fn(),
    rerunFailed: vi.fn(),
    create: vi.fn(),
    startRun: vi.fn(),
  }),
}));

const mockColumnsList = vi.fn();
const mockColumnsCreate = vi.fn();
const mockColumnsRemove = vi.fn();
const mockGetRunRows = vi.fn();
vi.mock("@/lib/workbook-columns", () => ({
  workbookColumnsQueryKey: (id: string) => ["workbooks", id, "columns"],
  workbookRunRowsQueryKey: (id: string, runId: string) => ["workbooks", id, "runs", runId, "rows"],
  useWorkbookColumnsApi: () => ({
    list: mockColumnsList,
    create: mockColumnsCreate,
    remove: mockColumnsRemove,
    getRunRows: mockGetRunRows,
  }),
}));

const WORKBOOK: EnrichmentWorkbook = {
  id: "wb-1",
  workspaceId: "ws-1",
  name: "Test Workbook",
  fields: ["company", "email"],
  emailQualityThreshold: null,
  budgetCreditsPerRun: null,
  status: "active",
  activatedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const RUN: WorkbookRun = {
  id: "run-1",
  workbookId: "wb-1",
  workspaceId: "ws-1",
  listId: "list-1",
  mode: "sample",
  targetProspectIds: ["p1"],
  batchId: null,
  status: "completed",
  totalRows: 1,
  processedRows: 1,
  succeededRows: 1,
  failedRows: 0,
  creditsBudget: null,
  creditsUsed: 1,
  rerunOfRunId: null,
  errorMessage: null,
  queuedAt: "2026-01-01T00:00:00.000Z",
  startedAt: "2026-01-01T00:00:00.000Z",
  pausedAt: null,
  completedAt: "2026-01-01T00:00:00.000Z",
};

const COLUMN: WorkbookColumn = {
  id: "col-1",
  workspaceId: "ws-1",
  workbookId: "wb-1",
  key: "summary",
  label: "Summary",
  columnType: "derived",
  config: { template: "{{company}} Inc" },
  orderIndex: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const RUN_ROW: WorkbookRunRow = {
  prospectId: "p1",
  fullName: "Ada Lovelace",
  companyName: "Acme",
  companyDomain: "acme.com",
  email: "ada@acme.com",
  phone: null,
  title: null,
  columns: { summary: { status: "succeeded", value: "Acme Inc", error: null } },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkbooksPage />
    </QueryClientProvider>
  );
}

describe("WorkbooksPage — flexible columns (ADI-12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({ data: [WORKBOOK], total: 1 });
    mockListRuns.mockResolvedValue({ data: [RUN], total: 1 });
    mockColumnsList.mockResolvedValue({ data: [COLUMN], total: 1 });
    mockGetRunRows.mockResolvedValue({ data: [RUN_ROW], total: 1 });
  });

  afterEach(() => cleanup());

  it("opens the columns dialog and lists existing flexible columns", async () => {
    renderPage();
    await screen.findByText("Test Workbook");

    fireEvent.click(screen.getByRole("button", { name: /columns/i }));

    await waitFor(() => expect(mockColumnsList).toHaveBeenCalledWith("wb-1"));
    await screen.findByText("Summary");
    screen.getByText("summary");
  });

  it("creates a new derived column from the add-column form", async () => {
    mockColumnsCreate.mockResolvedValue({ ...COLUMN, id: "col-2", key: "new_col" });
    renderPage();
    await screen.findByText("Test Workbook");
    fireEvent.click(screen.getByRole("button", { name: /columns/i }));
    await screen.findByText("Summary");

    fireEvent.click(screen.getByRole("button", { name: /add column/i }));
    await screen.findByText(/add flexible column/i);
    fireEvent.change(screen.getByLabelText(/key/i), { target: { value: "New Col" } });
    fireEvent.change(screen.getByLabelText(/label/i), { target: { value: "New Column" } });
    fireEvent.change(screen.getByLabelText(/template/i), { target: { value: "{{company}} v2" } });

    // The trigger button and the dialog's submit button share the exact label "Add Column" —
    // the submit button is the one rendered last (dialogs portal-append to document.body in order).
    const addColumnButtons = screen.getAllByRole("button", { name: "Add Column" });
    fireEvent.click(addColumnButtons[addColumnButtons.length - 1]!);

    await waitFor(() =>
      expect(mockColumnsCreate).toHaveBeenCalledWith("wb-1", {
        key: "new_col",
        label: "New Column",
        columnType: "derived",
        template: "{{company}} v2",
      })
    );
  });

  it("deletes a column", async () => {
    mockColumnsRemove.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText("Test Workbook");
    fireEvent.click(screen.getByRole("button", { name: /columns/i }));
    await screen.findByText("Summary");

    const deleteButtons = screen.getAllByRole("button", { name: "" });
    const trashButton = deleteButtons.find((b) => b.querySelector("svg"));
    fireEvent.click(trashButton!);

    await waitFor(() => expect(mockColumnsRemove).toHaveBeenCalledWith("wb-1", "col-1"));
  });

  it("shows View Grid for a run with processed rows, and the grid merges fixed + flexible column data", async () => {
    renderPage();
    await screen.findByText("Test Workbook");

    fireEvent.click(screen.getByRole("button", { name: /execution runs/i }));
    await screen.findByText(/sample/i);

    const viewGridButton = await screen.findByRole("button", { name: /view grid/i });
    fireEvent.click(viewGridButton);

    await waitFor(() => expect(mockGetRunRows).toHaveBeenCalledWith("wb-1", "run-1"));
    await screen.findByText("Ada Lovelace");
    screen.getByText("ada@acme.com");
    screen.getByText("Acme Inc");
  });

  it("does not show View Grid for a run with zero processed rows", async () => {
    mockListRuns.mockResolvedValue({ data: [{ ...RUN, processedRows: 0, status: "queued" }], total: 1 });
    renderPage();
    await screen.findByText("Test Workbook");

    fireEvent.click(screen.getByRole("button", { name: /execution runs/i }));
    await screen.findByText(/sample/i);

    expect(screen.queryByRole("button", { name: /view grid/i })).toBeNull();
  });
});
