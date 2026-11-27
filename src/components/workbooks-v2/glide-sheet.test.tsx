import { readFileSync } from "node:fs";
import path from "node:path";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GlideSheet, { toGridCell } from "./glide-sheet";
import type { CellView, SheetProps } from "./sheet-types";

/** What the grid library is told: the keyboard and clipboard behaviour the Workbooks V2 grid relies on. */
const editor = vi.hoisted(() => ({ props: null as unknown as Record<string, any> }));
vi.mock("@glideapps/glide-data-grid/dist/index.css", () => ({}));
vi.mock("@glideapps/glide-data-grid", () => ({
  CompactSelection: { empty: () => ({ length: 0 }) },
  GridCellKind: { Text: "text", Loading: "loading" },
  DataEditor: (props: Record<string, unknown>) => {
    editor.props = props;
    return null;
  },
}));

const view = (over: Partial<CellView> = {}): CellView => ({ text: "a", editable: true, ...over });
const theme = { invalid: { bgCell: "amber" }, pending: { textDark: "grey" }, fixed: { bgCell: "plain" } };

function show(over: Partial<SheetProps> = {}) {
  const props: SheetProps = {
    columns: [{ id: "n", title: "Name", width: 180 }],
    rows: 3,
    cell: (col, row) => view({ text: `${col}:${row}` }),
    loadCells: vi.fn(async () => [[view({ text: "copied" })]]),
    onEdit: vi.fn(),
    onClear: vi.fn(),
    selection: null,
    onSelection: vi.fn(),
    onVisibleRows: vi.fn(),
    height: 300,
    ...over,
  };
  const rendered = render(<GlideSheet {...props} />);
  return { props, grow: (rows: number) => rendered.rerender(<GlideSheet {...props} rows={rows} />), unmount: rendered.unmount };
}
const selected = (col: number, row: number, width = 1, height = 1) => ({
  columns: {},
  rows: {},
  current: { cell: [col, row], range: { x: col, y: row, width, height }, rangeStack: [] },
});

describe("GlideSheet", () => {
  afterEach(() => cleanup());

  it("draws values as text cells, locking those that cannot be edited and tinting flagged and unsaved ones", () => {
    expect(toGridCell(view({ text: "x" }), theme)).toMatchObject({ kind: "text", data: "x", displayData: "x", allowOverlay: true, readonly: false });
    expect(toGridCell(view({ editable: false }), theme)).toMatchObject({ allowOverlay: false, readonly: true, themeOverride: theme.fixed });
    expect(toGridCell(view({ tone: "invalid" }), theme)).toMatchObject({ themeOverride: theme.invalid });
    expect(toGridCell(view({ tone: "pending" }), theme)).toMatchObject({ themeOverride: theme.pending });
    expect(toGridCell(view({ loading: true }), theme)).toMatchObject({ kind: "loading" });
    // What is copied is the value itself, never a label drawn with it.
    expect(toGridCell(view({ text: "a@x.com", badge: "From your Skout data" }), theme)).toMatchObject({ data: "a@x.com", displayData: "a@x.com" });
  });

  it("leaves paste to the workbook grid, and keeps the library's selection, keyboard and copy", async () => {
    const { props } = show();
    expect(editor.props.keybindings).toMatchObject({ paste: false });
    expect(editor.props.keybindings).not.toHaveProperty("copy");
    expect(editor.props.onPaste).toBeUndefined();
    expect(editor.props.rangeSelect).toBe("multi-rect");
    const copied = await editor.props.getCellsForSelection({ x: 0, y: 0, width: 1, height: 1 })();
    expect(copied[0][0]).toMatchObject({ data: "copied" });
    expect(props.loadCells).toHaveBeenCalledWith({ x: 0, y: 0, width: 1, height: 1 });
  });

  it("reports edits, selections and what is on screen", () => {
    const { props } = show();
    act(() => editor.props.onCellEdited([0, 1], { kind: "text", data: "typed" }));
    expect(props.onEdit).toHaveBeenCalledWith(0, 1, "typed");
    act(() => editor.props.onGridSelectionChange(selected(0, 1, 2, 3)));
    expect(props.onSelection).toHaveBeenLastCalledWith({ col: 0, row: 1, ranges: [{ x: 0, y: 1, width: 2, height: 3 }] });
    act(() => editor.props.onVisibleRegionChanged({ x: 0, y: 40, width: 3, height: 20 }));
    expect(props.onVisibleRows).toHaveBeenCalledWith(40, 60);
  });

  it("hands Delete to the workbook grid instead of clearing by itself", () => {
    const { props } = show();
    expect(editor.props.onDelete(selected(0, 0, 2, 2))).toBe(false);
    expect(props.onClear).toHaveBeenCalledWith([{ x: 0, y: 0, width: 2, height: 2 }]);
  });

  it("moves to the new empty row after Enter on the last one", () => {
    const { props, grow } = show();
    act(() => editor.props.onGridSelectionChange(selected(0, 2)));
    act(() => editor.props.onFinishedEditing({ kind: "text" }, [0, 1]));
    grow(4);
    expect(props.onSelection).toHaveBeenLastCalledWith({ col: 0, row: 3, ranges: [{ x: 0, y: 3, width: 1, height: 1 }] });
  });

  it("does not move after Escape, or after Enter higher up", () => {
    const { props, grow } = show();
    act(() => editor.props.onGridSelectionChange(selected(0, 2)));
    act(() => editor.props.onFinishedEditing(undefined, [0, 1]));
    act(() => editor.props.onGridSelectionChange(selected(0, 0)));
    act(() => editor.props.onFinishedEditing({ kind: "text" }, [0, 1]));
    vi.mocked(props.onSelection).mockClear();
    grow(4);
    expect(props.onSelection).not.toHaveBeenCalled();
  });

  it("provides the element the cell editor is drawn into, and removes it afterwards", () => {
    const { unmount } = show();
    expect(document.getElementById("portal")).toBeTruthy();
    unmount();
    expect(document.getElementById("portal")).toBeNull();
  });

  // patches/@glideapps__glide-data-grid: without it, characters typed right after the page opens are lost.
  it("uses the library with its cell editor loaded up front", () => {
    const source = readFileSync(path.join(process.cwd(), "node_modules/@glideapps/glide-data-grid/dist/esm/data-editor/data-editor.js"), "utf8");
    expect(source).toContain('import DataGridOverlayEditor from "../internal/data-grid-overlay-editor/data-grid-overlay-editor.js"');
    expect(source).not.toContain("React.lazy");
  });
});
