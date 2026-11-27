"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, authQueryOptions, formatQueryError, useAuthReady } from "@/lib/api-client";
import { detectType, parseClipboard } from "@/lib/workbooks-v2-clipboard";
import { EditQueue, type Cells, type Change } from "@/lib/workbooks-v2-edit-queue";
import {
  FROM_SKOUT,
  MAX_COPY_ROWS,
  SOURCE_COLUMN,
  SUPPRESSED,
  SUPPRESSED_NOTE,
  VERIFICATION,
  cellProblem,
  cellText,
  gridColumns,
  incompatibleMessage,
  pasteSummary,
  planPaste,
  sourceText,
  tooLarge,
  tooLargeToClear,
  type IncompatibleColumn,
  type PastePlan,
} from "@/lib/workbooks-v2-grid";
import { useWorkbookImportApi, type DataType, type WorkbookColumn } from "@/lib/workbooks-v2-import";
import { useWorkbookRowsApi, type PasteBody } from "@/lib/workbooks-v2-rows";
import { AddColumnDialog, ChooseColumnDialog, ConfirmClearDialog, CreateColumnsDialog, type NewColumnSpec } from "./paste-dialogs";
import type { CellView, Rect, SheetSelection } from "./sheet-types";
import { rowsKey, useRowCache, useRowWindow } from "./use-row-window";

// Drawn on a canvas, so only ever in the browser.
const GlideSheet = dynamic(() => import("./glide-sheet"), { ssr: false, loading: () => <p className="text-sm text-muted-foreground">Loading the grid…</p> });

const n = (value: number) => value.toLocaleString("en-US");
/** Clearing more cells than this at once is confirmed first. */
export const CONFIRM_CLEAR_ABOVE = 50;
const newKey = () => crypto.randomUUID();

interface Notice {
  workbookId: string;
  tone: "success" | "warning" | "error";
  text: string;
}

type Question =
  | { kind: "choose"; workbookId: string; reason: string; values: string[][]; detected: DataType | null; exclude?: string }
  | { kind: "columns"; workbookId: string; values: string[][] }
  | { kind: "add-column"; workbookId: string }
  | { kind: "clear"; workbookId: string; cells: number; plans: PastePlan[] };

/** Sending the same request again can only help when the failure was not the API's answer to it. */
function retryable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status >= 500 || error.status === 429 || (error.body as { retryable?: unknown } | undefined)?.retryable === true;
}

/**
 * The Workbooks V2 grid (WB2-022): rows fetched in windows, typing into cells and into the empty last row, and pasting
 * single values, lists and spreadsheet blocks. Changes are saved in order in the background, so the grid stays usable
 * while a large paste is on its way. Nothing here runs a column. Sorting, filtering, undo and column management beyond
 * adding an input column belong to the full grid (WB2-071).
 */
