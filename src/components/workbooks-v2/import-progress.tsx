"use client";

import { Download } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, isRunning, type WorkbookImport } from "@/lib/workbooks-v2-import";

/** How an import is going, straight from the server's counts, and its report of rows that were not added. */
export function ImportProgress({
  item,
  downloading,
  downloadError,
  onDownload,
  onClose,
}: {
  item: WorkbookImport;
  downloading: boolean;
  downloadError: string | null;
  onDownload: () => void;
  onClose: () => void;
}) {
  const { counts, status } = item;
  const figures: Array<[string, number]> = [
    ["Total rows", counts.total],
    ["Processed", counts.processed],
    ["Imported", counts.imported],
    ["Duplicates skipped", counts.duplicates],
    ["Invalid or failed", counts.failed],
    ["Empty rows skipped", counts.skipped],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{item.fileName}</span>
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
      {status === "completed" ? <Alert variant="success">{counts.imported.toLocaleString("en-US")} rows were added to the workbook.</Alert> : null}
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
          {isRunning(status) ? "Close" : "Import another file"}
        </Button>
      </div>
    </div>
  );
}
