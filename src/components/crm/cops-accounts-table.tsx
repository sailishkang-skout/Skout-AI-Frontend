"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiFetch, useAuthReady } from "@/lib/api-client";
import { isStale, STALE_AFTER_DAYS, useCopsAccountListApi, type AccountRow } from "@/lib/cops-crm";
import { useTeamApi } from "@/lib/team";
import { BulkOwnerBar, copsErrorText, SavedViewPicker } from "./cops-table-parts";

/**
 * COPS-02 accounts table: fast filters (search, only mine, sort), saved views, a stale-record
 * indicator, and bulk owner reassignment with a reason. Reads GET /api/v1/accounts.
 */
export function CopsAccountsTable() {
  const api = useCopsAccountListApi();
  const teamApi = useTeamApi();
  const apiFetch = useApiFetch();
  const authReady = useAuthReady();

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [sort, setSort] = useState<"-created_at" | "name">("-created_at");
  const [viewId, setViewId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
  const memberList = members.data?.data ?? [];
  const memberName = useMemo(() => {
    const map = new Map(memberList.map((m) => [m.userId, m.fullName || m.email]));
    return (id: string | null) => (id ? map.get(id) ?? "Unknown" : "Unassigned");
  }, [memberList]);

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
        <SavedViewPicker
          object="account"
          viewId={viewId}
          onChange={setViewId}
          currentFilters={{ ...(q ? { q } : {}), ...(ownerFilter ? { owner_id: ownerFilter } : {}) }}
          sort={sort}
          canSave={Boolean(q || onlyMine)}
        />
      </div>

      <BulkOwnerBar
        object="accounts"
        selectedIds={Array.from(selected)}
        members={memberList}
        onDone={() => setSelected(new Set())}
        invalidateKey={["cops-accounts"]}
      />

      {list.isError && <Alert variant="error">{copsErrorText(list.error, "Could not load accounts.")}</Alert>}

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
