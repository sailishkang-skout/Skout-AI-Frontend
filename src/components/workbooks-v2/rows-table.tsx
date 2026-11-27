"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authQueryOptions, formatQueryError, useAuthReady } from "@/lib/api-client";
import { useWorkbookImportApi } from "@/lib/workbooks-v2-import";
import { useWorkbookRowsApi, type WorkbookCell, type WorkbookRow } from "@/lib/workbooks-v2-rows";

export const ROWS_PAGE_SIZE = 25;
export const FROM_SKOUT = "From your Skout data";
const n = (value: number) => value.toLocaleString("en-US");

const VERIFICATION: Record<string, string> = { valid: "Verified", catch_all: "Catch-all", risky: "Risky", unknown: "Unknown", unverified: "Not verified" };

export function sourceLabel(source: WorkbookRow["source"]): string {
  const named = (kind: string, name: unknown) => (typeof name === "string" && name ? `${kind}: ${name}` : kind);
  if (source.type === "csv") return named("CSV", source.fileName);
  if (source.type === "list") return named("List", source.listName);
  if (source.type === "smart_list") return named("Smart list", source.smartListName);
  if (source.type === "search") return "Search";
  if (source.type === "manual") return "Added by hand";
  return source.type;
}

function Cell({ cell }: { cell: WorkbookCell | undefined }) {
  if (!cell) return null;
  const value = typeof cell.value === "boolean" ? (cell.value ? "Yes" : "No") : cell.value === null ? "" : String(cell.value);
  return (
    <div className="space-y-0.5">
      <span className="block max-w-64 truncate" title={value}>
        {value}
      </span>
      {cell.state === "error" ? <span className="block text-amber-700 dark:text-amber-300">Invalid value</span> : null}
      {cell.foundVia === "cache" ? (
        <span className="flex flex-wrap gap-1">
          <Badge tone="info">{FROM_SKOUT}</Badge>
          {cell.verification ? <Badge tone={cell.verification === "valid" ? "success" : "muted"}>{VERIFICATION[cell.verification] ?? cell.verification}</Badge> : null}
        </span>
      ) : null}
    </div>
  );
}

/** A read-only look at a workbook's rows until the grid is built (WB2-021). */
export function RowsTable({ workbookId }: { workbookId: string }) {
  const api = useWorkbookRowsApi();
  const columnsApi = useWorkbookImportApi();
  const authReady = useAuthReady();
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [workbookId]);

  const columns = useQuery({ ...authQueryOptions, queryKey: ["workbooks-v2", workbookId, "columns"], queryFn: () => columnsApi.columns(workbookId), enabled: authReady });
  const rows = useQuery({
    ...authQueryOptions,
    queryKey: ["workbooks-v2", workbookId, "rows", page],
    queryFn: () => api.window(workbookId, page * ROWS_PAGE_SIZE, ROWS_PAGE_SIZE),
    enabled: authReady,
  });
  const shown = (columns.data ?? []).filter((c) => !c.hidden);
  const total = rows.data?.window.total ?? 0;
  const error = rows.error ?? columns.error;

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Rows</h2>
          <p className="text-sm text-muted-foreground">Read only for now.</p>
        </div>
        {error ? (
          <Alert
            variant="error"
            onRetry={() => {
              void rows.refetch();
              void columns.refetch();
            }}
          >
            {formatQueryError(error, "The rows could not be loaded.")}
          </Alert>
        ) : !rows.data || !columns.data ? (
          <p className="text-sm text-muted-foreground">Loading rows…</p>
        ) : !total ? (
          <p className="text-sm text-muted-foreground">This workbook has no rows yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted">
                  <tr>
                    {shown.map((c) => (
                      <th key={c.id} scope="col" className="min-w-32 px-2 py-1.5 font-medium">
                        {c.name}
                      </th>
                    ))}
                    <th scope="col" className="min-w-32 px-2 py-1.5 font-medium">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.data.data.map((row) => (
                    <tr key={row.id} className="border-t align-top">
                      {shown.map((c) => (
                        <td key={c.id} className="px-2 py-1">
                          <Cell cell={row.cells[c.id]} />
                        </td>
                      ))}
                      <td className="px-2 py-1 text-muted-foreground">{sourceLabel(row.source)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Rows {n(page * ROWS_PAGE_SIZE + 1)}–{n(page * ROWS_PAGE_SIZE + rows.data.data.length)} of {n(total)}
              </span>
              <span className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={page === 0 || rows.isFetching} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={!rows.data.window.hasMore || rows.isFetching} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
