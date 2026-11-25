/**
 * WB2-001 grid spike: the one sample dataset both grids render. 100,000 rows × 30 columns, never stored:
 * every cell is computed from (row, column), so the "server" can return any window instantly and both
 * libraries are measured on the same values. Experimental; not used by any production page.
 */

export const ROW_COUNT = 100_000;
export const COLUMN_COUNT = 30;
/** The PRD's ceiling (GRID-1) is 50 columns; the spike also runs at that width. */
export const MAX_COLUMN_COUNT = 50;

export type SpikeColumnKind = "text" | "number" | "status" | "bool";

export interface SpikeColumn {
  id: string;
  title: string;
  kind: SpikeColumnKind;
  width: number;
}

const FIRST = ["Ada", "Grace", "Alan", "Linus", "Priya", "Wei", "Sofia", "Omar", "Mei", "Noah", "Zoe", "Ravi", "Lena", "Mateo", "Aiko", "Hugo"];
const LAST = ["Lovelace", "Hopper", "Turing", "Torvalds", "Raman", "Chen", "Rossi", "Haddad", "Tanaka", "Kim", "Okafor", "Patel", "Novak", "Silva", "Sato", "Meyer"];
const COMPANY = ["Initech", "Hooli", "Acme", "Globex", "Umbrella", "Stark", "Wayne", "Wonka", "Soylent", "Cyberdyne", "Tyrell", "Vandelay"];
const STATUS = ["Found", "Not found", "Running", "Needs input", "Error"] as const;

const KINDS: SpikeColumnKind[] = ["text", "text", "text", "number", "status", "bool"];

/** Column definitions for the first `count` columns (30 by default, up to the PRD's 50). */
export function buildColumns(count = COLUMN_COUNT): SpikeColumn[] {
  return Array.from({ length: Math.min(count, MAX_COLUMN_COUNT) }, (_, index) => {
    const kind: SpikeColumnKind = index === 0 ? "text" : index === 1 ? "text" : KINDS[index % KINDS.length]!;
    return {
      id: `c${index}`,
      title: index === 0 ? "Full name" : index === 1 ? "Company" : `${kind === "number" ? "Score" : kind === "status" ? "Status" : kind === "bool" ? "Verified" : "Field"} ${index + 1}`,
      kind,
      width: index === 0 ? 180 : index === 1 ? 150 : kind === "number" ? 90 : kind === "bool" ? 90 : 130,
    };
  });
}

/** A small fast hash so values look varied but are the same every time. */
function mix(row: number, col: number): number {
  let h = (row * 374761393 + col * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

export type CellValue = string | number | boolean;

/** The value of one cell. Pure: the same (row, column) always gives the same value. */
export function cellValue(row: number, col: number, kind?: SpikeColumnKind): CellValue {
  const k = kind ?? buildColumns(MAX_COLUMN_COUNT)[col]?.kind ?? "text";
  const h = mix(row, col);
  if (col === 0) return `${FIRST[h % FIRST.length]} ${LAST[(h >>> 4) % LAST.length]} ${row + 1}`;
  if (col === 1) return COMPANY[h % COMPANY.length]!;
  switch (k) {
    case "number":
      return h % 1000;
    case "status":
      return STATUS[h % STATUS.length]!;
    case "bool":
      return h % 3 !== 0;
    default:
      return `r${row + 1}-c${col + 1}-${(h % 9973).toString(36)}`;
  }
}

/** A window of rows, as the server would return it: `count` rows starting at `start`, each a list of cell values. */
export function generateWindow(start: number, count: number, columns: SpikeColumn[] = buildColumns()): CellValue[][] {
  const end = Math.min(ROW_COUNT, start + count);
  const rows: CellValue[][] = [];
  for (let row = Math.max(0, start); row < end; row++) rows.push(columns.map((column, col) => cellValue(row, col, column.kind)));
  return rows;
}

/** The cell as text, the way a spreadsheet copies it. */
export function cellText(value: CellValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
