"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { GuideLink } from "@/components/guides/guide-link";
import { DemoBanner } from "@/components/layout/demo-banner";
import { ImportUploadPanel } from "@/components/import/import-upload-panel";
import { ProviderImportPanel } from "@/components/import/provider-import-panel";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useEnrichmentApi } from "@/lib/enrichment";
import { IMPORT_PROVIDERS } from "@/lib/import-adapters";
import { useImportApi, type DetectedSheet, type ImportedProspectRow } from "@/lib/import-prospects";
import { cn } from "@/lib/utils";
import type { ImportProvider } from "@/types/api";

type ImportMode = "csv" | ImportProvider;

export default function ImportProspectsPage() {
  const authReady = useAuthReady();
  const importApi = useImportApi();
  const enrichmentApi = useEnrichmentApi();
  const queryClient = useQueryClient();

  const [rows, setRows] = useState<ImportedProspectRow[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sheets, setSheets] = useState<DetectedSheet[]>([]);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [downloadingSample, setDownloadingSample] = useState<"csv" | "xlsx" | null>(null);
  const [listId, setListId] = useState("");
  const [listName, setListName] = useState("");
  const [autoEnrich, setAutoEnrich] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>("csv");

  const lists = useQuery({
    queryKey: ["lists"],
    queryFn: enrichmentApi.listLists,
    enabled: authReady,
  });

  const parse = useMutation({
    mutationFn: ({ file, headerMap }: { file: File; headerMap?: Record<string, string> }) =>
      importApi.parseFile(file, headerMap),
    onSuccess: (res) => {
      setRows(res.data.rows);
      setSource(res.data.source);
      setWarnings(res.data.warnings);
      setSheets(res.data.sheets ?? []);
      setParseError(null);
      setSuccessMsg(null);
    },
    onError: (err) => {
      setParseError(formatQueryError(err, "Could not parse file."));
      setRows([]);
    },
  });

  const handleDownloadSample = async (format: "csv" | "xlsx") => {
    setDownloadingSample(format);
    try {
      await importApi.downloadSample(format);
    } catch (err) {
      setParseError(formatQueryError(err, "Could not download sample file."));
    } finally {
      setDownloadingSample(null);
    }
  };

  const commit = useMutation({
    mutationFn: () =>
      importApi.commit({
        rows,
        listId: listId || undefined,
        listName: !listId && listName.trim() ? listName.trim() : undefined,
        autoEnrich,
      }),
    onSuccess: (res) => {
      setSuccessMsg(
        `Imported ${res.data.imported} prospect${res.data.imported === 1 ? "" : "s"}${
          res.data.listName ? ` into “${res.data.listName}”` : ""
        }.`
      );
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
    },
  });

  const preview = useMemo(() => rows.slice(0, 50), [rows]);
  const hasRevenue = useMemo(() => rows.some((r) => r.companyRevenue), [rows]);

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Import prospects"
        description="Upload CSV, Excel, PDF, PNG, or SVG. SVG is read as text; scans use OCR."
        actions={<GuideLink slug="import-prospects" label="Import guide" />}
      />

      <DemoBanner />

      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "csv"}
          onClick={() => setMode("csv")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "csv" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          File (CSV / Excel)
        </button>
        {IMPORT_PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={mode === p.id}
            onClick={() => setMode(p.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === p.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {mode !== "csv" ? (
        <ProviderImportPanel
          provider={mode}
          description={IMPORT_PROVIDERS.find((p) => p.id === mode)?.description ?? ""}
        />
      ) : (
      <>
      <ImportUploadPanel
        isParsing={parse.isPending}
        parseError={parseError}
        source={source}
        rowCount={rows.length}
        warnings={warnings}
        sheets={sheets}
        onFileSelected={(file) => {
          setLastFile(file);
          parse.mutate({ file });
        }}
        onReparseWithMapping={(headerMap) => {
          if (lastFile) parse.mutate({ file: lastFile, headerMap });
        }}
        onDownloadSample={handleDownloadSample}
        downloadingSample={downloadingSample}
      />

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview & destination</CardTitle>
            <CardDescription>
              Showing {preview.length} of {rows.length}. Import into an existing list or create one.
              {hasRevenue && " Revenue is shown for reference only — it isn't stored on import."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Existing list</label>
                <Select value={listId} onChange={(e) => setListId(e.target.value)}>
                  <option value="">— None / new list —</option>
                  {(lists.data?.data ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.prospectCount})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Or new list name</label>
                <Input
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="Imported contacts"
                  disabled={Boolean(listId)}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoEnrich}
                onChange={(e) => setAutoEnrich(e.target.checked)}
              />
              Auto-enrich first 50 imported prospects
            </label>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Domain</th>
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">LinkedIn</th>
                    <th className="px-3 py-2">Country</th>
                    <th className="px-3 py-2">City</th>
                    {hasRevenue && <th className="px-3 py-2">Revenue</th>}
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr key={`${row.fullName}-${idx}`} className="border-b last:border-0">
                      <td className="px-3 py-2">{row.fullName}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.email ?? "—"}</td>
                      <td className="px-3 py-2">{row.companyDomain}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.companyName ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.jobTitle ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.phone ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.linkedinUrl ? (
                          <a
                            href={row.linkedinUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            Profile
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{row.country ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.city ?? "—"}</td>
                      {hasRevenue && (
                        <td className="px-3 py-2 text-muted-foreground">{row.companyRevenue ?? "—"}</td>
                      )}
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remove row"
                          onClick={() =>
                            setRows((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {commit.error && (
              <Alert variant="error">{formatQueryError(commit.error, "Import failed.")}</Alert>
            )}
            {successMsg && (
              <Alert variant="success">
                {successMsg}{" "}
                {commit.data?.data.listId && (
                  <Link href={`/lists/${commit.data.data.listId}`} className="font-medium underline">
                    Open list
                  </Link>
                )}
              </Alert>
            )}

            <Button
              onClick={() => commit.mutate()}
              disabled={commit.isPending || rows.length === 0}
            >
              {commit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Import {rows.length} prospect{rows.length === 1 ? "" : "s"}
            </Button>
          </CardContent>
        </Card>
      )}
      </>
      )}
    </PageShell>
  );
}
