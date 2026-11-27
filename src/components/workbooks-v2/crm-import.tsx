"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DatabaseZap } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFeatureOn } from "@/lib/access";
import { ApiError, authQueryOptions, formatQueryError, useAuthReady } from "@/lib/api-client";
import { useCrmApi } from "@/lib/crm";
import { OBJECT_LABEL, importBody, selectionProblem, useWorkbookCrmApi, type CrmObject, type CrmProvider, type CrmSelection } from "@/lib/workbooks-v2-crm";
import { isRunning, refusalReasons, useWorkbookImportApi, type confirmBody } from "@/lib/workbooks-v2-import";
import { POLL_MS } from "./csv-import";
import { CrmFieldPicker, CrmSelectionPicker } from "./crm-selection";
import { ImportProgress } from "./import-progress";
import { MappingStep } from "./mapping-step";

const KEY = "workbooks-v2";

const STATUS: Record<CrmProvider["status"], { label: string; tone: "success" | "warning" | "muted" }> = {
  connected: { label: "Connected", tone: "success" },
  needs_reauth: { label: "Reconnect required", tone: "warning" },
  not_connected: { label: "Not connected", tone: "muted" },
  not_configured: { label: "Not set up on this server", tone: "muted" },
  not_available: { label: "Not available yet", tone: "muted" },
};

const codeOf = (error: unknown) => (error instanceof ApiError ? (error.body as { code?: string } | undefined)?.code : undefined);
/** Refusals that reconnecting the CRM would fix. */
const RECONNECT = new Set(["CRM_RECONNECT_REQUIRED", "CRM_SCOPE_MISSING", "CRM_NOT_CONNECTED"]);

/** Shown where CRM is part of the workspace's plan; the API refuses it elsewhere. */
export function CrmImport({ workbook }: { workbook: { id: string; name: string } }) {
  return useFeatureOn("crm") ? <CrmImportCard workbook={workbook} /> : null;
}

/**
 * "Import from your CRM" (WB2-023): choose a connected CRM, contacts or companies, which records and which fields,
 * check the preview and mapping, confirm, and follow the import. The preview and progress are the CSV import's own.
 */
