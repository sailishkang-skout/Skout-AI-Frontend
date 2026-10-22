"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuthReady } from "@/lib/api-client";
import { minutesText, SLA_STATE_LABEL, SLA_STATE_TONE, slaDueText, useCopsTicketsApi, type Incident, type ReleasePatch, type SlaClock, type SlaState, type TicketRelease } from "@/lib/cops-tickets";

const INPUT = "h-9 w-full rounded-md border bg-background px-3 text-sm";
const TEXTAREA = "flex w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** COPS-12: the ticket's worst SLA clock in one chip (queue rows). */
export function SlaChip({ state, dueAt }: { state: SlaState; dueAt?: string | null }) {
  const due = state === "running" || state === "at_risk" ? slaDueText(dueAt) : null;
  return (
    <Badge tone={SLA_STATE_TONE[state]} data-testid="sla-chip" data-state={state}>
      <Clock className="mr-1 h-3 w-3" />
      SLA {SLA_STATE_LABEL[state].toLowerCase()}
      {due ? ` · ${due}` : ""}
    </Badge>
  );
}

/** Row accent for at-risk and breached tickets in the queue. */
export const slaRowClass = (state: SlaState | undefined) =>
  state === "breached" ? "border-l-4 border-l-red-500 pl-2" : state === "at_risk" ? "border-l-4 border-l-amber-500 pl-2" : "";

