"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError, authQueryOptions, formatQueryError, useAuthReady } from "@/lib/api-client";
import type { WorkbookImport } from "@/lib/workbooks-v2-import";
import { sheetSourcesKey, useWorkbookSheetsApi, type SheetSource } from "@/lib/workbooks-v2-sheets";
import { POLL_MS } from "./csv-import";
import { SHEETS_CONNECTION_CODES, SheetsSettingsLink, codeOf } from "./sheets-picker";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

/** The Google Sheets tabs a workbook takes rows from, with "Pull new rows" (WB2-025). Nothing is pulled by itself. */
export function SheetSources({ workbookId, onImport }: { workbookId: string; onImport: (item: WorkbookImport) => void }) {
  const api = useWorkbookSheetsApi();
  const client = useQueryClient();
  const authReady = useAuthReady();
  const [forgetting, setForgetting] = useState<string | null>(null);
  const sources = useQuery({
    ...authQueryOptions,
    queryKey: sheetSourcesKey(workbookId),
    queryFn: () => api.sources(workbookId),
    enabled: authReady,
    refetchInterval: (query) => (query.state.data?.some((s) => s.runningImportId) ? POLL_MS * 2 : false),
  });
  // One key per attempt: a retry after a lost answer is the same pull, a later click a new one.
  const keys = useRef(new Map<string, string>());
  const pull = useMutation({
    mutationFn: (source: SheetSource) => {
      const key = keys.current.get(source.id) ?? crypto.randomUUID();
      keys.current.set(source.id, key);
      return api.pull(workbookId, source.id, key);
    },
    onSuccess: ({ data }, source) => {
      keys.current.delete(source.id);
      onImport(data);
    },
    onError: (error, source) => {
      // The API refused, so the next click is a new request.
      if (error instanceof ApiError && error.status < 500) keys.current.delete(source.id);
    },
    onSettled: () => client.invalidateQueries({ queryKey: sheetSourcesKey(workbookId) }),
  });
  const forget = useMutation({
    mutationFn: (id: string) => api.forget(workbookId, id),
    onSettled: () => {
      setForgetting(null);
      return client.invalidateQueries({ queryKey: sheetSourcesKey(workbookId) });
    },
  });

  if (sources.isError) {
    return (
      <Alert variant="warning" onRetry={() => void sources.refetch()}>
        {formatQueryError(sources.error, "This workbook’s Google Sheets could not be loaded.")}
      </Alert>
    );
  }
  if (!sources.data?.length) return null;

  return (
    <section aria-labelledby="sheet-sources" className="space-y-2">
      <h3 id="sheet-sources" className="text-sm font-semibold">
        Google Sheets in this workbook
      </h3>
      <ul className="divide-y rounded-md border text-sm">
        {sources.data.map((source) => {
          const name = `${source.spreadsheetName} · ${source.tabName}`;
          const pulling = pull.isPending && pull.variables?.id === source.id;
          return (
            <li key={source.id} className="space-y-2 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{name}</span>
                  <span className="block text-xs text-muted-foreground">
                    Rows recognised by {source.idColumn ? `“${source.idColumn}”` : "their contents"} · {source.lastPulledAt ? `last read ${when(source.lastPulledAt)}` : "not finished yet"}
                  </span>
                </span>
                {source.runningImportId ? (
                  <span className="text-xs text-muted-foreground">Being read now…</span>
                ) : (
                  <>
                    <Button type="button" size="sm" disabled={pull.isPending || forget.isPending} onClick={() => pull.mutate(source)} aria-label={`Pull new rows from ${name}`}>
                      <RefreshCw className={pulling ? "animate-spin" : ""} aria-hidden />
                      {pulling ? "Pulling…" : "Pull new rows"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setForgetting(source.id)} aria-label={`Stop pulling from ${name}`}>
                      Stop
                    </Button>
                  </>
                )}
              </div>
              {forgetting === source.id ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span>Stop pulling from this tab? Its rows stay. If you import it again, they can be added a second time.</span>
                  <Button type="button" size="sm" variant="destructive" disabled={forget.isPending} onClick={() => forget.mutate(source.id)}>
                    Yes, stop
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setForgetting(null)}>
                    Keep it
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {pull.error ? (
        <div className="space-y-2">
          <Alert variant="error">{formatQueryError(pull.error, "New rows could not be pulled.")}</Alert>
          {SHEETS_CONNECTION_CODES.has(codeOf(pull.error) ?? "") ? (
            <p className="text-sm">
              <SheetsSettingsLink />
            </p>
          ) : null}
        </div>
      ) : null}
      {forget.error ? <Alert variant="error">{formatQueryError(forget.error, "That could not be stopped.")}</Alert> : null}
      <p className="text-xs text-muted-foreground">Rows are added only when you pull. Existing rows are never changed.</p>
    </section>
  );
}
