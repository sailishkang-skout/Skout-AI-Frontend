import { useApiFetch, useApiFetchBlob } from "./api-client";

/**
 * CSV import for Workbooks V2 (WB2-020). The API checks everything; the checks here only let a person fix a problem
 * before sending.
 */
export const IMPORT_MAX_BYTES = 50 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 100_000;
export const MAX_COLUMN_NAME = 200;

export const DATA_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "url", label: "Web address" },
  { value: "linkedin_url", label: "LinkedIn URL" },
  { value: "domain", label: "Domain" },
  { value: "phone", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
] as const;
export type DataType = (typeof DATA_TYPES)[number]["value"];
export const dataTypeLabel = (type: DataType) => DATA_TYPES.find((t) => t.value === type)?.label ?? type;

export const DEDUPE_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "linkedin_url", label: "LinkedIn URL" },
  { value: "domain", label: "Domain" },
  { value: "none", label: "None (import every row)" },
] as const;
export type DedupeKey = (typeof DEDUPE_OPTIONS)[number]["value"];

/** The column types each key can be read from; the first is its own type. */
const KEY_TYPES: Record<Exclude<DedupeKey, "none">, DataType[]> = {
  email: ["email", "text"],
  linkedin_url: ["linkedin_url", "url", "text"],
  domain: ["domain", "url", "text"],
};

export interface WorkbookListItem {
  id: string;
  name: string;
  rowCount: number;
  rowLimit: number;
}

export interface WorkbookColumn {
  id: string;
  name: string;
  type: string;
  config: { dataType?: DataType } & Record<string, unknown>;
}

export interface CsvHeader {
  index: number;
  name: string;
  fits: DataType[];
  filled: number;
}

export type SuggestedTarget = { columnId: string } | { newColumn: { name: string; dataType: DataType } } | null;

export interface ImportPreview {
  headers: CsvHeader[];
  rows: Array<{ line: number; values: string[]; problem?: string }>;
  suggestions: Array<{ header: number; target: SuggestedTarget }>;
}

export type ImportStatus = "awaiting_confirmation" | "queued" | "processing" | "completed" | "failed" | "cancelled";

export interface WorkbookImport {
  id: string;
  workbookId: string;
  status: ImportStatus;
  fileName: string;
  fileBytes: number;
  counts: { total: number; processed: number; imported: number; duplicates: number; skipped: number; failed: number };
  progress: number;
  background: boolean;
  error: { code: string; message: string } | null;
  report: { available: boolean; rows: number };
  preview: ImportPreview | null;
  createdAt: string;
}