/** COPS-12: both SLA clocks of a ticket (drawer). */
export function SlaPanel({ clocks }: { clocks: SlaClock[] }) {
  if (clocks.length === 0) return <p className="text-xs text-muted-foreground">No SLA clock yet. It starts within a few minutes.</p>;
  return (
    <ul className="space-y-2" data-testid="ticket-sla">
      {[...clocks]
        .sort((a, b) => (a.kind === "response" ? -1 : 1) - (b.kind === "response" ? -1 : 1))
        .map((c) => {
          const pct = Math.min(100, Math.round((c.used_minutes / c.target_minutes) * 100));
          return (
            <li key={c.kind} className="space-y-1" data-testid={`sla-clock-${c.kind}`}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="capitalize">{c.kind === "response" ? "First response" : "Resolution"}</span>
                <Badge tone={SLA_STATE_TONE[c.state]}>{SLA_STATE_LABEL[c.state]}</Badge>
              </div>
              <div className="h-1.5 rounded bg-muted">
                <div className={`h-1.5 rounded ${c.state === "breached" ? "bg-red-500" : c.state === "at_risk" ? "bg-amber-500" : c.state === "met" ? "bg-emerald-500" : "bg-sky-500"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {minutesText(c.used_minutes)} of {minutesText(c.target_minutes)} ({c.calendar === "24x7" ? "24x7" : "business hours"})
                {c.paused ? " · paused while waiting on the customer" : ""}
                {c.due_at && !c.met_at ? ` · due ${new Date(c.due_at).toLocaleString()} (${slaDueText(c.due_at)})` : ""}
                {c.met_at ? ` · ${c.breached_at ? "met late" : "met"} ${new Date(c.met_at).toLocaleString()}` : ""}
              </p>
            </li>
          );
        })}
    </ul>
  );
}

/**
 * COPS-12 release and verification (Bible p.55): the fix (release id, fixed-in version,
 * deployed-at) and the two verifications, each with evidence. Verified needs both.
 */
export function ReleasePanel({ release, canWrite, onSave }: { release: TicketRelease; canWrite: boolean; onSave: (patch: ReleasePatch) => Promise<unknown> }) {
  const [releaseId, setReleaseId] = useState(release.release_id ?? "");
  const [version, setVersion] = useState(release.fixed_in_version ?? "");
  const [deployedAt, setDeployedAt] = useState(release.deployed_at ? release.deployed_at.slice(0, 16) : "");
  const [qa, setQa] = useState("");
  const [customer, setCustomer] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(patch: ReleasePatch, reset?: () => void) {
    setBusy(true);
    try {
      await onSave(patch);
      reset?.();
    } catch {
      // The drawer shows the error.
    } finally {
      setBusy(false);
    }
  }
  const verified = (at: string | null, evidence: string | null, label: string) =>
    at ? (
      <p className="text-xs">
        <Badge tone="success">{label} verified</Badge> <span className="text-muted-foreground">{new Date(at).toLocaleString()}</span>
        {evidence ? <span className="block whitespace-pre-wrap text-muted-foreground">{evidence}</span> : null}
      </p>
    ) : (
      <p className="text-xs text-muted-foreground">{label} verification not recorded.</p>
    );

  return (
    <div className="space-y-3" data-testid="ticket-release">
      <div className="grid gap-2 sm:grid-cols-3">
        <input aria-label="Release id" placeholder="Release id" value={releaseId} onChange={(e) => setReleaseId(e.target.value)} disabled={!canWrite} className={INPUT} />
        <input aria-label="Fixed in version" placeholder="Fixed in version" value={version} onChange={(e) => setVersion(e.target.value)} disabled={!canWrite} className={INPUT} />
        <input aria-label="Deployed at" type="datetime-local" value={deployedAt} onChange={(e) => setDeployedAt(e.target.value)} disabled={!canWrite} className={INPUT} />
      </div>
      {canWrite && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => save({ release_id: releaseId.trim() || null, fixed_in_version: version.trim() || null, deployed_at: deployedAt ? new Date(deployedAt).toISOString() : null })}
          data-testid="ticket-release-save"
        >
          Save release
        </Button>
      )}
      {verified(release.qa_verified_at, release.qa_evidence, "QA")}
      {verified(release.customer_verified_at, release.customer_evidence, "Customer")}
      {canWrite && (!release.qa_verified_at || !release.customer_verified_at) && (
        <div className="grid gap-2">
          {!release.qa_verified_at && (
            <div className="flex gap-2">
              <textarea aria-label="QA evidence" rows={2} placeholder="QA evidence (test run, steps checked)" value={qa} onChange={(e) => setQa(e.target.value)} className={TEXTAREA} />
              <Button size="sm" variant="outline" disabled={busy || !qa.trim()} onClick={() => save({ qa_evidence: qa.trim() }, () => setQa(""))} data-testid="ticket-verify-qa">
                Record QA
              </Button>
            </div>
          )}
          {!release.customer_verified_at && (
            <div className="flex gap-2">
              <textarea aria-label="Customer evidence" rows={2} placeholder="Customer verification (who confirmed, how)" value={customer} onChange={(e) => setCustomer(e.target.value)} className={TEXTAREA} />
              <Button size="sm" variant="outline" disabled={busy || !customer.trim()} onClick={() => save({ customer_evidence: customer.trim() }, () => setCustomer(""))} data-testid="ticket-verify-customer">
                Record customer
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** COPS-12: link the ticket to an open incident, or show the one it belongs to. */
export function IncidentLink({
  incident,
  canWrite,
  onLink,
  onUnlink,
}: {
  incident: { id: string; title: string; status: string } | null | undefined;
  canWrite: boolean;
  onLink: (incidentId: string) => Promise<unknown>;
  onUnlink: (incidentId: string) => Promise<unknown>;
}) {
  const api = useCopsTicketsApi();
  const authReady = useAuthReady();
  const [choice, setChoice] = useState("");
  const open = useQuery({ queryKey: ["cops-incidents", "open"], queryFn: () => api.incidents(), enabled: authReady && canWrite && !incident });
  const options = (open.data?.data ?? []).filter((i: Pick<Incident, "status">) => i.status !== "resolved");

  if (incident) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="ticket-incident">
        <span>
          Linked to <Link href={`/engineering/incidents?id=${incident.id}`} className="font-medium text-primary hover:underline">{incident.title}</Link>
        </span>
        <Badge>{incident.status}</Badge>
        {canWrite && (
          <Button size="sm" variant="ghost" onClick={() => onUnlink(incident.id).catch(() => undefined)} data-testid="ticket-incident-unlink">
            Unlink
          </Button>
        )}
      </div>
    );
  }
  if (!canWrite) return <p className="text-xs text-muted-foreground">Not linked to an incident.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="ticket-incident">
      <Select aria-label="Incident" value={choice} onChange={(e) => setChoice(e.target.value)} className="w-64">
        <option value="">{options.length ? "Link to an open incident…" : "No open incidents"}</option>
        {options.map((i) => (
          <option key={i.id} value={i.id}>
            {i.title}
          </option>
        ))}
      </Select>
      <Button size="sm" variant="outline" disabled={!choice} onClick={() => onLink(choice).then(() => setChoice("")).catch(() => undefined)} data-testid="ticket-incident-link">
        Link
      </Button>
    </div>
  );
}
