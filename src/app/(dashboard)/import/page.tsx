"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FileUp, Loader2, Trash2, Upload } from "lucide-react";
import { GuideLink } from "@/components/guides/guide-link";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useEnrichmentApi } from "@/lib/enrichment";
import { useImportApi, type ImportedProspectRow } from "@/lib/import-prospects";

export default function ImportProspectsPage() {
  const authReady = useAuthReady();
  const importApi = useImportApi();
  const enrichmentApi = useEnrichmentApi();
  const queryClient = useQueryClient();

  const [rows, setRows] = useState<ImportedProspectRow[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [listId, setListId] = useState("");
  const [listName, setListName] = useState("");
  const [autoEnrich, setAutoEnrich] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const lists = useQuery({
    queryKey: ["lists"],
    queryFn: enrichmentApi.listLists,
    enabled: authReady,
  });

  const parse = useMutation({
    mutationFn: (file: File) => importApi.parseFile(file),
    onSuccess: (res) => {
      setRows(res.data.rows);
      setSource(res.data.source);
      setWarnings(res.data.warnings);
      setParseError(null);
      setSuccessMsg(null);
    },
    onError: (err) => {
      setParseError(formatQueryError(err, "Could not parse file."));
      setRows([]);
    },
  });

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

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Import prospects"
        description="Upload CSV, Excel, PDF, PNG, or SVG. SVG is read as text; scans use OCR."
        actions={<GuideLink slug="import-prospects" label="Import guide" />}
      />

      <DemoBanner />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4" />
            Upload file
          </CardTitle>
          <CardDescription>
            CSV / Excel preferred. PDF and PNG/JPEG use OCR when needed. SVG is parsed as text (not OCR). Max 8MB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center hover:border-primary/50">
            <FileUp className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">
              {parse.isPending ? "Parsing…" : "Choose CSV, Excel, PDF, PNG, or SVG"}
            </span>
            <input
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls,.pdf,.svg,.png,.jpg,.jpeg,.webp,.gif,text/csv,image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              disabled={parse.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) parse.mutate(file);
                e.target.value = "";
              }}
            />
          </label>
          {parseError && (
            <Alert variant="error" dismissible>
              {parseError}
            </Alert>
          )}
          {source && (
            <p className="text-xs text-muted-foreground">
              Parsed via <span className="font-medium">{source}</span> · {rows.length} row
              {rows.length === 1 ? "" : "s"}
            </p>
          )}
          {warnings.map((w) => (
            <Alert key={w} variant="warning">
              {w}
            </Alert>
          ))}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview & destination</CardTitle>
            <CardDescription>
              Showing {preview.length} of {rows.length}. Import into an existing list or create one.
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
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr key={`${row.fullName}-${idx}`} className="border-b last:border-0">
                      <td className="px-3 py-2">{row.fullName}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.email ?? "—"}</td>
                      <td className="px-3 py-2">{row.companyDomain}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.jobTitle ?? "—"}</td>
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
    </PageShell>
  );
}
