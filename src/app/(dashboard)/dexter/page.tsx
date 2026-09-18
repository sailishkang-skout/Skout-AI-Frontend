"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CheckSquare,
  Clock,
  Compass,
  Copy,
  Database,
  Globe,
  Inbox,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { formatJobTime } from "@/lib/enrichment-display";
import { cn } from "@/lib/utils";
import { DEXTER_EVENT_SPINE_TYPES, DEXTER_EVENT_TYPE_LABELS, type AutomationMode, useDexterPlatformApi } from "@/lib/dexter-platform";

const ACTION_KEY_META: Record<string, { title: string; desc: string }> = {
  "dexter.chat_write": { title: "AI Chat Reply", desc: "Live inbound SDR messaging" },
  "dexter.enroll_list": { title: "List Enrollment", desc: "Target account additions" },
  "dexter.plan_invoke": { title: "Plan Execution", desc: "Autonomous directive launch" },
  "sequence.activate": { title: "Sequence Activation", desc: "Start outbound campaigns" },
  "sequence.enroll": { title: "Prospect Enrollment", desc: "Add contacts to active cadence" },
  "activation_rule.fire": { title: "Rule Triggering", desc: "Automated trigger firing" },
  "ai.draft_auto_approve": { title: "AI Draft Approval", desc: "Pre-review generated copy" },
};

const PRESET_BRIEFS = [
  {
    label: "SaaS VPs (Mode C)",
    prompt: "Enroll high-fit SaaS VPs in a Mode C cadence",
    icon: Target,
  },
  {
    label: "FinTech Series B Trigger",
    prompt: "Target FinTech founders following Series B funding announcements",
    icon: Zap,
  },
  {
    label: "Enterprise TAM Enrichment",
    prompt: "Enrich stale enterprise accounts with verified buying committee signals",
    icon: Database,
  },
  {
    label: "Dormant Pipeline Re-engagement",
    prompt: "Run autonomous multi-touchpoint revival on 60-day stalled opportunities",
    icon: TrendingUp,
  },
];

/** §7.3 SP-12 — Evaluation Loop metrics are fractions (0-1) or null when nothing to rate yet. */
function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "—";
  return `${Math.round(rate * 100)}%`;
}

function decisionBadgeTone(decision: string): "success" | "danger" | "muted" {
  if (decision === "accepted") return "success";
  if (decision === "rejected") return "danger";
  return "muted";
}

function decisionLabel(decision: string): string {
  return decision === "rejected" ? "overridden" : decision;
}

