"use client";

import { useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckSquare, Mail, Phone } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FollowUpActionDialog } from "@/components/crm/onboarding/follow-up-action-dialog";
import { useAuthReady } from "@/lib/api-client";
import { CopsRequestError } from "@/lib/cops-fetch";
import { can, useMyPermissions } from "@/lib/cops-commercial";
import {
  QUEUE_REASON_LABEL,
  QUEUE_REASONS,
  queueTone,
  useCopsOnboardingApi,
  type ActionKind,
  type QueueItem,
  type QueueReason,
} from "@/lib/cops-onboarding";

const QUEUE_POLL_MS = 30_000;
const ICON: Record<ActionKind, typeof Phone> = { call: Phone, email: Mail, meeting: Calendar, task: CheckSquare };

/**
 * COPS-05 Sales Follow-up (Bible p.64): who needs human attention today. A prioritised queue
 * (replies, commercial blockers, trials ending, stalled onboarding, due tasks, high usage) with last
 * touch, signals and a recommended action; every one-click action is logged on the account timeline.
 */
export default function SalesFollowUpPage() {
  const api = useCopsOnboardingApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { permissions } = useMyPermissions();
  const isManager = can(permissions, ["crm:admin", "onboarding:admin"]);
  const [owner, setOwner] = useState<"me" | "all">("me");
  const [reason, setReason] = useState<QueueReason | "">("");
  const [acting, setActing] = useState<{ item: QueueItem; kind: ActionKind } | null>(null);
  const queryKey = ["cops-follow-up-queue", owner, reason];

  const queue = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => api.queue({ owner, reason, cursor: pageParam }),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: authReady,
    refetchInterval: (q) => (q.state.error instanceof CopsRequestError && q.state.error.envelope?.code === "FORBIDDEN" ? false : QUEUE_POLL_MS),
    refetchIntervalInBackground: false,
  });
  const items = queue.data?.pages.flatMap((p) => p.data) ?? [];
  const forbidden = queue.error instanceof CopsRequestError && queue.error.envelope?.code === "FORBIDDEN";
  // COPS-07: an admin turned the module off; say so instead of blaming the role.
  const moduleOff = forbidden && ((queue.error as CopsRequestError).envelope?.details as { reason?: string } | null | undefined)?.reason === "module_disabled";

  return (
    <div className="space-y-4 p-6" data-testid="page-cops-follow-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Follow-up</h1>
          <p className="text-sm text-muted-foreground">Who needs a human touch today, most urgent first.</p>
        </div>
        <div className="flex gap-2">
          {isManager && (
            <Select aria-label="Owner" value={owner} onChange={(e) => setOwner(e.target.value as "me" | "all")} className="w-36">
              <option value="me">My accounts</option>
              <option value="all">All reps</option>
            </Select>
          )}
          <Select aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value as QueueReason | "")} className="w-48">
            <option value="">All reasons</option>
            {QUEUE_REASONS.map((r) => (
              <option key={r} value={r}>
                {QUEUE_REASON_LABEL[r]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {queue.isLoading ? (
            <Skeleton className="h-40 w-full rounded-md" />
          ) : queue.isError ? (
            <Alert variant={forbidden ? "default" : "error"}>
              {moduleOff
                ? "Onboarding and follow-up are turned off for this workspace. An admin can turn them on in CustomerOps admin."
                : forbidden
                  ? "The follow-up queue is for Sales and Customer Success roles."
                  : "Could not load the follow-up queue."}
            </Alert>
          ) : items.length === 0 ? (
            // Bible Appendix G: no tasks -> show the next recommended action.
            <div className="rounded-md border border-dashed p-8 text-center" data-testid="follow-up-empty">
              <p className="text-sm font-medium">Nothing needs you right now</p>
              <p className="mt-1 text-xs text-muted-foreground">Next: review accounts in onboarding and book the trial reviews coming up.</p>
              <Link href="/crm/companies" className="mt-3 inline-block rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent">
                Open accounts
              </Link>
            </div>
          ) : (
            <ul className="divide-y" data-testid="follow-up-queue">
              {items.map((item) => {
                const Rec = ICON[item.recommended_action.kind];
                return (
                  <li key={item.id} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:justify-between" data-testid="follow-up-row">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={queueTone(item.reason)}>{QUEUE_REASON_LABEL[item.reason]}</Badge>
                        <Link className="font-medium hover:underline" href={`/crm/360?mode=account&id=${item.account.id}&tab=onboarding`}>
                          {item.account.name}
                        </Link>
                        {item.contact && <span className="text-xs text-muted-foreground">{item.contact.name}</span>}
                      </div>
                      <p className="truncate text-sm">{item.detail}</p>
                      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span>Last touch: {item.last_touch_at ? new Date(item.last_touch_at).toLocaleDateString() : "never"}</span>
                        {item.due_at && <span>Due: {new Date(item.due_at).toLocaleDateString()}</span>}
                        {item.active_sequence && <span>Follow-up step {item.active_sequence.current_step ?? "—"}</span>}
                        {item.signals.filter((s) => s !== item.reason).length > 0 && (
                          <span>Also: {item.signals.filter((s) => s !== item.reason).map((s) => QUEUE_REASON_LABEL[s]).join(", ")}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" onClick={() => setActing({ item, kind: item.recommended_action.kind })} data-testid="follow-up-recommended">
                        <Rec className="h-3.5 w-3.5" /> {item.recommended_action.label}
                      </Button>
                      {(["call", "email", "meeting", "task"] as const)
                        .filter((k) => k !== item.recommended_action.kind)
                        .map((k) => {
                          const Icon = ICON[k];
                          return (
                            <Button key={k} size="sm" variant="outline" aria-label={`${k} ${item.account.name}`} onClick={() => setActing({ item, kind: k })}>
                              <Icon className="h-3.5 w-3.5" />
                            </Button>
                          );
                        })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {queue.hasNextPage && (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => queue.fetchNextPage()} disabled={queue.isFetchingNextPage}>
              Load more
            </Button>
          )}
        </CardContent>
      </Card>

      {acting && (
        <FollowUpActionDialog
          open
          onClose={() => setActing(null)}
          kind={acting.kind}
          accountId={acting.item.account.id}
          accountName={acting.item.account.name}
          contact={acting.item.contact}
          queueItemId={acting.item.id.startsWith("task:") || acting.item.id.startsWith("signal:") ? acting.item.id : undefined}
          defaultSubject={acting.kind === "email" && acting.item.reason === "reply" ? `Re: ${acting.item.detail}` : acting.item.detail}
          onDone={() => queryClient.invalidateQueries({ queryKey: ["cops-follow-up-queue"] })}
        />
      )}
    </div>
  );
}
