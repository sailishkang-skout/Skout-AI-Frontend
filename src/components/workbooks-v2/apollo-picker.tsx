"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, authQueryOptions, formatQueryError, useAuthReady } from "@/lib/api-client";
import { MAX_APOLLO_STAGES, apolloBody, apolloProblem, useWorkbookApolloApi, type ApolloSelection, type ApolloSource } from "@/lib/workbooks-v2-apollo";
import type { WorkbookImport } from "@/lib/workbooks-v2-import";
import { CrmFieldPicker } from "./crm-selection";

const n = (value: number) => value.toLocaleString("en-US");

/** Refusals that saving the Apollo key again would fix. */
const KEY_CODES = new Set(["APOLLO_NOT_CONNECTED", "APOLLO_RECONNECT_REQUIRED", "APOLLO_SCOPE_MISSING"]);
const codeOf = (error: unknown) => (error instanceof ApiError ? (error.body as { code?: string } | undefined)?.code : undefined);

function SettingsLink({ children }: { children: React.ReactNode }) {
  return (
    <Link href="/settings/integrations" className="font-medium text-primary underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

/** One saved list, or a search of the saved contacts. */
function Selection({ source, selection, onChange }: { source: ApolloSource; selection: ApolloSelection; onChange: (selection: ApolloSelection) => void }) {
  const lists = source.lists!;
  const stages = source.stages!;
  const noLists = !lists.available ? lists.reason : !lists.items.length ? "There are no contact lists in this Apollo account." : null;
  const choose = (kind: ApolloSelection["kind"]) => {
    if (kind !== selection.kind) onChange(kind === "list" ? { kind, listId: "" } : { kind, keywords: "", stageIds: [] });
  };
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-semibold">Which people</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name="apollo-selection" checked={selection.kind === "list"} disabled={Boolean(noLists)} onChange={() => choose("list")} />A saved list
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="apollo-selection" checked={selection.kind === "search"} onChange={() => choose("search")} />A search of saved contacts
        </label>
      </div>
      {noLists ? <p className="text-xs text-muted-foreground">{noLists}</p> : null}

      {selection.kind === "list" ? (
        <ul className="max-h-40 divide-y overflow-y-auto rounded-md border text-sm">
          {lists.items.map((list) => (
            <li key={list.id}>
              <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-muted">
                <input type="radio" name="apollo-list" checked={selection.listId === list.id} onChange={() => onChange({ kind: "list", listId: list.id })} />
                <span className="min-w-0 flex-1 truncate">{list.name}</span>
                <span className="text-muted-foreground">{list.count === null ? "" : `${n(list.count)} contact${list.count === 1 ? "" : "s"}`}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Searches the contacts saved in your Apollo account, not Apollo’s whole database. Leave both empty to take every saved contact.
          </p>
          <Input
            aria-label="Keywords"
            placeholder="Keywords: name, title, company or email"
            maxLength={200}
            value={selection.keywords}
            onChange={(e) => onChange({ ...selection, keywords: e.target.value })}
          />
          {!stages.available ? (
            <p className="text-xs text-muted-foreground">{stages.reason}</p>
          ) : stages.items.length ? (
            <fieldset>
              <legend className="mb-1 text-xs font-medium">Contact stage (any of those ticked)</legend>
              <div className="flex max-h-28 flex-wrap gap-x-4 gap-y-1 overflow-y-auto text-sm">
                {stages.items.map((stage) => {
                  const on = selection.stageIds.includes(stage.id);
                  return (
                    <label key={stage.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!on && selection.stageIds.length >= MAX_APOLLO_STAGES}
                        onChange={() => onChange({ ...selection, stageIds: on ? selection.stageIds.filter((id) => id !== stage.id) : [...selection.stageIds, stage.id] })}
                      />
                      {stage.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {source.note} At most {n(source.maxRecords)} contacts can be read from one selection.
      </p>
    </fieldset>
  );
}

/** The Apollo part of "Add rows" (WB2-024): the connection, which people, which fields, then a preview. */
export function ApolloPicker({ workbookId, onPreview }: { workbookId: string; onPreview: (item: WorkbookImport) => void }) {
  const api = useWorkbookApolloApi();
  const authReady = useAuthReady();
  const [selection, setSelection] = useState<ApolloSelection>({ kind: "search", keywords: "", stageIds: [] });
  const [fields, setFields] = useState<string[] | null>(null);
  const source = useQuery({
    ...authQueryOptions,
    // A refusal says what to do; asking again would only repeat it.
    retry: false,
    // Settings may have changed since it was last looked at.
    staleTime: 0,
    queryKey: ["workbooks-v2", workbookId, "apollo-source"],
    queryFn: () => api.source(workbookId),
    enabled: authReady,
  });
  const picked = fields ?? source.data?.defaultFields ?? [];
  const problem = apolloProblem(picked, selection);

  // The same choice asked twice makes one preview; a different one makes another.
  const asked = useRef<{ body: string; key: string }>({ body: "", key: "" });
  const preview = useMutation({
    mutationFn: () => {
      const body = apolloBody(picked, selection);
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
    },
  });

  if (source.isError) {
    return (
      <div className="space-y-2">
        <Alert variant="error" onRetry={() => void source.refetch()}>
          {formatQueryError(source.error, "Apollo could not be read.")}
        </Alert>
        {KEY_CODES.has(codeOf(source.error) ?? "") ? (
          <p className="text-sm">
            <SettingsLink>Open Settings → Integrations</SettingsLink>
          </p>
        ) : null}
      </div>
    );
  }
  if (!source.data) return <p className="text-sm text-muted-foreground">Reading Apollo…</p>;
  const { status } = source.data.connection;
  if (status !== "connected") {
    return (
      <Alert variant="warning">
        <p>
          {status === "needs_reauth"
            ? "The saved Apollo API key can’t be used. Save it again to import."
            : "Apollo isn’t connected. Add your workspace’s Apollo API key to import."}
        </p>
        <p className="mt-2">
          <SettingsLink>Open Settings → Integrations</SettingsLink>
        </p>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Apollo connection</legend>
        <label className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
          <input type="radio" name="apollo-connection" checked readOnly />
          <span className="flex-1 font-medium">Your workspace’s Apollo API key</span>
          <Badge tone="success">Connected</Badge>
          <SettingsLink>Manage</SettingsLink>
        </label>
      </fieldset>
      <Selection
        source={source.data}
        selection={selection}
        onChange={(next) => {
          setSelection(next);
          preview.reset();
        }}
      />
      <CrmFieldPicker
        info={source.data}
        chosen={picked}
        onChange={(next) => {
          setFields(next);
          preview.reset();
        }}
      />
      {preview.error ? (
        <div className="space-y-2">
          <Alert variant="error">{formatQueryError(preview.error, "The contacts could not be previewed.")}</Alert>
          {KEY_CODES.has(codeOf(preview.error) ?? "") ? (
            <p className="text-sm">
              <SettingsLink>Open Settings → Integrations</SettingsLink>
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={Boolean(problem) || preview.isPending} onClick={() => preview.mutate()}>
          {preview.isPending ? "Reading contacts…" : "Preview contacts"}
        </Button>
        <p className="text-sm text-muted-foreground">{problem ?? "Nothing is added until you confirm."}</p>
      </div>
    </div>
  );
}
