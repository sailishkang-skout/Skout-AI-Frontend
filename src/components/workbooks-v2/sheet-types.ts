/** What the grid library is asked to draw and report. Kept apart from it so everything else can be tested without it. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SheetColumn {
  id: string;
  title: string;
  width: number;
}

export interface CellView {
  text: string;
  editable: boolean;
  loading?: boolean;
  /** `invalid`: kept but flagged. `pending`: not saved yet. */
  tone?: "invalid" | "pending";
  /** A label drawn under the value. */
  badge?: string;
}

export interface SheetSelection {
  /** The cell with the cursor. */
  col: number;
  row: number;
  /** Every selected block, the one with the cursor first. */
  ranges: Rect[];
}

export interface SheetProps {
  columns: SheetColumn[];
  rows: number;
  /** A new function whenever what it answers changes. */
  cell: (col: number, row: number) => CellView;
  /** The cells of a block, fetching rows that are not on screen, for copying. */
  loadCells: (rect: Rect) => Promise<CellView[][]>;
  onEdit: (col: number, row: number, text: string) => void;
  onClear: (ranges: Rect[]) => void;
  selection: SheetSelection | null;
  onSelection: (selection: SheetSelection | null) => void;
  onVisibleRows: (first: number, last: number) => void;
  height: number;
}
