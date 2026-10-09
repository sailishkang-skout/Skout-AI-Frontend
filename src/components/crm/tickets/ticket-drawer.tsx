"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Lock } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { can, useMyPermissions } from "@/lib/cops-commercial";
import {
  diagnosticRows,
  higherSeverities,
  humanizeTicket,
  severityTone,
  TICKET_TRANSITIONS,
  ticketErrorMessage,
  useCopsTicketsApi,
  type TicketSeverity,
  type TicketStatus,
  type TicketVisibility,
} from "@/lib/cops-tickets";

const TEXTAREA = "flex w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * One composer per visibility, never a toggle: the internal note and the customer update are
 * separate boxes with their own colour, label and button, so a note cannot be published by a
 * mis-click. The customer composer is disabled without tickets:send.
 */
function Composer({
  visibility,
  disabled,
  disabledReason,
  onSubmit,
}: {
  visibility: TicketVisibility;
  disabled?: boolean;
  disabledReason?: string;
  onSubmit: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const customer = visibility === "customer";
  const Icon = customer ? Eye : Lock;

  async function submit() {
    setBusy(true);
    try {
      await onSubmit(body.trim());
      setBody("");
    } catch {
      // The drawer shows the error; the text stays so nothing is lost.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={customer ? "rounded-md border-2 border-sky-500/60 bg-sky-50/50 p-3 dark:bg-sky-950/20" : "rounded-md border-2 border-amber-500/60 bg-amber-50/50 p-3 dark:bg-amber-950/20"}
      data-testid={`ticket-composer-${visibility}`}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Icon className="h-3.5 w-3.5" />
        {customer ? "Customer update" : "Internal note"}
      </p>
      <p className="mb-2 text-xs text-muted-foreground">
        {customer ? "The customer can see this. Write it for them." : "Internal staff only. The customer never sees this."}
      </p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={10000}
        disabled={disabled}
        aria-label={customer ? "Customer update" : "Internal note"}
        placeholder={customer ? "What should the customer know?" : "Findings, root cause, next steps"}
        className={TEXTAREA}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{disabled ? disabledReason : ""}</span>
        <Button size="sm" variant={customer ? "default" : "outline"} onClick={submit} disabled={disabled || busy || !body.trim()} data-testid={`ticket-composer-${visibility}-submit`}>
          {busy && <Loader2 className="animate-spin" />}
          {customer ? "Publish to customer" : "Add internal note"}
        </Button>
      </div>
    </div>
  );
}

/**
 * COPS-06 ticket drawer: customer context, safe diagnostics, status and escalation, the comment
 * stream with a visibility label on every entry, and the two composers.
 */
export function TicketDrawer({ ticketId, onClose }: { ticketId: string | null; onClose: () => void }) {
  const api = useCopsTicketsApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { permissions } = useMyPermissions();
  const canWrite = can(permissions, ["tickets:write"]);
  const canPublish = can(permissions, ["tickets:send"]);
  const [error, setError] = useState<string | null>(null);
  const [escalateTo, setEscalateTo] = useState<TicketSeverity | "">("");
  const [escalateReason, setEscalateReason] = useState("");

  const query = useQuery({
    queryKey: ["cops-ticket", ticketId],
    queryFn: () => api.get(ticketId as string),
    enabled: authReady && Boolean(ticketId),
  });
  const t = query.data?.data;

  async function act(run: () => Promise<unknown>, fallback: string) {
    setError(null);
    try {
      await run();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cops-ticket", ticketId] }),
        queryClient.invalidateQueries({ queryKey: ["cops-tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["cops-account-tickets"] }),
      ]);
    } catch (err) {
      setError(ticketErrorMessage(err, fallback));
      throw err;
    }
  }
  const quiet = (p: Promise<unknown>) => p.catch(() => undefined);

  const next = t ? TICKET_TRANSITIONS[t.status] : [];
  const higher = t ? higherSeverities(t.severity) : [];
  const diagnostics = t ? diagnosticRows(t.diagnostics) : [];

  return (
    <Sheet open={Boolean(ticketId)} onClose={onClose} title={t?.title ?? "Ticket"}>
      <div className="space-y-5" data-testid="ticket-drawer">
        {error && <Alert variant="error">{error}</Alert>}
        {query.isLoading ? (
          <Skeleton className="h-64 w-full rounded-md" />
        ) : query.isError || !t ? (
          <Alert variant="error">{ticketErrorMessage(query.error, "Could not load the ticket.")}</Alert>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={severityTone(t.severity)}>{t.severity}</Badge>
              <Badge>{humanizeTicket(t.status)}</Badge>
              <span className="text-xs text-muted-foreground">
                {t.priority.toUpperCase()} · {humanizeTicket(t.category)} · {t.environment}
              </span>
            </div>

            <section className="space-y-1 text-sm" data-testid="ticket-customer-context">
              <h3 className="text-sm font-medium">Customer</h3>
              <p>
                {t.context.account?.name ?? "—"} <span className="text-xs text-muted-foreground">{humanizeTicket(t.context.account?.tier)}</span>
              </p>
              {t.context.contact && (
                <p className="text-xs text-muted-foreground">
                  {t.context.contact.name}
                  {t.context.contact.email ? ` · ${t.context.contact.email}` : ""}
                </p>
              )}
              {t.context.milestone && <p className="text-xs text-muted-foreground">Onboarding milestone: {t.context.milestone.label}</p>}
              {t.context.opportunity && <p className="text-xs text-muted-foreground">Opportunity: {t.context.opportunity.name}</p>}
              <p className="text-xs text-muted-foreground">
                {t.context.summary.open_count} open ticket{t.context.summary.open_count === 1 ? "" : "s"} on this account
                {t.context.summary.max_severity ? `, highest ${t.context.summary.max_severity}` : ""}
              </p>
            </section>

            <section className="space-y-1 text-sm">
              <h3 className="text-sm font-medium">Details</h3>
              {t.impact && <p>Impact: {t.impact}</p>}
              {t.affected_feature && <p>Affected feature: {t.affected_feature}</p>}
              {t.description && <p className="whitespace-pre-wrap">{t.description}</p>}
              {t.repro_steps && <p className="whitespace-pre-wrap text-xs text-muted-foreground">Steps: {t.repro_steps}</p>}
              {t.log_refs.length > 0 && <p className="break-all text-xs text-muted-foreground">Logs: {t.log_refs.join(", ")}</p>}
            </section>

            <section data-testid="ticket-diagnostics">
              <h3 className="text-sm font-medium">Safe diagnostics</h3>
              {diagnostics.length === 0 ? (
                <p className="text-xs text-muted-foreground">None attached.</p>
              ) : (
                <dl className="mt-1 space-y-0.5 text-xs">
                  {diagnostics.map((d) => (
                    <div key={d.label} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{d.label}</dt>
                      <dd className="break-all text-right">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            {canWrite && (
              <section className="space-y-2">
                <h3 className="text-sm font-medium">Workflow</h3>
                <div className="flex flex-wrap gap-2">
                  {next.length === 0 ? (
                    <p className="text-xs text-muted-foreground">This ticket is closed.</p>
                  ) : (
                    next.map((to: TicketStatus) => (
                      <Button key={to} size="sm" variant="outline" onClick={() => quiet(act(() => api.transition(t.id, to), "Could not change the status."))} data-testid={`ticket-move-${to}`}>
                        Move to {humanizeTicket(to)}
                      </Button>
                    ))
                  )}
                </div>
                {higher.length > 0 && next.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={escalateTo} onChange={(e) => setEscalateTo(e.target.value as TicketSeverity | "")} aria-label="Escalate to" className="w-36">
                      <option value="">Escalate to…</option>
                      {higher.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                    <input
                      value={escalateReason}
                      onChange={(e) => setEscalateReason(e.target.value)}
                      aria-label="Escalation reason"
                      placeholder="Reason (required)"
                      maxLength={1000}
                      className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!escalateTo || !escalateReason.trim()}
                      onClick={() =>
                        quiet(
                          act(() => api.escalate(t.id, escalateTo as TicketSeverity, escalateReason.trim()), "Could not escalate the ticket.").then(() => {
                            setEscalateTo("");
                            setEscalateReason("");
                          })
                        )
                      }
                      data-testid="ticket-escalate"
                    >
                      Escalate
                    </Button>
                  </div>
                )}
              </section>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Notes and updates</h3>
              {t.comments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing yet.</p>
              ) : (
                <ul className="space-y-2" data-testid="ticket-comments">
                  {t.comments.map((c) => (
                    <li
                      key={c.id}
                      className={c.visibility === "customer" ? "rounded-md border-l-4 border-sky-500 bg-sky-50/50 p-2 dark:bg-sky-950/20" : "rounded-md border-l-4 border-amber-500 bg-amber-50/50 p-2 dark:bg-amber-950/20"}
                      data-visibility={c.visibility}
                    >
                      <p className="flex items-center gap-1.5 text-xs font-medium">
                        {c.visibility === "customer" ? <Eye className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        {c.visibility === "customer" ? "Visible to customer" : "Internal"}
                        {c.ai_generated && <span className="font-normal text-muted-foreground">· AI summary</span>}
                        <span className="font-normal text-muted-foreground">· {new Date(c.created_at).toLocaleString()}</span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {canWrite && (
              <section className="space-y-3">
                <Composer visibility="internal" onSubmit={(body) => act(() => api.comment(t.id, body, "internal"), "Could not add the note.")} />
                <Composer
                  visibility="customer"
                  disabled={!canPublish}
                  disabledReason="Only Customer Success can publish updates to the customer."
                  onSubmit={(body) => act(() => api.comment(t.id, body, "customer"), "Could not publish the update.")}
                />
              </section>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
