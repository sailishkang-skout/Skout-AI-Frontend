import { detectType } from "./workbooks-v2-clipboard";
import { dataTypeLabel, type DataType, type WorkbookColumn } from "./workbooks-v2-import";
import type { PasteResult, WorkbookCell, WorkbookRow } from "./workbooks-v2-rows";

/** What the Workbooks V2 grid shows, and how a paste is laid onto it (WB2-022). */
export const MAX_PASTE_ROWS = 10_000;
export const MAX_PASTE_CELLS = 100_000;
export const MAX_COPY_ROWS = 10_000;
export const SOURCE_COLUMN = "__source";
export const FROM_SKOUT = "From your Skout data";

const n = (value: number) => value.toLocaleString("en-US");
const plural = (count: number, word: string) => `${n(count)} ${word}${count === 1 ? "" : "s"}`;

export const VERIFICATION: Record<string, string> = { valid: "Verified", catch_all: "Catch-all", risky: "Risky", unknown: "Unknown", unverified: "Not verified" };

export function sourceLabel(source: WorkbookRow["source"]): string {
  const named = (kind: string, name: unknown) => (typeof name === "string" && name ? `${kind}: ${name}` : kind);
  if (source.type === "csv") return named("CSV", source.fileName);
  if (source.type === "list") return named("List", source.listName);
  if (source.type === "smart_list") return named("Smart list", source.smartListName);
  if (source.type === "search") return "Search";
  if (source.type === "paste") return "Pasted";
  if (source.type === "manual") return "Added by hand";
  return source.type;
}

export function cellText(value: WorkbookCell["value"] | undefined): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value === null || value === undefined ? "" : String(value);
}

/** Why a flagged cell is flagged. */
export function cellProblem(cell: WorkbookCell | undefined, column: WorkbookColumn | undefined): string | null {
  if (cell?.state !== "error") return null;
  const type = column?.config.dataType;
  return column?.type === "input" && type ? `Doesn't fit this ${dataTypeLabel(type)} column. Kept as entered.` : "This cell has an error.";
}

export interface GridColumnInfo {
  /** `SOURCE_COLUMN` for the read-only column saying where a row came from. */
  id: string;
  name: string;
  editable: boolean;
  dataType: DataType | null;
  width: number;
}

/** The columns the grid shows: the workbook's own, less hidden ones, and where each row came from. */
export function gridColumns(columns: WorkbookColumn[]): GridColumnInfo[] {
  const shown = columns
    .filter((c) => !c.hidden)
    .map((c) => ({
      id: c.id,
      name: c.name,
      editable: c.type === "input",
      dataType: c.type === "input" ? (c.config.dataType ?? "text") : null,
      width: typeof (c as { width?: unknown }).width === "number" ? (c as unknown as { width: number }).width : 180,
    }));
  return shown.length ? [...shown, { id: SOURCE_COLUMN, name: "Source", editable: false, dataType: null, width: 170 }] : [];
}

export interface PastePlan {
  columnIds: string[];
  values: string[][];
  /** The grid row the top of the block lands on, and how many rows already there it covers. */
  row: number;
  overlap: number;
  /** Values that fell to the right of the last column. */
  outside: number;
}

export type PlanOutcome =
  | { kind: "paste"; plan: PastePlan }
  /** A list aimed at a column nobody can type in: ask where it should go. */
  | { kind: "choose"; values: string[][] }
  | { kind: "refused"; message: string };

export function tooLarge(block: string[][]): string | null {
  const cells = block.length * (block[0]?.length ?? 0);
  return block.length > MAX_PASTE_ROWS || cells > MAX_PASTE_CELLS
    ? `Paste at most ${n(MAX_PASTE_ROWS)} rows or ${n(MAX_PASTE_CELLS)} cells at a time. This is ${plural(block.length, "row")} and ${plural(cells, "cell")}; use CSV import for larger data.`
    : null;
}

