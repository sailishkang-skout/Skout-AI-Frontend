import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cellSelectionFeature, columnPinningFeature, createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { cellText, cellValue, generateWindow } from "@/lib/workbook-grid-spike/dataset";
import { toTsv } from "@/lib/workbook-grid-spike/selection";
import { TanstackGrid } from "./tanstack-grid";

// jsdom has no layout: give the scroll container the size a real one has, so the virtualizer can place rows.
beforeAll(() => {
  // TanStack Virtual reads the scroll container's clientWidth/clientHeight.
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 640 });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 1400 });
  Element.prototype.getBoundingClientRect = () => ({ width: 1400, height: 640, top: 0, left: 0, right: 1400, bottom: 640, x: 0, y: 0, toJSON() {} });
  globalThis.ResizeObserver = class {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      this.callback([{ target, contentRect: { width: 1400, height: 640 }, borderBoxSize: [{ inlineSize: 1400, blockSize: 640 }] } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 0)) as unknown as typeof requestAnimationFrame;
});
afterEach(cleanup);

const cell = (row: number, col: number) => document.querySelector(`[data-row="${row}"][data-col="${col}"]`) as HTMLElement;

describe("TanStack grid spike (jsdom: logic and rendering, not scroll performance)", () => {
  it("renders only the rows near the top out of 100,000, with 30 columns, never the whole dataset", async () => {
    render(<TanstackGrid />);
    await waitFor(() => expect(cell(0, 0)?.textContent).toBe(cellText(cellValue(0, 0))));
    expect(screen.getAllByRole("columnheader")).toHaveLength(30);
    expect(screen.getByRole("grid").getAttribute("aria-rowcount")).toBe("100000");
    const rendered = document.querySelectorAll('[role="row"][aria-rowindex]').length;
    expect(rendered).toBeGreaterThan(5);
    expect(rendered).toBeLessThan(80);
    // The window is what the table holds in windowed mode.
    expect(window.__gridSpike?.stats().rowsInTable).toBeLessThan(80);
    expect(window.__gridSpike?.stats().rowsFetched).toBe(200);
  });

  it("shows a placeholder until a slow window arrives, then the real values", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    render(<TanstackGrid latencyMs={80} />);
    await act(async () => {});
    expect(cell(0, 0)?.textContent).toBe("…");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    vi.useRealTimers();
    await waitFor(() => expect(cell(0, 0)?.textContent).toBe(cellText(cellValue(0, 0))));
  });

  it("selects a cell, a shift-click rectangle and a ctrl-click addition, and shows the count", async () => {
    render(<TanstackGrid />);
    await waitFor(() => expect(cell(2, 2)).toBeTruthy());
    fireEvent.mouseDown(cell(2, 2));
    expect(screen.getByTestId("selected-count").textContent).toBe("1 cells selected");
    fireEvent.mouseDown(cell(4, 4), { shiftKey: true });
    fireEvent.mouseUp(screen.getByRole("grid"));
    expect(screen.getByTestId("selected-count").textContent).toBe("9 cells selected");
    fireEvent.mouseDown(cell(8, 0), { ctrlKey: true });
    expect(screen.getByTestId("selected-count").textContent).toBe("10 cells selected");
    expect(cell(3, 3).getAttribute("aria-selected")).toBe("true");
    expect(cell(6, 3).getAttribute("aria-selected")).toBe("false");
  });

  it("drags to select a block", async () => {
    render(<TanstackGrid />);
    await waitFor(() => expect(cell(1, 1)).toBeTruthy());
    fireEvent.mouseDown(cell(1, 1));
    fireEvent.mouseEnter(cell(3, 3));
    fireEvent.mouseUp(screen.getByRole("grid"));
    expect(screen.getByTestId("selected-count").textContent).toBe("9 cells selected");
  });

  it("moves and extends with the keyboard, and selects all with ctrl+A", async () => {
    render(<TanstackGrid />);
    await waitFor(() => expect(cell(0, 1)).toBeTruthy());
    const grid = screen.getByRole("grid");
    fireEvent.mouseDown(cell(0, 1));
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    fireEvent.keyDown(grid, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(grid, { key: "ArrowRight", shiftKey: true });
    expect(screen.getByTestId("selected-count").textContent).toBe("3 cells selected");
    fireEvent.keyDown(grid, { key: "a", ctrlKey: true });
    expect(screen.getByTestId("selected-count").textContent).toBe("3,000,000 cells selected");
  });

  it("copies the selected block as tab-separated text that matches the data", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<TanstackGrid />);
    await waitFor(() => expect(cell(1, 0)).toBeTruthy());
    fireEvent.mouseDown(cell(1, 0));
    fireEvent.mouseDown(cell(3, 2), { shiftKey: true });
    fireEvent.keyDown(screen.getByRole("grid"), { key: "c", metaKey: true });
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0]![0]).toBe(toTsv(generateWindow(1, 3).map((row) => row.slice(0, 3))));
    await waitFor(() => expect(screen.getByTestId("grid-notice").textContent).toBe("Copied 3 × 3 cells"));
  });

  it("pastes into text (input) columns only, from the active cell", async () => {
    render(<TanstackGrid />);
    await waitFor(() => expect(cell(0, 0)).toBeTruthy());
    fireEvent.mouseDown(cell(0, 0));
    fireEvent.paste(screen.getByRole("grid"), { clipboardData: { getData: () => "Ada\tAcme\tx\t77\nBo\tGlobex\ty\t88" } });
    await waitFor(() => expect(window.__gridSpike?.editedValue(0, 0)).toBe("Ada"));
    expect(window.__gridSpike?.editedValue(1, 1)).toBe("Globex");
    // Column 3 is a number (a result column): it is not written.
    expect(window.__gridSpike?.editedValue(0, 3)).toBeUndefined();
    expect(screen.getByTestId("grid-notice").textContent).toMatch(/Pasted 6 cells, 2 skipped \(not input columns\)/);
    await waitFor(() => expect(cell(0, 0).textContent).toBe("Ada"));
  });

  it("starts with one frozen (pinned) column and can resize a column", async () => {
    render(<TanstackGrid />);
    await waitFor(() => expect(cell(0, 0)).toBeTruthy());
    expect(window.__gridSpike?.frozenColumns()).toBe(1);
    expect(window.__gridSpike?.columnWidth(1)).toBe(150);
    expect(screen.getAllByRole("columnheader")[0]!.className).toContain("sticky");
    const handle = screen.getByTestId("resize-c1");
    fireEvent.mouseDown(handle, { clientX: 400, button: 0 });
    fireEvent.mouseMove(document, { clientX: 460 });
    fireEvent.mouseUp(document, { clientX: 460 });
    await waitFor(() => expect(window.__gridSpike?.columnWidth(1)).toBeGreaterThan(150));
  });

  it("full mode hands the table every row, and says what that cost", async () => {
    render(<TanstackGrid mode="full" />);
    await waitFor(() => expect(cell(0, 0)).toBeTruthy());
    const stats = window.__gridSpike!.stats();
    expect(stats.rowsInTable).toBe(100_000);
    expect(stats.fullBuildMs).toBeGreaterThan(0);
    expect(document.querySelectorAll('[role="row"][aria-rowindex]').length).toBeLessThan(80);
  });
});

