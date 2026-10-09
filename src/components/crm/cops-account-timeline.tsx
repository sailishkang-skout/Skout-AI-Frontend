"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { CopsRequestError } from "@/lib/cops-fetch";
import { TIMELINE_TYPES, useCopsAccountApi, type TimelineEvent, type TimelineType } from "@/lib/cops-crm";

const TYPE_LABELS: Record<TimelineType, string> = {
  email: "Email",
  call: "Call",
  meeting: "Meeting",
  note: "Note",
  proposal: "Proposal",
  contract: "Contract",
  payment: "Payment",
  provisioning: "Provisioning",
  product_milestone: "Product milestone",
  ticket: "Ticket",
  workflow_action: "Workflow",
};

function timelineErrorMessage(error: unknown): string {
  if (error instanceof CopsRequestError && error.envelope?.code === "FORBIDDEN") {
    return "You don't have access to this account's timeline.";
  }
  return error instanceof Error ? error.message : "Could not load the timeline.";
}

/**
 * COPS-02 account timeline: every Phase 1 event and CRM activity on one account, newest first,
 * filterable by type. Internal notes come back only for users allowed to see them and are styled
 * apart from customer-facing history.
 */
export function CopsAccountTimeline({ accountId }: { accountId: string }) {
  const api = useCopsAccountApi();
  const authReady = useAuthReady();
  const [types, setTypes] = useState<TimelineType[]>([]);

  const query = useInfiniteQuery({
    queryKey: ["cops-timeline", accountId, types],
    queryFn: ({ pageParam }) => api.timeline(accountId, { types, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: authReady && Boolean(accountId),
  });

  const events: TimelineEvent[] = query.data?.pages.flatMap((p) => p.data) ?? [];

  function toggle(type: TimelineType) {
    setTypes((current) => (current.includes(type) ? current.filter((t) => t !== type) : [...current, type]));
  }

  return (
    <div className="space-y-4" data-testid="cops-account-timeline">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter timeline by type">
        <button
          type="button"
          onClick={() => setTypes([])}
          aria-pressed={types.length === 0}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            types.length === 0 ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </button>
        {TIMELINE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => toggle(type)}
            aria-pressed={types.includes(type)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              types.includes(type) ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {query.isError && <Alert variant="error">{timelineErrorMessage(query.error)}</Alert>}

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : !query.isError && events.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {types.length ? "No events of this type yet." : "Nothing has happened on this account yet. Calls, emails, notes and deal changes will show up here."}
        </p>
      ) : (
        <ol className="space-y-2">
          {events.map((event) => {
            const internal = event.visibility === "internal";
            return (
              <li
                key={event.id}
                data-visibility={event.visibility}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-3 text-sm",
                  internal ? "border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/10" : "bg-background"
                )}
              >
                <Badge tone={internal ? "warning" : "muted"} className="shrink-0">
                  {TYPE_LABELS[event.type] ?? event.type}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{event.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.occurred_at).toLocaleString()}
                    {event.actor.type !== "user" ? ` · ${event.actor.type}` : ""}
                  </p>
                </div>
                {internal && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <Lock className="h-3 w-3" aria-hidden /> Internal
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {query.hasNextPage && (
        <Button variant="outline" size="sm" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
          {query.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
