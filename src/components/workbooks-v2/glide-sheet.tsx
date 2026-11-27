"use client";

/**
 * The Workbooks V2 grid drawn with Glide Data Grid, the library chosen after the WB2-001 spike. Selection, keyboard
 * navigation, cell editing and copy are the library's. Paste is handled by the workbook grid around it, which reads the
 * clipboard itself: the library's own paste asks the browser for clipboard permission and edits cell by cell.
 */
import "@glideapps/glide-data-grid/dist/index.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CompactSelection,
  DataEditor,
  GridCellKind,
  type DataEditorProps,
  type EditableGridCell,
  type GridCell,
  type GridColumn,
  type GridSelection,
  type Item,
  type Rectangle,
  type Theme,
} from "@glideapps/glide-data-grid";
import type { CellView, Rect, SheetProps, SheetSelection } from "./sheet-types";

const ROW_HEIGHT = 44;

export function toGridCell(view: CellView, theme: { invalid: Partial<Theme>; pending: Partial<Theme>; fixed: Partial<Theme> }): GridCell {
  if (view.loading) return { kind: GridCellKind.Loading, allowOverlay: false };
  const themeOverride = view.tone === "invalid" ? theme.invalid : view.tone === "pending" ? theme.pending : view.editable ? undefined : theme.fixed;
  return {
    kind: GridCellKind.Text,
    data: view.text,
    displayData: view.text,
    allowOverlay: view.editable,
    readonly: !view.editable,
    ...(themeOverride ? { themeOverride } : {}),
  };
}

/** The app's colours (HSL triplets in CSS variables), following light and dark. */
function useAppTheme() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const watch = new MutationObserver(() => setVersion((v) => v + 1));
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => watch.disconnect();
  }, []);
  return useMemo(() => {
    void version;
    const style = getComputedStyle(document.documentElement);
    const dark = document.documentElement.classList.contains("dark");
    const hsl = (name: string, fallback: string) => {
      const [h, s, l] = style.getPropertyValue(name).trim().split(/\s+/);
      return l ? `hsl(${h}, ${s}, ${l})` : fallback;
    };
    const text = hsl("--foreground", "#1c1230");
    const muted = hsl("--muted-foreground", "#6b6477");
    const card = hsl("--card", "#ffffff");
    const grid: Partial<Theme> = {
      accentColor: hsl("--primary", "#5b21b6"),
      accentLight: dark ? "rgba(167, 139, 250, 0.2)" : "rgba(91, 33, 182, 0.1)",
      textDark: text,
      textMedium: muted,
      textLight: muted,
      textHeader: text,
      bgCell: card,
      bgCellMedium: hsl("--muted", "#f5f3f8"),
      bgHeader: hsl("--muted", "#f5f3f8"),
      bgHeaderHovered: hsl("--accent", "#efe9fd"),
      bgHeaderHasFocus: hsl("--accent", "#efe9fd"),
      borderColor: hsl("--border", "#e5e2ea"),
      fontFamily: "Work Sans, ui-sans-serif, system-ui, sans-serif",
      baseFontStyle: "12px",
      headerFontStyle: "600 12px",
      editorFontSize: "12px",
    };
    return {
      grid,
      badge: { text: dark ? "#bfdbfe" : "#1d4ed8", fill: dark ? "rgba(59, 130, 246, 0.25)" : "#dbeafe" },
      cells: {
        invalid: { textDark: dark ? "#fcd34d" : "#92400e", bgCell: dark ? "#3f2d10" : "#fef3c7" } satisfies Partial<Theme>,
        pending: { textDark: muted } satisfies Partial<Theme>,
        fixed: { bgCell: hsl("--background", "#fcfbfe") } satisfies Partial<Theme>,
      },
    };
  }, [version]);
}

const rectOf = (r: Rectangle): Rect => ({ x: r.x, y: r.y, width: r.width, height: r.height });
const emptySelection = (): GridSelection => ({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });

