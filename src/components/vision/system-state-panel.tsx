"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Loader2, PauseCircle } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { DASHBOARD_SUMMARY_KEY, useDashboardApi } from "@/lib/dashboard";
import { useDexterPlatformApi } from "@/lib/dexter-platform";
import type { VisionScreenId } from "@/lib/vision-screens";

type JobRow = { id: string; status: string; type?: string };

export function VisionSystemStatePanel({
  screenId,
  compact,
}: {
  screenId: VisionScreenId;
  compact?: boolean;
}) {
  const authReady = useAuthReady();
  const dashboardApi = useDashboardApi();
  const dexterApi = useDexterPlatformApi();

  const summary = useQuery({
    queryKey: DASHBOARD_SUMMARY_KEY,
    queryFn: async () => (await dashboardApi.getSummary()).data,
    enabled: authReady,
    staleTime: 30_000,
  });

  const workflowRuns = useQuery({
    queryKey: ["workflow-runs", "vision"],
    queryFn: dexterApi.listWorkflowRuns,
    enabled: authReady && screenId === "17.16",
    staleTime: 30_000,
  });

  const jobs = (summary.data?.recentJobs ?? []) as JobRow[];
  const running = jobs.filter((j) => j.status === "running" || j.status === "queued");
  const failed = jobs.filter((j) => j.status === "failed");
  const runs = (workflowRuns.data?.data ?? []) as Array<Record<string, unknown>>;
  const blockedRuns = runs.filter((r) => String(r.status) === "awaiting_approval" || String(r.status) === "pending");
  const failedRuns = runs.filter((r) => String(r.status) === "failed");

  const items: Array<{ label: string; tone: "info" | "warning" | "danger" | "muted"; icon: typeof Loader2 }> = [];
  if (summary.isLoading) {
    items.push({ label: "Loading system state…", tone: "muted", icon: Loader2 });
  } else {
    if (running.length) items.push({ label: `${running.length} job(s) running`, tone: "info", icon: Loader2 });
    if (failed.length) items.push({ label: `${failed.length} enrichment failure(s)`, tone: "danger", icon: AlertTriangle });
    if (blockedRuns.length)
      items.push({ label: `${blockedRuns.length} workflow(s) awaiting approval`, tone: "warning", icon: PauseCircle });
    if (failedRuns.length) items.push({ label: `${failedRuns.length} workflow run failure(s)`, tone: "danger", icon: AlertTriangle });
    if (!items.length) items.push({ label: "All systems nominal", tone: "muted", icon: Clock });
  }

  const body = (
    <ul className="space-y-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            <Icon className={`h-4 w-4 shrink-0 ${item.tone === "info" ? "animate-spin text-blue-600" : "text-muted-foreground"}`} />
            <Badge tone={item.tone}>{item.label}</Badge>
          </li>
        );
      })}
      {failed.slice(0, 2).map((j) => (
        <li key={j.id} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
          <span>{j.type ?? "Job"}</span>
          <Badge tone={statusTone(j.status)}>{j.status}</Badge>
        </li>
      ))}
    </ul>
  );

  if (compact) {
    return (
      <div className="rounded-md border bg-muted/20 p-2 text-xs">
        <p className="mb-1 font-medium">System state</p>
        {body}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">System state</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary.isLoading && screenId !== "17.16" ? <Skeleton className="h-20 w-full" /> : body}
        {(failed.length > 0 || failedRuns.length > 0) && (
          <Link
            href={screenId === "17.16" ? "/workflows" : "/enrichment"}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Investigate
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
