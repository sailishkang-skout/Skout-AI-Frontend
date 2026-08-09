"use client";

/**
 * Static-auth admin data-import page.
 *
 * NOT gated by Clerk — reachable by anyone who knows the shared ADMIN_IMPORT_SECRET
 * (see apps/api/src/plugins/auth.ts, the `admin_<secret>` bearer-token path). Intended
 * for ops/internal use: loading bulk seed data (e.g. a purchased contact list) without
 * requiring a full Skout account. Every row lands in the single workspace configured
 * server-side via ADMIN_IMPORT_WORKSPACE_ID — this page never asks which workspace,
 * by design, so a leaked secret can't be used to write into an arbitrary tenant.
 *
 * Reuses the exact same parse → preview → commit flow as the regular, Clerk-authed
 * /import page (apps/api's /api/v1/import/prospects/parse and /api/v1/import/prospects);
 * only the auth mechanism and the destination-picker differ.
 */

import { useState } from "react";
import { useMutation as useRQMutation } from "@tanstack/react-query";
import { Loader2, Lock, Trash2 } from "lucide-react";
import { ImportUploadPanel } from "@/components/import/import-upload-panel";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError, formatQueryError } from "@/lib/api-client";
import { downloadSampleWithToken, fileToBase64, type DetectedSheet, type ImportedProspectRow } from "@/lib/import-prospects";

const SESSION_KEY = "skout_admin_import_token";

interface ParseResponse {
  data: { rows: ImportedProspectRow[]; total: number; source: string; warnings: string[]; sheets: DetectedSheet[] };
}
interface CommitResponse {
  data: { imported: number; listId: string | null; listName: string | null; prospectIds: string[]; skipped: number };
}
interface PingResponse {
  data: { ok: boolean; workspaceId: string };
}

export default function AdminImportPage() {
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? window.sessionStorage.getItem(SESSION_KEY) : null
  );

  return token ? (
    <UploadPanel
      token={token}
      onLock={() => {
        window.sessionStorage.removeItem(SESSION_KEY);
        setToken(null);
      }}
    />
  ) : (
    <PasswordGate
      onUnlock={(t) => {
        window.sessionStorage.setItem(SESSION_KEY, t);
        setToken(t);
      }}
    />
  );
}

function PasswordGate({ onUnlock }: { onUnlock: (token: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const verify = useRQMutation({
    mutationFn: async (pw: string) => {
      const authToken = `admin_${pw}`;
      await apiFetch<PingResponse>("/api/v1/import/admin/ping", { authToken });
      return authToken;
    },
    onSuccess: (authToken) => onUnlock(authToken),
    onError: (err) => {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Incorrect password."
          : formatQueryError(err, "Could not reach the API.")
      );
    },
  });

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            Admin data import
          </CardTitle>
          <CardDescription>
            Internal ops tool — bulk-load prospect data without a Skout account. Enter the
            shared import password to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (password.trim()) verify.mutate(password.trim());
            }}
            className="space-y-3"
          >
            <Input
              type="password"
              autoFocus
              placeholder="Shared password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={verify.isPending}
            />
            {error && (
              <Alert variant="error" dismissible>
                {error}
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={verify.isPending || !password.trim()}>
              {verify.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Unlock
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function UploadPanel({ token, onLock }: { token: string; onLock: () => void }) {
  const [rows, setRows] = useState<ImportedProspectRow[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sheets, setSheets] = useState<DetectedSheet[]>([]);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [downloadingSample, setDownloadingSample] = useState<"csv" | "xlsx" | null>(null);
  const [listName, setListName] = useState("");
  const [autoEnrich, setAutoEnrich] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const parse = useRQMutation({
    mutationFn: async ({ file, headerMap }: { file: File; headerMap?: Record<string, string> }) => {
      const base64 = await fileToBase64(file);
      return apiFetch<ParseResponse>("/api/v1/import/prospects/parse", {
        method: "POST",
        authToken: token,
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          base64,
          headerMap,
        }),
      });
    },
    onSuccess: (res) => {
      setRows(res.data.rows);
      setSource(res.data.source);
      setWarnings(res.data.warnings);
      setSheets(res.data.sheets ?? []);
      setParseError(null);
      setSuccessMsg(null);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        onLock(); // session expired / password rotated — send back to the gate
        return;
      }
      setParseError(formatQueryError(err, "Could not parse file."));
      setRows([]);
    },
  });

  const handleDownloadSample = async (format: "csv" | "xlsx") => {
    setDownloadingSample(format);
    try {
      await downloadSampleWithToken(format, token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onLock();
      } else {
        setParseError(formatQueryError(err, "Could not download sample file."));
      }
    } finally {
      setDownloadingSample(null);
    }
  };

  const commit = useRQMutation({
    mutationFn: () =>
      apiFetch<CommitResponse>("/api/v1/import/prospects", {
        method: "POST",
        authToken: token,
        body: JSON.stringify({
          rows,
          listName: listName.trim() || undefined,
          autoEnrich,
        }),
      }),
    onSuccess: (res) => {
      setSuccessMsg(
        `Imported ${res.data.imported} prospect${res.data.imported === 1 ? "" : "s"}${
          res.data.listName ? ` into “${res.data.listName}”` : ""
        }.`
      );
      setRows([]);
      setSheets([]);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) onLock();
    },
  });

  const preview = rows.slice(0, 50);
  const hasRevenue = rows.some((r) => r.companyRevenue);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 py-10 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Admin data import</h1>
          <p className="text-sm text-muted-foreground">
            Upload CSV, Excel, PDF, PNG, or SVG. Rows are activated into the configured admin
            workspace — not a specific user&apos;s account.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onLock}>
          Lock
        </Button>
      </div>

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
            <CardTitle className="text-base">Preview & commit</CardTitle>
            <CardDescription>
              Showing {preview.length} of {rows.length}.
              {hasRevenue && " Revenue is shown for reference only — it isn't stored on import."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">List name (optional)</label>
              <Input
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="e.g. Apollo bulk import — 2026-08-04"
              />
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
                          onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {commit.error && !(commit.error instanceof ApiError && commit.error.status === 401) && (
              <Alert variant="error">{formatQueryError(commit.error, "Import failed.")}</Alert>
            )}
            {successMsg && <Alert variant="success">{successMsg}</Alert>}

            <Button onClick={() => commit.mutate()} disabled={commit.isPending || rows.length === 0}>
              {commit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Import {rows.length} prospect{rows.length === 1 ? "" : "s"}
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
