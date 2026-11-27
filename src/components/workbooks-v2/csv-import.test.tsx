import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import type { ImportPreview, WorkbookColumn, WorkbookImport } from "@/lib/workbooks-v2-import";
import { CsvImport } from "./csv-import";

const api = {
  workbooks: vi.fn(),
  createWorkbook: vi.fn(),
  columns: vi.fn(),
  upload: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
  report: vi.fn(),
};
vi.mock("@/lib/workbooks-v2-import", async (original) => ({ ...(await original<typeof import("@/lib/workbooks-v2-import")>()), useWorkbookImportApi: () => api }));

const COLUMNS: WorkbookColumn[] = [
  { id: "c-name", name: "Name", type: "input", config: { dataType: "text" } },
  { id: "c-email", name: "Email", type: "input", config: { dataType: "email" } },
  { id: "c-found", name: "Work email", type: "enrichment", config: {} },
];

const PREVIEW: ImportPreview = {
  headers: [
    { index: 0, name: "Full name", fits: ["text"], filled: 30 },
    { index: 1, name: "Email", fits: ["text", "email"], filled: 30 },
    { index: 2, name: "Website", fits: ["text", "url"], filled: 30 },
  ],
  rows: Array.from({ length: 20 }, (_, i) => ({ line: i + 2, values: [`Person ${i}`, `p${i}@x.com`, `https://co${i}.com`] })),
  suggestions: [
    { header: 0, target: { columnId: "c-name" } },
    { header: 1, target: { columnId: "c-email" } },
    { header: 2, target: { newColumn: { name: "Website", dataType: "url" } } },
  ],
};

function item(over: Omit<Partial<WorkbookImport>, "counts"> & { counts?: Partial<WorkbookImport["counts"]> } = {}): WorkbookImport {
  return {
    id: "imp-12345678",
    workbookId: "wb-1",
    sourceType: "csv",
    sourceName: null,
    truncated: null,
    status: "awaiting_confirmation",
    fileName: "leads.csv",
    fileBytes: 2048,
    progress: 0,
    background: false,
    error: null,
    report: { available: false, rows: 0 },
    preview: PREVIEW,
    createdAt: "2026-11-27T10:00:00.000Z",
    ...over,
    counts: { total: 30, processed: 0, imported: 0, duplicates: 0, skipped: 0, failed: 0, ...over.counts },
  };
}

const show = (canEdit = true) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CsvImport canEdit={canEdit} />
    </QueryClientProvider>
  );

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const pickFile = (name = "leads.csv", size?: number) => {
  const file = new File(["a\n1\n"], name, { type: "text/csv" });
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  fireEvent.change(fileInput(), { target: { files: [file] } });
  return file;
};
const into = (header: string) => screen.getByLabelText(`Import “${header}” into`) as HTMLSelectElement;
const importButton = () => screen.getByRole("button", { name: /^Import 30 rows$/ }) as HTMLButtonElement;
const dedupeBy = (label: RegExp | string) => fireEvent.click(screen.getByRole("radio", { name: label }));

async function openPreview() {
  api.upload.mockResolvedValue(item());
  api.get.mockResolvedValue(item());
  show();
  await screen.findByText("Choose a CSV file");
  pickFile();
  await screen.findByText("Map the columns");
}

