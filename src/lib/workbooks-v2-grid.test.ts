import { describe, expect, it } from "vitest";
import { SOURCE_COLUMN, cellProblem, cellText, columnsForBlock, freeName, gridColumns, incompatibleMessage, pasteSummary, planPaste, sourceLabel, tooLarge } from "./workbooks-v2-grid";
import type { PasteResult } from "./workbooks-v2-rows";

const columns = gridColumns([
  { id: "n", name: "Name", type: "input", config: {} },
  { id: "e", name: "Email", type: "input", config: { dataType: "email" } },
  { id: "h", name: "Hidden", type: "input", config: {}, hidden: true },
  { id: "f", name: "Found", type: "enrichment", config: {} },
  { id: "c", name: "City", type: "input", config: {} },
]);
// Name 0, Email 1, Found 2, City 3, Source 4.

const result = (over: Partial<PasteResult> = {}): PasteResult => ({
  added: 0, updated: 0, cellsWritten: 0, cellsCleared: 0, rowCount: 0, blankRows: 0, invalid: { count: 0 }, rejected: { count: 0 }, skippedColumns: [], ...over,
});

describe("grid columns", () => {
  it("leaves out hidden columns, lets only input columns be edited, and says where rows came from", () => {
    expect(columns.map((c) => [c.id, c.editable, c.dataType])).toEqual([
      ["n", true, "text"],
      ["e", true, "email"],
      ["f", false, null],
      ["c", true, "text"],
      [SOURCE_COLUMN, false, null],
    ]);
    expect(gridColumns([])).toEqual([]);
  });

  it("shows values, sources and why a cell is flagged", () => {
    expect([cellText(true), cellText(false), cellText(0), cellText(null), cellText(undefined)]).toEqual(["Yes", "No", "0", "", ""]);
    expect(sourceLabel({ type: "paste" })).toBe("Pasted");
    expect(sourceLabel({ type: "webhook", webhookId: "w", receivedAt: "2026-11-27T10:00:00Z" })).toBe("Webhook");
    expect(sourceLabel({ type: "manual" })).toBe("Added by hand");
    expect(sourceLabel({ type: "list", listName: "Q4" })).toBe("List: Q4");
    expect(sourceLabel({ type: "csv", fileName: "a.csv" })).toBe("CSV: a.csv");
    expect(sourceLabel({ type: "search" })).toBe("Search");
    const column = { id: "e", name: "Email", type: "input", config: { dataType: "email" as const } };
    expect(cellProblem({ value: "x", state: "error", foundVia: null, verification: null }, column)).toContain("Email column");
    expect(cellProblem({ value: "x", state: "found", foundVia: null, verification: null }, column)).toBeNull();
  });
});

describe("planPaste", () => {
  const block = (rows: number, width: number) => Array.from({ length: rows }, (_, r) => Array.from({ length: width }, (_, c) => `${r}.${c}`));

  it("lays a block over the columns to the right of the cell and the rows below it", () => {
    expect(planPaste(block(3, 2), columns, { col: 0, row: 4 }, 5)).toEqual({
      kind: "paste",
      plan: { columnIds: ["n", "e"], values: block(3, 2), row: 4, overlap: 1, outside: 0 },
    });
  });

  it("makes every row new when it starts on the empty row", () => {
    expect(planPaste(block(2, 1), columns, { col: 3, row: 5 }, 5)).toMatchObject({ plan: { columnIds: ["c"], row: 5, overlap: 0 } });
  });

  it("covers only existing rows when the block ends before them", () => {
    expect(planPaste(block(2, 1), columns, { col: 0, row: 0 }, 5)).toMatchObject({ plan: { overlap: 2 } });
  });

  it("keeps a read-only column in the middle in its place, for the API to leave out", () => {
    expect(planPaste(block(1, 3), columns, { col: 1, row: 0 }, 1)).toMatchObject({ plan: { columnIds: ["e", "f", "c"] } });
  });

  it("cuts what falls past the last column and counts it, never moving it elsewhere", () => {
    const outcome = planPaste([["a", "b", "c"], ["d", "", ""]], columns, { col: 3, row: 0 }, 2);
    expect(outcome).toMatchObject({ kind: "paste", plan: { columnIds: ["c"], values: [["a"], ["d"]], outside: 2 } });
  });

  it("asks where a list goes when it is aimed at a column nobody can type in", () => {
    for (const col of [2, 4]) expect(planPaste(block(2, 1), columns, { col, row: 0 }, 2)).toEqual({ kind: "choose", values: block(2, 1) });
  });

  it("refuses a block with no editable column under it", () => {
    expect(planPaste(block(1, 2), columns, { col: 4, row: 0 }, 1)).toMatchObject({ kind: "refused" });
  });

  it("refuses more than 10,000 rows or 100,000 cells", () => {
    expect(tooLarge(block(10_000, 10))).toBeNull();
    expect(tooLarge(block(10_001, 1))).toContain("at most 10,000 rows");
    expect(tooLarge(block(9_100, 11))).toContain("CSV import");
    expect(planPaste(block(10_001, 1), columns, { col: 0, row: 0 }, 0)).toMatchObject({ kind: "refused" });
  });
});

describe("messages", () => {
  it("says what a paste did", () => {
    expect(pasteSummary(result({ added: 1 }), 0, columns)).toEqual({ tone: "success", text: "Added 1 row." });
    expect(pasteSummary(result({ added: 2, updated: 3, blankRows: 1 }), 0, columns)).toEqual({ tone: "success", text: "Added 2 rows and updated 3 rows. 1 empty line added no row." });
    expect(pasteSummary(result(), 0, columns)).toEqual({ tone: "warning", text: "Nothing was pasted." });
  });

  it("warns about everything flagged or left out", () => {
    const { tone, text } = pasteSummary(result({ updated: 1, invalid: { count: 2 }, rejected: { count: 1 }, skippedColumns: [{ columnId: "f", values: 4 }, { columnId: "x", values: 0 }] }), 5, columns);
    expect(tone).toBe("warning");
    expect(text).toBe(
      "Updated 1 row. 2 values didn't fit the column type: kept and flagged. 1 value too long or unreadable: not pasted. 4 values not pasted: “Found” can't be edited. 5 values not pasted: past the last column."
    );
  });

  it("explains a refused column", () => {
    expect(incompatibleMessage({ columnId: "e", dataType: "email", values: 3, invalid: 3, looksLike: "domain" }, columns)).toBe(
      "“Email” takes Email values, and 3 of 3 pasted into it don't fit. They look like Domain values."
    );
  });

  it("names new columns without clashing", () => {
    expect(freeName("Email", ["email", "Email 2"])).toBe("Email 3");
    expect(columnsForBlock([["a@example.com", "b@example.com", "Ada", "x.com"]], ["Email"])).toEqual([
      { name: "Email 2", dataType: "email" },
      { name: "Email 3", dataType: "email" },
      { name: "Column 3", dataType: "text" },
      { name: "Domain", dataType: "domain" },
    ]);
  });
});
