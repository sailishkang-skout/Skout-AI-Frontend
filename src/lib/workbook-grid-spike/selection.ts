/**
 * WB2-001 grid spike: selection, copy and paste logic that does not depend on either grid library, so the
 * TanStack option (which has none built in) can use it and the comparison can say exactly how much code
 * "multi-cell selection and copy/paste" costs when it must be written.
 */
import { cellText, type CellValue } from "./dataset";

export interface CellPos {
  row: number;
  col: number;
}

/** A rectangle of cells, inclusive on every side. */
export interface CellRange {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
}

/** A selection is one or more rectangles (ctrl/cmd-click adds one) with an active cell. */
export interface Selection {
  ranges: CellRange[];
  active: CellPos | null;
}

export const EMPTY_SELECTION: Selection = { ranges: [], active: null };

export function rangeFrom(a: CellPos, b: CellPos): CellRange {
  return { rowStart: Math.min(a.row, b.row), rowEnd: Math.max(a.row, b.row), colStart: Math.min(a.col, b.col), colEnd: Math.max(a.col, b.col) };
}

export function rangeSize(range: CellRange): { rows: number; cols: number; cells: number } {
  const rows = range.rowEnd - range.rowStart + 1;
  const cols = range.colEnd - range.colStart + 1;
  return { rows, cols, cells: rows * cols };
}

export function selectedCellCount(selection: Selection): number {
  return selection.ranges.reduce((total, range) => total + rangeSize(range).cells, 0);
}

export function isSelected(selection: Selection, row: number, col: number): boolean {
  return selection.ranges.some((range) => row >= range.rowStart && row <= range.rowEnd && col >= range.colStart && col <= range.colEnd);
}

/** Select one cell. */
export function selectCell(pos: CellPos): Selection {
  return { ranges: [rangeFrom(pos, pos)], active: pos };
}

/** Shift-click / shift-arrow / drag: extend from the active cell to `to`. */
export function extendSelection(selection: Selection, to: CellPos): Selection {
  const anchor = selection.active ?? to;
  const rest = selection.ranges.slice(0, -1);
  return { ranges: [...rest, rangeFrom(anchor, to)], active: anchor };
}

/** Ctrl/cmd-click: add another cell as its own rectangle. */
export function addCell(selection: Selection, pos: CellPos): Selection {
  return { ranges: [...selection.ranges, rangeFrom(pos, pos)], active: pos };
}

/** Move the active cell with the arrow keys, staying inside the grid; with `extend` it grows the range. */
export function moveActive(selection: Selection, dRow: number, dCol: number, rowCount: number, colCount: number, extend = false): Selection {
  const current = selection.active ?? { row: 0, col: 0 };
  const lastRange = selection.ranges[selection.ranges.length - 1];
  // When extending, the moving corner is the one opposite the anchor.
  const corner = extend && lastRange ? { row: current.row === lastRange.rowStart ? lastRange.rowEnd : lastRange.rowStart, col: current.col === lastRange.colStart ? lastRange.colEnd : lastRange.colStart } : current;
  const next = { row: Math.max(0, Math.min(rowCount - 1, corner.row + dRow)), col: Math.max(0, Math.min(colCount - 1, corner.col + dCol)) };
  return extend ? extendSelection(selection.active ? selection : selectCell(current), next) : selectCell(next);
}

/** Select every cell. */
export function selectAll(rowCount: number, colCount: number): Selection {
  return { ranges: [{ rowStart: 0, rowEnd: rowCount - 1, colStart: 0, colEnd: colCount - 1 }], active: { row: 0, col: 0 } };
}

/** A grid of values as the tab-separated text a spreadsheet puts on the clipboard. */
export function toTsv(values: ReadonlyArray<ReadonlyArray<CellValue | undefined>>): string {
  return values
    .map((row) =>
      row
        .map((value) => {
          const text = cellText(value);
          // A value with a tab, newline or quote is quoted the way spreadsheets do, so it pastes back as one cell.
          return /[\t\n\r"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join("\t")
    )
    .join("\n");
}

/** Clipboard text from a spreadsheet back into rows of cells (handles quoted cells with tabs or newlines). */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i]!;
    if (quoted) {
      if (char === '"' && normalized[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === "\t") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  // A trailing newline (spreadsheets add one) does not make an extra empty row.
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * Where pasted cells land: the block starts at the active cell and is cut to the grid, and only the columns
 * the caller says accept input (PRD GRID-3: paste goes into input columns) receive values.
 */
export function pasteTargets(
  values: string[][],
  origin: CellPos,
  rowCount: number,
  colCount: number,
  isInputColumn: (col: number) => boolean
): { writes: Array<CellPos & { value: string }>; skippedCells: number; clippedRows: number } {
  const writes: Array<CellPos & { value: string }> = [];
  let skippedCells = 0;
  let clippedRows = 0;
  values.forEach((line, dRow) => {
    const row = origin.row + dRow;
    if (row >= rowCount) {
      clippedRows++;
      return;
    }
    line.forEach((value, dCol) => {
      const col = origin.col + dCol;
      if (col >= colCount) return;
      if (!isInputColumn(col)) {
        skippedCells++;
        return;
      }
      writes.push({ row, col, value });
    });
  });
  return { writes, skippedCells, clippedRows };
}
