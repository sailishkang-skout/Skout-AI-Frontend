"use client";

import { Download } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, importTitle, isRecordImport, isRunning, type WorkbookImport } from "@/lib/workbooks-v2-import";

/** How an import is going, straight from the server's counts, and its report of rows that were not added. */
export function ImportProgress({
  item,
  downloading,
  downloadError,
  onDownload,
  onClose,
  closeLabel,
}: {
  item: WorkbookImport;
  downloading: boolean;
  downloadError: string | null;
  onDownload: () => void;
  onClose: () => void;
  /** What closing does once the import has ended; by default, choosing another file. */
  closeLabel?: string;
}) {
  const { counts, status } = item;
  const file = item.sourceType === "csv";
  const crm = isRecordImport(item);
  const sheet = item.sheet ?? null;
  const figures: Array<[string, number]> = sheet
    ? [
        ["Rows in the tab", counts.total],
        ["Processed", counts.processed],
        ["Added", counts.imported],
        ["Already imported", counts.alreadyImported ?? 0],
        ["Duplicates skipped", counts.duplicates],
        ["Invalid, empty or over the limit", counts.failed + counts.skipped],
      ]
    : [
    [file ? "Total rows" : crm ? "In the selection" : "Selected", counts.total],
    ["Processed", counts.processed],
    [file ? "Imported" : "Added", counts.imported],
    [file ? "Duplicates skipped" : crm ? "Duplicates skipped" : "Already in workbook", counts.duplicates],
    [file ? "Invalid or failed" : crm ? "Invalid or over the limit" : "Over the row limit", counts.failed],
    [file ? "Empty rows skipped" : crm ? "Empty or no longer there" : "Not found", counts.skipped],
  ];
  const left = counts.duplicates + counts.failed + counts.skipped;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{importTitle(item)}</span>
        <Badge tone={statusTone(status)}>{STATUS_LABEL[status]}</Badge>
        <span className="text-muted-foreground" aria-live="polite">
          {item.progress}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Import progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={item.progress}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className={status === "failed" ? "h-full bg-red-500" : "h-full bg-primary"} style={{ width: `${item.progress}%` }} />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {figures.map(([label, value]) => (
          <div key={label} className="rounded-md border p-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-base font-semibold tabular-nums">{value.toLocaleString("en-US")}</dd>
          </div>
        ))}
      </dl>
      {item.error ? <Alert variant={status === "failed" ? "error" : "default"}>{item.error.message}</Alert> : null}
      {item.truncated ? (
        <Alert variant="warning">
          {item.truncated.reason === "source_limit"
            ? `Apollo lets only the first ${item.truncated.considered.toLocaleString("en-US")} of about ${item.truncated.matched.toLocaleString("en-US")} contacts be read. Narrow the selection to reach the others.`
            : crm
            ? `The workbook filled up: the first ${item.truncated.considered.toLocaleString("en-US")} of about ${item.truncated.matched.toLocaleString("en-US")} records were read.`
            : `${item.truncated.matched.toLocaleString("en-US")} prospects matched; only the first ${item.truncated.considered.toLocaleString("en-US")} fit a workbook and were considered.`}
        </Alert>
      ) : null}
      {status === "completed" && counts.imported === 0 ? (
        sheet?.pull && counts.duplicates + counts.failed + counts.skipped === 0 ? (
          <Alert variant="success">No new rows: everything in the tab has already been added.</Alert>
        ) : (
          <Alert variant="warning">No rows were added to the workbook.</Alert>
        )
      ) : null}
      {status === "completed" && counts.imported > 0 ? (
        <Alert variant={!file && left > 0 ? "warning" : "success"}>
          <p>{counts.imported.toLocaleString("en-US")} rows were added to the workbook.</p>
          {!file && left > 0 ? <p>{left.toLocaleString("en-US")} were not added; the report says why.</p> : null}
        </Alert>
      ) : null}
      {isRunning(status) ? <p className="text-sm text-muted-foreground">You can keep working or leave this page; the import carries on.</p> : null}
      {downloadError ? <Alert variant="error">{downloadError}</Alert> : null}
      <div className="flex flex-wrap gap-3">
        {item.report.available ? (
          <Button type="button" variant="outline" onClick={onDownload} disabled={downloading}>
            <Download aria-hidden />
            {downloading ? "Downloading…" : `Download skipped rows (${item.report.rows.toLocaleString("en-US")})`}
          </Button>
        ) : null}
        <Button type="button" variant={isRunning(status) ? "ghost" : "default"} onClick={onClose}>
          {isRunning(status) ? "Close" : (closeLabel ?? "Import another file")}
        </Button>
      </div>
    </div>
  );
}
