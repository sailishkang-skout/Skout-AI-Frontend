"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Mail, Pause, Phone, Play, Square, TriangleAlert, Wrench } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DailyBarChart } from "@/components/analytics/daily-bar-chart";
import { useAuthReady } from "@/lib/api-client";
import { CopsRequestError } from "@/lib/cops-fetch";
import { can, useMyPermissions } from "@/lib/cops-commercial";
import { usageSeries, useCopsProvisioningApi, type Provisioning } from "@/lib/cops-provisioning";
import {
  BLOCKER_LABEL,
  INTEGRATION_LABEL,
  INTEGRATION_STATE_LABEL,
  integrationTone,
  emailProgress,
  emailStatusTone,
  evidenceText,
  ONBOARDING_PERMS,
  ONBOARDING_POLL_MS,
  onboardingErrorMessage,
  orderedMilestones,
  STOP_REASON_LABEL,
  trialTimer,
  useCopsOnboardingApi,
  type ActionKind,
} from "@/lib/cops-onboarding";
import { OnboardingEmailDialog } from "./onboarding-email-dialog";
import { FollowUpActionDialog } from "./follow-up-action-dialog";
import { CreateTicketDialog } from "../tickets/create-ticket-dialog";
import { ReasonDialog } from "./reason-dialog";

type ReasonMode = { kind: "pause" | "stop"; enrollmentId: string } | { kind: "milestone"; key: string; label: string } | null;

/**
 * COPS-05 Onboarding Control (Bible p.63), on the Customer 360 Onboarding tab once the trial is
 * provisioned: activation progress and trial timer, checklist with milestone evidence, follow-up
 * sequence card (current step, next action, pause/stop), usage and credit chart, integrations,
 * blockers and escalation shortcuts, onboarding emails. Polls so status changes show without a refresh.
 */
