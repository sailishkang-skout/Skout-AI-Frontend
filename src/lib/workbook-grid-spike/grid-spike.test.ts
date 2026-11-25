import { describe, expect, it, vi } from "vitest";
import { COLUMN_COUNT, MAX_COLUMN_COUNT, ROW_COUNT, buildColumns, cellText, cellValue, generateWindow } from "./dataset";
import { oracleTsv, summarizeFrames } from "./harness";
import { addCell, extendSelection, isSelected, moveActive, parseTsv, pasteTargets, rangeFrom, selectAll, selectCell, selectedCellCount, toTsv } from "./selection";
import { PAGE_SIZE, WindowedSource } from "./windowed-source";

describe("sample dataset", () => {
  it("is 100,000 rows × 30 columns, up to the PRD's 50", () => {
    expect([ROW_COUNT, COLUMN_COUNT, MAX_COLUMN_COUNT]).toEqual([100_000, 30, 50]);
    expect(buildColumns()).toHaveLength(30);
    expect(buildColumns(80)).toHaveLength(50);
  });

  it("gives the same value for the same cell every time, so both grids show identical data", () => {
    const columns = buildColumns();
    expect(generateWindow(1234, 5, columns)).toEqual(generateWindow(1234, 5, columns));
    expect(cellValue(99_999, 29)).toEqual(generateWindow(99_999, 1, columns)[0]![29]);
    expect(generateWindow(99_998, 10, columns)).toHaveLength(2);
    expect(generateWindow(-2, 5, columns)).toHaveLength(3);
    expect(generateWindow(-5, 3, columns)).toHaveLength(0);
  });

  it("has a mix of text, number, status and yes/no columns", () => {
    expect(new Set(buildColumns().map((column) => column.kind))).toEqual(new Set(["text", "number", "status", "bool"]));
    expect(cellText(true)).toBe("Yes");
    expect(cellText(false)).toBe("No");
    expect(cellText(undefined)).toBe("");
  });
});

describe("windowed source (stand-in for the server rows API)", () => {
  it("loads only the page asked for, and never the whole dataset", async () => {
    const source = new WindowedSource();
    expect(source.cell(10, 0)).toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();
    expect(source.cell(10, 0)).toBe(cellValue(10, 0));
    expect(source.stats()).toMatchObject({ requests: 1, rowsFetched: PAGE_SIZE, pagesResident: 1, rowCount: ROW_COUNT });
  });

  it("keeps a bounded number of pages and drops the least recently used", async () => {
    const source = new WindowedSource({ maxPages: 3 });
    for (let page = 0; page < 6; page++) await source.range(page * PAGE_SIZE, page * PAGE_SIZE, 0, 0);
    expect(source.stats()).toMatchObject({ pagesResident: 3, evictions: 3, requests: 6 });
    expect(source.isLoaded(0)).toBe(false);
    expect(source.isLoaded(5 * PAGE_SIZE)).toBe(true);
  });

  it("returns a range wider than its cache complete and in order (select all, then copy)", async () => {
    const source = new WindowedSource({ maxPages: 2 });
    const rows = await source.range(190, 610, 0, 2);
    expect(rows).toHaveLength(421);
    expect(rows[0]).toEqual(generateWindow(190, 1)[0]!.slice(0, 3));
    expect(rows[420]).toEqual(generateWindow(610, 1)[0]!.slice(0, 3));
    expect(rows.every((row) => row.length === 3)).toBe(true);
  });

  it("does not request a page twice while it is on its way, and simulates a slow server", async () => {
    vi.useFakeTimers();
    const landed: number[] = [];
    const source = new WindowedSource({ latencyMs: 80, onPage: (page) => landed.push(page) });
    source.ensure(0, 150);
    source.ensure(0, 150);
    source.cell(5, 1);
    expect(source.stats().requests).toBe(1);
    expect(source.isLoaded(5)).toBe(false);
    await vi.advanceTimersByTimeAsync(80);
    expect(landed).toEqual([0]);
    expect(source.isLoaded(5)).toBe(true);
    vi.useRealTimers();
  });

  it("ignores rows outside the dataset", () => {
    const source = new WindowedSource();
    expect(source.cell(-1, 0)).toBeUndefined();
    expect(source.cell(ROW_COUNT, 0)).toBeUndefined();
    expect(source.stats().requests).toBe(0);
  });
});