describe("TanStack Table v9 built-in cell selection with only a window of rows in the table", () => {
  const features = tableFeatures({ cellSelectionFeature, columnPinningFeature });
  const helper = createColumnHelper<typeof features, { index: number; v: number }>();
  const columns = helper.columns([helper.accessor("v", { id: "c0" }), helper.accessor((row) => row.index, { id: "c1" })]);
  const rowsOf = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ index: from + i, v: i }));

  it("selects a range whose corners are both in the table", () => {
    const data = rowsOf(0, 99);
    const { result } = renderHook(() => useTable({ features, columns, data, getRowId: (row) => String(row.index) }));
    act(() => result.current.selectCellRange({ anchorRowId: "10", anchorColumnId: "c0", focusRowId: "19", focusColumnId: "c1" }));
    expect(result.current.getSelectedCellCount()).toBe(20);
  });

  it("selects nothing when a corner is a row that is not in the table (the table holds only the window), so shift-click across a far scroll cannot use it", () => {
    const data = rowsOf(0, 99);
    const { result } = renderHook(() => useTable({ features, columns, data, getRowId: (row) => String(row.index) }));
    act(() => result.current.selectCellRange({ anchorRowId: "10", anchorColumnId: "c0", focusRowId: "50000", focusColumnId: "c1" }));
    expect(result.current.getSelectedCellCount()).toBe(0);
  });

  it("resets the selection when the data window changes (autoResetCellSelection defaults to true)", () => {
    let data = rowsOf(0, 99);
    const { result, rerender } = renderHook(() => useTable({ features, columns, data, getRowId: (row) => String(row.index) }));
    act(() => result.current.selectCellRange({ anchorRowId: "10", anchorColumnId: "c0", focusRowId: "12", focusColumnId: "c1" }));
    expect(result.current.getSelectedCellCount()).toBe(6);
    data = rowsOf(1, 100);
    rerender();
    return waitFor(() => expect(result.current.getSelectedCellCount()).toBe(0));
  });

  it("offers no clipboard support: it returns the selected values and leaves the text to the app", () => {
    const data = rowsOf(0, 9);
    const { result } = renderHook(() => useTable({ features, columns, data, getRowId: (row) => String(row.index) }));
    act(() => result.current.selectCellRange({ anchorRowId: "1", anchorColumnId: "c0", focusRowId: "2", focusColumnId: "c1" }));
    expect(result.current.getSelectedCellRangesData()).toEqual([[[1, 1], [2, 2]]]);
    expect(within(document.body).queryByText(/copy/i)).toBeNull();
  });
});
