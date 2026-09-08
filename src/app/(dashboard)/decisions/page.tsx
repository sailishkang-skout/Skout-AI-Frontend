"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Layers,
  Loader2,
  Shield,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useDexterPlatformApi } from "@/lib/dexter-platform";
import { timeAgoShort } from "@/lib/signals";
import { cn } from "@/lib/utils";

type DecisionOption = { id: string; label: string; primary?: boolean };

interface DecisionView {
  id: string;
  title: string;
  kind: string;
  status: "open" | "decided" | "dismissed" | string;
  recommendation: string | null;
  options: DecisionOption[];
  evidenceIds: string[];
  expectedOutcome: { actionType?: string | null; suggestionId?: string | null } | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  decidedAt: string | null;
}

function asDecisionView(d: Record<string, unknown>): DecisionView {
  return {
    id: String(d.id ?? ""),
    title: String(d.title ?? "Decision"),
    kind: String(d.kind ?? "custom"),
    status: String(d.status ?? "open"),
    recommendation: typeof d.recommendation === "string" ? d.recommendation : null,
    options: Array.isArray(d.options) ? (d.options as DecisionOption[]) : [],
    evidenceIds: Array.isArray(d.evidenceIds) ? (d.evidenceIds as string[]) : [],
    expectedOutcome:
      d.expectedOutcome && typeof d.expectedOutcome === "object"
        ? (d.expectedOutcome as DecisionView["expectedOutcome"])
        : null,
    entityType: typeof d.entityType === "string" ? d.entityType : null,
    entityId: typeof d.entityId === "string" ? d.entityId : null,
    createdAt: String(d.createdAt ?? new Date().toISOString()),
    decidedAt: typeof d.decidedAt === "string" ? d.decidedAt : null,
  };
}

const KIND_META: Record<string, { label: string; icon: typeof Sparkles; tone: BadgeProps["tone"] }> = {
  next_best_action: { label: "Next best action", icon: Sparkles, tone: "info" },
  forecast: { label: "Forecast", icon: TrendingUp, tone: "warning" },
  competitive: { label: "Competitive", icon: Shield, tone: "danger" },
  custom: { label: "Custom", icon: Layers, tone: "muted" },
};

function entityHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  if (entityType === "contact") return `/crm/contacts/${entityId}`;
  if (entityType === "deal") return `/crm/deals/${entityId}`;
  return null;
}

/** §1.2 / D14 — decision-oriented views (not vanity dashboards). */
export default function DecisionsPage() {
  const authReady = useAuthReady();
  const api = useDexterPlatformApi();
  const qc = useQueryClient();
  const [entityId, setEntityId] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const list = useQuery({
    queryKey: ["decision-views"],
    queryFn: () => api.listDecisions(),
    enabled: authReady,
  });

  const create = useMutation({
    mutationFn: () => api.createDecisionFromNba("contact", entityId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["decision-views"] });
      setEntityId("");
    },
  });

  const decide = useMutation({
    mutationFn: ({ id, choice }: { id: string; choice: "decided" | "dismissed" }) => api.decide(id, choice),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decision-views"] }),
  });

  const decisions = (list.data?.data ?? []).map(asDecisionView);
  const openDecisions = decisions.filter((d) => d.status === "open");
  const resolvedDecisions = decisions.filter((d) => d.status !== "open");

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Decision views"
        description="Actionable recommendations with options and evidence — grounded in next-best-action and Policy Gateway."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create from NBA</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            placeholder="Contact UUID"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="max-w-md"
          />
          <Button onClick={() => create.mutate()} disabled={!entityId || create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create decision
          </Button>
        </CardContent>
      </Card>

      {list.isError && <Alert variant="error">{formatQueryError(list.error, "Could not load decisions.")}</Alert>}
      {create.isError && <Alert variant="error">{formatQueryError(create.error, "Create failed.")}</Alert>}

      {list.isLoading && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-1/3 rounded bg-muted" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-4 w-full rounded bg-muted" />
                <div className="h-4 w-2/3 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!list.isLoading && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Open decisions {openDecisions.length > 0 && `(${openDecisions.length})`}
            </h2>
            {openDecisions.length ? (
              openDecisions.map((d) => (
                <DecisionCard
                  key={d.id}
                  decision={d}
                  onChoose={(choice) => decide.mutate({ id: d.id, choice })}
                  isDeciding={decide.isPending && decide.variables?.id === d.id}
                />
              ))
            ) : (
              <Card>
                <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  No open decisions right now — you&apos;re caught up.
                </CardContent>
              </Card>
            )}
          </div>

          {resolvedDecisions.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowResolved((s) => !s)}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {showResolved ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Resolved ({resolvedDecisions.length})
              </button>
              {showResolved && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  {resolvedDecisions.map((d) => (
                    <ResolvedRow key={d.id} decision={d} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

function DecisionCard({
  decision,
  onChoose,
  isDeciding,
}: {
  decision: DecisionView;
  onChoose: (choice: "decided" | "dismissed") => void;
  isDeciding: boolean;
}) {
  const meta = KIND_META[decision.kind] ?? KIND_META.custom;
  const Icon = meta.icon;
  const href = entityHref(decision.entityType, decision.entityId);
  const suggestedAction = decision.expectedOutcome?.actionType;
  const options = decision.options.length
    ? decision.options
    : [{ id: "act", label: "Decide", primary: true }, { id: "dismiss", label: "Dismiss" }];

  return (
    <Card className="animate-in fade-in duration-300">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{decision.title}</CardTitle>
          <span className="text-xs text-muted-foreground">{timeAgoShort(decision.createdAt)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone} className="gap-1">
            <Icon className="h-3 w-3" />
            {meta.label}
          </Badge>
          {suggestedAction && (
            <Badge tone="muted">Suggested: {suggestedAction.replace(/_/g, " ")}</Badge>
          )}
          {decision.evidenceIds.length > 0 && (
            <Badge tone="muted">
              {decision.evidenceIds.length} evidence source{decision.evidenceIds.length === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {decision.recommendation && <p>{decision.recommendation}</p>}
        {href && (
          <Link href={href} className="text-sm font-medium text-primary hover:underline">
            View {decision.entityType} →
          </Link>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {options.map((opt) => (
            <Button
              key={opt.id}
              size="sm"
              variant={opt.id === "dismiss" ? "outline" : opt.primary ? "default" : "secondary"}
              disabled={isDeciding}
              onClick={() => onChoose(opt.id === "dismiss" ? "dismissed" : "decided")}
            >
              {isDeciding && <Loader2 className="h-3 w-3 animate-spin" />}
              {opt.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ResolvedRow({ decision }: { decision: DecisionView }) {
  const meta = KIND_META[decision.kind] ?? KIND_META.custom;
  const Icon = meta.icon;
  const decided = decision.status === "decided";
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
      {decided ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className={cn("min-w-0 flex-1 truncate", !decided && "text-muted-foreground")}>{decision.title}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {decision.decidedAt ? timeAgoShort(decision.decidedAt) : timeAgoShort(decision.createdAt)}
      </span>
    </div>
  );
}