describe("selection, copy and paste logic (what TanStack needs written; Glide has it built in)", () => {
  it("selects a cell, extends it to a rectangle, and adds another rectangle", () => {
    let selection = selectCell({ row: 2, col: 3 });
    expect(selectedCellCount(selection)).toBe(1);
    selection = extendSelection(selection, { row: 5, col: 4 });
    expect(selection.ranges[0]).toEqual({ rowStart: 2, rowEnd: 5, colStart: 3, colEnd: 4 });
    expect(selectedCellCount(selection)).toBe(8);
    selection = addCell(selection, { row: 50_000, col: 0 });
    expect(selectedCellCount(selection)).toBe(9);
    expect(isSelected(selection, 50_000, 0)).toBe(true);
    expect(isSelected(selection, 50_001, 0)).toBe(false);
    // Extending after an add moves only the newest rectangle.
    selection = extendSelection(selection, { row: 50_002, col: 1 });
    expect(selection.ranges).toHaveLength(2);
    expect(selection.ranges[0]).toEqual({ rowStart: 2, rowEnd: 5, colStart: 3, colEnd: 4 });
  });

  it("moves with the arrow keys, stays inside the grid, and extends with shift", () => {
    let selection = selectCell({ row: 0, col: 0 });
    expect(moveActive(selection, -1, -1, 100, 30).active).toEqual({ row: 0, col: 0 });
    selection = moveActive(selection, 2, 1, 100, 30);
    expect(selection.active).toEqual({ row: 2, col: 1 });
    const grown = moveActive(moveActive(selection, 0, 1, 100, 30, true), 0, 1, 100, 30, true);
    expect(grown.ranges[0]).toEqual({ rowStart: 2, rowEnd: 2, colStart: 1, colEnd: 3 });
    expect(moveActive(selectCell({ row: 99, col: 29 }), 1, 1, 100, 30).active).toEqual({ row: 99, col: 29 });
  });

  it("selects everything as one rectangle without enumerating 3 million cells", () => {
    const all = selectAll(ROW_COUNT, COLUMN_COUNT);
    expect(selectedCellCount(all)).toBe(3_000_000);
    expect(isSelected(all, 99_999, 29)).toBe(true);
  });

  it("writes a range as tab-separated text, and reads it back, including quoted cells", () => {
    const text = toTsv([["a", 1, true], ["x\ty", 'say "hi"', "line\nbreak"]]);
    expect(text).toBe('a\t1\tYes\n"x\ty"\t"say ""hi"""\t"line\nbreak"');
    expect(parseTsv(text)).toEqual([["a", "1", "Yes"], ["x\ty", 'say "hi"', "line\nbreak"]]);
    expect(parseTsv("a\tb\n")).toEqual([["a", "b"]]);
    expect(parseTsv("a\r\nb\r\n")).toEqual([["a"], ["b"]]);
    expect(parseTsv("")).toEqual([]);
  });

  it("pastes from the active cell, only into input columns, and cuts at the end of the grid", () => {
    const result = pasteTargets([["a", "b", "c"], ["d", "e", "f"], ["g", "h", "i"]], { row: 98, col: 0 }, 100, 5, (col) => col === 0 || col === 2);
    expect(result.writes).toEqual([
      { row: 98, col: 0, value: "a" },
      { row: 98, col: 2, value: "c" },
      { row: 99, col: 0, value: "d" },
      { row: 99, col: 2, value: "f" },
    ]);
    expect(result.skippedCells).toBe(2);
    expect(result.clippedRows).toBe(1);
    expect(pasteTargets([["x", "y"]], { row: 0, col: 4 }, 10, 5, () => true).writes).toEqual([{ row: 0, col: 4, value: "x" }]);
  });

  it("builds ranges from any two corners", () => {
    expect(rangeFrom({ row: 5, col: 4 }, { row: 2, col: 9 })).toEqual({ rowStart: 2, rowEnd: 5, colStart: 4, colEnd: 9 });
  });
});

describe("benchmark helpers", () => {
  it("summarises frame times", () => {
    const report = summarizeFrames([16, 16, 17, 16, 40, 16, 16, 16, 16, 100], 1000);
    expect(report).toMatchObject({ frames: 10, durationMs: 1000, avgFps: 10, max: 100, longFrames: 2 });
    expect(report.p50).toBe(16);
    expect(summarizeFrames([], 0)).toMatchObject({ frames: 0, avgFps: 0, max: 0 });
  });

  it("works out what a copy should contain straight from the data", () => {
    expect(oracleTsv(0, 1, 0, 1, 30)).toBe(toTsv(generateWindow(0, 2).map((row) => row.slice(0, 2))));
    expect(oracleTsv(99_999, 99_999, 29, 29, 30)).toBe(cellText(cellValue(99_999, 29)));
  });
});
