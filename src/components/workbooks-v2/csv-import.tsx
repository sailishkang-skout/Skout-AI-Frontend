"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError, authQueryOptions, formatQueryError, useAuthReady } from "@/lib/api-client";
import { STATUS_LABEL, fileProblem, importTitle, isRunning, useWorkbookImportApi, type confirmBody } from "@/lib/workbooks-v2-import";
import { ImportProgress } from "./import-progress";
import { MappingStep } from "./mapping-step";

export const POLL_MS = 1_500;
const KEY = ["workbooks-v2"] as const;

/** The server's reasons for refusing a request: each mapping problem if it listed them, else its message. */
function reasons(error: unknown, fallback: string): string[] {
  if (!error) return [];
  if (error instanceof ApiError) {
    const details = (error.body as { details?: { errors?: Array<{ message?: string }> } } | undefined)?.details;
    const listed = details?.errors?.flatMap((e) => (e.message ? [e.message] : []));
    if (listed?.length) return Array.from(new Set(listed));
  }
  return [formatQueryError(error, fallback)];
}

/**
 * Importing a CSV file into a Workbooks V2 workbook (WB2-020): choose the workbook and file, map the columns and check
 * the first rows, confirm, and follow the import. Imports are read back from the server, so leaving and returning
 * shows where each one is.
 */