export function WorkbookGrid({ workbook, canEdit }: { workbook: { id: string; name: string }; canEdit: boolean }) {
  const workbookId = workbook.id;
  const api = useWorkbookRowsApi();
  const columnsApi = useWorkbookImportApi();
  const client = useQueryClient();
  const cache = useRowCache();
  const authReady = useAuthReady();
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState({ first: 0, last: 30 });
  const [selection, setSelection] = useState<SheetSelection | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [adding, setAdding] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });

  const columnsQuery = useQuery({ ...authQueryOptions, queryKey: ["workbooks-v2", workbookId, "columns"], queryFn: () => columnsApi.columns(workbookId), enabled: authReady });
  const workbookColumns: WorkbookColumn[] = useMemo(() => columnsQuery.data ?? [], [columnsQuery.data]);
  const columns = useMemo(() => gridColumns(workbookColumns), [workbookColumns]);
  const editable = columns.some((c) => c.editable);
  const rows = useRowWindow(workbookId, visible);
  const { rowAt, fetchRow } = rows;

  // One queue per workbook, kept while another one is open so that its changes are still saved and reported.
  const queues = useRef(new Map<string, EditQueue>());
  let queue = queues.current.get(workbookId);
  if (!queue) queues.current.set(workbookId, (queue = new EditQueue()));
  const saving = useSyncExternalStore(queue.subscribe, queue.snapshot, queue.snapshot);

  const refreshList = useCallback(() => void client.invalidateQueries({ queryKey: ["workbooks-v2"], exact: true }), [client]);
  const say = useCallback((tone: Notice["tone"], text: string) => setNotice({ workbookId, tone, text }), [workbookId]);
  queue.handlers = {
    add: async (change) => {
      const { data, rowCount } = await api.addRow(workbookId, change.cells, change.key);
      cache.append(workbookId, data, rowCount);
      refreshList();
      return { id: data.id };
    },
    edit: async (rowId, cells) => cache.replace(workbookId, (await api.editRow(workbookId, rowId, cells)).data),
    retryable,
    refused: (change, error) => {
      if (change.kind === "task" && change.refused) return change.refused(error);
      say("error", formatQueryError(error, "That change could not be saved."));
      void client.invalidateQueries({ queryKey: rowsKey(workbookId) });
    },
  };

  // A different workbook starts clean.
  useEffect(() => {
    setSelection(null);
    setQuestion(null);
    setNotice(null);
    setVisible({ first: 0, last: 30 });
  }, [workbookId]);

  // Leaving the page would lose changes still on their way, whichever workbook they belong to.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (Array.from(queues.current.values()).some((q) => q.snapshot().waiting.length)) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const total = rows.total ?? 0;
  const pending = saving.pendingRows;
  /** Rows the grid holds, saved or not; the empty row comes after them. */
  const held = total + pending.length;
  const gridRows = held + (canEdit && editable ? 1 : 0);

  /** Edits to saved rows that have not been saved yet, by row id. */
  const unsavedEdits = useMemo(() => {
    const byRow = new Map<number, Cells>();
    for (const change of saving.waiting) {
      if (change.kind !== "edit") continue;
      const id = typeof change.row === "number" ? change.row : queue.idOf(change.row.temp);
      if (id !== undefined) byRow.set(id, { ...byRow.get(id), ...change.cells });
    }
    return byRow;
  }, [saving.waiting, queue]);

  const cell = useCallback(
    (col: number, row: number): CellView => {
      const column = columns[col];
      if (!column) return { text: "", editable: false };
      const canType = canEdit && column.editable;
      if (row >= total) {
        const typed = pending[row - total];
        if (!typed) return { text: "", editable: canType };
        if (column.id === SOURCE_COLUMN) return { text: "Saving…", editable: false, tone: "pending" };
        return { text: typed.cells[column.id] ?? "", editable: canType, tone: "pending" };
      }
      const saved = rowAt(row);
      if (!saved) return { text: "", editable: false, loading: true };
      // The whole row is shaded, and labelled in its first column, which is the one in view.
      const label = saved.suppressed && col === 0 ? SUPPRESSED : null;
      const shade = saved.suppressed ? { tone: "suppressed" as const } : {};
      if (column.id === SOURCE_COLUMN) return { text: sourceText(saved), editable: false, ...shade };
      const edit = unsavedEdits.get(saved.id);
      if (edit && column.id in edit) return { text: edit[column.id] ?? "", editable: canType, tone: "pending" };
      const value = saved.cells[column.id];
      const badge = label ?? (value?.foundVia === "cache" ? FROM_SKOUT : null);
      return {
        text: cellText(value?.value),
        editable: canType,
        ...shade,
        ...(value?.state === "error" ? { tone: "invalid" as const } : {}),
        ...(badge ? { badge } : {}),
      };
    },
    [columns, canEdit, total, pending, rowAt, unsavedEdits]
  );

  const onEdit = useCallback(
    (col: number, row: number, text: string) => {
      const column = columns[col];
      if (!canEdit || !column?.editable) return;
      const empty = text.trim() === "";
      if (row >= held) {
        // Nothing typed, no row.
        if (!empty) queue.push({ kind: "add", key: newKey(), temp: newKey(), cells: { [column.id]: text } });
        return;
      }
      const shown = cell(col, row);
      if (shown.loading || shown.text === text) return;
      const target = row < total ? rowAt(row)?.id : { temp: pending[row - total]!.temp };
      if (target === undefined) return;
      queue.push({ kind: "edit", key: newKey(), row: target, cells: { [column.id]: empty ? null : text } });
    },
    [columns, canEdit, held, total, pending, cell, rowAt, queue]
  );

  /** Queues one paste. `start` is looked up now where the rows are saved, and when its turn comes where they are not. */
  const queuePaste = useCallback(
    (label: string, build: () => Promise<PasteBody>, outside: number, list?: { values: string[][] }) => {
      const key = newKey();
      let body: PasteBody | undefined;
      setNotice(null);
      queue.push({
        kind: "task",
        key,
        label,
        run: async () => {
          // Built once, so that a retry sends exactly the same request under the same key.
          body ??= await build();
          const { data } = await api.paste(workbookId, body, key);
          await client.invalidateQueries({ queryKey: rowsKey(workbookId) });
          refreshList();
          const summary = pasteSummary(data, outside, columns);
          say(summary.tone, summary.text);
        },
        refused: (error) => {
          const answer = (error instanceof ApiError ? error.body : undefined) as { code?: string; details?: { columns?: IncompatibleColumn[] } } | undefined;
          const wrong = answer?.code === "INCOMPATIBLE_COLUMN" ? answer.details?.columns : undefined;
          if (wrong?.length && list) {
            setQuestion({ kind: "choose", workbookId, reason: incompatibleMessage(wrong[0]!, columns), values: list.values, detected: wrong[0]!.looksLike, exclude: wrong[0]!.columnId });
          } else if (wrong?.length) {
            say("error", `Nothing was pasted. ${wrong.map((w) => incompatibleMessage(w, columns)).join(" ")} Check which cell you pasted into.`);
          } else {
            say("error", formatQueryError(error, "Nothing was pasted."));
          }
          void client.invalidateQueries({ queryKey: rowsKey(workbookId) });
        },
      });
    },
    [queue, api, workbookId, client, refreshList, columns, say]
  );

  const submit = useCallback(
    (plan: PastePlan) => {
      const { columnIds, values, row, overlap, outside } = plan;
      const idAt = (index: number): (() => Promise<number | undefined>) => {
        if (index >= total) {
          const temp = pending[index - total]!.temp;
          return async () => queue.idOf(temp);
        }
        const shown = rowAt(index);
        const found = shown ? Promise.resolve(shown.id) : fetchRow(index).then((r) => r?.id);
        // Reported when the paste's turn comes.
        found.catch(() => {});
        return () => found;
      };
      const ends = overlap ? [idAt(row), idAt(row + overlap - 1)] : null;
      queuePaste(
        `Pasting ${n(values.length)} row${values.length === 1 ? "" : "s"}…`,
        async () => {
          if (!ends) return { columnIds, values };
          const [rowId, endRowId] = await Promise.all(ends.map((end) => end()));
          if (rowId === undefined || endRowId === undefined) {
            throw new ApiError("The rows changed while you were pasting. Check where you want to paste and try again.", 409);
          }
          return { columnIds, values, start: { rowId, endRowId, rows: overlap } };
        },
        outside,
        columnIds.length === 1 ? { values } : undefined
      );
    },
    [total, pending, rowAt, fetchRow, queue, queuePaste]
  );

  const paste = useCallback(
    (text: string) => {
      if (!canEdit) return say("warning", "You can look at this workbook but not change it.");
      if (columnsQuery.data === undefined || rows.total === undefined) return say("warning", "The workbook is still loading. Paste again in a moment.");
      const block = parseClipboard(text);
      if (!block.length) return say("warning", "There was nothing to paste.");
      if (!editable) {
        const big = tooLarge(block);
        return big ? say("error", big) : setQuestion({ kind: "columns", workbookId, values: block });
      }
      if (!selection) return say("warning", "Select the cell where the paste should start, then paste again.");
      const { x, y } = selection.ranges[0]!;
      const outcome = planPaste(block, columns, { col: x, row: y }, held);
      if (outcome.kind === "refused") return say("error", outcome.message);
      if (outcome.kind === "choose") {
        return setQuestion({ kind: "choose", workbookId, reason: `“${columns[x]?.name}” can't be edited.`, values: outcome.values, detected: detectType(outcome.values.map((line) => line[0]!)) });
      }
      submit(outcome.plan);
    },
    [canEdit, columnsQuery.data, rows.total, editable, selection, columns, held, workbookId, say, submit]
  );

  // The paste event goes to whatever has focus; only one aimed at the grid is ours. A paste into the open cell editor,
  // a dialog or another field on the page is left alone.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (!container.current?.contains(document.activeElement)) return;
      const text = event.clipboardData?.getData("text/plain");
      if (!text) return;
      event.preventDefault();
      paste(text);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [paste]);

  /** Delete and Backspace on a selection. */
  const onClear = useCallback(
    (ranges: Rect[]) => {
      if (!canEdit) return;
      const plans: PastePlan[] = [];
      for (const range of ranges) {
        if (range.width === 1 && range.height === 1) {
          if (range.y < held) onEdit(range.x, range.y, "");
          continue;
        }
        const columnIds = columns.slice(range.x, range.x + range.width).filter((c) => c.editable).map((c) => c.id);
        const end = Math.min(range.y + range.height, held);
        if (!columnIds.length || end <= range.y) continue;
        const big = tooLargeToClear(end - range.y, columnIds.length);
        if (big) return say("error", big);
        plans.push({ columnIds, values: Array.from({ length: end - range.y }, () => columnIds.map(() => "")), row: range.y, overlap: end - range.y, outside: 0 });
      }
      const cells = plans.reduce((sum, p) => sum + p.overlap * p.columnIds.length, 0);
      // There is no undo yet, so a large selection is confirmed first.
      if (cells > CONFIRM_CLEAR_ABOVE) setQuestion({ kind: "clear", workbookId, cells, plans });
      else plans.forEach(submit);
    },
    [canEdit, held, onEdit, columns, say, submit, workbookId]
  );

  const loadCells = useCallback(
    async (rect: Rect): Promise<CellView[][]> => {
      const height = Math.max(0, Math.min(rect.height, gridRows - rect.y));
      if (height > MAX_COPY_ROWS) {
        say("warning", `Copy at most ${n(MAX_COPY_ROWS)} rows at a time.`);
        throw new Error("Too many rows to copy");
      }
      const lines: CellView[][] = [];
      for (let row = rect.y; row < rect.y + height; row++) {
        const saved = row < total && !rowAt(row) ? await fetchRow(row) : undefined;
        lines.push(
          Array.from({ length: rect.width }, (_, i) => {
            const column = columns[rect.x + i];
            if (!saved || !column) return cell(rect.x + i, row);
            return { text: column.id === SOURCE_COLUMN ? sourceText(saved) : cellText(saved.cells[column.id]?.value), editable: false };
          })
        );
      }
      return lines;
    },
    [gridRows, total, rowAt, fetchRow, columns, cell, say]
  );

  const createColumns = async (specs: NewColumnSpec[], key: string) => {
    const ids: string[] = [];
    for (let i = 0; i < specs.length; i++) ids.push((await api.addColumn(workbookId, specs[i]!, `${key}-${i}`)).data.id);
    await client.invalidateQueries({ queryKey: ["workbooks-v2", workbookId, "columns"] });
    refreshList();
    return ids;
  };
  /** Adds a list or block as new rows, after making any columns it needs. */
  const append = (values: string[][], target: { columnIds: string[] } | { create: NewColumnSpec[] }) => {
    setQuestion(null);
    const columnsKey = newKey();
    queuePaste(
      `Pasting ${n(values.length)} row${values.length === 1 ? "" : "s"}…`,
      async () => ({ columnIds: "columnIds" in target ? target.columnIds : await createColumns(target.create, columnsKey), values }),
      0
    );
  };
  const addColumn = async (spec: NewColumnSpec) => {
    setAdding({ busy: true, error: null });
    try {
      await createColumns([spec], newKey());
      setAdding({ busy: false, error: null });
      setQuestion(null);
    } catch (error) {
      setAdding({ busy: false, error: formatQueryError(error, "The column could not be added.") });
    }
  };

  const chosen = selection ? columns[selection.col] : undefined;
  const chosenRow = selection && selection.row < total ? rowAt(selection.row) : undefined;
  const chosenCell = chosen && chosenRow ? chosenRow.cells[chosen.id] : undefined;
  const problem = cellProblem(chosenCell, workbookColumns.find((c) => c.id === chosen?.id));
  const loadError = columnsQuery.error ?? rows.error;
  const failure = saving.failure;
  const current = saving.waiting[0];
  const open = question && question.workbookId === workbookId ? question : null;

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Rows</h2>
            <p className="text-sm text-muted-foreground" data-testid="row-count">
              {rows.total === undefined ? "Loading rows…" : `${n(total)} row${total === 1 ? "" : "s"}`}
              {pending.length ? ` · ${n(pending.length)} being added` : ""}
              {selection && selection.ranges.some((r) => r.width * r.height > 1) ? ` · ${n(selection.ranges.reduce((sum, r) => sum + r.width * r.height, 0))} cells selected` : ""}
            </p>
          </div>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setAdding({ busy: false, error: null });
                setQuestion({ kind: "add-column", workbookId });
              }}
            >
              <Plus aria-hidden />
              Add column
            </Button>
          ) : null}
        </div>

        {failure ? (
          <Alert variant="error">
            <p>A change couldn’t be saved. {formatQueryError(failure.error, "Check your connection.")}</p>
            <span className="mt-2 flex gap-2">
              <Button type="button" size="sm" onClick={() => queue.retry()}>
                Try again
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => queue.discard()}>
                Discard it
              </Button>
              {saving.waiting.length > 1 ? <span className="self-center text-xs">{n(saving.waiting.length - 1)} more waiting</span> : null}
            </span>
          </Alert>
        ) : current ? (
          <p role="status" className="text-sm text-muted-foreground">
            {current.kind === "task" ? current.label : "Saving…"}
          </p>
        ) : null}
        {notice && notice.workbookId === workbookId ? (
          <Alert variant={notice.tone}>
            <p>{notice.text}</p>
            <button type="button" className="mt-1 font-medium underline underline-offset-4" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </Alert>
        ) : null}

        <div ref={container} className="space-y-2">
          {loadError ? (
            <Alert
              variant="error"
              onRetry={() => {
                rows.retry();
                void columnsQuery.refetch();
              }}
            >
              {formatQueryError(loadError, "The rows could not be loaded.")}
            </Alert>
          ) : columnsQuery.data === undefined || rows.total === undefined ? null : !columns.length ? (
            canEdit ? (
              <div
                tabIndex={0}
                data-testid="paste-target"
                className="rounded-md border border-dashed border-border px-6 py-8 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                This workbook has no columns yet. Click here and paste, or add a column.
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">This workbook has no columns yet.</p>
            )
          ) : !gridRows ? (
            <p className="text-sm text-muted-foreground">This workbook has no rows yet.</p>
          ) : (
            <GlideSheet
              key={workbookId}
              columns={columns.map((c) => ({ id: c.id, title: c.name, width: c.width }))}
              rows={gridRows}
              cell={cell}
              loadCells={loadCells}
              onEdit={onEdit}
              onClear={onClear}
              selection={selection}
              onSelection={setSelection}
              onVisibleRows={(first, last) => setVisible((v) => (v.first === first && v.last === last ? v : { first, last }))}
              height={Math.min(560, 40 + Math.max(gridRows, 6) * 44)}
            />
          )}
        </div>

        {chosen && selection ? (
          <p className="flex flex-wrap gap-x-2 text-xs" data-testid="cell-details">
            <span className="font-medium">
              Row {n(selection.row + 1)} · {chosen.name}
            </span>
            <span className="max-w-xl truncate">{cell(selection.col, selection.row).text}</span>
            {chosenCell?.foundVia === "cache" ? <span className="text-blue-700 dark:text-blue-300">{FROM_SKOUT}</span> : null}
            {chosenCell?.foundVia === "cache" && chosenCell.verification ? <span>{VERIFICATION[chosenCell.verification] ?? chosenCell.verification}</span> : null}
            {problem ? <span className="text-amber-700 dark:text-amber-300">{problem}</span> : null}
            {chosenRow?.suppressed ? <span className="font-medium">{SUPPRESSED_NOTE}</span> : null}
          </p>
        ) : null}
        {canEdit && editable ? (
          <p className="text-xs text-muted-foreground">Type in the empty last row to add a row. To paste, select the first cell and press Ctrl+V (⌘V on a Mac).</p>
        ) : null}
      </CardContent>

      {open?.kind === "choose" ? (
        <ChooseColumnDialog
          reason={open.reason}
          values={open.values}
          detected={open.detected}
          columns={columns}
          exclude={open.exclude}
          onAppend={(columnId) => append(open.values, { columnIds: [columnId] })}
          onCreate={(spec) => append(open.values, { create: [spec] })}
          onClose={() => setQuestion(null)}
        />
      ) : null}
      {open?.kind === "columns" ? (
        <CreateColumnsDialog values={open.values} taken={workbookColumns.map((c) => c.name)} onCreate={(specs) => append(open.values, { create: specs })} onClose={() => setQuestion(null)} />
      ) : null}
      {open?.kind === "clear" ? (
        <ConfirmClearDialog
          cells={open.cells}
          onConfirm={() => {
            setQuestion(null);
            open.plans.forEach(submit);
          }}
          onClose={() => setQuestion(null)}
        />
      ) : null}
      {open?.kind === "add-column" ? <AddColumnDialog busy={adding.busy} error={adding.error} onAdd={(spec) => void addColumn(spec)} onClose={() => setQuestion(null)} /> : null}
    </Card>
  );
}
