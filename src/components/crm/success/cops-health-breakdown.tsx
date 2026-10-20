"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { CopsRequestError } from "@/lib/cops-fetch";
import { HEALTH_DIMENSIONS, HEALTH_STATE_LABEL, HEALTH_STATE_TONE, useCopsSuccessApi } from "@/lib/cops-success";
import { useTeamApi } from "@/lib/team";

const errorText = (err: unknown, fallback: string) => (err instanceof CopsRequestError ? err.message : fallback);

/**
 * COPS-11 Customer 360 Success tab: the account's health score with its full factor breakdown
 * (Bible p.49: no opaque score; every point is explained), leading and lagging signals told apart,
 * the score trend, the CSM, and this account's playbook enrollments.
 */
export function CopsHealthBreakdown({ accountId }: { accountId: string }) {
  const api = useCopsSuccessApi();
  const teamApi = useTeamApi();
  const authReady = useAuthReady();
  const qc = useQueryClient();
  const health = useQuery({ queryKey: ["cs-health", accountId], queryFn: () => api.health(accountId), enabled: authReady, retry: false });
  const history = useQuery({ queryKey: ["cs-health-history", accountId], queryFn: () => api.history(accountId), enabled: authReady, retry: false });
  const enrollments = useQuery({ queryKey: ["cs-enrollments", accountId], queryFn: () => api.enrollments(accountId), enabled: authReady, retry: false });
  const members = useQuery({ queryKey: ["team", "members"], queryFn: () => teamApi.listMembers(), enabled: authReady });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["cs-health", accountId] });
    qc.invalidateQueries({ queryKey: ["cs-health-history", accountId] });
  };
  const recompute = useMutation({ mutationFn: () => api.recompute(accountId), onSuccess: refresh });
  const setCsm = useMutation({ mutationFn: (id: string | null) => api.setCsm(accountId, id), onSuccess: refresh });

  if (health.isLoading) return <Skeleton className="h-40 w-full rounded-md" />;
  if (health.isError) return <Alert variant="error" onRetry={() => health.refetch()}>{errorText(health.error, "Could not load the account's health.")}</Alert>;

  const h = health.data?.data.health ?? null;
  const csmId = health.data?.data.csmId ?? null;
  const memberList = members.data?.data ?? [];

  return (
    <div className="space-y-5" data-testid="health-breakdown">
      <div className="flex flex-wrap items-center gap-3">
        {h ? (
          <>
            <span className="text-3xl font-semibold" data-testid="health-score">{h.score}</span>
            <Badge tone={HEALTH_STATE_TONE[h.state]}>{HEALTH_STATE_LABEL[h.state]}</Badge>
            <span className="text-sm text-muted-foreground">Renewal risk: {h.renewalRisk}</span>
            <span className="text-xs text-muted-foreground">Computed {new Date(h.computedAt).toLocaleString()} · model v{h.modelVersion}</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Not scored yet. The daily sweep scores customer accounts, or score it now.</span>
        )}
        <Button size="sm" variant="outline" className="ml-auto" disabled={recompute.isPending} onClick={() => recompute.mutate()} data-testid="health-recompute">
          <RefreshCw className="h-3.5 w-3.5" /> {h ? "Recompute" : "Score now"}
        </Button>
      </div>
      {recompute.isError && <Alert variant="error">{errorText(recompute.error, "Could not recompute.")}</Alert>}

      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">CSM</span>
        <Select aria-label="CSM" className="h-8 w-auto" value={csmId ?? ""} disabled={setCsm.isPending} onChange={(e) => setCsm.mutate(e.target.value || null)}>
          <option value="">Not assigned</option>
          {memberList.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.fullName || m.email}
            </option>
          ))}
        </Select>
      </label>
      {setCsm.isError && <Alert variant="error">{errorText(setCsm.error, "Could not set the CSM.")}</Alert>}

      {h && (
        <div className="space-y-3" data-testid="health-dimensions">
          {HEALTH_DIMENSIONS.map((d) => {
            const dim = h.dimensions[d];
            const factors = h.factors.filter((f) => f.dimension === d);
            return (
              <details key={d} className="rounded-md border p-3" open={dim.score < 70}>
                <summary className="flex cursor-pointer items-center gap-3 text-sm">
                  <span className="w-28 font-medium capitalize">{d}</span>
                  <span className="h-2 flex-1 rounded bg-muted">
                    <span className={`block h-2 rounded ${dim.score >= 70 ? "bg-emerald-500" : dim.score >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${dim.score}%` }} />
                  </span>
                  <span className="w-20 text-right tabular-nums">{dim.score} · w{dim.weight}</span>
                </summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {factors.map((f) => (
                    <li key={f.key} className="flex items-center gap-2" data-testid="health-factor">
                      <Badge tone={f.kind === "leading" ? "info" : "muted"}>{f.kind}</Badge>
                      <span className="flex-1">{f.reason}</span>
                      <span className={`tabular-nums ${f.points < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>{f.points === 0 ? "0" : f.points}</span>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Each dimension starts at 100 and loses the points shown; the score is the weighted mean. Leading signals can still be acted on; lagging ones are outcomes.
          </p>
        </div>
      )}

      <section>
        <h3 className="mb-1 text-sm font-medium">Trend</h3>
        {history.isError ? (
          <Alert variant="error">{errorText(history.error, "Could not load the trend.")}</Alert>
        ) : (history.data?.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No history yet.</p>
        ) : (
          <div className="flex items-end gap-1" data-testid="health-trend" aria-label="Health score over time">
            {[...(history.data?.data ?? [])].reverse().slice(-30).map((p) => (
              <span
                key={p.computedAt}
                title={`${p.score} on ${new Date(p.computedAt).toLocaleDateString()}`}
                className={`w-2 rounded-t ${p.state === "healthy" ? "bg-emerald-500" : p.state === "watch" ? "bg-amber-500" : "bg-red-500"}`}
                style={{ height: `${Math.max(4, p.score * 0.6)}px` }}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-sm font-medium">Playbooks</h3>
        {enrollments.isError ? (
          <Alert variant="error">{errorText(enrollments.error, "Could not load playbook enrollments.")}</Alert>
        ) : (enrollments.data?.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No playbook has run for this account.</p>
        ) : (
          <ul className="divide-y text-sm" data-testid="health-enrollments">
            {(enrollments.data?.data ?? []).map((e) => (
              <li key={e.runId} className="flex items-center justify-between py-1.5">
                <span>{e.playbook}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge tone={e.status === "succeeded" ? "success" : e.status === "failed" ? "danger" : "muted"}>{e.status}</Badge>
                  {new Date(e.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