export function OnboardingControl({
  accountId,
  accountName,
  provisioning,
}: {
  accountId: string;
  accountName: string;
  provisioning: Provisioning;
}) {
  const api = useCopsOnboardingApi();
  const provApi = useCopsProvisioningApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { permissions } = useMyPermissions();
  const canSend = can(permissions, ONBOARDING_PERMS.send);
  const canFollowUp = can(permissions, ONBOARDING_PERMS.followUp);
  const [emailOpen, setEmailOpen] = useState(false);
  const [reasonMode, setReasonMode] = useState<ReasonMode>(null);
  const [actionKind, setActionKind] = useState<{ kind: ActionKind; subject?: string } | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = ["cops-onboarding", accountId];

  const view = useQuery({
    queryKey: key,
    queryFn: () => api.onboarding(accountId),
    enabled: authReady,
    refetchInterval: (q) => (q.state.error instanceof CopsRequestError && q.state.error.envelope?.code === "FORBIDDEN" ? false : ONBOARDING_POLL_MS),
    refetchIntervalInBackground: false,
  });
  const wallet = useQuery({ queryKey: ["cops-wallet-summary", accountId], queryFn: () => provApi.wallet(accountId), enabled: authReady, retry: false });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ["cops-360", accountId] });
    queryClient.invalidateQueries({ queryKey: ["cops-timeline", accountId] });
  };

  if (view.isLoading) return <Skeleton className="h-64 w-full rounded-md" />;
  if (view.isError) return <Alert variant="error">{onboardingErrorMessage(view.error, "Could not load onboarding.")}</Alert>;
  const d = view.data!.data;
  const activation = d.activation;
  const timer = trialTimer(d.trial_ends_at);
  const fu = d.follow_up;
  const enrollment = fu?.enrollment ?? null;
  const contact = (() => {
    const e = d.emails.find((x) => x.contact_id);
    return e ? { id: e.contact_id!, name: e.to, email: e.to } : null;
  })();
  const balance = wallet.data?.data.balance;

  async function control(action: "resume", enrollmentId: string) {
    setError(null);
    try {
      if (action === "resume") await api.resume(enrollmentId);
      refresh();
    } catch (err) {
      setError(onboardingErrorMessage(err, "Could not update the follow-up."));
    }
  }

  return (
    <div className="space-y-5" data-testid="onboarding-control">
      {error && <Alert variant="error">{error}</Alert>}

      {/* KPI row: completion, days left, credits, next task (Bible p.48 mock). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Completion" value={`${activation?.activation_pct ?? 0}%`} hint={activation?.activated_at ? "Activated" : "Activation"} testId="activation-pct" />
        <Kpi
          label="Days left"
          value={timer ? (timer.ended ? "Ended" : String(timer.days)) : "—"}
          hint={timer && !timer.ended ? `${timer.hours}h · trial` : "Trial"}
          testId="trial-timer"
        />
        <Kpi label="Credits" value={balance === undefined ? "—" : balance.toLocaleString()} hint="Balance" />
        <Kpi
          label="Next step"
          value={enrollment?.next_action ? enrollment.next_action.kind : fu?.task ? "Task" : "—"}
          hint={enrollment?.next_action?.scheduled_at ? new Date(enrollment.next_action.scheduled_at).toLocaleDateString() : fu?.task?.due_at ? new Date(fu.task.due_at).toLocaleDateString() : ""}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Checklist with milestone evidence. */}
        <section className="space-y-2" data-testid="activation-checklist">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Activation checklist</h3>
            {activation && <span className="text-xs text-muted-foreground">template {activation.template_key} v{activation.template_version}</span>}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${activation?.activation_pct ?? 0}%` }} />
          </div>
          <ul className="divide-y rounded-md border">
            {orderedMilestones(activation?.milestones ?? []).map((m) => (
              <li key={m.key} className="flex items-start justify-between gap-3 px-3 py-2 text-sm" data-testid={`milestone-${m.key}`}>
                <div className="flex items-start gap-2">
                  {m.completed_at ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                  <div>
                    <p className={m.completed_at ? "" : "text-muted-foreground"}>
                      {m.label}
                      {m.required && <span className="ml-1 text-xs text-muted-foreground">required</span>}
                    </p>
                    {m.completed_at && (
                      <p className="text-xs text-muted-foreground">
                        {evidenceText(m)} · {new Date(m.completed_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                {!m.completed_at && m.source === "manual" && canFollowUp && (
                  <Button size="sm" variant="outline" onClick={() => setReasonMode({ kind: "milestone", key: m.key, label: m.label })}>
                    Mark done
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Signing in alone never activates; activation needs every required milestone.</p>
        </section>

        <div className="space-y-5">
          {/* Follow-up sequence card. */}
          <section className="space-y-2 rounded-md border p-3" data-testid="follow-up-card">
            <h3 className="text-sm font-medium">Follow-up</h3>
            {!fu ? (
              <p className="text-sm text-muted-foreground">Starts when the onboarding email is sent.</p>
            ) : fu.mode === "task" ? (
              <div className="text-sm">
                <p>
                  Enrollment task: <span className="font-medium">{fu.task?.title ?? "task"}</span>{" "}
                  {fu.task && <Badge tone={fu.task.status === "done" ? "success" : "info"}>{fu.task.status}</Badge>}
                </p>
                {fu.task_reason && <p className="mt-1 text-xs text-muted-foreground">Why a task: {fu.task_reason.split(": ").slice(1).join(": ") || fu.task_reason}</p>}
              </div>
            ) : enrollment ? (
              <div className="space-y-2 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tone={enrollment.status === "active" ? "success" : enrollment.status === "paused" ? "warning" : "muted"} data-testid="follow-up-status">
                    {enrollment.status}
                  </Badge>
                  {enrollment.current_step != null && <span>Step {enrollment.current_step}</span>}
                  {enrollment.template_version != null && <span className="text-xs text-muted-foreground">cadence v{enrollment.template_version}</span>}
                </p>
                {enrollment.next_action && (
                  <p className="text-xs text-muted-foreground">
                    Next: {enrollment.next_action.kind}
                    {enrollment.next_action.scheduled_at ? ` on ${new Date(enrollment.next_action.scheduled_at).toLocaleString()}` : ""}
                  </p>
                )}
                {enrollment.stop_reason && <p className="text-xs text-muted-foreground">Stopped: {STOP_REASON_LABEL[enrollment.stop_reason] ?? enrollment.stop_reason}</p>}
                {canFollowUp && (enrollment.status === "active" || enrollment.status === "paused") && (
                  <div className="flex gap-2">
                    {enrollment.status === "active" ? (
                      <Button size="sm" variant="outline" onClick={() => setReasonMode({ kind: "pause", enrollmentId: enrollment.id })} data-testid="follow-up-pause">
                        <Pause className="h-3.5 w-3.5" /> Pause
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => control("resume", enrollment.id)} data-testid="follow-up-resume">
                        <Play className="h-3.5 w-3.5" /> Resume
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setReasonMode({ kind: "stop", enrollmentId: enrollment.id })} data-testid="follow-up-stop">
                      <Square className="h-3.5 w-3.5" /> Stop
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </section>

          {/* Blockers + escalation shortcuts. */}
          <section className="space-y-2" data-testid="onboarding-blockers">
            <h3 className="text-sm font-medium">Blockers</h3>
            {d.blockers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open blockers.</p>
            ) : (
              <ul className="space-y-1">
                {d.blockers.map((b) => (
                  <li key={`${b.kind}-${b.since}`} className="flex items-start gap-2 text-sm">
                    <TriangleAlert className="mt-0.5 h-4 w-4 text-amber-600" />
                    <span>
                      <span className="font-medium">{BLOCKER_LABEL[b.kind] ?? b.kind}</span>
                      <span className="block text-xs text-muted-foreground">since {new Date(b.since).toLocaleDateString()}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {canFollowUp && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setActionKind({ kind: "call" })}>
                  <Phone className="h-3.5 w-3.5" /> Log a call
                </Button>
                <Button size="sm" variant="outline" onClick={() => setActionKind({ kind: "meeting", subject: `Guided onboarding: ${accountName}` })}>
                  Book a meeting
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTicketOpen(true)}
                  data-testid="escalate-engineering"
                >
                  <Wrench className="h-3.5 w-3.5" /> Escalate to engineering
                </Button>
              </div>
            )}
            {d.handoff && <p className="text-xs text-muted-foreground">CS handoff created {d.handoff.created_at ? new Date(d.handoff.created_at).toLocaleDateString() : ""}; Sales keeps the account.</p>}
          </section>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Credits used, last 30 days</h3>
          <div className="h-40">
            <DailyBarChart data={usageSeries(wallet.data?.data.usage ?? [])} emptyLabel="No credits used yet" valueLabel="Credits used" />
          </div>
        </section>
        <section className="space-y-2" data-testid="onboarding-integrations">
          <h3 className="text-sm font-medium">Integrations</h3>
          <ul className="space-y-1 text-sm">
            {(d.integrations ?? []).map((i) => (
              <li key={i.key} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5" data-testid={`integration-${i.key}`}>
                <span>
                  {INTEGRATION_LABEL[i.key]}
                  {(provisioning.integrations ?? []).includes(i.key as never) && <span className="ml-1 text-xs text-muted-foreground">requested</span>}
                  {i.detail && <span className="block text-xs text-muted-foreground">{i.detail}</span>}
                </span>
                <Badge tone={integrationTone(i.status)}>{INTEGRATION_STATE_LABEL[i.status]}</Badge>
              </li>
            ))}
            {(d.integrations ?? []).length === 0 && <li className="text-muted-foreground">No integrations connected yet. Ask the customer to connect their CRM.</li>}
          </ul>
        </section>
      </div>

      {/* Onboarding emails. */}
      <section className="space-y-2" data-testid="onboarding-emails">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Onboarding email</h3>
          {canSend && (
            <Button size="sm" onClick={() => setEmailOpen(true)} data-testid="open-onboarding-email">
              <Mail className="h-3.5 w-3.5" /> {d.emails.some((e) => e.status !== "failed") ? "Re-send" : "Send onboarding email"}
            </Button>
          )}
        </div>
        {d.emails.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not sent yet. Sending it starts the follow-up.</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {d.emails.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  {e.to} · {e.subject}
                  {e.is_resend && <span className="ml-1 text-xs text-muted-foreground">re-send: {e.reason}</span>}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {new Date(e.sent_at ?? e.created_at).toLocaleString()}
                  <Badge tone={emailStatusTone(e)}>{emailProgress(e)}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <OnboardingEmailDialog open={emailOpen} onClose={() => setEmailOpen(false)} accountId={accountId} previous={d.emails} onSent={refresh} />
      <ReasonDialog
        open={reasonMode !== null}
        onClose={() => setReasonMode(null)}
        title={reasonMode?.kind === "pause" ? "Pause follow-up" : reasonMode?.kind === "stop" ? "Stop follow-up" : `Mark "${reasonMode && "label" in reasonMode ? reasonMode.label : ""}" done`}
        description={
          reasonMode?.kind === "stop"
            ? "No further step runs; pending steps are cancelled."
            : reasonMode?.kind === "pause"
              ? "Steps keep their schedule until you resume."
              : "Recorded as evidence with your name."
        }
        confirm={reasonMode?.kind === "pause" ? "Pause" : reasonMode?.kind === "stop" ? "Stop" : "Mark done"}
        danger={reasonMode?.kind === "stop"}
        onSubmit={async (reason) => {
          try {
            if (reasonMode?.kind === "pause") await api.pause(reasonMode.enrollmentId, reason);
            else if (reasonMode?.kind === "stop") await api.stop(reasonMode.enrollmentId, reason);
            else if (reasonMode?.kind === "milestone") await api.completeMilestone(accountId, reasonMode.key, reason);
          } catch (err) {
            throw new Error(onboardingErrorMessage(err, "Could not save."));
          }
          refresh();
        }}
      />
      <CreateTicketDialog
        open={ticketOpen}
        onClose={() => setTicketOpen(false)}
        accountId={accountId}
        accountName={accountName}
        blocker={d?.blockers[0]?.kind}
        source="onboarding_blocker"
        onCreated={refresh}
      />
      {actionKind && (
        <FollowUpActionDialog
          open
          onClose={() => setActionKind(null)}
          kind={actionKind.kind}
          defaultSubject={actionKind.subject}
          accountId={accountId}
          accountName={accountName}
          contact={contact}
          onDone={refresh}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId?: string }) {
  return (
    <div className="rounded-md border p-3" data-testid={testId}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold capitalize">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
