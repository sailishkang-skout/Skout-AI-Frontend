import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { FROM_SKOUT } from "@/lib/workbooks-v2-grid";
import type { PasteBody, WorkbookRow } from "@/lib/workbooks-v2-rows";
import type { SheetProps } from "./sheet-types";
import { WorkbookGrid } from "./workbook-grid";

/**
 * The grid's behaviour with the drawing library stood in for: `sheet.props` is what it was asked to draw, and calling
 * its callbacks is what a person selecting, typing and deleting does. The library itself is checked in a real browser.
 */
const sheet = vi.hoisted(() => ({ props: null as unknown as SheetProps }));
vi.mock("next/dynamic", () => ({
  default: () =>
    function FakeSheet(props: SheetProps) {
      sheet.props = props;
      return <div tabIndex={0} data-testid="sheet" />;
    },
}));
vi.mock("@/lib/api-client", async (original) => ({ ...(await original<typeof import("@/lib/api-client")>()), useAuthReady: () => true }));

const rowsApi = vi.hoisted(() => ({ window: vi.fn(), addRow: vi.fn(), editRow: vi.fn(), paste: vi.fn(), addColumn: vi.fn() }));
vi.mock("@/lib/workbooks-v2-rows", () => ({ useWorkbookRowsApi: () => rowsApi }));
const listColumns = vi.hoisted(() => vi.fn());
vi.mock("@/lib/workbooks-v2-import", async (original) => ({ ...(await original<typeof import("@/lib/workbooks-v2-import")>()), useWorkbookImportApi: () => ({ columns: listColumns }) }));

type Column = { id: string; name: string; type: string; hidden?: boolean; config: Record<string, unknown> };
const NAME: Column = { id: "n", name: "Name", type: "input", config: {} };
const EMAIL: Column = { id: "e", name: "Email", type: "input", config: { dataType: "email" } };
const DOMAIN: Column = { id: "d", name: "Domain", type: "input", config: { dataType: "domain" } };
const FOUND: Column = { id: "f", name: "Found", type: "enrichment", config: {} };
// Grid order: Name 0, Email 1, Domain 2, Found 3, Source 4.

const cell = (value: unknown, over: Record<string, unknown> = {}) => ({ value, state: "found", foundVia: null, verification: null, ...over });
const row = (id: number, cells: Record<string, ReturnType<typeof cell>> = {}, type = "manual"): WorkbookRow => ({ id, prospectId: null, source: { type }, cells: cells as WorkbookRow["cells"] });

/** What the API holds. */
const server = { columns: [] as Column[], rows: [] as WorkbookRow[], nextId: 100 };
const clean = { added: 0, updated: 0, cellsWritten: 0, cellsCleared: 0, rowCount: 0, blankRows: 0, invalid: { count: 0 }, rejected: { count: 0 }, skippedColumns: [] };
const toCells = (cells: Record<string, string | null>) => Object.fromEntries(Object.entries(cells).flatMap(([k, v]) => (v === null ? [] : [[k, cell(v)]])));

function held<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function show({ canEdit = true } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <WorkbookGrid workbook={{ id: "wb-1", name: "Leads" }} canEdit={canEdit} />
    </QueryClientProvider>
  );
  return {
    ...view,
    another: (id: string) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <WorkbookGrid workbook={{ id, name: id }} canEdit={canEdit} />
        </QueryClientProvider>
      ),
  };
}
const ready = async () => {
  await screen.findByTestId("sheet");
  await waitFor(() => expect(sheet.props.cell(0, 0).loading).toBeFalsy());
};
const text = (col: number, r: number) => sheet.props.cell(col, r).text;
const select = (col: number, r: number, width = 1, height = 1) =>
  act(() => sheet.props.onSelection({ col, row: r, ranges: [{ x: col, y: r, width, height }] }));
