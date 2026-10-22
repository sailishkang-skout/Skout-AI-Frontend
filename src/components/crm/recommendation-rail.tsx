"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { trackCops, withCopsTracking } from "@/lib/cops-analytics";
import { can, useMyPermissions } from "@/lib/cops-commercial";
import { CopsRequestError } from "@/lib/cops-fetch";
import { confidenceText, confidenceTone, evidenceHref, RECOMMENDATION_LABEL, useCopsInsightsApi, type Recommendation } from "@/lib/cops-insights";

const errorText = (err: unknown, fallback: string) => (err instanceof CopsRequestError ? err.message : fallback);
const ACTION_LABEL: Record<string, string> = { create_task: "Create task", start_playbook: "Start playbook", renewal_prep_task: "Create renewal task" };
/** The rail is narrow: a few recommendations, three lines of rationale and three evidence links until expanded. */
const RECS_SHOWN = 3;
const EVIDENCE_SHOWN = 3;

function RecommendationItem({ rec, accountId, canAct, onDone }: { rec: Recommendation; accountId: string; canAct: boolean; onDone: () => void }) {
  const api = useCopsInsightsApi();
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const evidence = expanded ? rec.evidence_refs : rec.evidence_refs.slice(0, EVIDENCE_SHOWN);
  const approve = useMutation({
    mutationFn: () => withCopsTracking("cops.recommendation_approved", () => api.approve(rec.id), (r) => ({ recommendation_type: rec.type, effect: r.data.effect?.kind ?? null })),
    onSuccess: onDone,
    onError: (e) => setError(errorText(e, "Could not approve the recommendation.")),
  });
  const dismiss = useMutation({
    mutationFn: () => withCopsTracking("cops.recommendation_dismissed", () => api.dismiss(rec.id, reason.trim()), { recommendation_type: rec.type }),
    onSuccess: onDone,
    onError: (e) => setError(errorText(e, "Could not dismiss the recommendation.")),
  });
  const busy = approve.isPending || dismiss.isPending;

  return (
    <li className="min-w-0 space-y-1 rounded-md border p-2" data-testid="recommendation" data-type={rec.type}>
      <div className="flex items-center justify-between gap-1.5">
        <Badge tone="info" className="truncate">{RECOMMENDATION_LABEL[rec.type] ?? rec.type}</Badge>
        <Badge tone={confidenceTone(rec.confidence)} title="Confidence: how strongly the evidence supports it" className="shrink-0" data-testid="recommendation-confidence">
          {confidenceText(rec.confidence)} confidence
        </Badge>
      </div>
      <p className="break-words text-sm font-medium leading-snug">{rec.headline}</p>
      <p className={`break-words text-xs text-muted-foreground ${expanded ? "" : "line-clamp-3"}`} data-testid="recommendation-rationale">
        {rec.rationale}
      </p>
      <ul className="space-y-0.5" data-testid="recommendation-evidence" aria-label="Evidence">
        {evidence.map((e) => {
          const href = evidenceHref(e, accountId);
          return (
            <li key={`${e.kind}:${e.id}`} className="truncate text-xs" title={e.label}>
              {href ? (
                <Link href={href} className="text-primary hover:underline">
                  {e.label}
                </Link>
              ) : (
                <span>{e.label}</span>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => setExpanded((x) => !x)} data-testid="recommendation-expand">
        {expanded ? "Less" : rec.evidence_refs.length > EVIDENCE_SHOWN ? `More (+${rec.evidence_refs.length - EVIDENCE_SHOWN} evidence)` : "More"}
      </button>
      <p className="text-[11px] text-muted-foreground">{rec.source === "llm" ? "AI-written from this evidence" : "From the rule"} · runs only if you approve</p>
      {error && <Alert variant="error">{error}</Alert>}
      {canAct &&
        (dismissing ? (
          <div className="space-y-1.5">
            <textarea
              aria-label="Why dismiss"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why it does not apply"
              maxLength={1000}
              className="w-full rounded-md border bg-background px-2 py-1 text-xs"
            />
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" disabled={busy || reason.trim().length < 3} onClick={() => dismiss.mutate()} data-testid="recommendation-dismiss-confirm">
                Dismiss
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDismissing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button size="sm" className="h-7 px-2 text-xs" disabled={busy} onClick={() => approve.mutate()} data-testid="recommendation-approve">
              {rec.suggested_action ? ACTION_LABEL[rec.suggested_action.kind] ?? "Approve" : "Approve"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={busy} onClick={() => setDismissing(true)} data-testid="recommendation-dismiss">
              Dismiss
            </Button>
          </div>
        ))}
    </li>
  );
}

/**
 * COPS-13 AI recommendation rail on Customer 360 (Bible p.61, p.83): pending recommendations with
 * their evidence and confidence. Approve runs the one suggested action; dismiss asks why.
 */
export function RecommendationRail({ accountId }: { accountId: string }) {
  const api = useCopsInsightsApi();
  const authReady = useAuthReady();
  const qc = useQueryClient();
  const { permissions } = useMyPermissions();
  const canAct = can(permissions, ["crm:write"]);
  const key = ["cops-recommendations", accountId];
  const list = useQuery({ queryKey: key, queryFn: () => api.recommendations(accountId, "pending"), enabled: authReady && Boolean(accountId), retry: false });
  const generate = useMutation({
    mutationFn: () => api.generate(accountId),
    onSuccess: (r) => {
      trackCops("cops.recommendations_generated", { generated_count: r.generated });
      qc.setQueryData(key, { data: r.data });
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["cops-360", accountId] });
  };
  const recs = list.data?.data ?? [];
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? recs : recs.slice(0, RECS_SHOWN);

  return (
    <Card data-testid="recommendation-rail">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="flex min-w-0 flex-1 items-center gap-1.5 text-sm" title="AI recommendations">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">AI recommendations</span>
          {recs.length > 0 && <Badge tone="muted" className="shrink-0">{recs.length}</Badge>}
        </CardTitle>
        {canAct && (
          <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" disabled={generate.isPending} onClick={() => generate.mutate()} data-testid="recommendations-generate">
            {generate.isPending ? "Checking…" : "Check now"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {generate.isError && <Alert variant="error">{errorText(generate.error, "Could not check for recommendations.")}</Alert>}
        {list.isLoading ? (
          <Skeleton className="h-16 w-full rounded-md" />
        ) : list.isError ? (
          <Alert variant="error" onRetry={() => list.refetch()}>
            {errorText(list.error, "Could not load recommendations.")}
          </Alert>
        ) : recs.length === 0 ? (
          <p className="text-xs text-muted-foreground" data-testid="recommendations-empty">
            {generate.isSuccess ? "Nothing to recommend right now." : "No open recommendations."}
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {shown.map((r) => (
                <RecommendationItem key={r.id} rec={r} accountId={accountId} canAct={canAct} onDone={refresh} />
              ))}
            </ul>
            {recs.length > RECS_SHOWN && (
              <button type="button" className="w-full text-center text-xs text-primary hover:underline" onClick={() => setShowAll((x) => !x)} data-testid="recommendations-show-all">
                {showAll ? "Show fewer" : `Show ${recs.length - RECS_SHOWN} more`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
