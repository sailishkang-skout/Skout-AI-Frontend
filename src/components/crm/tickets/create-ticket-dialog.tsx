"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "../form-field";
import { newIdempotencyKey } from "@/lib/cops-provisioning";
import {
  diagnosticRows,
  humanizeTicket,
  TICKET_CATEGORIES,
  TICKET_ENVIRONMENTS,
  TICKET_PRIORITIES,
  TICKET_SEVERITIES,
  ticketErrorMessage,
  useCopsTicketsApi,
  type Ticket,
  type TicketPrefill,
  type TicketSeverity,
} from "@/lib/cops-tickets";

const TEXTAREA =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * COPS-06 "Create ticket" from an account or an onboarding blocker. The form opens prefilled from
 * the account context (category, severity, priority, impact, affected feature, environment, safe
 * diagnostics), so the reporter only adds what happened. One Idempotency-Key per open dialog.
 */
export function CreateTicketDialog({
  open,
  onClose,
  accountId,
  accountName,
  blocker,
  milestoneId,
  source,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  accountId: string;
  accountName?: string;
  blocker?: string;
  milestoneId?: string;
  source: "account" | "onboarding_blocker";
  onCreated?: (ticket: Ticket) => void;
}) {
  const api = useCopsTicketsApi();
  const key = useRef(newIdempotencyKey());
  const [form, setForm] = useState<TicketPrefill | null>(null);
  const [description, setDescription] = useState("");
  const [repro, setRepro] = useState("");
  const [logRefs, setLogRefs] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefill = useQuery({
    queryKey: ["cops-ticket-prefill", accountId, milestoneId ?? "", blocker ?? ""],
    queryFn: () => api.prefill({ account_id: accountId, milestone_id: milestoneId, blocker }),
    enabled: open,
    staleTime: 0,
  });

  useEffect(() => {
    if (!open) return;
    key.current = newIdempotencyKey();
    setForm(null);
    setDescription("");
    setRepro("");
    setLogRefs("");
    setError(null);
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (open && prefill.data && !form) setForm(prefill.data.data);
  }, [open, prefill.data, form]);

  const set = <K extends keyof TicketPrefill>(k: K, v: TicketPrefill[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const valid = Boolean(form?.title.trim());

  async function submit() {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const refs = logRefs.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      const res = await api.create(
        {
          account_id: form.account_id,
          ...(form.contact_id ? { contact_id: form.contact_id } : {}),
          ...(form.milestone_id ? { milestone_id: form.milestone_id } : {}),
          title: form.title.trim(),
          category: form.category,
          severity: form.severity,
          priority: form.priority,
          environment: form.environment,
          ...(form.impact?.trim() ? { impact: form.impact.trim() } : {}),
          ...(form.affected_feature?.trim() ? { affected_feature: form.affected_feature.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(repro.trim() ? { repro_steps: repro.trim() } : {}),
          ...(refs.length ? { log_refs: refs } : {}),
          diagnostics: form.diagnostics,
        },
        key.current,
        source
      );
      onCreated?.(res.data);
      onClose();
    } catch (err) {
      setError(ticketErrorMessage(err, "Could not create the ticket."));
    } finally {
      setBusy(false);
    }
  }

  const diagnostics = form ? diagnosticRows(form.diagnostics) : [];

  return (
    <Dialog open={open} onClose={onClose} title="Create engineering ticket" description={accountName ? `For ${accountName}. Fields are prefilled from the account.` : "Fields are prefilled from the account."}>
      <div className="space-y-4" data-testid="create-ticket-dialog">
        {error && <Alert variant="error">{error}</Alert>}
        {prefill.isError ? (
          <Alert variant="error">{ticketErrorMessage(prefill.error, "Could not load the account context.")}</Alert>
        ) : !form ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading account context…
          </div>
        ) : (
          <>
            <Field label="Title" required>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} aria-label="Title" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Category">
                <Select value={form.category} onChange={(e) => set("category", e.target.value)} aria-label="Category">
                  {TICKET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {humanizeTicket(c)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Severity">
                <Select value={form.severity} onChange={(e) => set("severity", e.target.value as TicketSeverity)} aria-label="Severity">
                  {TICKET_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={form.priority} onChange={(e) => set("priority", e.target.value)} aria-label="Priority">
                  {TICKET_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p.toUpperCase()}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Environment">
                <Select value={form.environment} onChange={(e) => set("environment", e.target.value)} aria-label="Environment">
                  {TICKET_ENVIRONMENTS.map((env) => (
                    <option key={env} value={env}>
                      {env}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Affected feature">
                <Input value={form.affected_feature ?? ""} onChange={(e) => set("affected_feature", e.target.value)} maxLength={200} aria-label="Affected feature" />
              </Field>
              <Field label="Customer impact">
                <Input value={form.impact ?? ""} onChange={(e) => set("impact", e.target.value)} maxLength={1000} aria-label="Customer impact" />
              </Field>
            </div>
            <Field label="What happened">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={10000} aria-label="What happened" className={TEXTAREA} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Steps to reproduce">
                <textarea value={repro} onChange={(e) => setRepro(e.target.value)} rows={2} maxLength={10000} aria-label="Steps to reproduce" className={TEXTAREA} />
              </Field>
              <Field label="Log references">
                <textarea value={logRefs} onChange={(e) => setLogRefs(e.target.value)} rows={2} aria-label="Log references" placeholder="Request ids or trace links, one per line" className={TEXTAREA} />
              </Field>
            </div>
            <div className="rounded-md border bg-muted/40 p-3" data-testid="ticket-safe-diagnostics">
              <p className="text-xs font-medium">Safe diagnostics attached</p>
              {diagnostics.length === 0 ? (
                <p className="text-xs text-muted-foreground">None for this account yet.</p>
              ) : (
                <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
                  {diagnostics.map((d) => (
                    <div key={d.label} className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{d.label}</dt>
                      <dd className="truncate">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="mt-1 text-xs text-muted-foreground">No credentials, message content or commercial data is included.</p>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !valid} data-testid="create-ticket-submit">
            {busy && <Loader2 className="animate-spin" />}
            Create ticket
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
