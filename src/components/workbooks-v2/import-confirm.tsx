"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { authQueryOptions, formatQueryError, useAuthReady } from "@/lib/api-client";
import { refusalReasons, useWorkbookImportApi, type confirmBody, type WorkbookImport } from "@/lib/workbooks-v2-import";
import { MappingStep } from "./mapping-step";

/** The step between a CRM or Apollo preview and its import: map the fields, then confirm or cancel. */
export function ImportConfirm({
  item,
  onConfirmed,
  onCancelled,
  onRefused,
}: {
  item: WorkbookImport & { preview: NonNullable<WorkbookImport["preview"]> };
  onConfirmed: (next: WorkbookImport) => void;
  onCancelled: () => void;
  /** The server refused to start it, so what is known about it may be out of date. */
  onRefused: (error: unknown) => void;
}) {
  const imports = useWorkbookImportApi();
  const authReady = useAuthReady();
  const columns = useQuery({
    ...authQueryOptions,
    queryKey: ["workbooks-v2", item.workbookId, "columns"],
    queryFn: () => imports.columns(item.workbookId),
    enabled: authReady,
  });
  const confirm = useMutation({
    mutationFn: (body: ReturnType<typeof confirmBody>) => imports.confirm(item.workbookId, item.id, body),
    onSuccess: onConfirmed,
    onError: onRefused,
  });
  const cancel = useMutation({ mutationFn: () => imports.cancel(item.workbookId, item.id), onSuccess: onCancelled });

  if (columns.data) {
    return (
      <MappingStep
        upload={item}
        preview={item.preview}
        columns={columns.data}
        busy={confirm.isPending || cancel.isPending}
        errors={[...refusalReasons(confirm.error, "The import could not be started."), ...refusalReasons(cancel.error, "The import could not be cancelled.")]}
        onConfirm={(body) => confirm.mutate(body)}
        onCancel={() => cancel.mutate()}
      />
    );
  }
  return columns.isError ? (
    <Alert variant="error" onRetry={() => void columns.refetch()}>
      {formatQueryError(columns.error, "The workbook’s columns could not be loaded.")}
    </Alert>
  ) : (
    <p className="text-sm text-muted-foreground">Loading the workbook’s columns…</p>
  );
}
