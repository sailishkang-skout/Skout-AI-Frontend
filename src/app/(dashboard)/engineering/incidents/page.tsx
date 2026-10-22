"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { can, useMyPermissions } from "@/lib/cops-commercial";
import { humanizeTicket, severityTone, ticketErrorMessage, useCopsTicketsApi, type Incident, type IncidentFollowUp } from "@/lib/cops-tickets";
import { useTeamApi } from "@/lib/team";

const INPUT = "h-9 w-full rounded-md border bg-background px-3 text-sm";
const TEXTAREA = "flex w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const SEVERITIES = ["low", "medium", "high", "critical"] as const;

/** COPS-12 incident detail: one investigation owner, workaround, root cause, follow-ups, linked tickets, customer update. */
function IncidentDetail({ id }: { id: string }) {
  const api = useCopsTicketsApi();
  const teamApi = useTeamApi();
  const authReady = useAuthReady();
  const qc = useQueryClient();
  const { permissions } = useMyPermissions();
  const canWrite = can(permissions, ["tickets:write"]);
  const canPublish = can(permissions, ["tickets:send"]);
  const q = useQuery({ queryKey: ["cops-incident", id], queryFn: () => api.incident(id), enabled: authReady });
  const members = useQuery({ queryKey: ["team", "members"], queryFn: () => teamApi.listMembers(), enabled: authReady });
  const inc = q.data?.data;
  const [workaround, setWorkaround] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [update, setUpdate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    setWorkaround(inc?.workaround ?? "");
    setRootCause(inc?.root_cause ?? "");
  }, [inc?.id, inc?.workaround, inc?.root_cause]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["cops-incident", id] });
    qc.invalidateQueries({ queryKey: ["cops-incidents"] });
    qc.invalidateQueries({ queryKey: ["cops-tickets"] });
  };
  const patch = useMutation({ mutationFn: (body: Parameters<typeof api.updateIncident>[1]) => api.updateIncident(id, body), onSuccess: refresh, onError: (e) => setError(ticketErrorMessage(e, "Could not save the incident.")) });
  const publish = useMutation({
    mutationFn: () => api.incidentCustomerUpdate(id, update.trim()),
    onSuccess: (r) => {
      setUpdate("");
      setNotice(`Posted to ${r.data.ticketsUpdated} linked ticket(s).`);
      refresh();
    },
    onError: (e) => setError(ticketErrorMessage(e, "Could not publish the update.")),
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full rounded-md" />;
  if (q.isError || !inc) return <Alert variant="error">{ticketErrorMessage(q.error, "Could not load the incident.")}</Alert>;
  const setFollowUps = (list: IncidentFollowUp[]) => patch.mutate({ follow_ups: list });

  return (
    <div className="space-y-4" data-testid="incident-detail">
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert>{notice}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{inc.title}</h2>
        <Badge tone={severityTone(inc.severity)}>{inc.severity}</Badge>
        <Badge>{inc.status}</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Investigation owner</span>
          <Select aria-label="Investigation owner" value={inc.owner_id ?? ""} disabled={!canWrite || patch.isPending} onChange={(e) => patch.mutate({ owner_id: e.target.value || null })}>
            <option value="">Not assigned</option>
            {(members.data?.data ?? []).map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.fullName || m.email}
              </option>
            ))}
          </Select>
          <span className="block text-xs text-muted-foreground">Every linked ticket is assigned to the owner.</span>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          <Select aria-label="Incident status" value={inc.status} disabled={!canWrite} onChange={(e) => patch.mutate({ status: e.target.value as Incident["status"] })}>
            <option value="open">open</option>
            <option value="investigating">investigating</option>
            <option value="resolved">resolved</option>
          </Select>
        </label>
        <div className="space-y-1 text-sm">
          <span className="text-muted-foreground">Window</span>
          <p>
            {inc.started_at ? new Date(inc.started_at).toLocaleString() : "—"} → {inc.ended_at ? new Date(inc.ended_at).toLocaleString() : "ongoing"}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Workaround</span>
          <textarea aria-label="Workaround" rows={3} value={workaround} disabled={!canWrite} onChange={(e) => setWorkaround(e.target.value)} className={TEXTAREA} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Root cause (internal)</span>
          <textarea aria-label="Root cause" rows={3} value={rootCause} disabled={!canWrite} onChange={(e) => setRootCause(e.target.value)} className={TEXTAREA} />
        </label>
      </div>
      {canWrite && (
        <Button size="sm" variant="outline" disabled={patch.isPending} onClick={() => patch.mutate({ workaround: workaround.trim() || null, root_cause: rootCause.trim() || null })} data-testid="incident-save">
          Save
        </Button>
      )}

      <section className="space-y-1">
        <h3 className="text-sm font-medium">Follow-ups</h3>
        <ul className="space-y-1 text-sm" data-testid="incident-follow-ups">
          {inc.follow_ups.map((f, i) => (
            <li key={`${i}-${f.text}`} className="flex items-center gap-2">
              <input type="checkbox" checked={f.done} disabled={!canWrite} aria-label={`Done: ${f.text}`} onChange={() => setFollowUps(inc.follow_ups.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} />
              <span className={f.done ? "line-through text-muted-foreground" : ""}>{f.text}</span>
            </li>
          ))}
          {inc.follow_ups.length === 0 && <li className="text-xs text-muted-foreground">No follow-ups yet.</li>}
        </ul>
        {canWrite && (
          <div className="flex gap-2">
            <input aria-label="New follow-up" value={followUp} onChange={(e) => setFollowUp(e.target.value)} placeholder="Add a follow-up" className={INPUT} />
            <Button size="sm" variant="outline" disabled={!followUp.trim()} onClick={() => (setFollowUps([...inc.follow_ups, { text: followUp.trim(), done: false }]), setFollowUp(""))}>
              Add
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-1">
        <h3 className="text-sm font-medium">
          Linked tickets ({inc.tickets.length}) · {inc.affected_accounts.length} affected customer{inc.affected_accounts.length === 1 ? "" : "s"}
        </h3>
        {inc.tickets.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tickets linked yet. Link one from its drawer in the engineering queue.</p>
        ) : (
          <ul className="divide-y text-sm" data-testid="incident-tickets">
            {inc.tickets.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <Badge tone={severityTone(t.severity)}>{t.severity}</Badge>
                <span className="font-medium">{t.title}</span>
                <Link href={`/crm/360?mode=account&id=${t.account_id}&tab=engineering`} className="text-xs text-primary hover:underline">
                  {t.account_name}
                </Link>
                <span className="ml-auto text-xs text-muted-foreground">{humanizeTicket(t.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border-2 border-sky-500/60 bg-sky-50/50 p-3 dark:bg-sky-950/20" data-testid="incident-customer-update">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Eye className="h-3.5 w-3.5" /> Customer update to every linked ticket
        </p>
        <p className="mb-2 text-xs text-muted-foreground">Each customer sees this on their own ticket. Never paste the internal root cause here.</p>
        {inc.customer_update && <p className="mb-2 whitespace-pre-wrap text-xs">Last: {inc.customer_update} ({inc.customer_update_at ? new Date(inc.customer_update_at).toLocaleString() : ""})</p>}
        <textarea aria-label="Customer update" rows={3} value={update} disabled={!canPublish} onChange={(e) => setUpdate(e.target.value)} className={TEXTAREA} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{canPublish ? "" : "Only Customer Success can publish updates to the customer."}</span>
          <Button size="sm" disabled={!canPublish || !update.trim() || publish.isPending || inc.tickets.length === 0} onClick={() => publish.mutate()} data-testid="incident-publish">
            Publish to {inc.tickets.length} ticket(s)
          </Button>
        </div>
      </section>
    </div>
  );
}

/** COPS-12 incidents (Bible p.54): one incident for many customer tickets, one investigation. */
export default function IncidentsPage() {
  const api = useCopsTicketsApi();
  const authReady = useAuthReady();
  const qc = useQueryClient();
  const params = useSearchParams();
  const { permissions } = useMyPermissions();
  const canWrite = can(permissions, ["tickets:write"]);
  const [selected, setSelected] = useState<string | null>(params.get("id"));
  const [status, setStatus] = useState("");
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<Incident["severity"]>("high");
  const list = useQuery({ queryKey: ["cops-incidents", status], queryFn: () => api.incidents(status || undefined), enabled: authReady });
  const create = useMutation({
    mutationFn: () => api.createIncident({ title: title.trim(), severity }),
    onSuccess: (r) => {
      setTitle("");
      setSelected(r.data.id);
      qc.invalidateQueries({ queryKey: ["cops-incidents"] });
    },
  });
  const items = list.data?.data ?? [];
  // Open the newest incident when none is picked, so the page never starts empty.
  const shown = selected ?? items[0]?.id ?? null;

  return (
    <div className="space-y-4 p-6" data-testid="page-cops-incidents">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Incidents</h1>
          <p className="text-sm text-muted-foreground">
            Many customer tickets, one investigation. <Link href="/engineering" className="text-primary hover:underline">Back to the queue</Link>
          </p>
        </div>
        <Select aria-label="Incident status filter" value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
        </Select>
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Incidents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {canWrite && (
              <div className="space-y-2" data-testid="incident-create">
                <input aria-label="Incident title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New incident title" className={INPUT} />
                <div className="flex gap-2">
                  <Select aria-label="Incident severity" value={severity} onChange={(e) => setSeverity(e.target.value as Incident["severity"])}>
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>
                    Create
                  </Button>
                </div>
                {create.isError && <Alert variant="error">{ticketErrorMessage(create.error, "Could not create the incident.")}</Alert>}
              </div>
            )}
            {list.isLoading ? (
              <Skeleton className="h-24 w-full rounded-md" />
            ) : list.isError ? (
              <Alert variant="error">{ticketErrorMessage(list.error, "Could not load incidents.")}</Alert>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No incidents. Create one when several tickets share a cause.</p>
            ) : (
              <ul className="divide-y text-sm" data-testid="incident-list">
                {items.map((i) => (
                  <li key={i.id}>
                    <button type="button" onClick={() => setSelected(i.id)} className={`flex w-full items-center gap-2 py-2 text-left ${shown === i.id ? "font-medium" : ""}`}>
                      <Badge tone={severityTone(i.severity)}>{i.severity}</Badge>
                      <span className="truncate">{i.title}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{i.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">{shown ? <IncidentDetail key={shown} id={shown} /> : <p className="text-sm text-muted-foreground">Select an incident.</p>}</CardContent>
        </Card>
      </div>
    </div>
  );
}
