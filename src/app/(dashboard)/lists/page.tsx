"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ListIcon, Loader2, Pencil, Plus, Search, Trash2, Users, X, Zap } from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEnrichmentApi, refreshCredits, refreshJobs } from "@/lib/enrichment";
import { handleCreditsError, useCreditsModal } from "@/components/credits/insufficient-credits-modal";
import { useRedirectToIcpSetup } from "@/lib/icp";
import { useAuthReady } from "@/lib/api-client";
import { formatJobTime } from "@/lib/enrichment-display";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { EnrichmentBatch, ProspectList } from "@/types/api";

export default function ListsPage() {
  const queryClient = useQueryClient();
  const enrichmentApi = useEnrichmentApi();
  const authReady = useAuthReady();
  const [name, setName] = useState("");
  const [batches, setBatches] = useState<Record<string, EnrichmentBatch>>({});
  const { redirectToIcpSetup } = useRedirectToIcpSetup();
  const { showInsufficientCredits } = useCreditsModal();

  const lists = useQuery({
    queryKey: ["lists"],
    queryFn: enrichmentApi.listLists,
    enabled: authReady,
  });

  const listData = useMemo(() => lists.data?.data ?? [], [lists.data]);

  const stats = useMemo(() => {
    const totalProspects = listData.reduce((sum, l) => sum + l.prospectCount, 0);
    const ready = listData.filter((l) => l.prospectCount > 0).length;
    return { totalLists: listData.length, totalProspects, ready };
  }, [listData]);

  const createList = useMutation({
    mutationFn: () => enrichmentApi.createList(name.trim()),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  const pollBatch = async (batchId: string) => {
    for (let i = 0; i < 30; i += 1) {
      const batch = await enrichmentApi.getBatch(batchId);
      setBatches((cur) => ({ ...cur, [batch.id]: batch }));
      if (batch.status === "completed" || batch.status === "failed") {
        refreshCredits(queryClient);
        refreshJobs(queryClient);
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  };

  const enrichList = useMutation({
    mutationFn: (listId: string) => enrichmentApi.enrichList(listId, ["company", "email", "validation"]),
    onSuccess: (res) => {
      void pollBatch(res.batchId);
    },
    onError: (err) => {
      handleCreditsError(err, showInsufficientCredits);
    },
  });

  const renameList = useMutation({
    mutationFn: ({ listId, name: n }: { listId: string; name: string }) =>
      enrichmentApi.renameList(listId, n),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lists"] }),
  });

  const deleteList = useMutation({
    mutationFn: (listId: string) => enrichmentApi.deleteList(listId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lists"] }),
  });

  return (
    <PageShell data-testid="page-lists">
      <PageHeader
        title="Lists"
        description="Group prospects from search or smart lists, then bulk-enrich the whole list in one action."
      />

      <DemoBanner />

      <div className="grid gap-3 sm:grid-cols-3">
        {lists.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 p-4">
                <Skeleton className="h-9 w-9 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-10" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard icon={ListIcon} label="Lists" value={stats.totalLists} />
            <StatCard icon={Users} label="Total prospects" value={stats.totalProspects} />
            <StatCard icon={Zap} label="Ready to enrich" value={stats.ready} />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Create a list</CardTitle>
          <CardDescription>
            Name your list, then add prospects from{" "}
            <Link href="/prospects/search" className="text-primary underline underline-offset-2">
              prospect search
            </Link>{" "}
            or{" "}
            <Link href="/smart-lists" className="text-primary underline underline-offset-2">
              smart lists
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/20 p-4 sm:flex-row sm:items-center">
            <Input
              placeholder="e.g. Seed SaaS — US VPs"
              className="min-w-0 flex-1 bg-background"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && createList.mutate()}
            />
            <Button
              data-testid="create-list-button"
              onClick={() => createList.mutate()}
              disabled={!name.trim() || createList.isPending}
              className="w-full shrink-0 sm:w-auto"
            >
              {createList.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create list
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Your lists</h2>
            <p className="text-sm text-muted-foreground">
              {lists.error ? "Unable to load lists" : `${listData.length} list(s) in this workspace`}
            </p>
          </div>
          <Link
            href="/prospects/search"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent sm:w-auto"
          >
            <Search className="h-4 w-4" />
            Find prospects
          </Link>
        </div>

        {lists.error && (
          <Alert variant="error" title="Something went wrong" dismissible onRetry={() => lists.refetch()}>
            We couldn&apos;t load your lists. Please try again.
          </Alert>
        )}

        {lists.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-28" />
                </CardHeader>
                <CardContent className="mt-auto space-y-3 pt-0">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-9 w-full rounded-md" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : listData.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {listData.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                batch={Object.values(batches).find((b) => b.listId === list.id)}
                enriching={enrichList.isPending && enrichList.variables === list.id}
                onEnrich={() => {
                  if (redirectToIcpSetup("/lists")) return;
                  enrichList.mutate(list.id);
                }}
                onRename={(n) => renameList.mutate({ listId: list.id, name: n })}
                onDelete={() => deleteList.mutate(list.id)}
                renaming={renameList.isPending && renameList.variables?.listId === list.id}
                deleting={deleteList.isPending && deleteList.variables === list.id}
              />
            ))}
          </div>
        ) : (
          !lists.error && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <div className="rounded-full bg-muted p-4">
                  <ListIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">No lists yet</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Create a list above, then add prospects from search using checkboxes.
                  </p>
                </div>
                <Link
                  href="/prospects/search"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent"
                >
                  <Search className="h-4 w-4" />
                  Go to search
                </Link>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </PageShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-muted p-2">
          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ListCard({
  list,
  batch,
  enriching,
  onEnrich,
  onRename,
  onDelete,
  renaming,
  deleting,
}: {
  list: ProspectList;
  batch?: EnrichmentBatch;
  enriching: boolean;
  onEnrich: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  renaming: boolean;
  deleting: boolean;
}) {
  const empty = list.prospectCount === 0;
  const progress = batch && batch.total > 0 ? Math.round((batch.done / batch.total) * 100) : 0;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(list.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(list.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== list.name) onRename(trimmed);
    setEditing(false);
  }

  return (
    <Card className={cn("flex flex-col", (empty || deleting) && "opacity-80")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          {editing ? (
            <input
              ref={inputRef}
              className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-0.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setEditing(false);
              }}
            />
          ) : (
            <Link href={`/lists/${list.id}`} className="min-w-0 hover:underline">
              <CardTitle className="line-clamp-2 text-base leading-snug">{list.name}</CardTitle>
            </Link>
          )}
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={startEdit}
              disabled={renaming || deleting}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
              aria-label="Rename list"
            >
              {renaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
              aria-label="Delete list"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
            <Badge tone={empty ? "warning" : "success"}>{list.prospectCount}</Badge>
          </div>
        </div>
        <CardDescription>Created {formatJobTime(list.createdAt)}</CardDescription>
      </CardHeader>

      {confirmDelete && (
        <div className="mx-4 mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="mb-2 font-medium text-destructive">Delete &ldquo;{list.name}&rdquo;?</p>
          <div className="flex gap-2">
            <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { onDelete(); setConfirmDelete(false); }}>
              Delete
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      <CardContent className="mt-auto space-y-3 pt-0">
        {empty ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Empty —{" "}
            <Link href="/prospects/search" className="underline underline-offset-2">
              add prospects
            </Link>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {list.prospectCount} prospect{list.prospectCount === 1 ? "" : "s"} ready for enrichment
          </p>
        )}

        {batch && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <Badge tone={statusTone(batch.status)}>{batch.status}</Badge>
              <span className="text-muted-foreground">
                {batch.done}/{batch.total}
                {batch.failed > 0 && ` · ${batch.failed} failed`}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            {batch.status === "completed" && (
              <p className="text-xs text-green-700 dark:text-green-400">
                Enrichment complete — {batch.done} done{batch.failed > 0 ? `, ${batch.failed} failed` : ""}.
              </p>
            )}
          </div>
        )}

        <Link
          href={`/lists/${list.id}`}
          className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
        >
          Open list
        </Link>

        <Button
          size="sm"
          variant={empty ? "outline" : "default"}
          onClick={onEnrich}
          disabled={enriching || empty}
          className="w-full"
        >
          {enriching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          Bulk enrich
        </Button>
      </CardContent>
    </Card>
  );
}
