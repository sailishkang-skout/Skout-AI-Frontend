"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPlus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { authQueryOptions, formatQueryError, useAuthReady } from "@/lib/api-client";
import { useEnrichmentApi } from "@/lib/enrichment";
import { useSmartListApi } from "@/lib/smart-lists";
import { isRunning, useWorkbookImportApi } from "@/lib/workbooks-v2-import";
import { MAX_CHOSEN, SMART_LIST_BROWSE_LIMIT, SOURCE_PAGE_SIZE, useWorkbookProspectsApi, type ProspectSelection, type ProspectSource } from "@/lib/workbooks-v2-prospects";
import { POLL_MS } from "./csv-import";
import { ImportProgress } from "./import-progress";

type Kind = "list" | "smart_list";
const KEY = "workbooks-v2";
const n = (value: number) => value.toLocaleString("en-US");

/** Choose a list or smart list, look through who is in it, and pick who to add. */
function SourcePicker({ workbookId, busy, error, onAdd }: { workbookId: string; busy: boolean; error: string | null; onAdd: (source: ProspectSource, selection: ProspectSelection) => void }) {
  const listsApi = useEnrichmentApi();
  const smartApi = useSmartListApi();
  const api = useWorkbookProspectsApi();
  const authReady = useAuthReady();
  const [kind, setKind] = useState<Kind>("list");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const lists = useQuery({ ...authQueryOptions, queryKey: ["lists"], queryFn: listsApi.listLists, enabled: authReady && kind === "list" });
  const smartLists = useQuery({ ...authQueryOptions, queryKey: ["smart-lists"], queryFn: smartApi.list, enabled: authReady && kind === "smart_list" });
  const sources =
    kind === "list"
      ? lists.data?.data.map((l) => ({ id: l.id, name: l.name, count: `${n(l.prospectCount)} prospect${l.prospectCount === 1 ? "" : "s"}` }))
      : smartLists.data?.data.map((l) => ({ id: l.id, name: l.name, count: l.lastRunCount === null ? "Not run yet" : `${n(l.lastRunCount)} at last run` }));
  const loadingSources = kind === "list" ? lists : smartLists;

  const members = useQuery({
    ...authQueryOptions,
    queryKey: [KEY, workbookId, "source", kind, sourceId, page],
    queryFn: () => api.browse(workbookId, kind, sourceId!, page),
    enabled: authReady && Boolean(sourceId),
  });

  const open = (next: Kind, id: string | null) => {
    setKind(next);
    setSourceId(id);
    setPage(1);
    setChosen(new Set());
  };
  const toggle = (ids: string[], on: boolean) =>
    setChosen((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const source: ProspectSource | null = sourceId ? (kind === "list" ? { type: "list", listId: sourceId } : { type: "smart_list", smartListId: sourceId }) : null;
  const total = members.data?.total ?? 0;
  const reachable = kind === "smart_list" ? Math.min(total, SMART_LIST_BROWSE_LIMIT) : total;
  const pages = Math.max(1, Math.ceil(reachable / SOURCE_PAGE_SIZE));
  const selectable = members.data?.data.filter((p) => !p.inWorkbook).map((p) => p.prospectId) ?? [];
  const allOnPage = selectable.length > 0 && selectable.every((id) => chosen.has(id));
  const tooMany = chosen.size > MAX_CHOSEN;

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Where to add from" className="flex gap-2">
        {(["list", "smart_list"] as const).map((value) => (
          <Button key={value} type="button" role="tab" aria-selected={kind === value} size="sm" variant={kind === value ? "default" : "outline"} onClick={() => open(value, null)}>
            {value === "list" ? "Lists" : "Smart lists"}
          </Button>
        ))}
      </div>

      {loadingSources.isError ? (
        <Alert variant="error" onRetry={() => void loadingSources.refetch()}>
          {formatQueryError(loadingSources.error, "Your lists could not be loaded.")}
        </Alert>
      ) : !sources ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !sources.length ? (
        <p className="text-sm text-muted-foreground">{kind === "list" ? "You have no lists yet." : "You have no smart lists yet."}</p>
      ) : (
        <ul className="max-h-40 divide-y overflow-y-auto rounded-md border text-sm">
          {sources.map((s) => (
            <li key={s.id}>
              <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-muted">
                <input type="radio" name="prospect-source" checked={sourceId === s.id} onChange={() => open(kind, s.id)} />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="text-muted-foreground">{s.count}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {sourceId ? (
        members.isError ? (
          <Alert variant="error" onRetry={() => void members.refetch()}>
            {formatQueryError(members.error, "These prospects could not be loaded.")}
          </Alert>
        ) : !members.data ? (
          <p className="text-sm text-muted-foreground">Loading prospects…</p>
        ) : !total ? (
          <p className="text-sm text-muted-foreground">There are no prospects here.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">{n(total)}</span> {kind === "list" ? "in this list" : "match this smart list"}
              {chosen.size ? ` · ${n(chosen.size)} selected` : ""}
            </p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th scope="col" className="w-8 px-2 py-1.5">
                      <input type="checkbox" aria-label="Select everyone on this page" checked={allOnPage} disabled={!selectable.length} onChange={(e) => toggle(selectable, e.target.checked)} />
                    </th>
                    <th scope="col" className="px-2 py-1.5 font-medium">Name</th>
                    <th scope="col" className="px-2 py-1.5 font-medium">Title</th>
                    <th scope="col" className="px-2 py-1.5 font-medium">Company</th>
                  </tr>
                </thead>
                <tbody>
                  {members.data.data.map((p) => {
                    const name = p.fullName ?? p.prospectId.slice(0, 12);
                    return (
                      <tr key={p.prospectId} className="border-t">
                        <td className="px-2 py-1">
                          <input
                            type="checkbox"
                            aria-label={`Select ${name}`}
                            checked={chosen.has(p.prospectId)}
                            disabled={p.inWorkbook}
                            onChange={(e) => toggle([p.prospectId], e.target.checked)}
                          />
                        </td>
                        <td className="px-2 py-1">
                          {name} {p.inWorkbook ? <Badge tone="muted">In workbook</Badge> : null}
                        </td>
                        <td className="px-2 py-1">{p.title}</td>
                        <td className="px-2 py-1">{p.companyName ?? p.companyDomain}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {n(page)} of {n(pages)}
                {reachable < total ? ` (only the first ${n(reachable)} can be browsed)` : ""}
              </span>
              <span className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={page <= 1 || members.isFetching} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={page >= pages || members.isFetching} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </span>
            </div>
          </div>
        )
      ) : null}

      {tooMany ? <Alert variant="warning">Choose at most {n(MAX_CHOSEN)} people, or add them all.</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy || !source || !chosen.size || tooMany} onClick={() => onAdd(source!, { prospectIds: Array.from(chosen) })}>
          {busy ? "Adding…" : `Add selected (${n(chosen.size)})`}
        </Button>
        <Button type="button" variant="outline" disabled={busy || !source || !total} onClick={() => onAdd(source!, { all: true })}>
          {source && total ? `Add all ${n(total)}` : "Add all"}
        </Button>
      </div>
    </div>
  );
}

/** "Add rows" from Skout lists and smart lists, and how that addition is going. */
export function AddProspects({ workbook }: { workbook: { id: string; name: string } }) {
  const api = useWorkbookProspectsApi();
  const imports = useWorkbookImportApi();
  const client = useQueryClient();
  const authReady = useAuthReady();
  const [open, setOpen] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);
  const close = useCallback(() => setOpen(false), []);

  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: [KEY], exact: true });
    for (const part of ["imports", "rows", "columns", "source"]) void client.invalidateQueries({ queryKey: [KEY, workbook.id, part] });
  }, [client, workbook.id]);

  const current = useQuery({
    ...authQueryOptions,
    queryKey: [KEY, workbook.id, "import", importId],
    queryFn: () => imports.get(workbook.id, importId!),
    enabled: authReady && Boolean(importId),
    refetchInterval: (query) => (query.state.data && isRunning(query.state.data.status) ? POLL_MS : false),
  });
  const item = importId ? current.data : undefined;

  const add = useMutation({
    mutationFn: ({ source, selection }: { source: ProspectSource; selection: ProspectSelection }) => api.add(workbook.id, source, selection),
    onSuccess: (next) => {
      client.setQueryData([KEY, next.workbookId, "import", next.id], next);
      setImportId(next.id);
      setOpen(false);
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

  const status = item?.status;
  useEffect(() => {
    if (status === "completed" || status === "failed") refresh();
  }, [status, refresh]);
  // Another workbook has its own additions.
  const { reset: resetAdd } = add;
  useEffect(() => {
    setImportId(null);
    setOpen(false);
    resetAdd();
  }, [workbook.id, resetAdd]);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Add rows from Skout</h2>
            <p className="text-sm text-muted-foreground">From your lists and smart lists. Details you already have are copied in without using credits.</p>
          </div>
          <Button
            type="button"
            onClick={() => {
              add.reset();
              setOpen(true);
            }}
          >
            <ListPlus aria-hidden />
            Add rows
          </Button>
        </div>
        {importId && current.isError && !item ? (
          <Alert variant="error" onRetry={() => void current.refetch()}>
            {formatQueryError(current.error, "This addition could not be loaded.")}
          </Alert>
        ) : null}
        {item ? (
          <ImportProgress
            item={item}
            closeLabel="Done"
            downloading={download.isPending}
            downloadError={download.error ? formatQueryError(download.error, "The report could not be downloaded.") : null}
            onDownload={() => download.mutate(item.id)}
            onClose={() => setImportId(null)}
          />
        ) : null}
      </CardContent>
      <Dialog open={open} onClose={close} title={`Add rows to “${workbook.name}”`} className="max-w-2xl">
        <SourcePicker
          workbookId={workbook.id}
          busy={add.isPending}
          error={add.error ? formatQueryError(add.error, "The prospects could not be added.") : null}
          onAdd={(source, selection) => add.mutate({ source, selection })}
        />
      </Dialog>
    </Card>
  );
}
