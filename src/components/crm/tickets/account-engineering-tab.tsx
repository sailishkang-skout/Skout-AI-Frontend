"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { can, useMyPermissions } from "@/lib/cops-commercial";
import { humanizeTicket, severityTone, ticketErrorMessage, useCopsTicketsApi } from "@/lib/cops-tickets";
import { CreateTicketDialog } from "./create-ticket-dialog";
import { TicketDrawer } from "./ticket-drawer";

/** COPS-06 Engineering tab on Customer 360: open count, max severity, the account's tickets, Create ticket. */
export function AccountEngineeringTab({ accountId, accountName }: { accountId: string; accountName?: string }) {
  const api = useCopsTicketsApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { permissions } = useMyPermissions();
  const canCreate = can(permissions, ["tickets:write", "crm:write"]);
  const canOpen = can(permissions, ["tickets:read"]);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["cops-account-tickets", accountId],
    queryFn: () => api.forAccount(accountId),
    enabled: authReady && Boolean(accountId),
  });
  const d = query.data?.data;

  const createButton = canCreate && (
    <Button size="sm" onClick={() => setCreating(true)} data-testid="account-create-ticket">
      Create ticket
    </Button>
  );

  return (
    <div className="space-y-3" data-testid="account-engineering-tab">
      {query.isLoading ? (
        <Skeleton className="h-32 w-full rounded-md" />
      ) : query.isError || !d ? (
        <Alert variant="error">{ticketErrorMessage(query.error, "Could not load this account's tickets.")}</Alert>
      ) : d.tickets.length === 0 ? (
        // Bible Appendix G.
        <div className="rounded-md border border-dashed p-8 text-center" data-testid="empty-tab-engineering">
          <p className="text-sm font-medium">No open tickets: this account is healthy</p>
          <div className="mt-3">{createButton}</div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm" data-testid="account-ticket-summary">
              <span className="font-medium">
                {d.summary.open_count} open ticket{d.summary.open_count === 1 ? "" : "s"}
              </span>
              {d.summary.max_severity && <Badge tone={severityTone(d.summary.max_severity)}>Highest: {d.summary.max_severity}</Badge>}
            </p>
            {createButton}
          </div>
          <ul className="divide-y rounded-md border">
            {d.tickets.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  {canOpen ? (
                    <button type="button" className="truncate text-left font-medium hover:underline" onClick={() => setOpenId(t.id)}>
                      {t.title}
                    </button>
                  ) : (
                    <span className="truncate font-medium">{t.title}</span>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {humanizeTicket(t.status)} · opened {new Date(t.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge tone={severityTone(t.severity)}>{t.severity}</Badge>
              </li>
            ))}
          </ul>
        </>
      )}

      <CreateTicketDialog
        open={creating}
        onClose={() => setCreating(false)}
        accountId={accountId}
        accountName={accountName}
        source="account"
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["cops-account-tickets", accountId] })}
      />
      <TicketDrawer ticketId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
