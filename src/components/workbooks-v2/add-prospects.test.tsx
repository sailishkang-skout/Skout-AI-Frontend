import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import type { WorkbookImport } from "@/lib/workbooks-v2-import";
import { AddProspects } from "./add-prospects";

const lists = vi.fn();
const smartLists = vi.fn();
const prospects = { browse: vi.fn(), add: vi.fn() };
const imports = { get: vi.fn(), report: vi.fn() };
vi.mock("@/lib/enrichment", () => ({ useEnrichmentApi: () => ({ listLists: lists }) }));
vi.mock("@/lib/smart-lists", () => ({ useSmartListApi: () => ({ list: smartLists }) }));
vi.mock("@/lib/workbooks-v2-prospects", async (original) => ({ ...(await original<typeof import("@/lib/workbooks-v2-prospects")>()), useWorkbookProspectsApi: () => prospects }));
vi.mock("@/lib/workbooks-v2-import", async (original) => ({ ...(await original<typeof import("@/lib/workbooks-v2-import")>()), useWorkbookImportApi: () => imports }));

const person = (i: number, inWorkbook = false) => ({ prospectId: `p-${i}`, fullName: `Person ${i}`, title: "CTO", companyName: `Co ${i}`, companyDomain: `co${i}.com`, inWorkbook });
const page = (from: number, total: number) => ({ data: Array.from({ length: Math.min(25, total - from) }, (_, i) => person(from + i, from + i === 0)), total, page: from / 25 + 1, pageSize: 25 });

function item(over: Partial<WorkbookImport> = {}): WorkbookImport {
  return {
    id: "imp-12345678", workbookId: "wb-1", sourceType: "list", sourceName: "Q4 leads", truncated: null, status: "completed", fileName: "", fileBytes: 0,
    counts: { total: 2, processed: 2, imported: 2, duplicates: 0, skipped: 0, failed: 0 }, progress: 100, background: false, error: null, report: { available: false, rows: 0 }, preview: null,
    createdAt: "2026-11-28T10:00:00.000Z", ...over,
  };
}

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AddProspects workbook={{ id: "wb-1", name: "Leads" }} />
    </QueryClientProvider>
  );

