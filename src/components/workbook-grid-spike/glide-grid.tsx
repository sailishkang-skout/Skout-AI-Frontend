"use client";

/**
 * WB2-001 grid spike, option 1: Glide Data Grid (canvas). 100,000 rows × 30 columns from the same windowed
 * source as the TanStack option. Experimental; not used by any production page.
 */
import "@glideapps/glide-data-grid/dist/index.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CompactSelection,
  DataEditor,
  GridCellKind,
  type DataEditorRef,
  type EditableGridCell,
  type GridCell,
  type GridColumn,
  type GridSelection,
  type Item,
  type Rectangle,
} from "@glideapps/glide-data-grid";
import { COLUMN_COUNT, ROW_COUNT, buildColumns, cellText } from "@/lib/workbook-grid-spike/dataset";
import { registerHarness } from "@/lib/workbook-grid-spike/harness";
import { PAGE_SIZE, WindowedSource } from "@/lib/workbook-grid-spike/windowed-source";

export interface GlideGridProps {
  columnCount?: number;
  latencyMs?: number;
  height?: number;
  /** Columns held in place on the left while scrolling sideways. */
  freezeColumns?: number;
}

export function GlideGrid({ columnCount = COLUMN_COUNT, latencyMs = 0, height = 640, freezeColumns = 1 }: GlideGridProps) {
  const columnsDef = useMemo(() => buildColumns(columnCount), [columnCount]);
  const [, setTick] = useState(0);
  const ref = useRef<DataEditorRef | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const source = useMemo(() => new WindowedSource({ columns: columnsDef, latencyMs }), [columnsDef, latencyMs]);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [selection, setSelection] = useState<GridSelection>({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });
  const [frozen, setFrozen] = useState(freezeColumns);
  // Edits (typing or pasting) live beside the server rows, the way an unsaved change would.
  const edits = useRef(new Map<string, string>());
  const visible = useRef<Rectangle>({ x: 0, y: 0, width: 0, height: 0 });
  const repaintScheduled = useRef(false);

  // A page landing repaints the grid once per frame, however many pages land together.
  useEffect(() => {
    source.setOnPage((page) => {
      const firstRow = page * PAGE_SIZE;
      const v = visible.current;
      if (firstRow + PAGE_SIZE < v.y || firstRow > v.y + v.height) return;
      if (repaintScheduled.current) return;
      repaintScheduled.current = true;
      requestAnimationFrame(() => {
        repaintScheduled.current = false;
        ref.current?.updateCells(
          Array.from({ length: Math.min(v.height, 120) * columnsDef.length }, (_, i) => ({ cell: [i % columnsDef.length, v.y + Math.floor(i / columnsDef.length)] as Item }))
        );
      });
    });
    return () => source.setOnPage(undefined);
  }, [source, columnsDef.length]);

  const columns: GridColumn[] = useMemo(
    () => columnsDef.map((column) => ({ id: column.id, title: column.title, width: widths[column.id] ?? column.width })),
    [columnsDef, widths]
  );

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const column = columnsDef[col]!;
      const edited = edits.current.get(`${row}:${col}`);
      const value = edited ?? source.cell(row, col);
      if (value === undefined) return { kind: GridCellKind.Loading, allowOverlay: false };
      // Text columns accept input (and paste); the rest are results and read-only, like enrichment columns.
      const editable = column.kind === "text";
      if (column.kind === "number" && edited === undefined)
        return { kind: GridCellKind.Number, data: value as number, displayData: String(value), allowOverlay: editable, readonly: !editable };
      if (column.kind === "bool" && edited === undefined) return { kind: GridCellKind.Boolean, data: value as boolean, allowOverlay: false, readonly: true };
      const text = cellText(value);
      return { kind: GridCellKind.Text, data: text, displayData: text, allowOverlay: editable, readonly: !editable };
    },
    [columnsDef, source]
  );

  const getCellsForSelection = useCallback(
    (rect: Rectangle) => async (): Promise<readonly (readonly GridCell[])[]> => {
      const values = await source.range(rect.y, rect.y + rect.height - 1, rect.x, rect.x + rect.width - 1);
      return values.map((line, dRow) =>
        line.map((value, dCol): GridCell => {
          const edited = edits.current.get(`${rect.y + dRow}:${rect.x + dCol}`);
          const text = edited ?? cellText(value);
          return { kind: GridCellKind.Text, data: text, displayData: text, allowOverlay: false };
        })
      );
    },
    [source]
  );

  const onCellEdited = useCallback((cell: Item, newValue: EditableGridCell) => {
    const [col, row] = cell;
    if (newValue.kind === GridCellKind.Text) edits.current.set(`${row}:${col}`, newValue.data);
    else if (newValue.kind === GridCellKind.Number) edits.current.set(`${row}:${col}`, String(newValue.data ?? ""));
    setTick((n) => n + 1);
  }, []);

  const onVisibleRegionChanged = useCallback(
    (range: Rectangle) => {
      visible.current = range;
      // The visible rows and a screenful either side are requested: only those are ever loaded.
      source.ensure(range.y - 40, range.y + range.height + 40);
    },
    [source]
  );

  useEffect(() => {
    registerHarness({
      kind: "glide",
      mode: "windowed",
      scrollerSelector: ".dvn-scroller",
      scrollToRow: (row) => ref.current?.scrollTo(0, row, "vertical", 0, 0, { vAlign: "start" }),
      firstLoadedVisibleRow: () => {
        const v = visible.current;
        for (let row = v.y; row < Math.min(ROW_COUNT, v.y + v.height); row++) if (source.isLoaded(row)) return row;
        return -1;
      },
      // The grid's visible region can run past the last row at the very end; only real rows count.
      visibleRows: () => {
        const v = visible.current;
        const last = Math.min(ROW_COUNT - 1, v.y + v.height - 1);
        let loaded = 0;
        for (let row = v.y; row <= last; row++) if (source.isLoaded(row)) loaded++;
        return { first: v.y, last, loaded };
      },
      stats: () => ({ ...source.stats() }),
      domNodes: () => containerRef.current?.querySelectorAll("*").length ?? 0,
      selectedCells: () => {
        const range = selection.current?.range;
        const fromRange = range ? range.width * range.height : 0;
        const extra = (selection.current?.rangeStack ?? []).reduce((n, r) => n + r.width * r.height, 0);
        return fromRange + extra;
      },
      frozenColumns: () => frozen,
      columnWidth: (col) => (columnsDef[col] ? widths[columnsDef[col]!.id] ?? columnsDef[col]!.width : 0),
      editedValue: (row, col) => edits.current.get(`${row}:${col}`),
      activeCell: () => {
        const cell = selection.current?.cell;
        return cell ? { row: cell[1], col: cell[0] } : null;
      },
    });
    return () => registerHarness(undefined);
  });

  return (
    <div ref={containerRef} data-testid="glide-grid" className="w-full" style={{ height }}>
      {/* Glide renders its cell editor into an element with this id; without it, inline editing does not open. */}
      <div id="portal" style={{ position: "fixed", left: 0, top: 0, zIndex: 9999 }} />
      <DataEditor
        ref={ref}
        columns={columns}
        rows={ROW_COUNT}
        getCellContent={getCellContent}
        getCellsForSelection={getCellsForSelection}
        onCellEdited={onCellEdited}
        onVisibleRegionChanged={onVisibleRegionChanged}
        onColumnResize={(column, newSize) => setWidths((previous) => ({ ...previous, [column.id ?? column.title]: newSize }))}
        gridSelection={selection}
        onGridSelectionChange={setSelection}
        freezeColumns={frozen}
        rowMarkers="number"
        rangeSelect="multi-rect"
        columnSelect="multi"
        rowSelect="multi"
        onPaste
        smoothScrollX
        smoothScrollY
        width="100%"
        height="100%"
      />
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <label className="flex items-center gap-1">
          Frozen columns
          <input aria-label="Frozen columns" type="number" min={0} max={5} value={frozen} onChange={(event) => setFrozen(Number(event.target.value))} className="w-14 rounded border px-1" />
        </label>
        <span>{columnsDef.length} columns · {ROW_COUNT.toLocaleString()} rows · windows of {PAGE_SIZE}</span>
      </div>
    </div>
  );
}
