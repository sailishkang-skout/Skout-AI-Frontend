"use client";

import { useState } from "react";
import { Download, FileUp, Upload } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { IMPORT_TARGET_FIELDS, type DetectedSheet } from "@/lib/import-prospects";

export interface ImportUploadPanelProps {
  isParsing: boolean;
  parseError: string | null;
  source: string | null;
  rowCount: number;
  warnings: string[];
  sheets: DetectedSheet[];
  onFileSelected: (file: File) => void;
  onReparseWithMapping: (headerMap: Record<string, string>) => void;
  onDownloadSample: (format: "csv" | "xlsx") => void;
  downloadingSample?: "csv" | "xlsx" | null;
}

/**
 * Shared upload card for both /import and /admin/import: dropzone, sample-template downloads,
 * parse error/warning display, and a manual column-mapping editor (shown automatically when a
 * parse comes back with zero rows but some columns were detected — the "columns don't match"
 * case — and otherwise available via "Adjust mapping").
 */
export function ImportUploadPanel({
  isParsing,
  parseError,
  source,
  rowCount,
  warnings,
  sheets,
  onFileSelected,
  onReparseWithMapping,
  onDownloadSample,
  downloadingSample,
}: ImportUploadPanelProps) {
  const [mappingOpen, setMappingOpen] = useState(false);
  const [headerMap, setHeaderMap] = useState<Record<string, string>>({});

  const shouldPromptMapping = rowCount === 0 && sheets.some((s) => s.headers.length > 0);
  const showMappingEditor = shouldPromptMapping || mappingOpen;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="h-4 w-4" />
          Upload file
        </CardTitle>
        <CardDescription>
          CSV / Excel preferred. PDF and PNG/JPEG use OCR when needed. SVG is parsed as text (not
          OCR). Max 8MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center hover:border-primary/50">
          <FileUp className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium">
            {isParsing ? "Parsing…" : "Choose CSV, Excel, PDF, PNG, or SVG"}
          </span>
          <input
            type="file"
            className="hidden"
            accept=".csv,.xlsx,.xls,.pdf,.svg,.png,.jpg,.jpeg,.webp,.gif,text/csv,image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            disabled={isParsing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setHeaderMap({});
                setMappingOpen(false);
                onFileSelected(file);
              }
              e.target.value = "";
            }}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Not sure of the format?</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline disabled:opacity-50"
            onClick={() => onDownloadSample("csv")}
            disabled={downloadingSample === "csv"}
          >
            <Download className="h-3 w-3" />
            {downloadingSample === "csv" ? "Downloading…" : "Sample CSV"}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline disabled:opacity-50"
            onClick={() => onDownloadSample("xlsx")}
            disabled={downloadingSample === "xlsx"}
          >
            <Download className="h-3 w-3" />
            {downloadingSample === "xlsx" ? "Downloading…" : "Sample Excel"}
          </button>
        </div>

        {parseError && (
          <Alert variant="error" dismissible>
            {parseError}
          </Alert>
        )}
        {source && (
          <p className="text-xs text-muted-foreground">
            Parsed via <span className="font-medium">{source}</span> · {rowCount} row
            {rowCount === 1 ? "" : "s"}
          </p>
        )}
        {warnings.map((w) => (
          <Alert key={w} variant="warning">
            {w}
          </Alert>
        ))}

        {sheets.length > 0 && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {shouldPromptMapping ? "Map columns manually" : "Detected columns"}
              </p>
              {!shouldPromptMapping && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => setMappingOpen((v) => !v)}
                >
                  {mappingOpen ? "Hide" : "Adjust mapping"}
                </button>
              )}
            </div>

            {showMappingEditor && (
              <>
                {sheets.map((sheet, sIdx) => (
                  <div key={sheet.sheetName ?? sIdx} className="space-y-1.5">
                    {sheet.sheetName && (
                      <p className="text-xs font-medium text-muted-foreground">
                        Sheet: {sheet.sheetName} ({sheet.rowCount} row
                        {sheet.rowCount === 1 ? "" : "s"} matched)
                      </p>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {sheet.headers.map((header) => {
                        const current = headerMap[header] ?? sheet.mappedHeaders[header] ?? "unmapped";
                        return (
                          <div key={header} className="flex items-center gap-2 text-xs">
                            <span className="w-1/2 shrink-0 truncate text-muted-foreground" title={header}>
                              {header}
                            </span>
                            <Select
                              className="h-8 text-xs"
                              value={current}
                              onChange={(e) =>
                                setHeaderMap((prev) => ({ ...prev, [header]: e.target.value }))
                              }
                            >
                              {IMPORT_TARGET_FIELDS.map((f) => (
                                <option key={f.value} value={f.value}>
                                  {f.label}
                                </option>
                              ))}
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isParsing || Object.keys(headerMap).length === 0}
                  onClick={() => onReparseWithMapping(headerMap)}
                >
                  Re-parse with this mapping
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
