"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, authQueryOptions, formatQueryError, useAuthReady } from "@/lib/api-client";
import { SHEETS_CONNECTION_KEY, useGoogleSheetsApi } from "@/lib/google-sheets";
import type { WorkbookImport } from "@/lib/workbooks-v2-import";
import { useWorkbookSheetsApi } from "@/lib/workbooks-v2-sheets";

/** Refusals that connecting Google again would fix. */
export const SHEETS_CONNECTION_CODES = new Set(["SHEETS_NOT_CONNECTED", "SHEETS_RECONNECT_REQUIRED", "SHEETS_SCOPE_MISSING"]);
export const codeOf = (error: unknown) => (error instanceof ApiError ? (error.body as { code?: string } | undefined)?.code : undefined);

export function SheetsSettingsLink({ children = "Open Settings → Google Sheets" }: { children?: React.ReactNode }) {
  return (
    <Link href="/settings/google-sheets" className="font-medium text-primary underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

/** The Google Sheets part of "Add rows" (WB2-025): your connection, a pasted link, a tab, then a preview. */
export function SheetsPicker({ workbookId, onPreview }: { workbookId: string; onPreview: (item: WorkbookImport) => void }) {
  const google = useGoogleSheetsApi();
  const api = useWorkbookSheetsApi();
  const authReady = useAuthReady();
  const [link, setLink] = useState("");
  const [tab, setTab] = useState<number | null>(null);
  const connection = useQuery({ ...authQueryOptions, staleTime: 0, queryKey: SHEETS_CONNECTION_KEY, queryFn: google.status, enabled: authReady });
  const connect = useMutation({ mutationFn: google.start, onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl) });
  const inspect = useMutation({
    mutationFn: (value: string) => api.inspect(workbookId, value),
    onSuccess: (found) => setTab(found.linkedSheetId ?? found.tabs[0]?.sheetId ?? null),
    onError: (error) => {
      if (SHEETS_CONNECTION_CODES.has(codeOf(error) ?? "")) void connection.refetch();
    },
  });
  // The same choice asked twice makes one preview; a different one makes another.
  const asked = useRef<{ body: string; key: string }>({ body: "", key: "" });
  const preview = useMutation({
    mutationFn: (body: { spreadsheet: string; sheetId: number }) => {
      const text = JSON.stringify(body);
      if (asked.current.body !== text) asked.current = { body: text, key: crypto.randomUUID() };
      return api.preview(workbookId, body, asked.current.key);
    },
    onSuccess: (next) => {
      asked.current = { body: "", key: "" };
      onPreview(next);
    },
    onError: (error) => {
      // The API refused, so the next attempt is a new question.
      if (error instanceof ApiError && error.status < 500) asked.current = { body: "", key: "" };
      if (SHEETS_CONNECTION_CODES.has(codeOf(error) ?? "")) void connection.refetch();
    },
  });

  if (connection.isError) {
    return (
      <Alert variant="error" onRetry={() => void connection.refetch()}>
        {formatQueryError(connection.error, "Your Google Sheets connection could not be loaded.")}
      </Alert>
    );
  }
  if (!connection.data) return <p className="text-sm text-muted-foreground">Checking your Google connection…</p>;
  const { status, configured } = connection.data;
  if (status !== "connected") {
    return (
      <Alert variant="warning">
        <p>
          {!configured
            ? "Google Sheets isn’t set up on this server."
            : status === "needs_reauth"
              ? "Your Google access expired or was removed. Reconnect to import."
              : "Connect your Google account to read your spreadsheets. Skout can’t change them."}
        </p>
        {configured ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button type="button" disabled={connect.isPending} onClick={() => connect.mutate()}>
              {connect.isPending ? "Opening Google…" : status === "needs_reauth" ? "Reconnect Google Sheets" : "Connect Google Sheets"}
            </Button>
            <span className="text-xs">You’ll finish in Settings; come back here afterwards.</span>
          </div>
        ) : null}
        {connect.error ? <p className="mt-2">{formatQueryError(connect.error, "The connection could not be started.")}</p> : null}
      </Alert>
    );
  }

  const found = inspect.data;
  const chosen = found?.tabs.find((t) => t.sheetId === tab);
  const refused = preview.error ?? inspect.error;
  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="success">Connected</Badge> Your Google account. <SheetsSettingsLink>Manage</SheetsSettingsLink>
      </p>
      <form
        className="space-y-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!link.trim()) return;
          preview.reset();
          inspect.mutate(link.trim());
        }}
      >
        <label htmlFor="sheet-link" className="text-sm font-semibold">
          Spreadsheet link
        </label>
        <div className="flex gap-2">
          <Input
            id="sheet-link"
            value={link}
            maxLength={2000}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            onChange={(e) => {
              setLink(e.target.value);
              inspect.reset();
              preview.reset();
            }}
          />
          <Button type="submit" variant="outline" disabled={!link.trim() || inspect.isPending}>
            {inspect.isPending ? "Opening…" : "Open"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Open the sheet in Google and copy its address. Only that spreadsheet is read.</p>
      </form>

      {found ? (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold">Tab of “{found.name}”</legend>
          {found.tabs.length ? (
            <ul className="max-h-40 divide-y overflow-y-auto rounded-md border text-sm">
              {found.tabs.map((t) => (
                <li key={t.sheetId}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-muted">
                    <input
                      type="radio"
                      name="sheet-tab"
                      checked={tab === t.sheetId}
                      onChange={() => {
                        setTab(t.sheetId);
                        preview.reset();
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    {t.sourceId ? <Badge tone="muted">In this workbook</Badge> : null}
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">This spreadsheet has no tabs of cells.</p>
          )}
          {chosen?.sourceId ? (
            <p className="text-xs text-muted-foreground">
              This tab was imported before. “Pull new rows” adds what is new; previewing it again lets you change which columns it fills.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {refused ? (
        <div className="space-y-2">
          <Alert variant="error">{formatQueryError(refused, "The spreadsheet could not be read.")}</Alert>
          {SHEETS_CONNECTION_CODES.has(codeOf(refused) ?? "") ? (
            <p className="text-sm">
              <SheetsSettingsLink />
            </p>
          ) : null}
        </div>
      ) : null}

      {found ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={!chosen || preview.isPending} onClick={() => preview.mutate({ spreadsheet: link.trim(), sheetId: chosen!.sheetId })}>
            {preview.isPending ? "Reading the tab…" : "Preview rows"}
          </Button>
          <p className="text-sm text-muted-foreground">Nothing is added until you confirm.</p>
        </div>
      ) : null}
    </div>
  );
}
