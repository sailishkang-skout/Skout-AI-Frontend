"use client";

/**
 * WB2-001 grid spike, option 2: TanStack Table (v9) + TanStack Virtual. The same 100,000 × 30 dataset and
 * the same windowed source as the Glide option. TanStack is headless, so everything the grid needs that is
 * not rows, sizing and pinning (selection, copy, paste, keyboard, painting) is written here, in the open.
 * Experimental; not used by any production page.
 *
 * Two data modes, to measure what "the whole dataset in the table" costs:
 *   windowed: the table is given only the rows near the viewport, fetched in pages of 200 (server-windowed).
 *   full:     the table is given all 100,000 rows at once (client-side), only the visible ones become DOM.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { columnPinningFeature, columnResizingFeature, columnSizingFeature, createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { COLUMN_COUNT, ROW_COUNT, buildColumns, cellText, generateWindow, type CellValue } from "@/lib/workbook-grid-spike/dataset";
import { registerHarness } from "@/lib/workbook-grid-spike/harness";
import {
  EMPTY_SELECTION,
  addCell,
  extendSelection,
  isSelected,
  moveActive,
  parseTsv,
  pasteTargets,
  selectAll,
  selectCell,
  selectedCellCount,
  toTsv,
  type Selection,
} from "@/lib/workbook-grid-spike/selection";
import { PAGE_SIZE, WindowedSource } from "@/lib/workbook-grid-spike/windowed-source";

export type TanstackMode = "windowed" | "full";

export interface TanstackGridProps {
  columnCount?: number;
  latencyMs?: number;
  height?: number;
  mode?: TanstackMode;
  freezeColumns?: number;
}

const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 36;
const MARKER_WIDTH = 64;

interface SpikeRow {
  index: number;
  /** undefined while the row's page has not arrived (windowed mode). */
  values: CellValue[] | undefined;
}

// Features, columns and fallback data are module-level: the table recomputes its models when they change.
const features = tableFeatures({ columnSizingFeature, columnResizingFeature, columnPinningFeature });
const helper = createColumnHelper<typeof features, SpikeRow>();

