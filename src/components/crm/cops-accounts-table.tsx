"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiFetch, useAuthReady } from "@/lib/api-client";
import { CopsRequestError } from "@/lib/cops-fetch";
import { fieldErrorsByPath } from "@/lib/cops-error";
import { isStale, STALE_AFTER_DAYS, useCopsAccountListApi, type AccountRow } from "@/lib/cops-crm";
import { useTeamApi } from "@/lib/team";

function errorText(err: unknown, fallback: string): string {
  if (err instanceof CopsRequestError && err.envelope) {
    if (err.envelope.code === "FORBIDDEN") return "You don't have permission for this.";
    const fields = fieldErrorsByPath(err.envelope);
    const first = Object.values(fields)[0];
    return first ?? err.envelope.message;
  }
  return fallback;
}

/**
 * COPS-02 accounts table: fast filters (search, only mine, sort), saved views, a stale-record
 * indicator, and bulk owner reassignment with a reason. Reads GET /api/v1/accounts.
 */
export function CopsAccountsTable() {
  const api = useCopsAccountListApi();
  const teamApi = useTeamApi();
  const apiFetch = useApiFetch();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [sort, setSort] = useState<"-created_at" | "name">("-created_at");
  const [viewId, setViewId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ownerId, setOwnerId] = useState("");
  const [reason, setReason] = useState("");
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewName, setViewName] = useState("");
  const [viewShared, setViewShared] = useState(false);

  // Fast filter: search applies 300ms after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const me = useQuery<{ userId?: string }>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/v1/me"),
    enabled: authReady,
    staleTime: 30_000,
  });
  const members = useQuery({ queryKey: ["team", "members"], queryFn: () => teamApi.listMembers(), enabled: authReady });
  const memberName = useMemo(() => {
    const map = new Map((members.data?.data ?? []).map((m) => [m.userId, m.fullName || m.email]));
    return (id: string | null) => (id ? map.get(id) ?? "Unknown" : "Unassigned");
  }, [members.data]);

  const views = useQuery({ queryKey: ["cops-saved-views", "account"], queryFn: () => api.savedViews(), enabled: authReady });

  const ownerFilter = onlyMine ? me.data?.userId : undefined;
  const list = useInfiniteQuery({
    queryKey: ["cops-accounts", { q, ownerFilter, sort, viewId }],
    queryFn: ({ pageParam }) => api.list({ q: q || undefined, ownerId: ownerFilter, sort, viewId: viewId || undefined, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: authReady && (!onlyMine || Boolean(me.data?.userId)),
  });
  const rows: AccountRow[] = list.data?.pages.flatMap((p) => p.data) ?? [];
  const filtersActive = Boolean(q || onlyMine || viewId);

  const bulk = useMutation({
    mutationFn: () => api.bulkReassign(Array.from(selected), ownerId, reason.trim()),
    onSuccess: (res) => {
      const { updated, skipped_ids } = res.data;
      setBulkMessage(`Reassigned ${updated} account${updated === 1 ? "" : "s"} to ${memberName(ownerId)}.${skipped_ids.length ? ` ${skipped_ids.length} skipped.` : ""}`);
      setSelected(new Set());
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["cops-accounts"] });
    },
    onError: (err) => setBulkMessage(errorText(err, "Could not reassign these accounts.")),
  });

  const saveView = useMutation({
    mutationFn: () =>
      api.saveView({
        name: viewName.trim(),
        filters: { ...(q ? { q } : {}), ...(ownerFilter ? { owner_id: ownerFilter } : {}) },
        sort,
        shared: viewShared,
      }),
    onSuccess: (res) => {
      setSaving(false);
      setViewName("");
      queryClient.invalidateQueries({ queryKey: ["cops-saved-views", "account"] });
      setViewId(res.data.id);
    },
  });

  const deleteView = useMutation({
    mutationFn: (id: string) => api.deleteView(id),
    onSuccess: () => {
      setViewId("");
      queryClient.invalidateQueries({ queryKey: ["cops-saved-views", "account"] });
    },
  });

  const currentView = views.data?.data.find((v) => v.id === viewId);
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleRow(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3" data-testid="cops-accounts-table">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search accounts"
          aria-label="Search accounts"
          className="h-9 w-56 rounded-md border bg-background px-3 text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
          Only mine
        </label>
        <Select aria-label="Sort accounts" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 w-40">
          <option value="-created_at">Newest first</option>
          <option value="name">Name A–Z</option>
        </Select>
        <Select aria-label="Saved view" value={viewId} onChange={(e) => setViewId(e.target.value)} className="h-9 w-52">
          <option value="">All accounts</option>
          {(views.data?.data ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.shared ? " (shared)" : ""}
            </option>
          ))}
        </Select>
        {currentView?.mine && (
          <Button variant="ghost" size="sm" onClick={() => deleteView.mutate(currentView.id)} disabled={deleteView.isPending}>
            Delete view
          </Button>
        )}
        {!saving ? (
          <Button variant="outline" size="sm" onClick={() => setSaving(true)} disabled={!q && !onlyMine}>
            Save view
          </Button>
        ) : (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (viewName.trim()) saveView.mutate();
            }}
          >
            <input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="View name"
              aria-label="View name"
              className="h-9 w-40 rounded-md border bg-background px-3 text-sm"
              autoFocus
            />
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={viewShared} onChange={(e) => setViewShared(e.target.checked)} />
              Share with team
            </label>
            <Button size="sm" type="submit" disabled={!viewName.trim() || saveView.isPending}>
              Save
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setSaving(false)}>
              Cancel
            </Button>
          </form>
        )}
      </div>
      {saveView.isError && <Alert variant="error">{errorText(saveView.error, "Could not save this view.")}</Alert>}

      {selected.size > 0 && (
        <form
          className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2 text-sm"
          data-testid="bulk-reassign-bar"
          onSubmit={(e) => {
            e.preventDefault();
            setBulkMessage(null);
            bulk.mutate();
          }}
        >
          <span className="font-medium">{selected.size} selected</span>
          <Select aria-label="New owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="h-8 w-48">
            <option value="">Assign owner…</option>
            {(members.data?.data ?? []).map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.fullName || m.email}
              </option>
            ))}
          </Select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
            aria-label="Reason"
            className="h-8 w-56 rounded-md border bg-background px-2 text-sm"
          />
          <Button size="sm" type="submit" disabled={!ownerId || !reason.trim() || bulk.isPending}>
            {bulk.isPending ? "Assigning…" : "Assign"}
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </form>
      )}
      {bulkMessage && <Alert variant={bulk.isError ? "error" : "success"}>{bulkMessage}</Alert>}

      {list.isError && <Alert variant="error">{errorText(list.error, "Could not load accounts.")}</Alert>}

      {list.isLoading ? (
        <Skeleton className="h-40 w-full rounded-md" />
      ) : rows.length === 0 && !list.isError ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filtersActive ? "No accounts match these filters." : "No accounts yet. Create one to start tracking contacts and deals."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={allOnPageSelected}
                    onChange={() =>
                      setSelected((s) => {
                        const next = new Set(s);
                        if (allOnPageSelected) rows.forEach((r) => next.delete(r.id));
                        else rows.forEach((r) => next.add(r.id));
                        return next;
                      })
                    }
                  />
                </th>
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Last updated</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className={selected.has(r.id) ? "bg-primary/5" : undefined}>
                  <td className="px-3 py-2">
                    <input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} />
                  </td>
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/crm/360?mode=account&id=${r.id}`} className="hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{memberName(r.owner_id)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      {new Date(r.updated_at).toLocaleDateString()}
                      {isStale(r.updated_at) && (
                        <Badge tone="warning" title={`No changes in over ${STALE_AFTER_DAYS} days`}>
                          Stale
                        </Badge>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.hasNextPage && (
        <Button variant="outline" size="sm" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
          {list.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
