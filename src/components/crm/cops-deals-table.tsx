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
import { formatMoney } from "@/lib/crm-display";
import { useCompaniesApi } from "@/lib/crm/companies";
import { usePipelinesApi } from "@/lib/crm/pipelines";
import {
  isStale,
  nextActionByDeal,
  STALE_AFTER_DAYS,
  useCopsOpportunityListApi,
  useCopsTasksApi,
  type OpportunityRow,
} from "@/lib/cops-crm";
import { useTeamApi } from "@/lib/team";
import { BulkOwnerBar, copsErrorText, SavedViewPicker } from "./cops-table-parts";

/**
 * COPS-02 opportunities table (the table mode of the Deals screen): fast filters, saved views,
 * stage and next action per deal, stale flags, and bulk owner reassignment.
 * Reads GET /api/v1/opportunities.
 */
export function CopsDealsTable() {
  const api = useCopsOpportunityListApi();
  const tasksApi = useCopsTasksApi();
  const teamApi = useTeamApi();
  const pipelinesApi = usePipelinesApi();
  const companiesApi = useCompaniesApi();
  const apiFetch = useApiFetch();
  const authReady = useAuthReady();

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"-updated_at" | "updated_at">("-updated_at");
  const [viewId, setViewId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const me = useQuery<{ userId?: string }>({ queryKey: ["me"], queryFn: () => apiFetch("/api/v1/me"), enabled: authReady, staleTime: 30_000 });
  const members = useQuery({ queryKey: ["team", "members"], queryFn: () => teamApi.listMembers(), enabled: authReady });
  // Same query keys as the board, so switching views does not refetch these.
  const pipelines = useQuery({ queryKey: ["crm", "pipelines"], queryFn: () => pipelinesApi.list(), enabled: authReady });
  const companies = useQuery({
    queryKey: ["crm", "companies", { forPicker: true }],
    queryFn: () => companiesApi.list({ limit: 100 }),
    enabled: authReady,
  });
  const dealTasks = useQuery({ queryKey: ["cops-tasks", "open-deal"], queryFn: () => tasksApi.openDealTasks(), enabled: authReady });

  const memberList = members.data?.data ?? [];
  const lookups = useMemo(() => {
    const stageName = new Map<string, string>();
    for (const p of pipelines.data?.data ?? []) for (const s of p.stages) stageName.set(s.id, s.name);
    const companyName = new Map((companies.data?.data ?? []).map((c) => [c.id, c.name]));
    const memberName = new Map(memberList.map((m) => [m.userId, m.fullName || m.email]));
    return { stageName, companyName, memberName };
  }, [pipelines.data, companies.data, memberList]);
  const nextActions = useMemo(() => nextActionByDeal(dealTasks.data?.data ?? []), [dealTasks.data]);

  const ownerFilter = onlyMine ? me.data?.userId : undefined;
  const list = useInfiniteQuery({
    queryKey: ["cops-opportunities", { q, ownerFilter, status, sort, viewId }],
    queryFn: ({ pageParam }) =>
      api.list({ q: q || undefined, ownerId: ownerFilter, status: status || undefined, sort, viewId: viewId || undefined, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: authReady && (!onlyMine || Boolean(me.data?.userId)),
  });
  const rows: OpportunityRow[] = list.data?.pages.flatMap((p) => p.data) ?? [];
  const filtersActive = Boolean(q || onlyMine || status || viewId);
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
    <div className="space-y-3" data-testid="cops-deals-table">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search deals"
          aria-label="Search deals"
          className="h-9 w-56 rounded-md border bg-background px-3 text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
          Only mine
        </label>
        <Select aria-label="Deal status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-36">
          <option value="">Any status</option>
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </Select>
        <Select aria-label="Sort deals" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 w-44">
          <option value="-updated_at">Recently updated</option>
          <option value="updated_at">Least recently updated</option>
        </Select>
        <SavedViewPicker
          object="opportunity"
          viewId={viewId}
          onChange={setViewId}
          currentFilters={{ ...(q ? { q } : {}), ...(status ? { status } : {}) }}
          sort={sort}
          canSave={Boolean(q || status)}
        />
      </div>

      <BulkOwnerBar
        object="opportunities"
        selectedIds={Array.from(selected)}
        members={memberList}
        onDone={() => setSelected(new Set())}
        invalidateKey={["cops-opportunities"]}
      />

      {list.isError && <Alert variant="error">{copsErrorText(list.error, "Could not load deals.")}</Alert>}

      {list.isLoading ? (
        <Skeleton className="h-40 w-full rounded-md" />
      ) : rows.length === 0 && !list.isError ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filtersActive ? "No deals match these filters." : "No opportunities yet. Add one with Quick create or from the board."}
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
                <th className="px-3 py-2 font-medium">Deal</th>
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Next action</th>
                <th className="px-3 py-2 font-medium">Last updated</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const next = nextActions.get(r.id);
                const overdue = next?.due_at ? new Date(next.due_at).getTime() < Date.now() : false;
                return (
                  <tr key={r.id} className={selected.has(r.id) ? "bg-primary/5" : undefined}>
                    <td className="px-3 py-2">
                      <input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} />
                    </td>
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/crm/deals/${r.id}`} className="hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.company_id ? (
                        <Link href={`/crm/360?mode=account&id=${r.company_id}`} className="hover:underline">
                          {lookups.companyName.get(r.company_id) ?? "Account"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">{lookups.stageName.get(r.stage_id) ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.owner_id ? lookups.memberName.get(r.owner_id) ?? "Unknown" : "Unassigned"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.amount == null ? null : Number(r.amount), r.currency ?? undefined)}</td>
                    <td className={overdue ? "px-3 py-2 font-medium text-destructive" : "px-3 py-2 text-muted-foreground"}>
                      {next ? `${next.title}${next.due_at ? ` · ${new Date(next.due_at).toLocaleDateString()}` : ""}` : "None planned"}
                    </td>
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
                );
              })}
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