export function TanstackGrid({ columnCount = COLUMN_COUNT, latencyMs = 0, height = 640, mode = "windowed", freezeColumns = 1 }: TanstackGridProps) {
  const columnsDef = useMemo(() => buildColumns(columnCount), [columnCount]);
  const source = useMemo(() => new WindowedSource({ columns: columnsDef, latencyMs }), [columnsDef, latencyMs]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [version, setVersion] = useState(0);
  const repaint = useRef(false);
  const edits = useRef(new Map<string, string>());
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const dragging = useRef(false);
  const [notice, setNotice] = useState("");

  // Full mode: every row is built up front, and that cost is recorded.
  const full = useMemo(() => {
    if (mode !== "full") return null;
    const started = performance.now();
    const rows: SpikeRow[] = generateWindow(0, ROW_COUNT, columnsDef).map((values, index) => ({ index, values }));
    return { rows, buildMs: Math.round(performance.now() - started) };
  }, [mode, columnsDef]);

  useEffect(() => {
    source.setOnPage(() => {
      if (repaint.current) return;
      repaint.current = true;
      requestAnimationFrame(() => {
        repaint.current = false;
        setVersion((n) => n + 1);
      });
    });
    return () => source.setOnPage(undefined);
  }, [source]);

  const virtualizer = useVirtualizer({
    count: ROW_COUNT,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });
  const items = virtualizer.getVirtualItems();
  const firstIndex = items[0]?.index ?? 0;
  const lastIndex = items[items.length - 1]?.index ?? 0;

  // Windowed mode: ask for the pages around what is on screen, and give the table just those rows.
  useEffect(() => {
    if (mode === "windowed") source.ensure(firstIndex - 40, lastIndex + 40);
  }, [mode, source, firstIndex, lastIndex]);

  const data = useMemo<SpikeRow[]>(() => {
    if (full) return full.rows;
    const rows: SpikeRow[] = [];
    for (let index = firstIndex; index <= lastIndex; index++) rows.push({ index, values: source.cell(index, 0) === undefined ? undefined : generateRowFromSource(source, index, columnsDef.length) });
    return rows;
    // `version` changes when a page lands, so the rows are rebuilt with the new values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, source, firstIndex, lastIndex, version, columnsDef.length]);

  const columns = useMemo(
    () =>
      helper.columns(
        columnsDef.map((column, col) => helper.accessor((row: SpikeRow) => row.values?.[col] as CellValue, { id: column.id, header: column.title, size: column.width, minSize: 60 }))
      ),
    [columnsDef]
  );

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => String(row.index),
    columnResizeMode: "onChange",
    initialState: { columnPinning: { start: columnsDef.slice(0, freezeColumns).map((column) => column.id), end: [] } },
  });

  const rowModel = table.getRowModel().rows;
  const rowAt = (index: number) => (full ? rowModel[index] : rowModel[index - firstIndex]);
  const leafColumns = table.getAllLeafColumns();
  const totalWidth = MARKER_WIDTH + leafColumns.reduce((sum, column) => sum + column.getSize(), 0);

  // ---- editing, copy and paste -------------------------------------------------------------------
  const isInputColumn = useCallback((col: number) => columnsDef[col]?.kind === "text", [columnsDef]);
  const valueAt = useCallback((row: number, col: number): CellValue | undefined => edits.current.get(`${row}:${col}`) ?? (full ? full.rows[row]?.values?.[col] : source.cell(row, col)), [full, source]);

  const copySelection = useCallback(async () => {
    const range = selection.ranges[0];
    if (!range) return;
    const values = full
      ? full.rows.slice(range.rowStart, range.rowEnd + 1).map((row) => row.values!.slice(range.colStart, range.colEnd + 1))
      : await source.range(range.rowStart, range.rowEnd, range.colStart, range.colEnd);
    const withEdits = values.map((line, dRow) => line.map((value, dCol) => edits.current.get(`${range.rowStart + dRow}:${range.colStart + dCol}`) ?? value));
    const text = toTsv(withEdits);
    await navigator.clipboard.writeText(text);
    setNotice(`Copied ${withEdits.length} × ${withEdits[0]?.length ?? 0} cells`);
  }, [selection, full, source]);

  const paste = useCallback(
    (text: string) => {
      const origin = selection.active;
      if (!origin) return;
      const { writes, skippedCells, clippedRows } = pasteTargets(parseTsv(text), origin, ROW_COUNT, columnsDef.length, isInputColumn);
      for (const write of writes) edits.current.set(`${write.row}:${write.col}`, write.value);
      setVersion((n) => n + 1);
      setNotice(`Pasted ${writes.length} cells${skippedCells ? `, ${skippedCells} skipped (not input columns)` : ""}${clippedRows ? `, ${clippedRows} rows past the end ignored` : ""}`);
    },
    [selection.active, columnsDef.length, isInputColumn]
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    const meta = event.metaKey || event.ctrlKey;
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[event.key]) {
      event.preventDefault();
      const [dRow, dCol] = arrows[event.key]!;
      const next = moveActive(selection, dRow, dCol, ROW_COUNT, columnsDef.length, event.shiftKey);
      setSelection(next);
      const target = next.ranges[next.ranges.length - 1];
      if (target) virtualizer.scrollToIndex(event.shiftKey ? (dRow < 0 ? target.rowStart : target.rowEnd) : target.rowStart, { align: "auto" });
    } else if (meta && event.key.toLowerCase() === "a") {
      event.preventDefault();
      setSelection(selectAll(ROW_COUNT, columnsDef.length));
    } else if (meta && event.key.toLowerCase() === "c") {
      event.preventDefault();
      void copySelection();
    }
  };

  const onPasteEvent = (event: React.ClipboardEvent) => {
    event.preventDefault();
    paste(event.clipboardData.getData("text/plain"));
  };

  // ---- harness for the benchmark -----------------------------------------------------------------
  useEffect(() => {
    registerHarness({
      kind: "tanstack",
      mode,
      scrollerSelector: '[data-testid="tanstack-scroller"]',
      scrollToRow: (row) => virtualizer.scrollToIndex(row, { align: "start" }),
      firstLoadedVisibleRow: () => {
        const range = virtualizer.range;
        for (let row = range?.startIndex ?? 0; row <= (range?.endIndex ?? 0); row++) if (full || source.isLoaded(row)) return row;
        return -1;
      },
      // The rows actually on screen (the virtualizer also renders a few extra above and below).
      visibleRows: () => {
        const range = virtualizer.range;
        const first = range?.startIndex ?? 0;
        const last = range?.endIndex ?? 0;
        let loaded = 0;
        for (let row = first; row <= last; row++) if (full || source.isLoaded(row)) loaded++;
        return { first, last, loaded };
      },
      stats: () => ({ ...source.stats(), ...(full ? { fullBuildMs: full.buildMs, rowsInTable: full.rows.length } : { rowsInTable: data.length }) }),
      domNodes: () => scrollRef.current?.querySelectorAll("*").length ?? 0,
      selectedCells: () => selectedCellCount(selection),
      frozenColumns: () => table.store.state.columnPinning.start.length,
      columnWidth: (col) => leafColumns[col]?.getSize() ?? 0,
      editedValue: (row, col) => edits.current.get(`${row}:${col}`),
      activeCell: () => selection.active,
    });
    return () => registerHarness(undefined);
  });

  return (
    <div data-testid="tanstack-grid" className="w-full">
      <div
        ref={scrollRef}
        data-testid="tanstack-scroller"
        role="grid"
        aria-rowcount={ROW_COUNT}
        aria-colcount={columnsDef.length}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPaste={onPasteEvent}
        onMouseUp={() => (dragging.current = false)}
        className="relative overflow-auto rounded-md border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40"
        style={{ height }}
      >
        <div style={{ width: totalWidth, height: virtualizer.getTotalSize() + HEADER_HEIGHT, position: "relative" }}>
          <div role="row" className="sticky top-0 z-20 flex border-b bg-muted/80 backdrop-blur" style={{ height: HEADER_HEIGHT, width: totalWidth }}>
            <div className="sticky left-0 z-30 shrink-0 border-r bg-muted px-2 py-2 text-xs text-muted-foreground" style={{ width: MARKER_WIDTH }} />
            {leafColumns.map((column) => {
              const pinned = column.getIsPinned() === "start";
              return (
                <div
                  key={column.id}
                  role="columnheader"
                  className={`relative shrink-0 truncate border-r px-2 py-2 text-xs font-medium ${pinned ? "sticky z-30 bg-muted" : ""}`}
                  style={{ width: column.getSize(), ...(pinned ? { left: MARKER_WIDTH + column.getStart("start") } : {}) }}
                >
                  {typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}
                  <div
                    data-testid={`resize-${column.id}`}
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      const header = table.getHeaderGroups()[0]!.headers.find((h) => h.column.id === column.id);
                      header?.getResizeHandler()(event);
                    }}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-primary/50"
                  />
                </div>
              );
            })}
          </div>

          {items.map((item) => {
            const row = rowAt(item.index);
            return (
              <div
                key={item.key}
                role="row"
                aria-rowindex={item.index + 1}
                className="absolute left-0 flex border-b"
                style={{ top: HEADER_HEIGHT + item.start, height: ROW_HEIGHT, width: totalWidth }}
              >
                <div className="sticky left-0 z-10 shrink-0 border-r bg-muted/60 px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground" style={{ width: MARKER_WIDTH }}>
                  {item.index + 1}
                </div>
                {leafColumns.map((column, col) => {
                  const pinned = column.getIsPinned() === "start";
                  const raw = row?.original.values ? valueAt(item.index, col) : undefined;
                  const selected = isSelected(selection, item.index, col);
                  return (
                    <div
                      key={column.id}
                      role="gridcell"
                      aria-selected={selected}
                      data-row={item.index}
                      data-col={col}
                      className={`shrink-0 truncate border-r px-2 py-1.5 ${selected ? "bg-primary/15 outline outline-1 -outline-offset-1 outline-primary/50" : ""} ${pinned ? "sticky z-10 bg-background" : ""} ${raw === undefined ? "text-muted-foreground" : ""}`}
                      style={{ width: column.getSize(), ...(pinned ? { left: MARKER_WIDTH + column.getStart("start") } : {}) }}
                      onMouseDown={(event) => {
                        scrollRef.current?.focus();
                        dragging.current = true;
                        const pos = { row: item.index, col };
                        setSelection((previous) => (event.shiftKey ? extendSelection(previous, pos) : event.metaKey || event.ctrlKey ? addCell(previous, pos) : selectCell(pos)));
                      }}
                      onMouseEnter={() => {
                        if (dragging.current) setSelection((previous) => extendSelection(previous, { row: item.index, col }));
                      }}
                    >
                      {raw === undefined ? "…" : cellText(raw)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground" aria-live="polite">
        <span>
          {columnsDef.length} columns · {ROW_COUNT.toLocaleString()} rows · mode {mode}
          {mode === "windowed" ? ` · windows of ${PAGE_SIZE}` : ""}
        </span>
        <span data-testid="selected-count">{selectedCellCount(selection).toLocaleString()} cells selected</span>
        {notice && <span data-testid="grid-notice">{notice}</span>}
      </div>
    </div>
  );
}

function generateRowFromSource(source: WindowedSource, row: number, columns: number): CellValue[] {
  const values: CellValue[] = [];
  for (let col = 0; col < columns; col++) values.push(source.cell(row, col) as CellValue);
  return values;
}