const type = (col: number, r: number, value: string) => act(async () => sheet.props.onEdit(col, r, value));
/** What the browser sends when someone presses Ctrl+V with the grid (or something else) focused. */
async function paste(value: string, target: HTMLElement | null = screen.queryByTestId("sheet") ?? screen.queryByTestId("paste-target")) {
  target?.focus();
  const event = new Event("paste", { cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: { getData: (kind: string) => (kind === "text/plain" ? value : "") } });
  await act(async () => void window.dispatchEvent(event));
  return event;
}
const sent = (call = 0) => rowsApi.paste.mock.calls[call]![1] as PasteBody;
const incompatible = (columnId: string, dataType: string, looksLike: string | null, values = 2) =>
  new ApiError("Nothing was pasted.", 422, { code: "INCOMPATIBLE_COLUMN", retryable: false, details: { columns: [{ columnId, dataType, values, invalid: values, looksLike }] } });

describe("Workbook grid", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    server.columns = [NAME, EMAIL, DOMAIN, FOUND];
    server.rows = [row(1, { n: cell("Ann"), e: cell("ann@acme.com") }), row(2, { n: cell("Bo") }, "paste"), row(3, { n: cell("Cy") })];
    server.nextId = 100;
    listColumns.mockImplementation(async () => server.columns);
    rowsApi.window.mockImplementation(async (_wb: string, offset: number, limit: number) => ({
      data: server.rows.slice(offset, offset + limit),
      window: { total: server.rows.length, hasMore: offset + limit < server.rows.length },
    }));
    rowsApi.addRow.mockImplementation(async (_wb: string, cells: Record<string, string>) => {
      const made = row(server.nextId++, toCells(cells));
      server.rows = [...server.rows, made];
      return { data: made, rowCount: server.rows.length };
    });
    rowsApi.editRow.mockImplementation(async (_wb: string, id: number, cells: Record<string, string | null>) => {
      server.rows = server.rows.map((r) => {
        if (r.id !== id) return r;
        const next: Record<string, unknown> = { ...r.cells, ...toCells(cells) };
        for (const [k, v] of Object.entries(cells)) if (v === null) delete next[k];
        return { ...r, cells: next as WorkbookRow["cells"] };
      });
      return { data: server.rows.find((r) => r.id === id)! };
    });
    rowsApi.paste.mockImplementation(async (_wb: string, body: PasteBody) => {
      const added = body.values.length - (body.start?.rows ?? 0);
      for (let i = 0; i < added; i++) server.rows = [...server.rows, row(server.nextId++, {}, "paste")];
      return { data: { ...clean, added, updated: body.start?.rows ?? 0, rowCount: server.rows.length } };
    });
    rowsApi.addColumn.mockImplementation(async (_wb: string, spec: { name: string; dataType: string }) => {
      const made = { id: `new-${server.columns.length}`, name: spec.name, type: "input", config: { dataType: spec.dataType } };
      server.columns = [...server.columns, made];
      return { data: made };
    });
  });
  afterEach(() => cleanup());

  // ── Looking ────────────────────────────────────────────────────────────────

  it("shows the rows with where they came from, the count, and an empty row to type in", async () => {
    show();
    await ready();
    expect(screen.getByTestId("row-count").textContent).toBe("3 rows");
    expect(sheet.props.columns.map((c) => c.title)).toEqual(["Name", "Email", "Domain", "Found", "Source"]);
    expect(sheet.props.rows).toBe(4);
    expect([text(0, 0), text(1, 0), text(4, 0), text(4, 1)]).toEqual(["Ann", "ann@acme.com", "Added by hand", "Pasted"]);
    expect([0, 1, 2, 3, 4].map((c) => sheet.props.cell(c, 3).editable)).toEqual([true, true, true, false, false]);
    expect(sheet.props.cell(3, 0).editable).toBe(false);
  });

  it("marks reused values and flagged ones, and says why on selection", async () => {
    server.rows = [row(1, { e: cell("a@acme.com", { foundVia: "cache", verification: "valid" }), d: cell("not a domain", { state: "error" }) })];
    show();
    await ready();
    expect(sheet.props.cell(1, 0).badge).toBe(FROM_SKOUT);
    expect(sheet.props.cell(0, 0).badge).toBeUndefined();
    expect(sheet.props.cell(2, 0).tone).toBe("invalid");
    select(1, 0);
    const details = screen.getByTestId("cell-details");
    expect(details.textContent).toContain("From your Skout data");
    expect(details.textContent).toContain("Verified");
    select(2, 0);
    expect(screen.getByTestId("cell-details").textContent).toContain("Doesn't fit this Domain column");
  });

  it("gives a viewer no empty row, no editing and no pasting", async () => {
    show({ canEdit: false });
    await ready();
    expect(sheet.props.rows).toBe(3);
    expect(sheet.props.cell(0, 0).editable).toBe(false);
    expect(screen.queryByRole("button", { name: "Add column" })).toBeNull();
    await type(0, 0, "changed");
    act(() => sheet.props.onClear([{ x: 0, y: 0, width: 2, height: 2 }]));
    select(0, 0);
    await paste("x");
    expect(screen.getByRole("alert").textContent).toContain("not change it");
    expect([rowsApi.editRow, rowsApi.addRow, rowsApi.paste].flatMap((f) => f.mock.calls)).toEqual([]);
  });

  it("fetches rows beyond the first window as they come on screen, and for copying", async () => {
    server.rows = Array.from({ length: 450 }, (_, i) => row(i + 1, { n: cell(`row ${i + 1}`) }));
    show();
    await ready();
    expect(rowsApi.window.mock.calls.map((c) => c[1])).toEqual(expect.arrayContaining([0]));
    expect(rowsApi.window.mock.calls.some((c) => c[1] === 400)).toBe(false);
    const copied = await act(() => sheet.props.loadCells({ x: 0, y: 399, width: 1, height: 3 }));
    expect(copied.map((line) => line[0]!.text)).toEqual(["row 400", "row 401", "row 402"]);
    act(() => sheet.props.onVisibleRows(410, 430));
    await waitFor(() => expect(sheet.props.cell(0, 420).text).toBe("row 421"));
  });

  it("says when the rows cannot be loaded, and loads them on retry", async () => {
    // The app tries a failed load once more by itself before saying so.
    const down = new ApiError("Rows are unavailable.", 400, { message: "Rows are unavailable." });
    rowsApi.window.mockRejectedValueOnce(down).mockRejectedValueOnce(down);
    show();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Rows are unavailable.");
    expect(screen.queryByTestId("sheet")).toBeNull();
    fireEvent.click(within(alert).getByRole("button", { name: /try again/i }));
    await ready();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // ── Typing ─────────────────────────────────────────────────────────────────

  it("creates one row from the first value typed in the empty row, and puts the next value in it", async () => {
    const creating = held();
    const real = rowsApi.addRow.getMockImplementation()!;
    rowsApi.addRow.mockImplementation(async (...args: unknown[]) => (await creating.promise, real(...args)));
    show();
    await ready();
    await type(1, 3, "new@acme.com");
    // Shown at once, with another empty row after it, before the API has answered.
    expect(sheet.props.rows).toBe(5);
    expect(sheet.props.cell(1, 3)).toMatchObject({ text: "new@acme.com", tone: "pending" });
    expect(screen.getByTestId("row-count").textContent).toBe("3 rows · 1 being added");
    await type(0, 3, "Dee");
    expect(rowsApi.editRow).not.toHaveBeenCalled();
    await act(async () => creating.resolve());
    await waitFor(() => expect(screen.getByTestId("row-count").textContent).toBe("4 rows"));
    expect(rowsApi.addRow).toHaveBeenCalledTimes(1);
    expect(rowsApi.addRow.mock.calls[0]).toEqual(["wb-1", { e: "new@acme.com" }, expect.any(String)]);
    expect(rowsApi.editRow).toHaveBeenCalledWith("wb-1", 100, { n: "Dee" });
    await waitFor(() => expect([text(0, 3), text(1, 3)]).toEqual(["Dee", "new@acme.com"]));
    expect(sheet.props.rows).toBe(5);
  });

  it("creates nothing when the empty row is left empty", async () => {
    show();
    await ready();
    select(0, 3);
    await type(0, 3, "");
    await type(1, 3, "   ");
    act(() => sheet.props.onClear([{ x: 0, y: 3, width: 1, height: 1 }]));
    act(() => sheet.props.onClear([{ x: 0, y: 3, width: 3, height: 1 }]));
    expect([rowsApi.addRow, rowsApi.editRow, rowsApi.paste].flatMap((f) => f.mock.calls)).toEqual([]);
    expect(sheet.props.rows).toBe(4);
  });

  it("never writes to a column that cannot be typed in", async () => {
    show();
    await ready();
    await type(3, 0, "x");
    await type(4, 3, "x");
    expect([rowsApi.addRow, rowsApi.editRow].flatMap((f) => f.mock.calls)).toEqual([]);
  });

  it("saves an edited cell, clears an emptied one, and ignores one left as it was", async () => {
    show();
    await ready();
    await type(0, 0, "Ann");
    expect(rowsApi.editRow).not.toHaveBeenCalled();
    await type(0, 0, "Anne");
    await type(1, 0, "");
    await waitFor(() => expect(rowsApi.editRow.mock.calls).toEqual([["wb-1", 1, { n: "Anne" }], ["wb-1", 1, { e: null }]]));
    await waitFor(() => expect([text(0, 0), text(1, 0)]).toEqual(["Anne", ""]));
  });

  // ── Pasting ────────────────────────────────────────────────────────────────

  it("pastes a block from the selected cell over the rows under it and on past the end", async () => {
    show();
    await ready();
    select(0, 1);
    const event = await paste("B\tb@x.com\tx.com\r\nC\t\t\r\nD\td@x.com\t\r\n");
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(rowsApi.paste).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual({
      columnIds: ["n", "e", "d"],
      values: [["B", "b@x.com", "x.com"], ["C", "", ""], ["D", "d@x.com", ""]],
      start: { rowId: 2, endRowId: 3, rows: 2 },
    });
    expect(rowsApi.paste.mock.calls[0]![2]).toEqual(expect.any(String));
    await screen.findByText("Added 1 row and updated 2 rows.");
    await waitFor(() => expect(screen.getByTestId("row-count").textContent).toBe("4 rows"));
  });

  it("makes every row new when pasting on the empty row", async () => {
    show();
    await ready();
    select(2, 3);
    await paste("a.com\nb.com");
    await waitFor(() => expect(rowsApi.paste).toHaveBeenCalled());
    expect(sent()).toEqual({ columnIds: ["d"], values: [["a.com"], ["b.com"]] });
  });

  it("looks up the last row of a paste that runs past what is loaded", async () => {
    server.rows = Array.from({ length: 450 }, (_, i) => row(i + 1));
    show();
    await ready();
    select(0, 5);
    await paste(Array.from({ length: 300 }, (_, i) => `v${i}`).join("\n"));
    await waitFor(() => expect(rowsApi.paste).toHaveBeenCalled());
    expect(sent().start).toEqual({ rowId: 6, endRowId: 305, rows: 300 });
  });

  it("leaves alone a paste aimed somewhere else, such as the cell editor or another field", async () => {
    show();
    await ready();
    select(0, 0);
    const elsewhere = document.body.appendChild(document.createElement("input"));
    const event = await paste("x", elsewhere);
    expect(event.defaultPrevented).toBe(false);
    expect(rowsApi.paste).not.toHaveBeenCalled();
    elsewhere.remove();
  });

  it("asks for a cell first, and refuses more than one request can take", async () => {
    show();
    await ready();
    await paste("x");
    expect(screen.getByRole("alert").textContent).toContain("Select the cell");
    select(0, 0);
    await paste(Array.from({ length: 10_001 }, () => "x").join("\n"));
    expect(screen.getByRole("alert").textContent).toContain("at most 10,000 rows");
    await paste(" \n\n");
    expect(screen.getByRole("alert").textContent).toContain("nothing to paste");
    expect(rowsApi.paste).not.toHaveBeenCalled();
  });

  it("guides a list that went to the wrong column into the right one, as new rows", async () => {
    rowsApi.paste.mockRejectedValueOnce(incompatible("e", "email", "domain"));
    show();
    await ready();
    select(1, 0);
    await paste("a.com\nb.com");
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("“Email” takes Email values");
    expect(dialog.textContent).toContain("Nothing has been pasted yet");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to “Domain”" }));
    await waitFor(() => expect(rowsApi.paste).toHaveBeenCalledTimes(2));
    expect(sent(1)).toEqual({ columnIds: ["d"], values: [["a.com"], ["b.com"]] });
    expect(rowsApi.paste.mock.calls[1]![2]).not.toBe(rowsApi.paste.mock.calls[0]![2]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("creates the missing column for a list and adds it there", async () => {
    server.columns = [NAME, EMAIL];
    rowsApi.paste.mockRejectedValueOnce(incompatible("e", "email", "linkedin_url"));
    show();
    await ready();
    select(1, 0);
    await paste("linkedin.com/in/a\nlinkedin.com/in/b");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: /^Add to/ })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create column “LinkedIn URL” (LinkedIn URL) and add them" }));
    await waitFor(() => expect(rowsApi.paste).toHaveBeenCalledTimes(2));
    expect(rowsApi.addColumn.mock.calls[0]![1]).toEqual({ name: "LinkedIn URL", dataType: "linkedin_url" });
    expect(sent(1)).toEqual({ columnIds: ["new-2"], values: [["linkedin.com/in/a"], ["linkedin.com/in/b"]] });
  });

  it("asks where a list should go when the selected column cannot be edited", async () => {
    show();
    await ready();
    select(3, 0);
    await paste("a@x.com\nb@x.com");
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("“Found” can't be edited");
    expect(rowsApi.paste).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(rowsApi.paste).not.toHaveBeenCalled();
  });

  it("says which columns of a block are wrong, without offering to move it", async () => {
    rowsApi.paste.mockRejectedValueOnce(incompatible("e", "email", "domain"));
    show();
    await ready();
    select(0, 0);
    await paste("a\ta.com\nb\tb.com");
    expect((await screen.findByRole("alert")).textContent).toMatch(/Nothing was pasted\. “Email” takes Email values.*Check which cell/);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers to create the columns for a paste into an empty workbook", async () => {
    server.columns = [];
    server.rows = [];
    show();
    await screen.findByTestId("paste-target");
    await paste("a@x.com\tAnn\nb@x.com\tBo");
    const dialog = await screen.findByRole("dialog");
    expect(rowsApi.addColumn).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create and paste" }));
    await waitFor(() => expect(rowsApi.paste).toHaveBeenCalled());
    expect(rowsApi.addColumn.mock.calls.map((c) => c[1])).toEqual([{ name: "Email", dataType: "email" }, { name: "Column 2", dataType: "text" }]);
    expect(new Set(rowsApi.addColumn.mock.calls.map((c) => c[2])).size).toBe(2);
    expect(sent()).toEqual({ columnIds: ["new-0", "new-1"], values: [["a@x.com", "Ann"], ["b@x.com", "Bo"]] });
    await screen.findByTestId("sheet");
  });

  it("stays usable while a paste is on its way, and saves later changes after it", async () => {
    const pasting = held();
    const order: string[] = [];
    rowsApi.paste.mockImplementation(async () => {
      await pasting.promise;
      order.push("paste");
      return { data: { ...clean, added: 2 } };
    });
    rowsApi.editRow.mockImplementation(async () => (order.push("edit"), { data: server.rows[0]! }));
    show();
    await ready();
    select(0, 3);
    await paste("x\ny");
    expect(screen.getByRole("status").textContent).toBe("Pasting 2 rows…");
    await type(0, 0, "Anne");
    expect(sheet.props.cell(0, 0)).toMatchObject({ text: "Anne", tone: "pending", editable: true });
    expect(order).toEqual([]);
    await act(async () => pasting.resolve());
    await waitFor(() => expect(order).toEqual(["paste", "edit"]));
  });

  // ── Clearing ───────────────────────────────────────────────────────────────

  it("clears one cell by editing it, and a block of cells in one request", async () => {
    show();
    await ready();
    act(() => sheet.props.onClear([{ x: 0, y: 0, width: 1, height: 1 }]));
    await waitFor(() => expect(rowsApi.editRow).toHaveBeenCalledWith("wb-1", 1, { n: null }));
    act(() => sheet.props.onClear([{ x: 1, y: 1, width: 4, height: 3 }]));
    await waitFor(() => expect(rowsApi.paste).toHaveBeenCalled());
    // Only input columns, and only rows that exist.
    expect(sent()).toEqual({ columnIds: ["e", "d"], values: [["", ""], ["", ""]], start: { rowId: 2, endRowId: 3, rows: 2 } });
  });

  it("asks before clearing many cells, since there is no undo", async () => {
    server.rows = Array.from({ length: 60 }, (_, i) => row(i + 1, { n: cell(`n${i}`) }));
    show();
    await ready();
    act(() => sheet.props.onClear([{ x: 0, y: 0, width: 1, height: 51 }]));
    let dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Clear 51 cells?");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(rowsApi.paste).not.toHaveBeenCalled();
    act(() => sheet.props.onClear([{ x: 0, y: 0, width: 1, height: 51 }]));
    dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Clear cells" }));
    await waitFor(() => expect(rowsApi.paste).toHaveBeenCalledTimes(1));
    expect(sent().start).toEqual({ rowId: 1, endRowId: 51, rows: 51 });
    // A small block goes straight through.
    act(() => sheet.props.onClear([{ x: 0, y: 0, width: 1, height: 50 }]));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(rowsApi.paste).toHaveBeenCalledTimes(2));
  });

  it("refuses to clear more than one request can take", async () => {
    server.rows = Array.from({ length: 3 }, (_, i) => row(i + 1));
    rowsApi.window.mockResolvedValue({ data: server.rows, window: { total: 10_001, hasMore: true } });
    show();
    await ready();
    act(() => sheet.props.onClear([{ x: 0, y: 0, width: 1, height: 10_001 }]));
    expect(screen.getByRole("alert").textContent).toContain("Clear at most 10,000 rows");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("warns before the page is left while any workbook still has changes to save", async () => {
    const creating = held();
    const real = rowsApi.addRow.getMockImplementation()!;
    rowsApi.addRow.mockImplementation(async (...args: unknown[]) => (await creating.promise, real(...args)));
    const leave = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const view = show();
    await ready();
    expect(leave()).toBe(false);
    await type(0, 3, "Dee");
    expect(leave()).toBe(true);
    view.another("wb-2");
    await ready();
    expect(leave()).toBe(true);
    await act(async () => creating.resolve());
    await waitFor(() => expect(leave()).toBe(false));
  });

  // ── Failures ───────────────────────────────────────────────────────────────

  it("offers to try a change again with the same key when the answer never came", async () => {
    rowsApi.addRow.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    show();
    await ready();
    await type(0, 3, "Dee");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("couldn’t be saved");
    expect(sheet.props.cell(0, 3).text).toBe("Dee");
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByTestId("row-count").textContent).toBe("4 rows"));
    expect(rowsApi.addRow.mock.calls[1]).toEqual(rowsApi.addRow.mock.calls[0]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("retries a failed paste as exactly the same request", async () => {
    rowsApi.paste.mockRejectedValueOnce(new ApiError("Server error", 500, {}));
    show();
    await ready();
    select(0, 1);
    await paste("x\ny");
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(rowsApi.paste).toHaveBeenCalledTimes(2));
    expect(rowsApi.paste.mock.calls[1]).toEqual(rowsApi.paste.mock.calls[0]);
  });

  it("drops a discarded change", async () => {
    rowsApi.addRow.mockRejectedValue(new TypeError("Failed to fetch"));
    show();
    await ready();
    await type(0, 3, "Dee");
    fireEvent.click(await screen.findByRole("button", { name: "Discard it" }));
    await waitFor(() => expect(sheet.props.rows).toBe(4));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(rowsApi.addRow).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["the row limit", new ApiError("This workspace allows 3 rows per workbook.", 422, { code: "ROW_LIMIT_EXCEEDED", message: "This workspace allows 3 rows per workbook.", retryable: false })],
    ["lost access", new ApiError("You don't have permission to do that.", 403, { message: "You don't have permission to do that.", retryable: false })],
    ["changed rows", new ApiError("The rows changed while you were pasting.", 409, { code: "ROWS_CHANGED", message: "The rows changed while you were pasting.", retryable: false })],
  ])("reports %s and does not offer to resend", async (_name, error) => {
    rowsApi.paste.mockRejectedValue(error);
    show();
    await ready();
    select(0, 0);
    await paste("x");
    expect((await screen.findByRole("alert")).textContent).toContain(error.message);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(rowsApi.paste).toHaveBeenCalledTimes(1);
  });

  it("takes a typed row away again when the API refuses it", async () => {
    rowsApi.addRow.mockRejectedValue(new ApiError("Full", 422, { message: "This workbook is full.", retryable: false }));
    show();
    await ready();
    await type(0, 3, "Dee");
    expect((await screen.findByRole("alert")).textContent).toContain("This workbook is full.");
    expect(sheet.props.rows).toBe(4);
  });

  // ── Columns and workbooks ──────────────────────────────────────────────────

  it("adds an input column", async () => {
    show();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Column name"), { target: { value: " Profile " } });
    fireEvent.change(within(dialog).getByLabelText("Holds"), { target: { value: "linkedin_url" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add column" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(rowsApi.addColumn.mock.calls[0]![1]).toEqual({ name: "Profile", dataType: "linkedin_url" });
    await waitFor(() => expect(sheet.props.columns.map((c) => c.title)).toContain("Profile"));
  });

  it("says why a column could not be added, and keeps the dialog open", async () => {
    rowsApi.addColumn.mockRejectedValueOnce(new ApiError("A workbook can have 200 columns.", 422, { message: "A workbook can have 200 columns." }));
    show();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Column name"), { target: { value: "One more" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add column" }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("A workbook can have 200 columns.");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("keeps saving one workbook's changes after another is opened, and shows nothing of them there", async () => {
    const creating = held();
    const real = rowsApi.addRow.getMockImplementation()!;
    rowsApi.addRow.mockImplementation(async (...args: unknown[]) => (await creating.promise, real(...args)));
    const view = show();
    await ready();
    await type(0, 3, "Dee");
    await type(1, 3, "dee@x.com");
    view.another("wb-2");
    await ready();
    await waitFor(() => expect(screen.getByTestId("row-count").textContent).toBe("3 rows"));
    expect(screen.queryByRole("status")).toBeNull();
    await act(async () => creating.resolve());
    await waitFor(() => expect(rowsApi.editRow).toHaveBeenCalledWith("wb-1", 100, { e: "dee@x.com" }));
    expect(rowsApi.addRow.mock.calls[0]![0]).toBe("wb-1");
  });
});