function getEventTypeConfig(type: string) {
  switch (type) {
    case "dexter.plan.approved":
      return { icon: CheckSquare, bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
    case "dexter.plan.blocked":
      return { icon: ShieldAlert, bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" };
    case "dexter.action.executed":
      return { icon: Zap, bg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" };
    case "dexter.plan.proposed":
      return { icon: Sparkles, bg: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" };
    case "dexter.plan.invoked":
      return { icon: Play, bg: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20" };
    case "dexter.learning.approved":
      return { icon: TrendingUp, bg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20" };
    case "icp.approved":
      return { icon: Target, bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
    case "tam.approved":
      return { icon: Globe, bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
    case "regional_brief.approved":
      return { icon: Compass, bg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20" };
    case "signal.detected":
      return { icon: Zap, bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
    case "enrichment.completed":
      return { icon: Database, bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" };
    case "sequence.approved":
      return { icon: Send, bg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" };
    case "touchpoint.completed":
      return { icon: MessageSquare, bg: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20" };
    case "reply.classified":
      return { icon: Inbox, bg: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20" };
    case "meeting.completed":
      return { icon: Calendar, bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
    case "opportunity.updated":
      return { icon: TrendingUp, bg: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20" };
    default:
      return { icon: Activity, bg: "bg-muted text-muted-foreground border-border" };
  }
}

/** Small pill used across the redesigned stat row so all 5 tiles (4 KPIs + accept rate) share
 * one visual language instead of the old mix of gradient-topped cards and a separate free-floating
 * summary bar. */
function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "amber" | "emerald" | "indigo" | "rose" | "cyan";
}) {
  const toneClasses: Record<typeof tone, string> = {
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", toneClasses[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-tight text-foreground">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** One row of the 1→2→3 plan stepper. `state` drives both the badge text and the connecting
 * line color, so "where am I in this flow" is readable at a glance instead of three separately
 * styled boxes that don't visually connect. */
function StepRow({
  index,
  title,
  state,
  isLast,
  children,
}: {
  index: number;
  title: string;
  state: "done" | "current" | "upcoming";
  isLast?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            state === "done" && "bg-emerald-500 text-white",
            state === "current" && "bg-indigo-600 text-white",
            state === "upcoming" && "bg-muted text-muted-foreground"
          )}
        >
          {state === "done" ? <Check className="h-3.5 w-3.5" /> : index}
        </span>
        {!isLast && (
          <span
            className={cn(
              "mt-1 w-px flex-1 min-h-6",
              state === "done" ? "bg-emerald-500/50" : "bg-border"
            )}
          />
        )}
      </div>
      <div className={cn("flex-1 pb-4", state === "upcoming" && "opacity-50")}>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </div>
  );
}

export default function DexterOrchestratorPage() {
  const authReady = useAuthReady();
  const api = useDexterPlatformApi();
  const qc = useQueryClient();
  const [brief, setBrief] = useState("Enroll high-fit SaaS VPs in a Mode C cadence");
  const [planId, setPlanId] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
  /** Create plan / Automation settings / Approvals & blocks / Plan history used to be four
   * stacked cards a user had to scroll past one at a time. Tabbing them cuts that to one click,
   * while Event spine below stays outside the tabs — un-clicked and always visible — because
   * e2e/dexter-events.spec.ts asserts its heading/filter/feed are visible right after navigation. */
  const [workspaceTab, setWorkspaceTab] = useState<"plan" | "automation" | "approvals" | "history">("plan");

  const center = useQuery({
    queryKey: ["dexter-command-center"],
    queryFn: api.getCommandCenter,
    enabled: authReady,
  });

  const policies = useQuery({
    queryKey: ["automation-policy"],
    queryFn: api.listPolicies,
    enabled: authReady,
  });

  const events = useQuery({
    queryKey: ["dexter-events", eventTypeFilter],
    queryFn: () => api.listEvents({ type: eventTypeFilter || undefined, limit: 50 }),
    enabled: authReady,
  });

  const propose = useMutation({
    mutationFn: () => api.proposePlan(brief),
    onSuccess: (res) => {
      const plan = res.data.plan as { id?: string };
      setPlanId(String(plan.id ?? ""));
      toast.success(`Plan #${(plan.id ?? "").slice(0, 8)} proposed successfully`, "Plan Proposed");
      qc.invalidateQueries({ queryKey: ["dexter-command-center"] });
      qc.invalidateQueries({ queryKey: ["dexter-events"] });
    },
    onError: (err) => {
      toast.error(formatQueryError(err, "Failed to propose plan"), "Proposal Failed");
    },
  });

  const approve = useMutation({
    mutationFn: () => api.approvePlan(planId!),
    onSuccess: () => {
      toast.success(`Plan #${planId?.slice(0, 8)} approved and ready to invoke`, "Plan Approved");
      qc.invalidateQueries({ queryKey: ["dexter-command-center"] });
      qc.invalidateQueries({ queryKey: ["dexter-events"] });
    },
    onError: (err) => {
      toast.error(formatQueryError(err, "Failed to approve plan"), "Approval Failed");
    },
  });

  const invoke = useMutation({
    mutationFn: () => api.invokePlan(planId!),
    onSuccess: () => {
      toast.success(`Plan #${planId?.slice(0, 8)} executed through autonomous pipeline`, "Plan Invoked");
      qc.invalidateQueries({ queryKey: ["dexter-command-center"] });
      qc.invalidateQueries({ queryKey: ["dexter-events"] });
    },
    onError: (err) => {
      toast.error(formatQueryError(err, "Failed to invoke plan"), "Invocation Failed");
    },
  });

  const learn = useMutation({
    mutationFn: () => api.learnPlan(planId!, { attribution: "command_center", thresholdDelta: 0 }),
    onSuccess: () => {
      toast.success(`Learning recorded for plan #${planId?.slice(0, 8)}`, "Learning Recorded");
      qc.invalidateQueries({ queryKey: ["dexter-command-center"] });
      qc.invalidateQueries({ queryKey: ["dexter-events"] });
    },
    onError: (err) => {
      toast.error(formatQueryError(err, "Failed to record learning"), "Learning Failed");
    },
  });

  const setMode = useMutation({
    mutationFn: ({ actionKey, mode }: { actionKey: string; mode: AutomationMode }) =>
      api.setPolicy(actionKey, mode),
    onSuccess: (_res, vars) => {
      toast.info(`Updated "${vars.actionKey}" to mode: ${vars.mode}`, "Policy Gateway Updated");
      qc.invalidateQueries({ queryKey: ["automation-policy"] });
    },
    onError: (err) => {
      toast.error(formatQueryError(err, "Failed to update policy mode"), "Update Failed");
    },
  });

  const copyToClipboard = (correlationId: string, eventId: string) => {
    navigator.clipboard.writeText(correlationId);
    setCopiedEventId(eventId);
    toast.success(`Copied correlation ID #${correlationId.slice(0, 8)}`, "ID Copied");
    setTimeout(() => setCopiedEventId(null), 2000);
  };

  const summary = center.data?.data.summary;
  const planPreview = (() => {
    if (!planId) return null;
    const plan = center.data?.data.plans.find((p) => String(p.id) === planId);
    const proposal = plan?.proposal as {
      hypothesis?: string;
      scope?: string;
      steps?: Array<{ id: string; status: string; label?: string }>;
    } | undefined;
    return proposal ?? null;
  })();

  const selectedPlan = center.data?.data.plans.find((p) => String(p.id) === planId);
  const planStatus = selectedPlan ? String(selectedPlan.status ?? "proposed") : (planId ? "proposed" : null);
  const isApprovedOrInvoked = planStatus === "approved" || planStatus === "invoked";
  const isInvoked = planStatus === "invoked";

  const step1State: "done" | "current" = planId ? "done" : "current";
  const step2State: "done" | "current" | "upcoming" = isApprovedOrInvoked ? "done" : planId ? "current" : "upcoming";
  const step3State: "done" | "current" | "upcoming" = isInvoked ? "done" : isApprovedOrInvoked ? "current" : "upcoming";

  const policyRows = [
    ...(policies.data?.data.policies ?? []),
    ...(policies.data?.data.defaults ?? []),
  ];

  /** Backend returns one row per denied attempt (up to 10), which repeats the same actionKey
   * over and over when a workspace hits the same guard repeatedly. Grouping by actionKey turns
   * that into one row per action with a count, since rows already arrive newest-first. */
  const groupedPolicyBlocks = (() => {
    const byAction = new Map<string, { actionKey: string; count: number; lastAt: unknown }>();
    for (const d of center.data?.data.policyBlocks ?? []) {
      const actionKey = String(d.actionKey);
      const existing = byAction.get(actionKey);
      if (existing) {
        existing.count += 1;
      } else {
        byAction.set(actionKey, { actionKey, count: 1, lastAt: d.createdAt });
      }
    }
    return Array.from(byAction.values());
  })();

  return (
    <PageShell data-testid="page-dexter">
      {/* Header — one clear status line instead of three stacked jargon badges + a gradient
          banner. Same "Sync Spine" / "Policy Settings" actions as before. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dexter Orchestrator</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Describe a goal, review the plan Dexter proposes, approve it, then launch it —
            every step is policy-gated and logged below.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={events.isFetching || center.isFetching}
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["dexter-command-center"] });
              qc.invalidateQueries({ queryKey: ["dexter-events"] });
            }}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", (events.isFetching || center.isFetching) && "animate-spin")} />
            {events.isFetching || center.isFetching ? "Syncing…" : "Refresh"}
          </Button>
          <Link href="/settings/automation-policy">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Policy Settings
            </Button>
          </Link>
        </div>
      </div>

      {(propose.isError || approve.isError || invoke.isError || center.isError) && (
        <Alert variant="error">
          {formatQueryError(
            propose.error ?? approve.error ?? invoke.error ?? center.error,
            "Dexter command center error."
          )}
        </Alert>
      )}

      {/* Status strip — 4 KPIs + accept rate as one row of equally-weighted tiles, replacing the
          old mix of a 4-card grid plus a separately-styled "Evaluation Loop" bar underneath it. */}
      {center.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="dexter-evaluation-summary">
          <StatTile icon={CheckSquare} label="Pending approvals" value={String(summary?.pendingPlanApprovals ?? 0)} tone="amber" />
          <StatTile icon={Zap} label="Invoked plans" value={String(summary?.invokedPlans ?? 0)} tone="emerald" />
          <StatTile icon={AlertTriangle} label="Open decisions" value={String(summary?.openDecisions ?? 0)} tone="indigo" />
          <StatTile icon={ShieldAlert} label="Policy blocks" value={String(summary?.policyBlocks ?? 0)} tone="rose" />
          {summary?.evaluation && (
            <StatTile
              icon={TrendingUp}
              label={`Plan accept rate (${summary.evaluation.acceptedCount} of ${summary.evaluation.acceptedCount + summary.evaluation.rejectedCount + summary.evaluation.pendingCount})`}
              value={formatRate(summary.evaluation.acceptedRate)}
              tone="cyan"
            />
          )}
        </div>
      )}

      {/* Tab bar — replaces three stacked cards (Create plan+Automation, Approvals+Blocks, Plan
          history) that used to require scrolling past one to reach the next. */}
      <div className="flex gap-1 border-b border-border">
        {(
          [
            { id: "plan", label: "Create & automate" },
            { id: "approvals", label: "Approvals & blocks" },
            { id: "history", label: "Plan history" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setWorkspaceTab(t.id)}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              workspaceTab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {workspaceTab === "plan" && (
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Plan composer — the 1→2→3 flow is now one connected stepper instead of three
            disconnected boxes, so "where am I" and "what's next" read at a glance. */}
        <Card className="lg:col-span-7" id="dexter-plan-section">
          <CardHeader>
            <CardTitle className="text-lg">Create a plan</CardTitle>
            <CardDescription>Type a goal in plain English — Dexter turns it into a policy-checked plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <span className="text-xs font-medium text-muted-foreground">Or start from a template:</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRESET_BRIEFS.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setBrief(p.prompt)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"
                    >
                      <Icon className="h-3 w-3 text-indigo-500" />
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Input
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              aria-label="Dexter plan brief"
              placeholder="e.g. Enroll high-fit SaaS VPs in a Mode C cadence"
              className="h-12"
            />

            <div className="border-t border-border/60 pt-4">
              <StepRow index={1} title="Propose" state={step1State}>
                <Button
                  size="sm"
                  onClick={() => propose.mutate()}
                  disabled={!authReady || propose.isPending}
                  className="gap-1.5"
                >
                  {propose.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {propose.isPending ? "Proposing…" : planId ? "Re-propose" : "Propose plan"}
                </Button>
              </StepRow>

              <StepRow index={2} title="Approve" state={step2State}>
                {planId && (
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md bg-muted px-2 py-0.5 font-mono">#{planId.slice(0, 8)}</span>
                    <span className="capitalize">Status: {planStatus}</span>
                  </div>
                )}
                {!isApprovedOrInvoked && planId && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    Needs sign-off before it can run — this is the Policy Gateway&apos;s
                    &apos;approve&apos; guard, same one shown under Policy blocks below.
                  </p>
                )}
                <Button
                  size="sm"
                  variant={isApprovedOrInvoked ? "secondary" : "outline"}
                  onClick={() => approve.mutate()}
                  disabled={!planId || approve.isPending || isApprovedOrInvoked}
                  className="gap-1.5"
                >
                  {approve.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckSquare className="h-3.5 w-3.5" />
                  )}
                  {approve.isPending ? "Approving…" : isApprovedOrInvoked ? "Approved" : "Approve plan"}
                </Button>
              </StepRow>

              <StepRow index={3} title="Launch" state={step3State} isLast>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => invoke.mutate()}
                    disabled={!planId || invoke.isPending || isInvoked}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-500"
                  >
                    {invoke.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    {invoke.isPending ? "Invoking…" : isInvoked ? "Invoked" : "Invoke plan"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => learn.mutate()}
                    disabled={!planId || learn.isPending}
                    className="gap-1.5"
                  >
                    {learn.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
                    {learn.isPending ? "Recording…" : "Record learning"}
                  </Button>
                </div>
              </StepRow>
            </div>

            {planPreview && (
              <div className="rounded-xl border border-border/80 bg-muted/20 p-4 text-sm">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Target className="h-4 w-4 shrink-0 text-indigo-500" />
                    Plan details
                  </span>
                  {/* Only the decision (pending/accepted/rejected) is a real short badge —
                      scope is a free-text sentence, so it gets a plain description line below
                      instead of being crammed into a pill it was never sized for. */}
                  {selectedPlan && (
                    <Badge tone={decisionBadgeTone(selectedPlan.decision)} className="shrink-0">
                      {selectedPlan.decision}
                    </Badge>
                  )}
                </div>

                {planPreview.scope && <p className="mb-3 text-xs text-muted-foreground">{planPreview.scope}</p>}

                {selectedPlan && (
                  <div
                    className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground"
                    data-testid="dexter-plan-evaluation-metrics"
                  >
                    <span>Reply rate <span className="font-semibold text-foreground">{formatRate(selectedPlan.replyRate)}</span></span>
                    <span>Meeting rate <span className="font-semibold text-foreground">{formatRate(selectedPlan.meetingRate)}</span></span>
                  </div>
                )}

                {planPreview.hypothesis && (
                  <p className="mb-3 border-l-2 border-indigo-500 pl-3 text-xs italic text-muted-foreground">
                    &quot;{planPreview.hypothesis}&quot;
                  </p>
                )}

                <ul className="space-y-1.5">
                  {(planPreview.steps ?? []).map((step, idx) => {
                    const isDone = step.status === "done" || step.status === "completed";
                    const isBlocked = step.status.includes("blocked");
                    return (
                      <li
                        key={step.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                              isDone
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                            )}
                          >
                            {isDone ? <Check className="h-3 w-3" /> : idx + 1}
                          </span>
                          <span className="truncate font-medium text-foreground">
                            {step.label ?? step.id.replaceAll("_", " ")}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 whitespace-nowrap text-[11px] font-medium capitalize",
                            isDone && "text-emerald-600 dark:text-emerald-400",
                            isBlocked && "text-amber-600 dark:text-amber-400",
                            !isDone && !isBlocked && "text-muted-foreground"
                          )}
                        >
                          {step.status.replaceAll("_", " ")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Automation settings — the old per-row <select> needed two clicks (open, then pick) and
            gave no sense of the other 3 options without opening it. A segmented button row shows
            all 4 modes and their current pick at a glance, and sets it in one click. */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="text-lg">Automation settings</CardTitle>
            <CardDescription>Choose how much Dexter can do on its own, per action.</CardDescription>
          </CardHeader>
          {/* Single-line rows (label left, controls right) instead of label-then-controls
              stacked — that stacked layout made this card tower far past "Create a plan" next
              to it. Hard-capped at 7 rows below (.slice(0, 7)), so no scroll cap needed here. */}
          <CardContent className="space-y-1">
            {policyRows.slice(0, 7).map((row) => {
              const meta = ACTION_KEY_META[row.actionKey];
              return (
                <div
                  key={row.actionKey}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border/40 py-2.5 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{meta?.title ?? row.actionKey}</p>
                    <p className="truncate text-xs text-muted-foreground">{meta?.desc ?? row.actionKey}</p>
                  </div>
                  <div className="flex shrink-0 rounded-lg border border-border bg-background p-0.5">
                    {(["ask", "auto", "draft", "approve"] as AutomationMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        disabled={setMode.isPending}
                        onClick={() => setMode.mutate({ actionKey: row.actionKey, mode: m })}
                        className={cn(
                          "rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors disabled:opacity-60",
                          row.mode === m
                            ? m === "auto"
                              ? "bg-emerald-600 text-white"
                              : m === "approve"
                                ? "bg-amber-600 text-white"
                                : m === "draft"
                                  ? "bg-purple-600 text-white"
                                  : "bg-blue-600 text-white"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
          <div className="border-t border-border/50 p-4">
            <Link href="/settings/automation-policy" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              View all policies
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>
      </div>
      )}

      {workspaceTab === "approvals" && (
      /* One card instead of two mismatched-height ones. Blocks are grouped by action instead of
       * repeating the same "dexter.plan_invoke — Denied" row up to 10 times — a count + most
       * recent time says the same thing in one line and stops the list from towering over the
       * approvals side. */
      <Card>
        <CardContent className="divide-y divide-border/60 p-0">
          <div className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <CheckSquare className="h-4 w-4 text-amber-500" />
                Awaiting your approval
              </h3>
              <Badge tone="warning">{(center.data?.data.pendingApprovals ?? []).length}</Badge>
            </div>
            {(center.data?.data.pendingApprovals ?? []).length ? (
              <ul className="max-h-72 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {(center.data?.data.pendingApprovals ?? []).map((p) => (
                  <li
                    key={String(p.id)}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{String(p.brief)}</p>
                      <span className="text-xs text-muted-foreground">Mode: {String(p.policyMode)}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => {
                          setPlanId(String(p.id));
                          setBrief(String(p.brief));
                          setWorkspaceTab("plan");
                        }}
                      >
                        Select
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 gap-1 bg-emerald-600 text-xs text-white hover:bg-emerald-500"
                        disabled={approve.isPending}
                        onClick={() => {
                          setPlanId(String(p.id));
                          api
                            .approvePlan(String(p.id))
                            .then(() => {
                              toast.success(`Plan #${String(p.id).slice(0, 8)} approved and ready to invoke`, "Plan Approved");
                              qc.invalidateQueries({ queryKey: ["dexter-command-center"] });
                              qc.invalidateQueries({ queryKey: ["dexter-events"] });
                            })
                            .catch((err) => {
                              toast.error(formatQueryError(err, "Failed to approve plan"), "Approval Failed");
                            });
                        }}
                      >
                        <CheckSquare className="h-3 w-3" />
                        Approve
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <CheckSquare className="h-4 w-4 text-muted-foreground/40" />
                Nothing waiting on you right now.
              </p>
            )}
          </div>

          <div className="p-5">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                Blocked actions
              </h3>
              <Badge tone="danger">{(center.data?.data.policyBlocks ?? []).length}</Badge>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Set to <strong className="text-foreground">&apos;approve&apos;</strong> in Automation
              settings — blocked until a plan carrying that action is signed off above.
            </p>
            {groupedPolicyBlocks.length ? (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
                {groupedPolicyBlocks.map((g) => (
                  <li
                    key={g.actionKey}
                    className="flex items-center justify-between gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-mono text-xs font-semibold text-foreground">{g.actionKey}</span>
                      {Boolean(g.lastAt) && (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          last {formatJobTime(String(g.lastAt))}
                        </span>
                      )}
                    </div>
                    <Badge tone="danger" className="shrink-0">
                      {g.count > 1 ? `×${g.count} denied` : "denied"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-500/40" />
                No recent policy denials.
              </p>
            )}
            <div className="mt-3">
              <Link href="/decisions" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                Open full decision queue
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {workspaceTab === "history" && (
      /* Plan evaluation table — unchanged data/testid, just dropped the header icon clutter. */
      <Card data-testid="dexter-plan-evaluation-table">
        <CardHeader>
          <CardTitle className="text-base">Plan history</CardTitle>
          <CardDescription>Decision outcomes and observed reply/meeting rates for every plan.</CardDescription>
        </CardHeader>
        <CardContent>
          {(center.data?.data.plans ?? []).length ? (
            <div className="max-h-[480px] overflow-auto custom-scrollbar">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Plan</th>
                    <th className="pb-2 pr-4 font-medium">Decision</th>
                    <th className="pb-2 pr-4 font-medium">Reply rate</th>
                    <th className="pb-2 font-medium">Meeting rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(center.data?.data.plans ?? []).map((plan) => (
                    <tr key={plan.id} className="border-b border-border/40 last:border-0">
                      <td className="max-w-[360px] truncate py-3 pr-4 font-medium text-foreground">
                        {plan.brief || `Plan ${plan.id.slice(0, 8)}`}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={decisionBadgeTone(plan.decision)}>{decisionLabel(plan.decision)}</Badge>
                      </td>
                      <td className="py-3 pr-4 font-semibold text-foreground">{formatRate(plan.replyRate)}</td>
                      <td className="py-3 font-semibold text-foreground">{formatRate(plan.meetingRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No Dexter plans to evaluate yet.</p>
          )}
        </CardContent>
      </Card>
      )}

      {/* Event spine — unchanged data/testids/heading text (relied on by e2e/dexter-events.spec.ts),
          just cleaned up the header. */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Event spine
              </CardTitle>
              <CardDescription>Every Dexter event, newest first — trace a run via its correlation ID.</CardDescription>
            </div>
            <Select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="h-8 w-64 text-xs"
              aria-label="Filter events by type"
              data-testid="dexter-event-type-filter"
            >
              <option value="">All event types ({events.data?.data.length ?? 0})</option>
              {DEXTER_EVENT_SPINE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DEXTER_EVENT_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {events.isError && <Alert variant="error" className="mb-4">{formatQueryError(events.error, "Failed to load event feed.")}</Alert>}

          {events.isLoading ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                  <Skeleton className="h-12 flex-1 rounded-xl" />
                </div>
              ))}
            </div>
          ) : (
            <div className="relative max-h-[460px] overflow-y-auto pr-1 custom-scrollbar" data-testid="dexter-event-feed">
              <ul className="space-y-2">
                {(events.data?.data ?? []).map((event) => {
                  const cfg = getEventTypeConfig(event.type);
                  const Icon = cfg.icon;
                  const isCopied = copiedEventId === event.id;

                  return (
                    <li
                      key={event.id}
                      data-testid="dexter-event-row"
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${cfg.bg}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              {DEXTER_EVENT_TYPE_LABELS[event.type] ?? event.type}
                            </span>
                            <span className="max-w-[200px] truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:max-w-xs">
                              {event.aggregateId}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2.5 text-xs sm:gap-4">
                        <span className="whitespace-nowrap text-[11px] text-muted-foreground">{formatJobTime(event.occurredAt)}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(event.correlationId, event.id)}
                          title="Click to copy full correlation ID"
                          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"
                        >
                          <span className="font-mono">{event.correlationId.slice(0, 8)}</span>
                          {isCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 opacity-60" />}
                        </button>
                      </div>
                    </li>
                  );
                })}

                {!events.isLoading && !(events.data?.data ?? []).length && (
                  <li className="py-12 text-center text-sm text-muted-foreground">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30">
                      <Clock className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="font-medium text-foreground">
                      No events found{eventTypeFilter ? ` for "${DEXTER_EVENT_TYPE_LABELS[eventTypeFilter] ?? eventTypeFilter}"` : ""}.
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                      {eventTypeFilter
                        ? "No events of this type have been recorded yet. Select 'All event types' to view all recorded timeline events."
                        : "Events will stream here automatically in reverse-chronological order as Dexter executes autonomous GTM triggers."}
                    </p>
                    {eventTypeFilter && (
                      <div className="mt-3">
                        <Button variant="outline" size="sm" onClick={() => setEventTypeFilter("")} className="gap-1.5 text-xs">
                          Show all event types
                        </Button>
                      </div>
                    )}
                  </li>
                )}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