export default function GlideSheet({ columns, rows, cell, loadCells, onEdit, onClear, selection, onSelection, onVisibleRows, height }: SheetProps) {
  const theme = useAppTheme();
  const [grid, setGrid] = useState<GridSelection>(emptySelection);
  /** Where Enter on the last row should land once the row it created exists. */
  const moveTo = useRef<Item | null>(null);

  // The cell editor is drawn into this element.
  useEffect(() => {
    if (document.getElementById("portal")) return;
    const portal = document.createElement("div");
    portal.id = "portal";
    portal.style.cssText = "position:fixed;left:0;top:0;z-index:9999";
    document.body.appendChild(portal);
    return () => portal.remove();
  }, []);

  // Another workbook starts with nothing selected.
  useEffect(() => {
    if (selection === null) setGrid(emptySelection());
  }, [selection]);

  const select = useCallback(
    (next: GridSelection) => {
      setGrid(next);
      let chosen: SheetSelection | null = null;
      if (next.current) {
        const { cell: at, range, rangeStack } = next.current;
        chosen = { col: at[0], row: at[1], ranges: [rectOf(range), ...rangeStack.map(rectOf)] };
      }
      onSelection(chosen);
    },
    [onSelection]
  );

  useEffect(() => {
    const target = moveTo.current;
    if (!target || target[1] >= rows) return;
    moveTo.current = null;
    select({ ...emptySelection(), current: { cell: target, range: { x: target[0], y: target[1], width: 1, height: 1 }, rangeStack: [] } });
  }, [rows, select]);

  const gridColumns = useMemo<GridColumn[]>(() => columns.map((c) => ({ id: c.id, title: c.title, width: c.width })), [columns]);
  const getCellContent = useCallback(([col, row]: Item) => toGridCell(cell(col, row), theme.cells), [cell, theme]);
  const getCellsForSelection = useCallback(
    (rect: Rectangle) => async () => (await loadCells(rectOf(rect))).map((line) => line.map((view) => toGridCell({ ...view, loading: false }, theme.cells))),
    [loadCells, theme]
  );
  const drawCell = useCallback<NonNullable<DataEditorProps["drawCell"]>>(
    (args, drawContent) => {
      const view = cell(args.col, args.row);
      if (!view.badge || view.loading) return drawContent();
      const { ctx, rect } = args;
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.width, rect.height);
      ctx.clip();
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.font = `12px ${theme.grid.fontFamily}`;
      ctx.fillStyle = theme.grid.textDark!;
      ctx.fillText(view.text, rect.x + 8, rect.y + 14);
      ctx.font = `500 10px ${theme.grid.fontFamily}`;
      const width = ctx.measureText(view.badge).width;
      ctx.fillStyle = theme.badge.fill;
      ctx.beginPath();
      ctx.roundRect?.(rect.x + 8, rect.y + 24, width + 12, 15, 7);
      ctx.fill();
      ctx.fillStyle = theme.badge.text;
      ctx.fillText(view.badge, rect.x + 14, rect.y + 32);
      ctx.restore();
    },
    [cell, theme]
  );

  return (
    <div style={{ height }} className="w-full overflow-hidden rounded-md border">
      <DataEditor
        columns={gridColumns}
        rows={rows}
        rowHeight={ROW_HEIGHT}
        headerHeight={36}
        getCellContent={getCellContent}
        getCellsForSelection={getCellsForSelection}
        drawCell={drawCell}
        onCellEdited={([col, row]: Item, value: EditableGridCell) => {
          if (value.kind === GridCellKind.Text) onEdit(col, row, value.data);
        }}
        onFinishedEditing={(value, [dx, dy]) => {
          const at = grid.current?.cell;
          if (value && at && dy === 1 && dx === 0 && at[1] === rows - 1) moveTo.current = [at[0], rows];
        }}
        onDelete={(deleted) => {
          if (deleted.current) onClear([rectOf(deleted.current.range), ...deleted.current.rangeStack.map(rectOf)]);
          // Nothing is cleared until the save is queued.
          return false;
        }}
        gridSelection={grid}
        onGridSelectionChange={select}
        onVisibleRegionChanged={(r) => onVisibleRows(r.y, r.y + r.height)}
        keybindings={{ paste: false, search: false }}
        rowMarkers="number"
        rangeSelect="multi-rect"
        columnSelect="none"
        rowSelect="none"
        theme={theme.grid}
        smoothScrollX
        smoothScrollY
        width="100%"
        height="100%"
      />
    </div>
  );
}
