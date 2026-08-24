"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MailboxSelect, WarmupEmpty, WarmupStatGrid } from "@/components/warmup/warmup-ui";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { mailboxLabel, useWarmupToolApi } from "@/lib/warmup-tool";

export default function WarmupControlPage() {
  const api = useWarmupToolApi();
  const authReady = useAuthReady();
  const qc = useQueryClient();
  const [selected, setSelected] = useState("");

  const mailboxes = useQuery({
    queryKey: ["warmup-tool", "mailboxes"],
    queryFn: () => api.listMailboxes(),
    enabled: authReady,
  });

  const status = useQuery({
    queryKey: ["warmup-tool", "warmup", selected],
    queryFn: () => api.getWarmup(selected),
    enabled: authReady && Boolean(selected),
  });

  const decisions = useQuery({
    queryKey: ["warmup-tool", "warmup-decisions", selected],
    queryFn: () => api.getDecisions(selected),
    enabled: authReady && Boolean(selected),
  });

  const lifecycle = useMutation({
    mutationFn: (kind: "start" | "pause" | "resume" | "stop") => {
      if (kind === "start") return api.startWarmup(selected);
      if (kind === "pause") return api.pauseWarmup(selected);
      if (kind === "resume") return api.resumeWarmup(selected);
      return api.stopWarmup(selected);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["warmup-tool", "warmup", selected] });
      void qc.invalidateQueries({ queryKey: ["warmup-tool", "warmup-decisions", selected] });
    },
  });

  const session = status.data?.session;
  const latest = status.data?.latestDecision;

  return (
    <PageShell>
      <PageHeader
        title="Warm-up control"
        description="Start and steer the volume ramp. A 404 on status means warm-up has not been started yet — that is normal until you click Start."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Mailbox</CardTitle>
          <CardDescription>
            Start creates a default ramp profile if missing, then opens a session. Connect OAuth and enable the mailbox first for best results.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <MailboxSelect
            value={selected}
            onChange={setSelected}
            options={(mailboxes.data ?? []).map((m) => ({ id: m.id, label: mailboxLabel(m) }))}
          />
          <div className="flex flex-wrap gap-2">
            {(["start", "pause", "resume", "stop"] as const).map((kind) => (
              <Button
                key={kind}
                size="sm"
                variant={kind === "stop" ? "destructive" : kind === "start" ? "default" : "outline"}
                disabled={!selected || lifecycle.isPending}
                onClick={() => {
                  if (kind === "stop" && !window.confirm("Stop warm-up for this mailbox?")) return;
                  lifecycle.mutate(kind);
                }}
              >
                {kind}
              </Button>
            ))}
          </div>
        </CardContent>
        {lifecycle.isError && (
          <Alert className="mx-6 mb-4">
            {formatQueryError(
              lifecycle.error,
              "Lifecycle action failed. Create/enable the mailbox and ensure it is eligible."
            )}
          </Alert>
        )}
      </Card>

      {!selected && <WarmupEmpty>Select a mailbox to view warm-up status.</WarmupEmpty>}

      {selected && status.isLoading && (
        <p className="text-sm text-muted-foreground">Loading warm-up status…</p>
      )}

      {selected && status.isError && (
        <Alert className="mb-4">{formatQueryError(status.error, "Could not load warm-up status.")}</Alert>
      )}

      {selected && !status.isLoading && !status.isError && !session && (
        <Alert className="mb-4">
          No warm-up session yet. Click <strong>start</strong> to create a default profile and begin the ramp.
        </Alert>
      )}

      {session && (
        <div className="mb-6 space-y-4">
          <WarmupStatGrid
            items={[
              { label: "State", value: session.state, tone: session.state === "ACTIVE" ? "success" : "muted" },
              { label: "Day", value: session.currentDay ?? "—" },
              { label: "Daily target", value: session.currentDailyTarget ?? "—" },
              { label: "Sent today", value: session.committedVolumeToday ?? "—" },
              { label: "Started", value: session.startedAt ? new Date(session.startedAt).toLocaleString() : "—" },
              { label: "Last decision", value: session.lastDecisionAt ? new Date(session.lastDecisionAt).toLocaleString() : "—" },
            ]}
          />
          {latest && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Latest decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  {latest.decision && <Badge>{latest.decision}</Badge>}
                  {latest.riskLevel && <Badge tone="warning">{latest.riskLevel}</Badge>}
                  {latest.eligibility && <Badge tone="muted">{latest.eligibility}</Badge>}
                </div>
                <p>
                  Recommended {latest.recommendedVolume ?? "—"} / max {latest.maximumVolume ?? "—"}
                </p>
                {(latest.reasons?.length || latest.reasonCodes?.length) && (
                  <ul className="list-inside list-disc text-muted-foreground">
                    {(latest.reasons ?? latest.reasonCodes ?? []).map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decision history</CardTitle>
          </CardHeader>
          <CardContent>
            {decisions.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!decisions.isLoading && (decisions.data ?? []).length === 0 && (
              <WarmupEmpty>No decisions yet. They appear after Start / Resume.</WarmupEmpty>
            )}
            <div className="space-y-2">
              {(decisions.data ?? []).map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="muted">Day {d.warmupDay ?? "—"}</Badge>
                    {d.decision && <Badge>{d.decision}</Badge>}
                    {d.riskLevel && <Badge tone="warning">{d.riskLevel}</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {d.generatedAt ? new Date(d.generatedAt).toLocaleString() : d.id}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