async function open() {
  show();
  fireEvent.click(screen.getByRole("button", { name: "Add rows" }));
  return screen.findByRole("dialog");
}
async function choose(name: RegExp = /Q4 leads/) {
  const dialog = await open();
  fireEvent.click(await within(dialog).findByRole("radio", { name }));
  await within(dialog).findByLabelText("Select Person 1");
  return dialog;
}
const button = (name: string | RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("Add rows from lists and smart lists", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    lists.mockResolvedValue({ data: [{ id: "l-1", name: "Q4 leads", prospectCount: 60 }, { id: "l-2", name: "Empty", prospectCount: 0 }] });
    smartLists.mockResolvedValue({ data: [{ id: "s-1", name: "ICP", lastRunCount: 25000 }, { id: "s-2", name: "New", lastRunCount: null }] });
    prospects.browse.mockImplementation(async (_wb: string, _type: string, _id: string, n: number) => page((n - 1) * 25, 60));
  });
  afterEach(() => cleanup());

  it("shows the lists with their prospect counts and who is in the one picked", async () => {
    const dialog = await open();
    expect(dialog.textContent).toContain("Add rows to “Leads”");
    expect(await within(dialog).findByRole("radio", { name: /Q4 leads\s*60 prospects/ })).toBeTruthy();
    expect(button(/^Add selected/).disabled).toBe(true);
    expect(button("Add all").disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole("radio", { name: /Q4 leads/ }));
    await within(dialog).findByLabelText("Select Person 1");
    expect(prospects.browse).toHaveBeenCalledWith("wb-1", "list", "l-1", 1);
    expect(dialog.textContent).toContain("60 in this list");
    // Someone already in the workbook cannot be picked.
    expect((within(dialog).getByLabelText("Select Person 0") as HTMLInputElement).disabled).toBe(true);
    expect(within(dialog).getByText("In workbook")).toBeTruthy();
    expect(button("Add all 60").disabled).toBe(false);
  });

  it("keeps the selection across pages and sends exactly those picked", async () => {
    prospects.add.mockResolvedValue(item());
    imports.get.mockResolvedValue(item());
    const dialog = await choose();
    fireEvent.click(within(dialog).getByLabelText("Select Person 2"));
    fireEvent.click(button("Next"));
    fireEvent.click(await within(dialog).findByLabelText("Select Person 30"));
    expect(dialog.textContent).toContain("2 selected");
    fireEvent.click(button("Add selected (2)"));
    await waitFor(() => expect(prospects.add).toHaveBeenCalledWith("wb-1", { type: "list", listId: "l-1" }, { prospectIds: ["p-2", "p-30"] }));
    expect(await screen.findByText("2 rows were added to the workbook.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("List: Q4 leads")).toBeTruthy();
  });

  it("selects a whole page, leaving out those already there", async () => {
    const dialog = await choose();
    fireEvent.click(within(dialog).getByLabelText("Select everyone on this page"));
    expect(button("Add selected (24)").disabled).toBe(false);
    fireEvent.click(within(dialog).getByLabelText("Select everyone on this page"));
    expect(button("Add selected (0)").disabled).toBe(true);
  });

  it("adds a whole smart list, saying how far it can be browsed", async () => {
    prospects.browse.mockResolvedValue(page(0, 25000));
    const queued = item({ sourceType: "smart_list", sourceName: "ICP", status: "queued", progress: 0, background: true, counts: { total: 0, processed: 0, imported: 0, duplicates: 0, skipped: 0, failed: 0 } });
    prospects.add.mockResolvedValue(queued);
    imports.get.mockResolvedValue(queued);
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Smart lists" }));
    expect(await within(dialog).findByRole("radio", { name: /ICP\s*25,000 at last run/ })).toBeTruthy();
    expect(within(dialog).getByRole("radio", { name: /New\s*Not run yet/ })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("radio", { name: /ICP/ }));
    await within(dialog).findByLabelText("Select Person 1");
    expect(dialog.textContent).toContain("only the first 10,000 can be browsed");
    expect(dialog.textContent).toContain("Page 1 of 400");
    fireEvent.click(button("Add all 25,000"));
    await waitFor(() => expect(prospects.add).toHaveBeenCalledWith("wb-1", { type: "smart_list", smartListId: "s-1" }, { all: true }));
    expect(await screen.findByText("Queued", { selector: "div span" })).toBeTruthy();
    expect(screen.getByText("Smart list: ICP")).toBeTruthy();
  });

  it("shows a partial result and downloads the report", async () => {
    const partial = item({ counts: { total: 10, processed: 10, imported: 6, duplicates: 2, skipped: 1, failed: 1 }, report: { available: true, rows: 4 }, truncated: { matched: 12000, considered: 10 } });
    prospects.add.mockResolvedValue(partial);
    imports.get.mockResolvedValue(partial);
    imports.report.mockResolvedValue(new Blob(["x"]));
    URL.createObjectURL = vi.fn(() => "blob:r");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await choose();
    fireEvent.click(button("Add all 60"));
    expect(await screen.findByText("6 rows were added to the workbook.")).toBeTruthy();
    expect(screen.getByText("4 were not added; the report says why.")).toBeTruthy();
    expect(screen.getByText(/12,000 prospects matched; only the first 10/)).toBeTruthy();
    const figure = (label: string) => screen.getByText(label).nextElementSibling!.textContent;
    expect([figure("Selected"), figure("Added"), figure("Already in workbook"), figure("Over the row limit"), figure("Not found")]).toEqual(["10", "6", "2", "1", "1"]);
    fireEvent.click(button("Download skipped rows (4)"));
    await waitFor(() => expect(imports.report).toHaveBeenCalledWith("wb-1", "imp-12345678"));
    click.mockRestore();
    fireEvent.click(button("Done"));
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("says when nothing was added, and when it failed", async () => {
    const none = item({ counts: { total: 2, processed: 2, imported: 0, duplicates: 2, skipped: 0, failed: 0 } });
    prospects.add.mockResolvedValue(none);
    imports.get.mockResolvedValue(none);
    await choose();
    fireEvent.click(button("Add all 60"));
    expect(await screen.findByText("No rows were added to the workbook.")).toBeTruthy();
  });

  it("keeps the dialog and the selection when the server refuses", async () => {
    prospects.add.mockRejectedValue(new ApiError("This workbook already holds its limit of 100,000 rows.", 422, { code: "ROW_LIMIT_EXCEEDED", error: "ROW_LIMIT_EXCEEDED", message: "This workbook already holds its limit of 100,000 rows." }));
    const dialog = await choose();
    fireEvent.click(within(dialog).getByLabelText("Select Person 3"));
    fireEvent.click(button("Add selected (1)"));
    expect(await within(dialog).findByText("This workbook already holds its limit of 100,000 rows.")).toBeTruthy();
    expect(button("Add selected (1)").disabled).toBe(false);
  });

  it("cannot be sent twice while the first is on its way", async () => {
    prospects.add.mockReturnValue(new Promise(() => {}));
    await choose();
    fireEvent.click(button("Add all 60"));
    await waitFor(() => expect(button("Adding…").disabled).toBe(true));
    expect(button("Add all 60").disabled).toBe(true);
  });

  it("says when there are no lists and when they cannot be loaded", async () => {
    lists.mockResolvedValue({ data: [] });
    smartLists.mockRejectedValue(new ApiError("x", 400, { message: "Smart lists are unavailable." }));
    const dialog = await open();
    expect(await within(dialog).findByText("You have no lists yet.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Smart lists" }));
    expect(await within(dialog).findByRole("alert", {}, { timeout: 4000 })).toBeTruthy();
  });
});