describe("CSV import", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.workbooks.mockResolvedValue({
      data: [
        { id: "wb-1", name: "Leads", rowCount: 1200, rowLimit: 100000 },
        { id: "wb-2", name: "Accounts", rowCount: 0, rowLimit: 100000 },
      ],
      total: 2,
    });
    api.columns.mockResolvedValue(COLUMNS);
    api.list.mockResolvedValue([]);
  });
  afterEach(() => cleanup());

  describe("choosing a file", () => {
    it("uploads it to the chosen workbook", async () => {
      api.upload.mockResolvedValue(item());
      api.get.mockResolvedValue(item());
      show();
      await screen.findByText("Choose a CSV file");
      fireEvent.change(screen.getByLabelText("Workbook"), { target: { value: "wb-2" } });
      const file = pickFile();
      await waitFor(() => expect(api.upload).toHaveBeenCalledWith("wb-2", file));
    });

    it.each([
      ["a file that is not CSV", "leads.xlsx", 10, /Only CSV files/],
      ["an empty file", "leads.csv", 0, /empty/],
      ["a file over 50 MB", "leads.csv", 50 * 1024 * 1024 + 1, /larger than 50 MB/],
    ])("stops %s before sending it", async (_name, name, size, message) => {
      show();
      await screen.findByText("Choose a CSV file");
      pickFile(name, size);
      expect((await screen.findByRole("alert")).textContent).toMatch(message);
      expect(api.upload).not.toHaveBeenCalled();
    });

    it("keeps the workbook fixed while a file is on its way", async () => {
      api.upload.mockReturnValue(new Promise(() => {}));
      show();
      await screen.findByText("Choose a CSV file");
      pickFile();
      expect(await screen.findByText("Uploading and checking the file…")).toBeTruthy();
      expect((screen.getByLabelText("Workbook") as HTMLSelectElement).disabled).toBe(true);
      fireEvent.change(screen.getByPlaceholderText("Workbook name"), { target: { value: "Other" } });
      expect((screen.getByRole("button", { name: "Create" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("shows why the server refused it", async () => {
      api.upload.mockRejectedValue(new ApiError("Line 7: a quote is in the wrong place.", 422, { code: "INVALID_CSV", error: "INVALID_CSV", message: "Line 7: a quote is in the wrong place." }));
      show();
      await screen.findByText("Choose a CSV file");
      pickFile();
      expect((await screen.findByRole("alert")).textContent).toContain("Line 7: a quote is in the wrong place.");
      expect(screen.queryByText("Map the columns")).toBeNull();
    });

    it("creates a workbook to import into", async () => {
      api.createWorkbook.mockResolvedValue({ data: { id: "wb-2", name: "Fresh", rowCount: 0, rowLimit: 100000 } });
      show();
      await screen.findByText("Choose a CSV file");
      fireEvent.change(screen.getByPlaceholderText("Workbook name"), { target: { value: "  Fresh " } });
      fireEvent.click(screen.getByRole("button", { name: "Create" }));
      await waitFor(() => expect(api.createWorkbook).toHaveBeenCalledWith("Fresh"));
    });

    it("offers a workbook first when there are none", async () => {
      api.workbooks.mockResolvedValue({ data: [], total: 0 });
      show();
      await screen.findByText("No workbooks yet");
      expect(fileInput()).toBeNull();
    });
  });

  describe("preview and mapping", () => {
    it("shows the headers, 20 rows and the suggested mapping, and sends nothing until confirmed", async () => {
      await openPreview();
      expect(screen.getByText("First 20 of 30 rows")).toBeTruthy();
      const table = screen.getByRole("table");
      expect(within(table).getAllByRole("row")).toHaveLength(21);
      expect(within(table).getByText("Person 19")).toBeTruthy();
      expect(within(table).getByRole("columnheader", { name: /Website.*→ Website \(new\)/ })).toBeTruthy();
      expect(into("Full name").value).toBe("c-name");
      expect(into("Email").value).toBe("c-email");
      expect(into("Website").value).toBe("new");
      // Only input columns can be imported into.
      expect(within(into("Email")).queryByText("Work email")).toBeNull();
      expect(screen.getByText(/Nothing is added until you confirm/)).toBeTruthy();
      expect(api.confirm).not.toHaveBeenCalled();
    });

    it("waits for a deduplication choice", async () => {
      await openPreview();
      expect(importButton().disabled).toBe(true);
      expect(screen.getByText("Choose how to find duplicates.")).toBeTruthy();
      dedupeBy(/None/);
      expect(importButton().disabled).toBe(false);
    });

    it("sends the corrected mapping, including a new column made from a header", async () => {
      await openPreview();
      api.confirm.mockResolvedValue(item({ status: "completed", progress: 100, preview: null }));
      fireEvent.change(into("Full name"), { target: { value: "skip" } });
      fireEvent.change(into("Email"), { target: { value: "new" } });
      fireEvent.change(screen.getByLabelText("Name of the new column for “Email”"), { target: { value: "Personal email" } });
      expect((screen.getByLabelText("Type of the new column for “Email”") as HTMLSelectElement).value).toBe("text");
      fireEvent.change(screen.getByLabelText("Type of the new column for “Email”"), { target: { value: "email" } });
      dedupeBy(/None/);
      fireEvent.click(importButton());
      await waitFor(() =>
        expect(api.confirm).toHaveBeenCalledWith("wb-1", "imp-12345678", {
          columns: [
            { header: 1, newColumn: { name: "Personal email", dataType: "email" } },
            { header: 2, newColumn: { name: "Website", dataType: "url" } },
          ],
          dedupe: { key: "none" },
        })
      );
    });

    it.each([
      ["Email", { key: "email", header: 1 }],
      ["Domain", { key: "domain", header: 2 }],
      [/None/, { key: "none" }],
    ])("sends the %s deduplication choice", async (label, dedupe) => {
      await openPreview();
      api.confirm.mockResolvedValue(item({ status: "completed", preview: null }));
      dedupeBy(label);
      // The website column is a web address, not a "domain" column, so it is chosen by name.
      if (dedupe.key === "domain") fireEvent.change(screen.getByLabelText("Column that holds the Domain"), { target: { value: "2" } });
      fireEvent.click(importButton());
      await waitFor(() => expect(api.confirm.mock.calls[0]![2].dedupe).toEqual(dedupe));
    });

    it("sends the LinkedIn URL choice once a column can hold it", async () => {
      await openPreview();
      api.confirm.mockResolvedValue(item({ status: "completed", preview: null }));
      fireEvent.change(screen.getByLabelText("Type of the new column for “Website”"), { target: { value: "linkedin_url" } });
      dedupeBy("LinkedIn URL");
      fireEvent.click(importButton());
      await waitFor(() => expect(api.confirm.mock.calls[0]![2].dedupe).toEqual({ key: "linkedin_url", header: 2 }));
    });

    it("blocks a key that no mapped column can hold", async () => {
      await openPreview();
      dedupeBy("LinkedIn URL");
      fireEvent.change(into("Website"), { target: { value: "skip" } });
      fireEvent.change(into("Full name"), { target: { value: "skip" } });
      expect(screen.getByText("Map a file column that holds the LinkedIn URL.")).toBeTruthy();
      expect(importButton().disabled).toBe(true);
    });

    it("blocks two file columns going into one workbook column, and a new name already in use", async () => {
      await openPreview();
      dedupeBy(/None/);
      fireEvent.change(into("Website"), { target: { value: "c-name" } });
      expect(screen.getByText("Another file column already goes into “Name”.")).toBeTruthy();
      expect(importButton().disabled).toBe(true);
      fireEvent.change(into("Website"), { target: { value: "new" } });
      fireEvent.change(screen.getByLabelText("Name of the new column for “Website”"), { target: { value: "email" } });
      expect(screen.getByText(/already has a column with this name/)).toBeTruthy();
      expect(importButton().disabled).toBe(true);
    });

    it("warns when a chosen type would refuse some values", async () => {
      await openPreview();
      expect(screen.queryByText(/Those rows will be skipped/)).toBeNull();
      fireEvent.change(into("Full name"), { target: { value: "c-email" } });
      fireEvent.change(into("Email"), { target: { value: "skip" } });
      expect(screen.getByText(/Some values are not a valid email\. Those rows will be skipped/)).toBeTruthy();
    });

    it("shows every reason the server refuses a mapping", async () => {
      await openPreview();
      api.confirm.mockRejectedValue(
        new ApiError("refused", 422, { code: "INVALID_IMPORT_MAPPING", details: { errors: [{ message: "This workbook has no such column." }, { message: "Map a file column to an email column." }] } })
      );
      dedupeBy(/None/);
      fireEvent.click(importButton());
      expect(await screen.findByText("This workbook has no such column.")).toBeTruthy();
      expect(screen.getByText("Map a file column to an email column.")).toBeTruthy();
      expect(screen.getByText("Map the columns")).toBeTruthy();
    });

    it("cancels without importing", async () => {
      await openPreview();
      api.cancel.mockResolvedValue(item({ status: "cancelled", preview: null }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await screen.findByText("Choose a CSV file");
      expect(api.cancel).toHaveBeenCalledWith("wb-1", "imp-12345678");
      expect(api.confirm).not.toHaveBeenCalled();
    });
  });

  describe("progress and results", () => {
    const running = (processed: number, progress: number) =>
      item({ status: "processing", background: true, preview: null, progress, counts: { total: 5000, processed, imported: processed - 10, duplicates: 10 } });

    async function openRunning(imported: WorkbookImport) {
      api.list.mockResolvedValue([imported]);
      show();
      fireEvent.click(await screen.findByRole("button", { name: "View leads.csv" }));
    }
    const bar = () => screen.getByRole("progressbar");

    it("shows only what the server reports, and follows it to the end", async () => {
      api.get.mockResolvedValue(running(2000, 40));
      await openRunning(running(2000, 40));
      await waitFor(() => expect(bar().getAttribute("aria-valuenow")).toBe("40"));
      // Once beside the progress bar, once in the list of recent imports.
      expect(screen.getAllByText("Processing")).toHaveLength(2);
      // Time passing alone moves nothing: several polls with the same answer leave the bar where it is.
      await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 4000 });
      expect(bar().getAttribute("aria-valuenow")).toBe("40");

      api.get.mockResolvedValue(
        item({ status: "completed", preview: null, progress: 100, report: { available: true, rows: 25 }, counts: { total: 5000, processed: 5000, imported: 4975, duplicates: 20, failed: 4, skipped: 1 } })
      );
      await waitFor(() => expect(bar().getAttribute("aria-valuenow")).toBe("100"), { timeout: 4000 });
      const figure = (label: string) => screen.getByText(label).nextElementSibling!.textContent;
      expect([figure("Total rows"), figure("Processed"), figure("Imported"), figure("Duplicates skipped"), figure("Invalid or failed"), figure("Empty rows skipped")]).toEqual(["5,000", "5,000", "4,975", "20", "4", "1"]);
      expect(screen.getByText("4,975 rows were added to the workbook.")).toBeTruthy();
      // Polling stops once it has finished.
      const polls = api.get.mock.calls.length;
      await new Promise((resolve) => setTimeout(resolve, 1900));
      expect(api.get.mock.calls.length).toBe(polls);
    }, 15_000);

    it("shows a queued import after confirming a large file", async () => {
      await openPreview();
      const queued = item({ status: "queued", background: true, preview: null });
      api.confirm.mockResolvedValue(queued);
      api.get.mockResolvedValue(queued);
      dedupeBy(/None/);
      fireEvent.click(importButton());
      expect(await screen.findByText("Queued", { selector: "div span" })).toBeTruthy();
      expect(bar().getAttribute("aria-valuenow")).toBe("0");
      expect(screen.getByText(/You can keep working or leave this page/)).toBeTruthy();
    });

    it("downloads the skipped rows", async () => {
      const done = item({ status: "completed", preview: null, progress: 100, report: { available: true, rows: 7 } });
      api.get.mockResolvedValue(done);
      api.report.mockResolvedValue(new Blob(["x"]));
      URL.createObjectURL = vi.fn(() => "blob:report");
      URL.revokeObjectURL = vi.fn();
      const names: string[] = [];
      const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
        names.push(this.download);
      });
      await openRunning(done);
      fireEvent.click(await screen.findByRole("button", { name: "Download skipped rows (7)" }));
      await waitFor(() => expect(names).toEqual(["skipped-rows-imp-1234.csv"]));
      expect(api.report).toHaveBeenCalledWith("wb-1", "imp-12345678");
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:report");
      click.mockRestore();
    });

    it("says why an import failed and still offers its report", async () => {
      const failed = item({ status: "failed", preview: null, progress: 20, error: { code: "IMPORT_FAILED", message: "The import stopped because of a problem on our side." }, report: { available: true, rows: 1 } });
      api.get.mockResolvedValue(failed);
      await openRunning(failed);
      expect(await screen.findByText("The import stopped because of a problem on our side.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Download skipped rows (1)" })).toBeTruthy();
      expect(screen.queryByText(/rows were added/)).toBeNull();
    });
  });

  it("lets someone without edit access follow imports but not start one", async () => {
    const waiting = item();
    api.list.mockResolvedValue([waiting]);
    api.get.mockResolvedValue(waiting);
    show(false);
    fireEvent.click(await screen.findByRole("button", { name: "View leads.csv" }));
    expect(await screen.findByText(/waiting for someone with edit access/)).toBeTruthy();
    expect(fileInput()).toBeNull();
    expect(screen.queryByPlaceholderText("Workbook name")).toBeNull();
    expect(screen.queryByText("Map the columns")).toBeNull();
  });
});