function CrmImportCard({ workbook }: { workbook: { id: string; name: string } }) {
  const api = useWorkbookCrmApi();
  const imports = useWorkbookImportApi();
  const crm = useCrmApi();
  const client = useQueryClient();
  const authReady = useAuthReady();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState("");
  const [object, setObject] = useState<CrmObject>("contact");
  const [selection, setSelection] = useState<CrmSelection>({ kind: "all" });
  const [fields, setFields] = useState<string[] | null>(null);
  const [importId, setImportId] = useState<string | null>(null);

  const sources = useQuery({ ...authQueryOptions, queryKey: [KEY, workbook.id, "crm-sources"], queryFn: () => api.sources(workbook.id), enabled: authReady && open });
  const chosen = sources.data?.find((s) => s.provider === provider);
  const connected = chosen?.status === "connected";
  const info = useQuery({
    ...authQueryOptions,
    // A refusal says what to do; asking again would only repeat it.
    retry: false,
    queryKey: [KEY, workbook.id, "crm-object", provider, object],
    queryFn: () => api.describe(workbook.id, provider, object),
    enabled: authReady && open && connected && !importId,
  });
  const picked = fields ?? info.data?.defaultFields ?? [];
  const problem = info.data ? selectionProblem(picked, selection) : null;

  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: [KEY], exact: true });
    for (const part of ["imports", "rows", "columns"]) void client.invalidateQueries({ queryKey: [KEY, workbook.id, part] });
  }, [client, workbook.id]);
  const recheck = () => void client.invalidateQueries({ queryKey: [KEY, workbook.id, "crm-sources"] });

  const current = useQuery({
    ...authQueryOptions,
    queryKey: [KEY, workbook.id, "import", importId],
    queryFn: () => imports.get(workbook.id, importId!),
    enabled: authReady && Boolean(importId),
    refetchInterval: (query) => (query.state.data && isRunning(query.state.data.status) ? POLL_MS : false),
  });
  const item = importId ? current.data : undefined;
  const columns = useQuery({
    ...authQueryOptions,
    queryKey: [KEY, workbook.id, "columns"],
    queryFn: () => imports.columns(workbook.id),
    enabled: authReady && item?.status === "awaiting_confirmation",
  });
  const show = (next: NonNullable<typeof item>) => {
    client.setQueryData([KEY, next.workbookId, "import", next.id], next);
    setImportId(next.id);
    refresh();
  };

  // The same choice asked twice makes one preview; a different one makes another.
  const asked = useRef<{ body: string; key: string }>({ body: "", key: "" });
  const preview = useMutation({
    mutationFn: () => {
      const body = importBody(provider, object, picked, selection);
      const text = JSON.stringify(body);
      if (asked.current.body !== text) asked.current = { body: text, key: crypto.randomUUID() };
      return api.preview(workbook.id, body, asked.current.key);
    },
    onSuccess: (next) => {
      asked.current = { body: "", key: "" };
      show(next);
    },
    onError: (error) => {
      // The API refused, so the next attempt is a new question.
      if (error instanceof ApiError && error.status < 500) asked.current = { body: "", key: "" };
      if (RECONNECT.has(codeOf(error) ?? "")) recheck();
    },
  });
  const confirm = useMutation({
    mutationFn: (body: ReturnType<typeof confirmBody>) => imports.confirm(workbook.id, importId!, body),
    onSuccess: show,
    onError: (error) => {
      if (RECONNECT.has(codeOf(error) ?? "")) recheck();
      void current.refetch();
    },
  });
  const cancel = useMutation({
    mutationFn: () => imports.cancel(workbook.id, importId!),
    onSuccess: () => {
      setImportId(null);
      refresh();
    },
  });
  const download = useMutation({
    mutationFn: async (id: string) => {
      const url = URL.createObjectURL(await imports.report(workbook.id, id));
      const link = document.createElement("a");
      link.href = url;
      link.download = `skipped-rows-${id.slice(0, 8)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });
  // The existing connection flow: the CRM's sign-in, which returns to CRM settings.
  const connect = useMutation({ mutationFn: crm.connectHubSpot, onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl) });

  const status = item?.status;
  useEffect(() => {
    if (status === "completed" || status === "failed") {
      refresh();
      // A failed import may mean the connection stopped working.
      if (status === "failed") void client.invalidateQueries({ queryKey: [KEY, workbook.id, "crm-sources"] });
    }
  }, [status, refresh, client, workbook.id]);

  const restart = () => {
    setImportId(null);
    preview.reset();
    confirm.reset();
    cancel.reset();
    download.reset();
  };
  const changed = () => {
    setSelection({ kind: "all" });
    setFields(null);
    preview.reset();
    connect.reset();
  };

  const reconnect = chosen && provider === "hubspot" && chosen.status !== "not_configured";
  const connectButton = (label: string) => (
    <Button type="button" onClick={() => connect.mutate()} disabled={connect.isPending}>
      {connect.isPending ? "Opening HubSpot…" : label}
    </Button>
  );

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Import from your CRM</h2>
            <p className="text-sm text-muted-foreground">Contacts or companies from a CRM your workspace has connected.</p>
          </div>
          <Button type="button" variant={open ? "ghost" : "default"} onClick={() => setOpen((v) => !v)}>
            {open ? null : <DatabaseZap aria-hidden />}
            {open ? "Close" : "Import from a CRM"}
          </Button>
        </div>

        {open ? (
          importId ? (
            <div className="space-y-4">
              {!item ? (
                current.isError ? (
                  <Alert variant="error" onRetry={() => void current.refetch()}>
                    {formatQueryError(current.error, "This import could not be loaded.")}
                  </Alert>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading the import…</p>
                )
              ) : item.status === "awaiting_confirmation" && item.preview ? (
                columns.data ? (
                  <MappingStep
                    key={item.id}
                    upload={item}
                    preview={item.preview}
                    columns={columns.data}
                    busy={confirm.isPending || cancel.isPending}
                    errors={[...refusalReasons(confirm.error, "The import could not be started."), ...refusalReasons(cancel.error, "The import could not be cancelled.")]}
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
                <>
                  {current.isError ? <Alert variant="warning">The latest progress could not be loaded. Trying again.</Alert> : null}
                  <ImportProgress
                    item={item}
                    closeLabel="Import more"
                    downloading={download.isPending}
                    downloadError={download.error ? formatQueryError(download.error, "The report could not be downloaded.") : null}
                    onDownload={() => download.mutate(item.id)}
                    onClose={restart}
                  />
                </>
              )}
            </div>
          ) : sources.isError ? (
            <Alert variant="error" onRetry={() => void sources.refetch()}>
              {formatQueryError(sources.error, "Your CRMs could not be loaded.")}
            </Alert>
          ) : !sources.data ? (
            <p className="text-sm text-muted-foreground">Loading your CRMs…</p>
          ) : (
            <div className="space-y-5">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">CRM</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {sources.data.map((source) => (
                    <label
                      key={source.provider}
                      className={`flex items-center gap-2 rounded-md border p-3 text-sm ${source.status === "not_available" ? "opacity-60" : "cursor-pointer hover:border-primary/50"}`}
                    >
                      <input
                        type="radio"
                        name="crm-provider"
                        checked={provider === source.provider}
                        disabled={source.status === "not_available"}
                        onChange={() => {
                          setProvider(source.provider);
                          setObject(source.objects[0] ?? "contact");
                          changed();
                        }}
                      />
                      <span className="flex-1 font-medium">{source.label}</span>
                      <Badge tone={STATUS[source.status].tone}>{STATUS[source.status].label}</Badge>
                    </label>
                  ))}
                </div>
              </fieldset>

              {chosen && !connected ? (
                <Alert variant="warning">
                  <p>
                    {chosen.status === "not_configured"
                      ? `${chosen.label} hasn’t been set up on this server, so it can’t be connected here.`
                      : chosen.status === "needs_reauth"
                        ? `${chosen.label} access expired or was revoked. Reconnect it to import.`
                        : `${chosen.label} isn’t connected yet.`}
                  </p>
                  {reconnect ? (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {connectButton(chosen.status === "needs_reauth" ? `Reconnect ${chosen.label}` : `Connect ${chosen.label}`)}
                      <span className="text-xs">You’ll finish in CRM settings; come back here afterwards.</span>
                    </div>
                  ) : null}
                </Alert>
              ) : null}
              {connect.error ? <Alert variant="error">{formatQueryError(connect.error, "The connection could not be started.")}</Alert> : null}

              {connected ? (
                <>
                  <fieldset>
                    <legend className="mb-1 text-sm font-semibold">Import</legend>
                    <div className="flex gap-5 text-sm">
                      {chosen!.objects.map((value) => (
                        <label key={value} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="crm-object"
                            checked={object === value}
                            onChange={() => {
                              setObject(value);
                              changed();
                            }}
                          />
                          {OBJECT_LABEL[value]}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {info.isError ? (
                    <div className="space-y-2">
                      <Alert variant="error" onRetry={() => void info.refetch()}>
                        {formatQueryError(info.error, "These records could not be read.")}
                      </Alert>
                      {reconnect && RECONNECT.has(codeOf(info.error) ?? "") ? connectButton(`Reconnect ${chosen!.label}`) : null}
                    </div>
                  ) : !info.data ? (
                    <p className="text-sm text-muted-foreground">Reading {chosen!.label}…</p>
                  ) : (
                    <>
                      <CrmSelectionPicker
                        info={info.data}
                        selection={selection}
                        onChange={(next) => {
                          setSelection(next);
                          preview.reset();
                        }}
                      />
                      <CrmFieldPicker
                        info={info.data}
                        chosen={picked}
                        onChange={(next) => {
                          setFields(next);
                          preview.reset();
                        }}
                      />
                      {preview.error ? (
                        <div className="space-y-2">
                          <Alert variant="error">{formatQueryError(preview.error, "The records could not be previewed.")}</Alert>
                          {reconnect && RECONNECT.has(codeOf(preview.error) ?? "") ? connectButton(`Reconnect ${chosen!.label}`) : null}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-3">
                        <Button type="button" disabled={Boolean(problem) || preview.isPending} onClick={() => preview.mutate()}>
                          {preview.isPending ? "Reading records…" : "Preview records"}
                        </Button>
                        <p className="text-sm text-muted-foreground">{problem ?? "Nothing is added until you confirm."}</p>
                      </div>
                    </>
                  )}
                </>
              ) : null}
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
