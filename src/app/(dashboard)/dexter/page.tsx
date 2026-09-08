"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Calendar,
  Check,
  CheckSquare,
  Clock,
  Compass,
  Copy,
  Database,
  Globe,
  Inbox,
  Layers,
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
import { Button, buttonVariants } from "@/components/ui/button";
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
    case "dexter.plan.learned":
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

export default function DexterOrchestratorPage() {
  const authReady = useAuthReady();
  const api = useDexterPlatformApi();
  const qc = useQueryClient();
  const [brief, setBrief] = useState("Enroll high-fit SaaS VPs in a Mode C cadence");
  const [planId, setPlanId] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

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

  const policyRows = [
    ...(policies.data?.data.policies ?? []),
    ...(policies.data?.data.defaults ?? []),
  ];

  return (
    <PageShell data-testid="page-dexter">
      {/* Sleek Enterprise Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-card via-card/95 to-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                LIVE EVENT SPINE ACTIVE
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                <Bot className="h-3 w-3" />
                Autonomous Engine v2.1
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-mono text-muted-foreground">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                Fail-Closed Policy Guard
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
                Dexter Autonomous AI SDR
              </h1>
              <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
                Enterprise GTM Command Center: Propose multi-signal intent cadences, enforce real-time Policy Gateway constraints, and monitor the unified execution spine end to end.
              </p>
            </div>
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
              className="gap-1.5 border-border hover:bg-accent"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", (events.isFetching || center.isFetching) && "animate-spin text-primary")} />
              {events.isFetching || center.isFetching ? "Syncing..." : "Sync Spine"}
            </Button>
            <Link
              href="/settings/automation-policy"
              className={cn(
                buttonVariants({ size: "sm" }),
                "gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-sm"
              )}
            >
              <Shield className="h-3.5 w-3.5" />
              Policy Settings
            </Link>
          </div>
        </div>
      </div>

      {/* Alert states */}
      {(propose.isError || approve.isError || invoke.isError || center.isError) && (
        <Alert variant="error" className="shadow-sm">
          {formatQueryError(
            propose.error ?? approve.error ?? invoke.error ?? center.error,
            "Dexter command center error."
          )}
        </Alert>
      )}

      {/* KPI Cards — Apollo / Clay style */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {center.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <Card className="relative overflow-hidden border-border/80 transition-all hover:border-amber-500/40 hover:shadow-md">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-500" />
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <CardDescription className="font-medium text-muted-foreground">
                    Pending approvals
                  </CardDescription>
                  <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                    <CheckSquare className="h-4 w-4" />
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
                  {summary?.pendingPlanApprovals ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 text-xs text-muted-foreground">
                Human-in-the-loop review queue
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-border/80 transition-all hover:border-emerald-500/40 hover:shadow-md">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <CardDescription className="font-medium text-muted-foreground">
                    Invoked plans
                  </CardDescription>
                  <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                    <Zap className="h-4 w-4" />
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
                  {summary?.invokedPlans ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 text-xs text-muted-foreground">
                Active autonomous cadences
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-border/80 transition-all hover:border-indigo-500/40 hover:shadow-md">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-400 to-violet-500" />
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <CardDescription className="font-medium text-muted-foreground">
                    Open decisions
                  </CardDescription>
                  <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-600 dark:text-indigo-400">
                    <Layers className="h-4 w-4" />
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
                  {summary?.openDecisions ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 text-xs text-muted-foreground">
                Real-time governor triage
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-border/80 transition-all hover:border-rose-500/40 hover:shadow-md">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-400 to-red-500" />
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <CardDescription className="font-medium text-muted-foreground">
                    Policy blocks
                  </CardDescription>
                  <div className="rounded-lg bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold tracking-tight text-destructive">
                  {summary?.policyBlocks ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 text-xs text-muted-foreground">
                Unauthorized actions blocked
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Evaluation Loop summary (§7.3 SP-12) — accepted-vs-overridden only; pipeline/revenue
          attribution and regional-calibration/drift aren't computed yet, so nothing here fakes
          those. */}
      {summary?.evaluation && (
        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border/80 bg-card px-4 py-3 text-sm"
          data-testid="dexter-evaluation-summary"
        >
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-cyan-500" />
            Evaluation Loop
          </span>
          <span className="text-muted-foreground">
            Accepted <span className="font-semibold text-emerald-600 dark:text-emerald-400">{summary.evaluation.acceptedCount}</span>
          </span>
          <span className="text-muted-foreground">
            Rejected <span className="font-semibold text-destructive">{summary.evaluation.rejectedCount}</span>
          </span>
          <span className="text-muted-foreground">
            Pending <span className="font-semibold text-foreground">{summary.evaluation.pendingCount}</span>
          </span>
          <span className="text-muted-foreground">
            Accept rate <span className="font-semibold text-foreground">{formatRate(summary.evaluation.acceptedRate)}</span>
          </span>
        </div>
      )}

      {/* Main Studio Grid: AI Mission Directive & Autonomy Modes */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Mission Directive Composer (7 cols) */}
        <Card id="dexter-plan-section" className="lg:col-span-7 border-border/80 shadow-sm overflow-hidden flex flex-col justify-between scroll-mt-6">
          <div>
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-600 dark:text-indigo-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Plan brief</CardTitle>
                    <CardDescription className="text-xs">
                      Natural-language goal → policy-classified execution plan.
                    </CardDescription>
                  </div>
                </div>
                <Badge tone="info" className="gap-1 font-mono text-[10px] tracking-wider uppercase">
                  <Bot className="h-3 w-3" />
                  LLM Router
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-5">
              {/* Quick Strategy Presets */}
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  Quick Strategy Templates:
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PRESET_BRIEFS.map((p) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setBrief(p.prompt)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-all hover:border-primary/50 hover:bg-accent hover:text-foreground"
                      >
                        <Icon className="h-3 w-3 text-indigo-500" />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Input Area */}
              <div className="relative">
                <Input
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  aria-label="Dexter plan brief"
                  placeholder="e.g. Enroll high-fit SaaS VPs in a Mode C cadence"
                  className="h-12 text-sm bg-background border-border/80 focus-visible:ring-indigo-500 shadow-inner"
                />
              </div>

              {/* Step-by-Step Execution Workflow */}
              <div className="space-y-3 pt-2 border-t border-border/40">
                {/* Step 1: Propose */}
                <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        1
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        Step 1: Propose Directive
                      </span>
                    </div>
                    {planId ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" />
                        Directive Created
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Ready to route</span>
                    )}
                  </div>
                  <Button
                    onClick={() => propose.mutate()}
                    disabled={!authReady || propose.isPending}
                    className="gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-sm text-xs h-8"
                  >
                    {propose.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {propose.isPending ? "Proposing..." : planId ? "Re-propose Directive" : "Propose Directive"}
                  </Button>
                </div>

                {/* Step 2: Review & Approve */}
                <div className={cn(
                  "rounded-xl border p-3.5 shadow-2xs space-y-2.5 transition-all",
                  planId ? "border-amber-500/40 bg-amber-500/5" : "border-border/50 bg-muted/20 opacity-60"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold",
                        planId ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"
                      )}>
                        2
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        Step 2: Review & Approve Directive
                      </span>
                    </div>
                    {planStatus === "approved" || planStatus === "invoked" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" />
                        Approved
                      </span>
                    ) : planId ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                        Awaiting Human Sign-off
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Propose plan first</span>
                    )}
                  </div>

                  {planId && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] bg-background/80 rounded-lg p-2 border border-border/60">
                        <span className="text-muted-foreground font-mono truncate max-w-[200px] sm:max-w-xs">
                          Plan ID: #{planId.slice(0, 8)}
                        </span>
                        <span className="font-medium capitalize text-foreground">
                          Status: {planStatus}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-tight">
                        Policy Gateway Guard: Approval is required before autonomous invocation when mode is &apos;approve&apos;.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => approve.mutate()}
                      disabled={!planId || approve.isPending || planStatus === "approved" || planStatus === "invoked"}
                      className="gap-1.5 border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs h-8"
                    >
                      {approve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckSquare className="h-3.5 w-3.5 text-emerald-600" />}
                      {approve.isPending ? "Approving..." : planStatus === "approved" || planStatus === "invoked" ? "Directive Approved ✓" : "Approve Directive"}
                    </Button>
                  </div>
                </div>

                {/* Step 3: Execute */}
                <div className={cn(
                  "rounded-xl border p-3.5 shadow-2xs space-y-2.5 transition-all",
                  planStatus === "approved" || planStatus === "invoked" ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/50 bg-muted/20 opacity-60"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold",
                        planStatus === "approved" || planStatus === "invoked" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                      )}>
                        3
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        Step 3: Autonomous Execution
                      </span>
                    </div>
                    {planStatus === "invoked" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" />
                        Invoked
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => invoke.mutate()}
                      disabled={!planId || invoke.isPending || planStatus === "invoked"}
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm text-xs h-8"
                    >
                      {invoke.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      {invoke.isPending ? "Invoking..." : planStatus === "invoked" ? "Pipeline Invoked ✓" : "Invoke Autonomous Pipeline"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => learn.mutate()}
                      disabled={!planId || learn.isPending}
                      className="gap-1.5 text-xs h-8"
                    >
                      {learn.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
                      {learn.isPending ? "Recording..." : "Record Learning"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Plan Preview with visual steps */}
              {planPreview && (
                <div className="rounded-xl border border-border/80 bg-gradient-to-b from-muted/30 to-muted/10 p-4 text-sm shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Target className="h-4 w-4 text-indigo-500" />
                      Plan Blueprint
                    </span>
                    <div className="flex items-center gap-1.5">
                      {planPreview.scope && (
                        <Badge tone="default" className="text-[10px] uppercase font-mono">
                          Scope: {planPreview.scope}
                        </Badge>
                      )}
                      {selectedPlan && (
                        <Badge tone={decisionBadgeTone(selectedPlan.decision)} className="text-[10px] uppercase font-mono">
                          {selectedPlan.decision}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* §7.3 SP-12 — reply/meeting rate are cheap event counts off the plan's
                      linked sequence; null (not 0) means no sequence is linked yet. */}
                  {selectedPlan && (
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-border/40 pb-2 text-xs text-muted-foreground" data-testid="dexter-plan-evaluation-metrics">
                      <span>
                        Reply rate <span className="font-semibold text-foreground">{formatRate(selectedPlan.replyRate)}</span>
                      </span>
                      <span>
                        Meeting rate <span className="font-semibold text-foreground">{formatRate(selectedPlan.meetingRate)}</span>
                      </span>
                    </div>
                  )}

                  {planPreview.hypothesis && (
                    <p className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-indigo-500 pl-3">
                      &quot;{planPreview.hypothesis}&quot;
                    </p>
                  )}

                  <div className="pt-1">
                    <span className="text-xs font-medium text-foreground block mb-2">
                      Execution Stepper:
                    </span>
                    <ul className="space-y-1.5">
                      {(planPreview.steps ?? []).map((step, idx) => (
                        <li
                          key={step.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/10 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                              {idx + 1}
                            </span>
                            <span className="font-medium text-foreground">
                              {step.label ?? step.id.replaceAll("_", " ")}
                            </span>
                          </div>
                          <Badge tone="muted" className="text-[10px] uppercase font-mono">
                            {step.status.replaceAll("_", " ")}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </div>
        </Card>

        {/* Autonomy Modes (5 cols) */}
        <Card className="lg:col-span-5 border-border/80 shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Autonomy modes</CardTitle>
                    <CardDescription className="text-xs">
                      Per-action Policy Gateway settings for this workspace.
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              <div className="rounded-xl border border-border/70 bg-card divide-y divide-border/40 overflow-hidden shadow-2xs">
                {policyRows.slice(0, 7).map((row) => {
                  const meta = ACTION_KEY_META[row.actionKey];
                  return (
                    <div
                      key={row.actionKey}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs transition-colors hover:bg-muted/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground truncate">
                            {meta?.title ?? row.actionKey}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded border border-border/40 shrink-0">
                            {row.actionKey}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {meta?.desc ?? "Policy Gateway action configuration"}
                        </p>
                      </div>

                      <div className="shrink-0">
                        <Select
                          value={row.mode}
                          onChange={(e) =>
                            setMode.mutate({
                              actionKey: row.actionKey,
                              mode: e.target.value as AutomationMode,
                            })
                          }
                          className={cn(
                            "h-8 w-28 text-xs font-medium rounded-lg border bg-background text-foreground transition-all shadow-2xs focus:ring-1 focus:ring-primary",
                            row.mode === "auto" && "border-emerald-500/50 text-emerald-700 dark:text-emerald-300 font-semibold",
                            row.mode === "approve" && "border-amber-500/50 text-amber-700 dark:text-amber-300 font-semibold",
                            row.mode === "ask" && "border-blue-500/50 text-blue-700 dark:text-blue-300 font-semibold",
                            row.mode === "draft" && "border-purple-500/50 text-purple-700 dark:text-purple-300 font-semibold"
                          )}
                        >
                          {(["ask", "auto", "draft", "approve"] as AutomationMode[]).map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div></CardContent>
          </div>

          <div className="p-4 border-t border-border/50 bg-muted/10">
            <Link
              href="/settings/automation-policy"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              View all policies
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>
      </div>

      {/* Decisions & Approvals Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Plan Approvals */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/50 bg-muted/20 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-amber-500" />
                Pending plan approvals
              </CardTitle>
              <Badge tone="warning" className="text-[10px]">
                {(center.data?.data.pendingApprovals ?? []).length} Awaiting
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ul className="space-y-2.5 text-sm">
              {(center.data?.data.pendingApprovals ?? []).map((p) => (
                <li
                  key={String(p.id)}
                  className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm transition-all hover:border-primary/40 hover:shadow"
                >
                  <p className="font-semibold text-foreground line-clamp-2">{String(p.brief)}</p>
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/40 pt-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-muted-foreground">
                      Mode: {String(p.policyMode)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-border"
                        onClick={() => {
                          setPlanId(String(p.id));
                          setBrief(String(p.brief));
                        }}
                      >
                        Select
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                        disabled={approve.isPending}
                        onClick={() => {
                          setPlanId(String(p.id));
                          api.approvePlan(String(p.id)).then(() => {
                            toast.success(`Plan #${String(p.id).slice(0, 8)} approved and ready to invoke`, "Plan Approved");
                            qc.invalidateQueries({ queryKey: ["dexter-command-center"] });
                            qc.invalidateQueries({ queryKey: ["dexter-events"] });
                          }).catch((err) => {
                            toast.error(formatQueryError(err, "Failed to approve plan"), "Approval Failed");
                          });
                        }}
                      >
                        <CheckSquare className="h-3 w-3" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
              {!center.isLoading && !(center.data?.data.pendingApprovals ?? []).length && (
                <li className="py-8 text-center text-sm text-muted-foreground">
                  <CheckSquare className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                  No plans awaiting approval.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Recent Policy Blocks */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/50 bg-muted/20 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Recent policy blocks
              </CardTitle>
              <Badge tone="danger" className="text-[10px]">
                {(center.data?.data.policyBlocks ?? []).length} Blocked
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="mb-3 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                Why actions get blocked
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed">
                When an action is set to <strong>&apos;approve&apos;</strong> in Autonomy modes, Policy Gateway blocks direct execution until signed off. Use <strong>Approve</strong> in Step 2 or Pending Approvals before invoking.
              </p>
            </div>
            <ul className="space-y-2.5 text-sm">
              {(center.data?.data.policyBlocks ?? []).map((d, i) => (
                <li
                  key={String(d.id ?? i)}
                  className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
                    <div>
                      <span className="font-mono font-semibold text-foreground">
                        {String(d.actionKey)}
                      </span>
                      <span className="text-muted-foreground block text-[11px]">
                        Blocked by Policy Gateway (prior approval required in &apos;approve&apos; mode)
                      </span>
                    </div>
                  </div>
                  <Badge tone="danger" className="text-[10px] uppercase font-mono">
                    Denied
                  </Badge>
                </li>
              ))}
              {!center.isLoading && !(center.data?.data.policyBlocks ?? []).length && (
                <li className="py-8 text-center text-sm text-muted-foreground">
                  <ShieldCheck className="mx-auto h-8 w-8 text-emerald-500/40 mb-2" />
                  No recent policy denials.
                </li>
              )}
            </ul>
            <div className="mt-4 pt-3 border-t border-border/50">
              <Link
                href="/decisions"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                Open decision queue
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Spine Timeline (SP-11 Showcase) */}
      <Card className="border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-600 dark:text-indigo-400">
                  <Clock className="h-4 w-4" />
                </div>
                <CardTitle className="text-lg">Event spine</CardTitle>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Live
                </span>
              </div>
              <CardDescription className="text-xs">
                Reverse-chronological feed of this workspace&apos;s Dexter events — trace a run
                end to end via its correlation ID.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="h-8 w-64 text-xs font-medium rounded-lg border-border/80 bg-background"
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
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {events.isError && (
            <Alert variant="error" className="mb-4">
              {formatQueryError(events.error, "Failed to load event feed.")}
            </Alert>
          )}

          {events.isLoading ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <Skeleton className="h-12 flex-1 rounded-xl" />
                </div>
              ))}
            </div>
          ) : (
            <div className="relative max-h-[460px] overflow-y-auto custom-scrollbar pr-1" data-testid="dexter-event-feed">
              {/* Event Feed List */}
              <ul className="space-y-2.5">
                {(events.data?.data ?? []).map((event) => {
                  const cfg = getEventTypeConfig(event.type);
                  const Icon = cfg.icon;
                  const isCopied = copiedEventId === event.id;

                  return (
                    <li
                      key={event.id}
                      data-testid="dexter-event-row"
                      className="group flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-sm transition-all hover:border-primary/40 hover:bg-muted/30"
                    >
                      {/* Left: Icon & Event Details */}
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${cfg.bg}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground text-xs">
                              {DEXTER_EVENT_TYPE_LABELS[event.type] ?? event.type}
                            </span>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground truncate max-w-[200px] sm:max-w-xs">
                              {event.aggregateId}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground block sm:inline sm:mt-0.5">
                            Recorded across autonomous pipeline
                          </span>
                        </div>
                      </div>

                      {/* Right: Timestamp & Copyable Correlation ID */}
                      <div className="flex shrink-0 items-center gap-2.5 sm:gap-4 text-xs">
                        <span className="text-muted-foreground text-[11px] whitespace-nowrap">
                          {formatJobTime(event.occurredAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(event.correlationId, event.id)}
                          title="Click to copy full correlation ID"
                          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground transition-all hover:border-primary/50 hover:bg-accent hover:text-foreground"
                        >
                          <span className="text-muted-foreground/60">#</span>
                          <span className="font-mono">
                            {event.correlationId.slice(0, 8)}
                          </span>
                          {isCopied ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                          )}
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
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      {eventTypeFilter
                        ? "No events of this type have been recorded yet. Select 'All event types' to view all recorded timeline events."
                        : "Events will stream here automatically in reverse-chronological order as Dexter executes autonomous GTM triggers."}
                    </p>
                    {eventTypeFilter && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEventTypeFilter("")}
                          className="text-xs gap-1.5"
                        >
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
