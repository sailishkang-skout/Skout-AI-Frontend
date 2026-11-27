"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, RefreshCw, Webhook } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { authQueryOptions, formatQueryError, useAuthReady } from "@/lib/api-client";
import { DEDUPE_OPTIONS, useWorkbookImportApi, type DedupeKey, type WorkbookColumn } from "@/lib/workbooks-v2-import";
import { exampleRequest, keyColumns, lastResultText, useWorkbookWebhookApi, webhookKey, type WorkbookWebhook } from "@/lib/workbooks-v2-webhook";
import { rowsKey } from "./use-row-window";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

/** A read-only value with a button that copies it. */
function Copyable({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  };
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex gap-2">
        <Input readOnly value={value} aria-label={label} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button type="button" variant="outline" onClick={() => void copy()} aria-label={`Copy ${label.toLowerCase()}`}>
          <Copy aria-hidden />
          {copied === "yes" ? "Copied" : "Copy"}
        </Button>
      </div>
      {copied === "failed" ? <p className="text-xs text-red-600">It couldn’t be copied. Select the text and copy it yourself.</p> : null}
    </div>
  );
}

/** How the webhook finds rows the workbook already has. */
function DuplicateSetting({ webhook, columns, busy, onSave }: { webhook: WorkbookWebhook; columns: WorkbookColumn[]; busy: boolean; onSave: (dedupe: WorkbookWebhook["dedupe"]) => void }) {
  const saved = webhook.dedupe;
  const [draft, setDraft] = useState<{ key: DedupeKey; columnId: string } | null>(null);
  const key = draft?.key ?? saved.key;
  const options = keyColumns(columns, key);
  const wanted = draft ? draft.columnId : (saved.columnId ?? "");
  const columnId = options.some((c) => c.id === wanted) ? wanted : "";
  const changed = key !== saved.key || (key !== "none" && columnId !== (saved.columnId ?? ""));
  const broken = !draft && saved.key !== "none" && columns.length > 0 && !options.some((c) => c.id === saved.columnId);
  return (
    <fieldset className="space-y-2" disabled={busy}>
      <legend className="text-sm font-medium">Duplicate rows</legend>
      {broken ? <Alert variant="warning">The column used to check duplicates is missing or has changed. Requests are refused until you save a new choice.</Alert> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Check duplicates by"
          className="w-auto"
          value={key}
          onChange={(e) => {
            const next = e.target.value as DedupeKey;
            setDraft({ key: next, columnId: keyColumns(columns, next)[0]?.id ?? "" });
          }}
        >
          {DEDUPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value === "none" ? "Add every row" : `Leave out repeats by ${o.label}`}
            </option>
          ))}
        </Select>
        {key !== "none" ? (
          <Select aria-label="Column to check" className="w-auto" value={columnId} onChange={(e) => setDraft({ key, columnId: e.target.value })}>
            {columnId ? null : <option value="">Choose a column</option>}
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        ) : null}
        <Button type="button" size="sm" variant="outline" disabled={!changed || (key !== "none" && !columnId)} onClick={() => onSave(key === "none" ? { key } : { key, columnId })}>
          Save
        </Button>
      </div>
      {key !== "none" && !options.length ? <p className="text-xs text-muted-foreground">No column in this workbook can hold that. Add one first.</p> : null}
    </fieldset>
  );
}

/**
 * The chosen workbook's inbound webhook (WB2-026). Viewers see its status; editors make it, replace its token, turn it
 * on or off and choose how duplicates are found. A new token is held only until it is dismissed. Render with the
 * workbook's id as `key`, so nothing carries over to another workbook.
 */