export const STATUS_LABEL: Record<ImportStatus, string> = {
  awaiting_confirmation: "Waiting for you",
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const isRunning = (status: ImportStatus) => status === "queued" || status === "processing";

/** Why a chosen file cannot be uploaded, or null. */
export function fileProblem(file: { name: string; size: number }): string | null {
  if (!/\.csv$/i.test(file.name)) return "Only CSV files can be imported. Choose a file ending in .csv.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > IMPORT_MAX_BYTES) return "This file is larger than 50 MB. Split it into smaller files.";
  return null;
}

// ── Mapping ──────────────────────────────────────────────────────────────────

/** What a person has chosen to do with one column of the file. */
export type Choice = { kind: "skip" } | { kind: "existing"; columnId: string } | { kind: "new"; name: string; dataType: DataType };

export interface DedupeState {
  /** Null until the person picks one. */
  key: DedupeKey | null;
  /** Chosen by hand; otherwise the only column of the key's type is used. */
  header?: number;
}

export function initialChoices(preview: ImportPreview): Choice[] {
  return preview.headers.map((header) => {
    const target = preview.suggestions.find((s) => s.header === header.index)?.target;
    if (!target) return { kind: "skip" };
    if ("columnId" in target) return { kind: "existing", columnId: target.columnId };
    return { kind: "new", ...target.newColumn };
  });
}

export function targetType(choice: Choice, columns: WorkbookColumn[]): DataType | null {
  if (choice.kind === "new") return choice.dataType;
  if (choice.kind === "existing") {
    const column = columns.find((c) => c.id === choice.columnId);
    return column ? (column.config.dataType ?? "text") : null;
  }
  return null;
}

export interface MappingCheck {
  /** By file column. */
  columnErrors: Record<number, string>;
  /** Shown, but do not stop the import. */
  warnings: Record<number, string>;
  /** File columns that could hold the chosen key. */
  keyHeaders: number[];
  /** The column that will be used as the key. */
  keyHeader: number | null;
  /** Why the import cannot start yet, or null. */
  blocker: string | null;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function checkMapping(headers: CsvHeader[], choices: Choice[], columns: WorkbookColumn[], dedupe: DedupeState): MappingCheck {
  const columnErrors: Record<number, string> = {};
  const warnings: Record<number, string> = {};
  const used = new Map<string, number>();
  const names: string[] = [];
  const mapped: Array<{ header: number; type: DataType }> = [];

  headers.forEach((header) => {
    const choice = choices[header.index] ?? { kind: "skip" };
    if (choice.kind === "skip") return;
    if (choice.kind === "existing") {
      if (used.has(choice.columnId)) {
        const name = columns.find((c) => c.id === choice.columnId)?.name ?? "that column";
        columnErrors[header.index] = `Another file column already goes into “${name}”.`;
        return;
      }
      used.set(choice.columnId, header.index);
    } else {
      if (!choice.name.trim()) {
        columnErrors[header.index] = "Name the new column.";
        return;
      }
      if (columns.some((c) => same(c.name, choice.name))) {
        columnErrors[header.index] = "The workbook already has a column with this name. Map to it, or use another name.";
        return;
      }
      if (names.some((n) => same(n, choice.name))) {
        columnErrors[header.index] = "Two new columns have this name.";
        return;
      }
      names.push(choice.name);
    }
    const type = targetType(choice, columns);
    if (!type) {
      columnErrors[header.index] = "This column no longer exists.";
      return;
    }
    mapped.push({ header: header.index, type });
    if (header.filled > 0 && !header.fits.includes(type)) {
      warnings[header.index] = `Some values are not a valid ${dataTypeLabel(type).toLowerCase()}. Those rows will be skipped and listed in the report.`;
    }
  });

  const key = dedupe.key;
  const keyHeaders = key && key !== "none" ? mapped.filter((m) => KEY_TYPES[key].includes(m.type)).map((m) => m.header) : [];
  let keyHeader: number | null = null;
  if (key && key !== "none") {
    const exact = mapped.filter((m) => m.type === key).map((m) => m.header);
    if (dedupe.header !== undefined && keyHeaders.includes(dedupe.header)) keyHeader = dedupe.header;
    else if (exact.length === 1) keyHeader = exact[0]!;
  }

  let blocker: string | null = null;
  const label = DEDUPE_OPTIONS.find((o) => o.value === key)?.label;
  if (Object.keys(columnErrors).length) blocker = "Fix the highlighted columns.";
  else if (!mapped.length) blocker = "Choose at least one column to import.";
  else if (!key) blocker = "Choose how to find duplicates.";
  else if (key !== "none" && !keyHeaders.length) blocker = `Map a file column that holds the ${label}.`;
  else if (key !== "none" && keyHeader === null) blocker = `Choose which column holds the ${label}.`;
  return { columnErrors, warnings, keyHeaders, keyHeader, blocker };
}

type ConfirmColumn = { header: number; columnId: string } | { header: number; newColumn: { name: string; dataType: DataType } };

export function confirmBody(choices: Choice[], dedupe: DedupeState, keyHeader: number | null) {
  return {
    columns: choices.flatMap<ConfirmColumn>((choice, header) => {
      if (choice.kind === "existing") return [{ header, columnId: choice.columnId }];
      if (choice.kind === "new") return [{ header, newColumn: { name: choice.name.trim(), dataType: choice.dataType } }];
      return [];
    }),
    dedupe: dedupe.key === "none" || !dedupe.key ? { key: "none" as const } : { key: dedupe.key, header: keyHeader ?? undefined },
  };
}

export function useWorkbookImportApi() {
  const fetchApi = useApiFetch();
  const fetchBlob = useApiFetchBlob();
  const base = (workbookId: string) => `/api/v1/workbooks-v2/${workbookId}`;
  return {
    workbooks: () => fetchApi<{ data: WorkbookListItem[]; total: number }>("/api/v1/workbooks-v2?pageSize=100"),
    createWorkbook: (name: string) => fetchApi<{ data: WorkbookListItem }>("/api/v1/workbooks-v2", { method: "POST", body: JSON.stringify({ name }) }),
    columns: (workbookId: string) => fetchApi<{ data: { columns: WorkbookColumn[] } }>(base(workbookId)).then((r) => r.data.columns),
    upload: (workbookId: string, file: File) =>
      fetchApi<{ data: WorkbookImport }>(`${base(workbookId)}/imports`, {
        method: "POST",
        body: file,
        // The name goes in a header, percent-encoded, so it stays out of request URLs.
        headers: { "Content-Type": "text/csv", "X-File-Name": encodeURIComponent(file.name) },
      }).then((r) => r.data),
    list: (workbookId: string) => fetchApi<{ data: WorkbookImport[] }>(`${base(workbookId)}/imports`).then((r) => r.data),
    get: (workbookId: string, importId: string) => fetchApi<{ data: WorkbookImport }>(`${base(workbookId)}/imports/${importId}`).then((r) => r.data),
    confirm: (workbookId: string, importId: string, body: ReturnType<typeof confirmBody>) =>
      fetchApi<{ data: WorkbookImport }>(`${base(workbookId)}/imports/${importId}/confirm`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.data),
    cancel: (workbookId: string, importId: string) => fetchApi<{ data: WorkbookImport }>(`${base(workbookId)}/imports/${importId}`, { method: "DELETE" }).then((r) => r.data),
    report: (workbookId: string, importId: string) => fetchBlob(`${base(workbookId)}/imports/${importId}/report`),
  };
}
