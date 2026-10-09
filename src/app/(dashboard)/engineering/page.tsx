"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketDrawer } from "@/components/crm/tickets/ticket-drawer";
import { useAuthReady } from "@/lib/api-client";
import { CopsRequestError } from "@/lib/cops-fetch";
import { humanizeTicket, severityTone, TICKET_SEVERITIES, TICKET_STATUSES, TICKET_TIERS, useCopsTicketsApi } from "@/lib/cops-tickets";

const QUEUE_POLL_MS = 30_000;

/**
 * COPS-06 Engineering Queue (Bible p.65): tickets by severity, filtered by severity, status, team,
 * assignee and account tier. A row opens the ticket drawer.
 */
export default function EngineeringQueuePage() {
  const api = useCopsTicketsApi();
  const authReady = useAuthReady();
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("open");
  const [assignee, setAssignee] = useState("");
  const [tier, setTier] = useState("");
  const [team, setTeam] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const queue = useInfiniteQuery({
    queryKey: ["cops-tickets", severity, status, assignee, tier, team],
    queryFn: ({ pageParam }) =>
      api.list({
        severity,
        assignee,
        tier,
        team: team.trim(),
        ...(status === "open" ? { open: true } : { status }),
        cursor: pageParam,
      }),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: authReady,
    refetchInterval: (q) => (q.state.error instanceof CopsRequestError && q.state.error.envelope?.code === "FORBIDDEN" ? false : QUEUE_POLL_MS),
    refetchIntervalInBackground: false,
  });
  const items = queue.data?.pages.flatMap((p) => p.data) ?? [];
  const forbidden = queue.error instanceof CopsRequestError && queue.error.envelope?.code === "FORBIDDEN";

  return (
    <div className="space-y-4 p-6" data-testid="page-cops-engineering">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Engineering queue</h1>
          <p className="text-sm text-muted-foreground">Customer tickets, most severe first.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-36">
            <option value="">All severities</option>
            {TICKET_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            <option value="open">Open</option>
            <option value="">All statuses</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanizeTicket(s)}
              </option>
            ))}
          </Select>
          <Select aria-label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-36">
            <option value="">Anyone</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
          </Select>
          <Select aria-label="Account tier" value={tier} onChange={(e) => setTier(e.target.value)} className="w-36">
            <option value="">All tiers</option>
            {TICKET_TIERS.map((t) => (
              <option key={t} value={t}>
                {humanizeTicket(t)}
              </option>
            ))}
          </Select>
          <Input aria-label="Team" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Team" className="w-32" />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {queue.isLoading ? (
            <Skeleton className="h-40 w-full rounded-md" />
          ) : queue.isError ? (
            <Alert variant={forbidden ? "default" : "error"}>
              {forbidden ? "The engineering queue is for Engineering, Customer Success and Product roles." : "Could not load the engineering queue."}
            </Alert>
          ) : items.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center" data-testid="engineering-empty">
              <p className="text-sm font-medium">No tickets match these filters</p>
              <p className="mt-1 text-xs text-muted-foreground">Tickets are raised from an account&apos;s Engineering tab or an onboarding blocker.</p>
            </div>
          ) : (
            <ul className="divide-y" data-testid="engineering-queue">
              {items.map((t) => (
                <li key={t.id} data-testid="engineering-row">
                  <button type="button" onClick={() => setOpenId(t.id)} className="flex w-full flex-col gap-1 py-3 text-left hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={severityTone(t.severity)}>{t.severity}</Badge>
                        <span className="truncate font-medium">{t.title}</span>
                      </div>
                      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span>{t.account_name}</span>
                        <span>{humanizeTicket(t.account_tier)}</span>
                        <span>{t.priority.toUpperCase()}</span>
                        {t.team && <span>Team: {t.team}</span>}
                        <span>{t.assignee_email ?? "Unassigned"}</span>
                        <span>Opened {new Date(t.created_at).toLocaleDateString()}</span>
                      </p>
                    </div>
                    <Badge>{humanizeTicket(t.status)}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {queue.hasNextPage && (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => queue.fetchNextPage()} disabled={queue.isFetchingNextPage}>
              Load more
            </Button>
          )}
        </CardContent>
      </Card>

      <TicketDrawer ticketId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
