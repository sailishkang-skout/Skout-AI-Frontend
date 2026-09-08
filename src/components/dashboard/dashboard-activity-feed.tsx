"use client";

import { Activity, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary } from "@/types/api";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardActivityFeedProps {
  summary?: DashboardSummary;
  isLoading?: boolean;
}

export function DashboardActivityFeed({ summary, isLoading }: DashboardActivityFeedProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Global Activity
        </CardTitle>
        <CardDescription>Recent meaningful events across your GTM system.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4 ml-2 border-l pl-4">
             {Array.from({ length: 4 }).map((_, i) => (
               <Skeleton key={i} className="h-10 w-full" />
             ))}
          </div>
        ) : !summary || summary.recentJobs.length === 0 ? (
           <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center">
             <Activity className="h-8 w-8 text-muted-foreground/30" />
             <p className="text-sm text-muted-foreground">No recent activity.</p>
           </div>
        ) : (
          <div className="relative border-l border-muted pl-4 ml-2 space-y-6">
            {summary.recentJobs.slice(0, 5).map((job) => (
              <div key={job.id} className="relative">
                <span className="absolute -left-[25px] flex h-5 w-5 items-center justify-center rounded-full bg-background ring-2 ring-muted">
                  <Zap className="h-3 w-3 text-amber-500" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium leading-none">
                    Enrichment job {job.status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {job.completedAt ? new Date(job.completedAt).toLocaleString() : new Date(job.queuedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
