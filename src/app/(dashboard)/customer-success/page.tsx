"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { withCopsTracking } from "@/lib/cops-analytics";
import { CopsRequestError } from "@/lib/cops-fetch";
import { HEALTH_STATE_LABEL, HEALTH_STATE_TONE, useCopsSuccessApi, type HealthState } from "@/lib/cops-success";

const errorText = (err: unknown, fallback: string) => (err instanceof CopsRequestError ? err.message : fallback);
const account360 = (id: string) => `/crm/360?mode=account&id=${id}&tab=success`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

function Tile({ label, value, tone, testId }: { label: string; value: number | string; tone?: string; testId?: string }) {
  return (
    <div className="rounded-md border p-3" data-testid={testId}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

/**
 * COPS-11 Customer Success screen (Bible p.66): health distribution, renewal exposure, adoption,
 * the at-risk list with the reason and the next action, expansion signals, and playbook
 * enrollment, visible and auditable.
 */
export default function CustomerSuccessPage() {
  const api = useCopsSuccessApi();
  const authReady = useAuthReady();
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: ["cs-overview"], queryFn: () => api.overview(), enabled: authReady, retry: false });
  const playbooks = useQuery({ queryKey: ["cs-playbooks"], queryFn: () => api.playbooks(), enabled: authReady, retry: false });
  const install = useMutation({
    mutationFn: () => withCopsTracking("cops.success_playbooks_installed", () => api.installPlaybooks(), (r) => ({ installed_count: r.data.installed.length })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cs-playbooks"] }),
  });
  const o = overview.data?.data;
  const missing = (playbooks.data?.data ?? []).filter((p) => !p.automationId).length;

  return (
    <PageShell data-testid="page-customer-success">
      <PageHeader title="Customer success" description="Account health, renewals, adoption and the playbooks working on them." />

      {overview.isError && (
        <Alert variant="error" onRetry={() => overview.refetch()}>
          {errorText(overview.error, "Could not load customer success.")}
        </Alert>
      )}

      {overview.isLoading ? (
        <Skeleton className="h-24 w-full rounded-md" />
      ) : o ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="cs-distribution">
            <Tile label="Healthy" value={o.distribution.healthy} tone="text-emerald-600" />
            <Tile label="Watch" value={o.distribution.watch} tone="text-amber-600" />
            <Tile label="At risk" value={o.distribution.at_risk} tone="text-red-600" />
            <Tile label="Not scored yet" value={o.distribution.unscored} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>At risk and watch</CardTitle>
              </CardHeader>
              <CardContent>
                {o.atRisk.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No account is at risk or on watch.</p>
                ) : (
                  <ul className="divide-y text-sm" data-testid="cs-at-risk">
                    {o.atRisk.map((a) => (
                      <li key={a.accountId} className="space-y-1 py-2">
                        <div className="flex items-center gap-2">
                          <Link href={account360(a.accountId)} className="font-medium hover:underline">
                            {a.name}
                          </Link>
                          <Badge tone={HEALTH_STATE_TONE[a.state as HealthState]}>{HEALTH_STATE_LABEL[a.state as HealthState]}</Badge>
                          <span className="ml-auto tabular-nums text-muted-foreground">{a.score ?? "—"}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Why: {a.reasons.join("; ") || "—"}</p>
                        <p className="text-xs">
                          Next: {a.nextAction ? `${a.nextAction.title} (due ${day(a.nextAction.dueDate)})` : <span className="text-amber-700 dark:text-amber-400">no open task: plan the next step</span>}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Renewals in the next 90 days</CardTitle>
              </CardHeader>
              <CardContent>
                {o.renewalExposure.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No renewal in the next 90 days.</p>
                ) : (
                  <ul className="divide-y text-sm" data-testid="cs-renewals">
                    {o.renewalExposure.map((r) => (
                      <li key={r.accountId + r.termEnd} className="flex items-center gap-2 py-1.5">
                        <Link href={account360(r.accountId)} className="hover:underline">
                          {r.name}
                        </Link>
                        {r.healthState && <Badge tone={HEALTH_STATE_TONE[r.healthState]}>{HEALTH_STATE_LABEL[r.healthState]}</Badge>}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {day(r.termEnd)} · risk {r.renewalRisk ?? "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Adoption</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="cs-adoption">
                  <Tile label="In onboarding or live" value={o.adoption.total} />
                  <Tile label="Signed in" value={o.adoption.signedIn} />
                  <Tile label="Activated" value={o.adoption.activated} />
                  <Tile label="Average activation" value={`${o.adoption.avgPct}%`} />
                </div>
                {o.adoption.under50 > 0 && <p className="mt-2 text-xs text-muted-foreground">{o.adoption.under50} account(s) below 50% activation.</p>}
                {(o.adoption.milestones ?? []).length > 0 && (
                  <ul className="mt-3 space-y-1.5 text-sm" data-testid="cs-milestones">
                    {(o.adoption.milestones ?? []).map((m) => (
                      <li key={m.key} className="flex items-center gap-2">
                        <span className="w-40 truncate">{m.label}</span>
                        <span className="h-2 flex-1 rounded bg-muted">
                          <span className="block h-2 rounded bg-primary" style={{ width: `${m.total ? Math.round((m.reached / m.total) * 100) : 0}%` }} />
                        </span>
                        <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                          {m.reached}/{m.total}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expansion signals (30 days)</CardTitle>
              </CardHeader>
              <CardContent>
                {o.expansionSignals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No expansion signal in the last 30 days.</p>
                ) : (
                  <ul className="divide-y text-sm" data-testid="cs-expansion">
                    {o.expansionSignals.map((e) => (
                      <li key={e.accountId + e.at} className="py-1.5">
                        <Link href={account360(e.accountId)} className="font-medium hover:underline">
                          {e.name ?? "Account"}
                        </Link>
                        <p className="text-xs text-muted-foreground">{e.evidence.join("; ")}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Playbooks</CardTitle>
              {missing > 0 && (
                <Button size="sm" onClick={() => install.mutate()} disabled={install.isPending} data-testid="cs-install-playbooks">
                  Install {missing} playbook{missing === 1 ? "" : "s"}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {install.isError && <Alert variant="error">{errorText(install.error, "Could not install the playbooks (admins only).")}</Alert>}
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="cs-playbook-list">
                {(playbooks.data?.data ?? []).map((p) => (
                  <li key={p.key} className="rounded-md border p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      {p.automationId ? (
                        <Link href={`/workflows/${p.automationId}`} className="font-medium hover:underline">
                          {p.name.replace("Playbook: ", "")}
                        </Link>
                      ) : (
                        <span className="font-medium">{p.name.replace("Playbook: ", "")}</span>
                      )}
                      <Badge tone={p.automationId ? (p.status === "active" ? "success" : "muted") : "muted"}>{p.automationId ? p.status : "not installed"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </li>
                ))}
              </ul>
              <h4 className="text-sm font-medium">Recent enrollments</h4>
              {o.playbooks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No playbook has enrolled an account yet.</p>
              ) : (
                <ul className="divide-y text-sm" data-testid="cs-enrollments">
                  {o.playbooks.map((e) => (
                    <li key={e.runId} className="flex items-center gap-2 py-1.5">
                      <span>{e.playbook.replace("Playbook: ", "")}</span>
                      {e.accountId && (
                        <Link href={account360(e.accountId)} className="text-xs text-primary hover:underline">
                          account
                        </Link>
                      )}
                      <Link href={`/workflows/${e.automationId}`} className="text-xs text-primary hover:underline">
                        run history
                      </Link>
                      <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge tone={e.status === "succeeded" ? "success" : e.status === "failed" ? "danger" : "muted"}>{e.status}</Badge>
                        {day(e.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </PageShell>
  );
}