export function CsvImport({ canEdit, onWorkbook }: { canEdit: boolean; onWorkbook?: (workbook: { id: string; name: string } | null) => void }) {
  const api = useWorkbookImportApi();
  const client = useQueryClient();
  const authReady = useAuthReady();
  const [chosen, setChosen] = useState("");
  const [importId, setImportId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const workbooks = useQuery({ ...authQueryOptions, queryKey: KEY, queryFn: () => api.workbooks(), enabled: authReady });
  const list = workbooks.data?.data ?? [];
  const workbookId = chosen || list[0]?.id || "";
  const ready = authReady && Boolean(workbookId);

  const imports = useQuery({
    ...authQueryOptions,
    queryKey: [...KEY, workbookId, "imports"],
    queryFn: () => api.list(workbookId),
    enabled: ready,
    refetchInterval: (query) => (query.state.data?.some((i) => isRunning(i.status)) ? POLL_MS * 2 : false),
  });
  const current = useQuery({
    ...authQueryOptions,
    queryKey: [...KEY, workbookId, "import", importId],
    queryFn: () => api.get(workbookId, importId!),
    enabled: ready && Boolean(importId),
    refetchInterval: (query) => (query.state.data && isRunning(query.state.data.status) ? POLL_MS : false),
  });
  const item = importId ? current.data : undefined;
  const columns = useQuery({
    ...authQueryOptions,
    queryKey: [...KEY, workbookId, "columns"],
    queryFn: () => api.columns(workbookId),
    enabled: ready && item?.status === "awaiting_confirmation",
  });

  const show = (next: NonNullable<typeof item>) => {
    client.setQueryData([...KEY, next.workbookId, "import", next.id], next);
    setImportId(next.id);
  };
  const refreshImports = () => client.invalidateQueries({ queryKey: [...KEY, workbookId, "imports"] });

  const create = useMutation({
    mutationFn: (name: string) => api.createWorkbook(name),
    onSuccess: async ({ data }) => {
      await client.invalidateQueries({ queryKey: KEY, exact: true });
      setChosen(data.id);
      setImportId(null);
      setNewName("");
    },
  });
  const upload = useMutation({
    mutationFn: (file: File) => api.upload(workbookId, file),
    onSuccess: (next) => {
      show(next);
      void refreshImports();
    },
  });
  const confirm = useMutation({
    mutationFn: (body: ReturnType<typeof confirmBody>) => api.confirm(workbookId, importId!, body),
    onSuccess: (next) => {
      show(next);
      void refreshImports();
    },
    // The import may have moved on (confirmed elsewhere, or expired): show what the server has.
    onError: () => void current.refetch(),
  });
  const cancel = useMutation({
    mutationFn: () => api.cancel(workbookId, importId!),
    onSuccess: () => {
      setImportId(null);
      void refreshImports();
    },
  });
  const download = useMutation({
    mutationFn: async (id: string) => {
      const url = URL.createObjectURL(await api.report(workbookId, id));
      const link = document.createElement("a");
      link.href = url;
      link.download = `skipped-rows-${id.slice(0, 8)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });

  // When an import ends the workbook's rows, row count and columns have changed.
  const status = item?.status;
  useEffect(() => {
    if (status !== "completed" && status !== "failed") return;
    void client.invalidateQueries({ queryKey: KEY, exact: true });
    void client.invalidateQueries({ queryKey: [...KEY, workbookId, "imports"] });
    void client.invalidateQueries({ queryKey: [...KEY, workbookId, "rows"] });
    void client.invalidateQueries({ queryKey: [...KEY, workbookId, "columns"] });
  }, [status, client, workbookId]);

  // The rest of the page works on the workbook chosen here.
  const selectedName = list.find((w) => w.id === workbookId)?.name;
  useEffect(() => {
    onWorkbook?.(workbookId && selectedName !== undefined ? { id: workbookId, name: selectedName } : null);
  }, [workbookId, selectedName, onWorkbook]);

  const reset = () => {
    setImportId(null);
    setLocalError(null);
    upload.reset();
    confirm.reset();
    cancel.reset();
    download.reset();
  };
  const chooseFile = (file: File) => {
    reset();
    const problem = fileProblem(file);
    if (problem) setLocalError(problem);
    else upload.mutate(file);
  };

  if (workbooks.isError) {
    return (
      <Alert variant="error" onRetry={() => void workbooks.refetch()}>
        {formatQueryError(workbooks.error, "Your workbooks could not be loaded.")}
      </Alert>
    );
  }
  if (!workbooks.data) return <p className="text-sm text-muted-foreground">Loading your workbooks…</p>;

  const selected = list.find((w) => w.id === workbookId);
  // Switching workbook while a request is on its way would show its answer under the wrong one.
  const sending = upload.isPending || confirm.isPending || cancel.isPending;
  const uploadError = localError ?? (upload.error ? formatQueryError(upload.error, "The file could not be uploaded.") : null);

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Import a CSV file</h2>
          <p className="text-sm text-muted-foreground">Up to 100,000 rows and 50 MB. UTF-8, with the column names on the first line.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Workbook</span>
            <Select
              value={workbookId}
              disabled={!list.length || sending}
              onChange={(e) => {
                reset();
                setChosen(e.target.value);
              }}
            >
              {list.length ? null : <option value="">No workbooks yet</option>}
              {list.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.rowCount.toLocaleString("en-US")} rows)
                </option>
              ))}
            </Select>
          </label>
          {canEdit ? (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newName.trim()) create.mutate(newName.trim());
              }}
            >
              <label className="min-w-0 flex-1 space-y-1 text-sm">
                <span className="font-medium">Or start a new one</span>
                <Input value={newName} maxLength={200} placeholder="Workbook name" onChange={(e) => setNewName(e.target.value)} />
              </label>
              <Button type="submit" variant="outline" disabled={!newName.trim() || create.isPending || sending}>
                Create
              </Button>
            </form>
          ) : null}
        </div>
        {create.error ? <Alert variant="error">{formatQueryError(create.error, "The workbook could not be created.")}</Alert> : null}

        {!canEdit ? <Alert>You can follow imports and download their reports. Importing needs permission to edit workbooks.</Alert> : null}

        {importId && current.isError && !item ? (
          <Alert variant="error" onRetry={() => void current.refetch()}>
            {formatQueryError(current.error, "This import could not be loaded.")}
          </Alert>
        ) : null}
        {importId && !item && !current.isError ? <p className="text-sm text-muted-foreground">Loading the import…</p> : null}

        {item?.status === "awaiting_confirmation" ? (
          canEdit && item.preview ? (
            columns.data ? (
              <MappingStep
                key={item.id}
                upload={item}
                preview={item.preview}
                columns={columns.data}
                busy={confirm.isPending || cancel.isPending}
                errors={[...reasons(confirm.error, "The import could not be started."), ...reasons(cancel.error, "The import could not be cancelled.")]}
                onConfirm={(body) => confirm.mutate(body)}
                onCancel={() => cancel.mutate()}
              />
            ) : columns.isError ? (
              <Alert variant="error" onRetry={() => void columns.refetch()}>
                {formatQueryError(columns.error, "The workbook’s columns could not be loaded.")}
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">Loading the workbook’s columns…</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">This file is waiting for someone with edit access to confirm it.</p>
          )
        ) : null}

        {item && item.status !== "awaiting_confirmation" ? (
          <>
            {current.isError ? <Alert variant="warning">The latest progress could not be loaded. Trying again.</Alert> : null}
            <ImportProgress
              item={item}
              downloading={download.isPending}
              downloadError={download.error ? formatQueryError(download.error, "The report could not be downloaded.") : null}
              onDownload={() => download.mutate(item.id)}
              onClose={reset}
            />
          </>
        ) : null}

        {!importId && canEdit && selected ? (
          <div className="space-y-3">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-8 text-center focus-within:ring-2 focus-within:ring-ring hover:border-primary/50">
              <FileUp className="h-7 w-7 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium">{upload.isPending ? "Uploading and checking the file…" : "Choose a CSV file"}</span>
              <input
                type="file"
                className="sr-only"
                accept=".csv,text/csv"
                disabled={upload.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) chooseFile(file);
                }}
              />
            </label>
            {uploadError ? <Alert variant="error">{uploadError}</Alert> : null}
          </div>
        ) : null}

        {imports.data?.length ? (
          <section aria-labelledby="recent-imports" className="space-y-2">
            <h3 id="recent-imports" className="text-sm font-semibold">
              Recent imports
            </h3>
            <ul className="divide-y rounded-md border text-sm">
              {imports.data.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate">{importTitle(i)}</span>
                  <Badge tone={statusTone(i.status)}>{STATUS_LABEL[i.status]}</Badge>
                  {isRunning(i.status) ? <span className="tabular-nums text-muted-foreground">{i.progress}%</span> : null}
                  {i.status === "completed" || i.status === "failed" ? <span className="text-muted-foreground">{i.counts.imported.toLocaleString("en-US")} added</span> : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`View ${importTitle(i)}`}
                    onClick={() => {
                      reset();
                      setImportId(i.id);
                    }}
                  >
                    View
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {imports.isError ? <Alert variant="warning">{formatQueryError(imports.error, "Recent imports could not be loaded.")}</Alert> : null}
      </CardContent>
    </Card>
  );
}
