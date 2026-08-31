"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckSquare, Flame, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { useDexterPlatformApi } from "@/lib/dexter-platform";
import { signalLabel, timeAgoShort, useSignalsApi } from "@/lib/signals";
import type { DashboardSummary } from "@/types/api";

export function DashboardCommandCenter({ summary }: { summary?: DashboardSummary }) {
  const authReady = useAuthReady();
  const dexterApi = useDexterPlatformApi();
  const signalsApi = useSignalsApi();

  const decisions = useQuery({
    queryKey: ["decision-views", "open"],
    queryFn: () => dexterApi.listDecisions("open"),
    enabled: authReady,
  });

  const signals = useQuery({
    queryKey: ["signals", "accounts", "dashboard"],
    queryFn: () => signalsApi.listAccounts({ limit: 20 }),
    enabled: authReady,
  });

  const openDecisions = (decisions.data?.data ?? []).filter((d) => String(d.status) === "open");
  const hotAccounts = (signals.data?.data ?? []).filter((a) => a.stackScore.band === "hot").slice(0, 5);
  const failedJobs = (summary?.recentJobs ?? []).filter((j) => j.status === "failed");
  const runningJobs = (summary?.recentJobs ?? []).filter((j) => j.status === "running" || j.status === "queued");
  const lowCredits = summary != null && summary.credits < 100;

  const risks: Array<{ label: string; href: string; tone: "warning" | "danger" }> = [];
  if (!summary?.icpConfigured) risks.push({ label: "ICP not configured", href: "/onboarding", tone: "warning" });
  if (lowCredits) risks.push({ label: "Credits running low", href: "/settings/workspace", tone: "warning" });
  if (failedJobs.length) risks.push({ label: `${failedJobs.length} failed enrichment job(s)`, href: "/enrichment", tone: "danger" });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Priority decisions</CardTitle>
            <CardDescription>Recommendations waiting for your review.</CardDescription>
          </div>
          <Link href="/decisions" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {decisions.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : openDecisions.length ? (
            <ul className="divide-y divide-border">
              {openDecisions.slice(0, 5).map((d) => (
                <li key={String(d.id)} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{String(d.title ?? "Decision")}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{String(d.recommendation ?? "")}</p>
                  </div>
                  <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No open decisions right now.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-4 w-4 text-orange-500" />
            Hot signals
          </CardTitle>
          <CardDescription>Accounts with the strongest live intent.</CardDescription>
        </CardHeader>
        <CardContent>
          {signals.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : hotAccounts.length ? (
            <ul className="space-y-2">
              {hotAccounts.map((account) => (
                <li key={account.companyId}>
                  <Link
                    href={`/crm/360?mode=account&id=${encodeURIComponent(account.companyId)}`}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{account.companyName ?? account.companyId}</p>
                      <p className="text-xs text-muted-foreground">
                        {account.signals[0] ? signalLabel(account.signals[0].signalType) : "Live signal"} ·{" "}
                        {account.signals[0] ? timeAgoShort(account.signals[0].observedAt) : "recent"}
                      </p>
                    </div>
                    <Badge tone="danger">{account.stackScore.score}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No hot accounts at the moment.</p>
          )}
          <Link
            href="/signals"
            className="mt-3 inline-flex w-full items-center justify-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Signal Center
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Operating feed</CardTitle>
          <CardDescription>Jobs in flight, risks and system activity.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4 text-primary" />
                Enrichment
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{runningJobs.length}</p>
              <p className="text-xs text-muted-foreground">jobs running or queued</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckSquare className="h-4 w-4 text-primary" />
                Decisions
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{openDecisions.length}</p>
              <p className="text-xs text-muted-foreground">awaiting review</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Flame className="h-4 w-4 text-orange-500" />
                Signals
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{hotAccounts.length}</p>
              <p className="text-xs text-muted-foreground">hot accounts</p>
            </div>
          </div>

          {risks.length > 0 && (
            <ul className="mt-4 space-y-2">
              {risks.map((risk) => (
                <li key={risk.label}>
                  <Link
                    href={risk.href}
                    className="flex items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2 text-sm hover:bg-accent/40"
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${risk.tone === "danger" ? "text-destructive" : "text-amber-500"}`} />
                      {risk.label}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
