"use client";

import { useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { CopsRequestError } from "@/lib/cops-fetch";
import {
  COMMERCIAL_POLL_MS,
  currencyExponent,
  DESK_STATE_FILTERS,
  deskRowStatus,
  formatMoney,
  humanize,
  statusTone,
  useCopsCommercialApi,
  type DeskStateFilter,
} from "@/lib/cops-commercial";

const STATE_LABEL: Record<DeskStateFilter, string> = {
  none: "Not started",
  proposal_sent: "Proposal sent",
  msa_pending: "MSA pending",
  payment_pending: "Payment pending",
  complete: "Complete",
};

const GATE_TONE = { fired: "success", open: "info", waiting: "muted" } as const;
const GATE_LABEL = { fired: "Provisioning requested", open: "Open", waiting: "Waiting" } as const;

/**
 * Commercial Desk across accounts (Bible p.62, COPS-01 nav): every open and won opportunity with its
 * proposal, MSA, payment and gate status. Polls like the account Commercial tab, so status changes
 * show without a refresh. Each row opens the account's Commercial tab for the actions.
 */
export default function CommercialDeskPage() {
  const api = useCopsCommercialApi();
  const authReady = useAuthReady();
  const [state, setState] = useState<DeskStateFilter | "">("");

  const desk = useInfiniteQuery({
    queryKey: ["cops-commercial-desk", state],
    queryFn: ({ pageParam }) => api.desk({ state: state || undefined, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: authReady,
    refetchInterval: (query) =>
      query.state.error instanceof CopsRequestError && query.state.error.envelope?.code === "FORBIDDEN" ? false : COMMERCIAL_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const rows = desk.data?.pages.flatMap((p) => p.data) ?? [];
  const forbidden = desk.error instanceof CopsRequestError && desk.error.envelope?.code === "FORBIDDEN";

  return (
    <div className="space-y-4 p-6" data-testid="page-cops-commercial">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Commercial</h1>
          <p className="text-sm text-muted-foreground">Proposal, MSA, payment and provisioning status for every open opportunity.</p>
        </div>
        <Select
          aria-label="Commercial state"
          value={state}
          onChange={(e) => setState(e.target.value as DeskStateFilter | "")}
          className="w-48"
        >
          <option value="">All states</option>
          {DESK_STATE_FILTERS.map((s) => (
            <option key={s} value={s}>
              {STATE_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          {desk.isLoading ? (
            <Skeleton className="h-40 w-full rounded-md" />
          ) : desk.isError ? (
            <Alert variant={forbidden ? "default" : "error"} data-testid="commercial-desk-error">
              {forbidden ? "The Commercial Desk is visible to roles with commercial access." : "Could not load the Commercial Desk."}
            </Alert>
          ) : rows.length === 0 ? (
            // Bible Appendix G: no opportunities -> create/import the first one.
            <div className="rounded-md border border-dashed p-8 text-center" data-testid="commercial-desk-empty">
              <p className="text-sm font-medium">{state ? `No opportunities in "${STATE_LABEL[state]}"` : "No open opportunities"}</p>
              <Link href="/crm/deals" className="mt-3 inline-block rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent">
                Create or import an opportunity
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="commercial-desk-table">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Opportunity</th>
                    <th className="px-2 py-2 font-medium">Account</th>
                    <th className="px-2 py-2 text-right font-medium">Value</th>
                    <th className="px-2 py-2 font-medium">State</th>
                    <th className="px-2 py-2 font-medium">Proposal</th>
                    <th className="px-2 py-2 font-medium">MSA</th>
                    <th className="px-2 py-2 font-medium">Payment</th>
                    <th className="px-2 py-2 font-medium">Gate</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => {
                    const st = deskRowStatus(row);
                    const amount = row.opportunity.amount == null ? null : Number(row.opportunity.amount);
                    return (
                      <tr key={row.opportunity.id} data-testid="commercial-desk-row">
                        <td className="px-2 py-2 font-medium">
                          {row.account ? (
                            <Link className="hover:underline" href={`/crm/360?mode=account&id=${row.account.id}&tab=commercial`}>
                              {row.opportunity.name}
                            </Link>
                          ) : (
                            row.opportunity.name
                          )}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">{row.account?.name ?? "—"}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          {amount == null || Number.isNaN(amount) ? "—" : formatMoney(Math.round(amount * 10 ** currencyExponent(row.opportunity.currency)), row.opportunity.currency)}
                        </td>
                        <td className="px-2 py-2">
                          {row.opportunity.commercial_state ? STATE_LABEL[row.opportunity.commercial_state] : STATE_LABEL.none}
                        </td>
                        {[st.proposal, st.msa, st.payment].map((s, i) => (
                          <td key={i} className="px-2 py-2">
                            {s ? <Badge tone={statusTone(s)} className="capitalize">{humanize(s)}</Badge> : <span className="text-muted-foreground">—</span>}
                          </td>
                        ))}
                        <td className="px-2 py-2">
                          <Badge tone={GATE_TONE[st.gate]}>{GATE_LABEL[st.gate]}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {desk.hasNextPage && (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => desk.fetchNextPage()} disabled={desk.isFetchingNextPage}>
                  Load more
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