export function tooLargeToClear(rows: number, columns: number): string | null {
  return rows > MAX_PASTE_ROWS || rows * columns > MAX_PASTE_CELLS
    ? `Clear at most ${n(MAX_PASTE_ROWS)} rows or ${n(MAX_PASTE_CELLS)} cells at a time. Select fewer cells.`
    : null;
}

/** Lays a block over the grid from one cell. `rows` is how many rows the grid holds, not counting the empty one. */
export function planPaste(block: string[][], columns: GridColumnInfo[], anchor: { col: number; row: number }, rows: number): PlanOutcome {
  const big = tooLarge(block);
  if (big) return { kind: "refused", message: big };
  const width = block[0]!.length;
  const under = columns.slice(anchor.col, anchor.col + width).filter((c) => c.id !== SOURCE_COLUMN);
  if (!under.some((c) => c.editable)) {
    if (width === 1) return { kind: "choose", values: block };
    return { kind: "refused", message: "None of the columns under this paste can be edited. Select a cell in an input column and paste again." };
  }
  const values = block.map((line) => line.slice(0, under.length));
  const outside = block.reduce((count, line) => count + line.slice(under.length).filter((v) => v.trim()).length, 0);
  const row = Math.min(anchor.row, rows);
  return { kind: "paste", plan: { columnIds: under.map((c) => c.id), values, row, overlap: Math.min(rows - row, values.length), outside } };
}

/** What a paste did, in a sentence or two. `warning` when anything was left out or flagged. */
export function pasteSummary(result: PasteResult, outside: number, columns: GridColumnInfo[]): { tone: "success" | "warning"; text: string } {
  const done = [result.added ? `added ${plural(result.added, "row")}` : null, result.updated ? `updated ${plural(result.updated, "row")}` : null].filter(Boolean).join(" and ");
  const parts = [done ? `${done[0]!.toUpperCase()}${done.slice(1)}.` : "Nothing was pasted."];
  const notes: string[] = [];
  if (result.invalid.count) notes.push(`${plural(result.invalid.count, "value")} didn't fit the column type: kept and flagged.`);
  if (result.rejected.count) notes.push(`${plural(result.rejected.count, "value")} too long or unreadable: not pasted.`);
  for (const skipped of result.skippedColumns) {
    if (skipped.values) notes.push(`${plural(skipped.values, "value")} not pasted: “${columns.find((c) => c.id === skipped.columnId)?.name ?? "That column"}” can't be edited.`);
  }
  if (outside) notes.push(`${plural(outside, "value")} not pasted: past the last column.`);
  // An empty line is not a problem worth a warning.
  if (result.blankRows) parts.push(`${plural(result.blankRows, "empty line")} added no row.`);
  return { tone: notes.length || !done ? "warning" : "success", text: [...parts, ...notes].join(" ") };
}

export interface IncompatibleColumn {
  columnId: string;
  dataType: DataType;
  values: number;
  invalid: number;
  looksLike: DataType | null;
}

export function incompatibleMessage(wrong: IncompatibleColumn, columns: GridColumnInfo[]): string {
  const name = columns.find((c) => c.id === wrong.columnId)?.name ?? "A column";
  const like = wrong.looksLike ? ` They look like ${dataTypeLabel(wrong.looksLike)} values.` : "";
  return `“${name}” takes ${dataTypeLabel(wrong.dataType)} values, and ${n(wrong.invalid)} of ${n(wrong.values)} pasted into it don't fit.${like}`;
}

/** A column name that is not taken yet: `Email`, `Email 2`, … */
export function freeName(base: string, taken: string[]): string {
  const used = new Set(taken.map((name) => name.trim().toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!used.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
}

/** Columns to create so that a block pasted into a workbook with nowhere to put it has somewhere to go. */
export function columnsForBlock(block: string[][], taken: string[]): Array<{ name: string; dataType: DataType }> {
  const names = [...taken];
  return Array.from({ length: block[0]!.length }, (_, i) => {
    const dataType: DataType = detectType(block.map((line) => line[i]!)) ?? "text";
    const name = freeName(dataType === "text" ? `Column ${i + 1}` : dataTypeLabel(dataType), names);
    names.push(name);
    return { name, dataType };
  });
}