export function WebhookCard({ workbook, canEdit }: { workbook: { id: string; name: string }; canEdit: boolean }) {
  const workbookId = workbook.id;
  const api = useWorkbookWebhookApi();
  const columnsApi = useWorkbookImportApi();
  const client = useQueryClient();
  const authReady = useAuthReady();
  const [confirming, setConfirming] = useState<"regenerate" | "disable" | null>(null);

  const query = useQuery({ ...authQueryOptions, queryKey: webhookKey(workbookId), queryFn: () => api.get(workbookId), enabled: authReady });
  const webhook = query.data;
  const columns = useQuery({ ...authQueryOptions, queryKey: ["workbooks-v2", workbookId, "columns"], queryFn: () => columnsApi.columns(workbookId), enabled: authReady && Boolean(webhook) });

  const reread = () => client.invalidateQueries({ queryKey: webhookKey(workbookId) });
  // The answer holds the token, so it is not kept once this card is gone.
  const issue = useMutation({
    gcTime: 0,
    mutationFn: (action: "create" | "regenerate") => (action === "create" ? api.create(workbookId) : api.regenerate(workbookId)),
    onSettled: () => {
      setConfirming(null);
      return reread();
    },
  });
  const change = useMutation({
    mutationFn: (body: Parameters<typeof api.update>[1]) => api.update(workbookId, body),
    onSuccess: (data) => client.setQueryData(webhookKey(workbookId), data),
    onSettled: () => {
      setConfirming(null);
      return reread();
    },
  });
  const busy = issue.isPending || change.isPending;
  const token = issue.data?.token;
  /** A new action clears the last one's error. A token on screen stays until it is dismissed. */
  const act = (run: () => void) => {
    change.reset();
    if (!token) issue.reset();
    run();
  };

  /** Rows arrive without anything here knowing, so the person asks. */
  const refresh = () => {
    void reread();
    void client.invalidateQueries({ queryKey: rowsKey(workbookId) });
    void client.invalidateQueries({ queryKey: ["workbooks-v2"], exact: true });
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5 text-sm">
        <section aria-labelledby="webhook-title" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Webhook className="h-5 w-5 text-muted-foreground" aria-hidden />
            <h2 id="webhook-title" className="text-base font-semibold">
              Inbound webhook
            </h2>
            {webhook ? <Badge tone={webhook.enabled ? "success" : "muted"}>{webhook.enabled ? "Enabled" : "Disabled"}</Badge> : null}
            {webhook ? (
              <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={refresh} disabled={query.isFetching}>
                <RefreshCw className={query.isFetching ? "animate-spin" : ""} aria-hidden />
                Refresh
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground">Other systems can add rows to “{workbook.name}” by sending them here. Adding rows runs no columns and spends no credits.</p>

          {query.isPending ? <p className="text-muted-foreground">Loading…</p> : null}
          {query.isError ? (
            <Alert variant="warning" onRetry={() => void query.refetch()}>
              {formatQueryError(query.error, "This workbook’s webhook could not be loaded.")}
            </Alert>
          ) : null}

          {token ? (
            <div className="space-y-2 rounded-md border border-amber-300 p-3 dark:border-amber-700" role="group" aria-label="New webhook token">
              <p className="font-medium">Copy this token now. It is shown only once.</p>
              <Copyable key={token} label="Webhook token" value={token} />
              <p className="text-xs text-muted-foreground">Keep it secret. Anyone who has it can add rows to this workbook. If you lose it, regenerate it.</p>
              <Button type="button" size="sm" onClick={() => issue.reset()}>
                I’ve saved it
              </Button>
            </div>
          ) : null}

          {query.isSuccess && !webhook ? (
            canEdit ? (
              <Button type="button" disabled={busy} onClick={() => act(() => issue.mutate("create"))}>
                {issue.isPending ? "Creating…" : "Create webhook"}
              </Button>
            ) : (
              <p className="text-muted-foreground">No webhook has been set up. Someone who can edit this workbook can create one.</p>
            )
          ) : null}

          {webhook ? (
            <>
              <Copyable label="Webhook URL" value={webhook.url} />
              <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
                <dt className="text-muted-foreground">Last used</dt>
                <dd>{webhook.lastUsedAt ? when(webhook.lastUsedAt) : "Never"}</dd>
                {webhook.lastResult ? (
                  <>
                    <dt className="text-muted-foreground">Last request</dt>
                    <dd>
                      {when(webhook.lastResult.at)}, {lastResultText(webhook.lastResult)}
                    </dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">Token created</dt>
                <dd>{when(webhook.tokenCreatedAt)}</dd>
              </dl>

              {canEdit ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" disabled={busy} onClick={() => act(() => setConfirming("regenerate"))}>
                      Regenerate token
                    </Button>
                    {webhook.enabled ? (
                      <Button type="button" variant="outline" disabled={busy} onClick={() => act(() => setConfirming("disable"))}>
                        Disable
                      </Button>
                    ) : (
                      <Button type="button" disabled={busy} onClick={() => act(() => change.mutate({ enabled: true }))}>
                        Enable
                      </Button>
                    )}
                  </div>
                  {columns.isError ? (
                    <Alert variant="warning" onRetry={() => void columns.refetch()}>
                      {formatQueryError(columns.error, "This workbook’s columns could not be loaded.")}
                    </Alert>
                  ) : null}
                  {columns.data ? (
                    // Made again when the saved choice changes, so the controls show what is saved.
                    <DuplicateSetting
                      key={`${webhook.dedupe.key}:${webhook.dedupe.columnId ?? ""}`}
                      webhook={webhook}
                      columns={columns.data}
                      busy={busy}
                      onSave={(dedupe) => act(() => change.mutate({ dedupe }))}
                    />
                  ) : null}
                </>
              ) : null}

              <details>
                <summary className="cursor-pointer font-medium">How to send rows</summary>
                <div className="mt-2 space-y-2">
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{exampleRequest(webhook.url, columns.data ?? [])}</pre>
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    <li>Send a JSON list of up to 1,000 rows, at most 5 MB, no more than 60 times a minute.</li>
                    <li>Field names are matched to your input column names. Other fields are left out.</li>
                    <li>Rows with a value that doesn’t fit its column are rejected and listed in the response; the rest are added.</li>
                    <li>Without an Idempotency-Key, sending the same request twice can add its rows twice.</li>
                  </ul>
                </div>
              </details>
            </>
          ) : null}

          {issue.error ? <Alert variant="error">{formatQueryError(issue.error, "A token could not be created. Try again.")}</Alert> : null}
          {change.error ? <Alert variant="error">{formatQueryError(change.error, "That change could not be saved.")}</Alert> : null}
        </section>

        {confirming ? (
          <Dialog open onClose={() => (busy ? undefined : setConfirming(null))} title={confirming === "regenerate" ? "Regenerate the token?" : "Disable this webhook?"}>
            <div className="space-y-4 p-1 text-sm">
              <p>
                {confirming === "regenerate"
                  ? "The current token stops working at once. Systems that use it will be refused until you give them the new one."
                  : "Requests will be refused until you enable it again, so systems that send rows here may stop working. The token stays the same."}
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirming(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => (confirming === "regenerate" ? issue.mutate("regenerate") : change.mutate({ enabled: false }))}
                >
                  {confirming === "regenerate" ? "Regenerate token" : "Disable webhook"}
                </Button>
              </div>
            </div>
          </Dialog>
        ) : null}
      </CardContent>
    </Card>
  );
}
