"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, AlertCircle, TrendingDown, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type { DashboardSummary } from "@/types/api";
import { Skeleton } from "@/components/ui/skeleton";

interface AiInsightsFeedProps {
  summary?: DashboardSummary;
  isLoading?: boolean;
}

export function AiInsightsFeed({ summary, isLoading }: AiInsightsFeedProps) {
  const insights = [];

  if (summary) {
    if (!summary.icpConfigured) {
      insights.push({
        id: "icp",
        type: "risk",
        message: "Your ICP is not configured, disabling lead scoring.",
        actionLabel: "Setup ICP",
        actionHref: "/onboarding",
      });
    }

    if (summary.credits < 100) {
      insights.push({
        id: "credits",
        type: "action",
        message: `Your credit balance is low (${summary.credits} remaining).`,
        actionLabel: "Add Credits",
        actionHref: "/settings/workspace",
      });
    }

    const failedJobs = summary.recentJobs.filter(j => j.status === "failed");
    if (failedJobs.length > 0) {
      insights.push({
        id: "failed-jobs",
        type: "action",
        message: `${failedJobs.length} enrichment job(s) failed recently.`,
        actionLabel: "View Errors",
        actionHref: "/enrichment",
      });
    }
    
    // Add a positive insight if they're doing well
    if (summary.enrichedThisWeek > 100) {
      insights.push({
        id: "momentum",
        type: "opportunity",
        message: `Strong momentum: ${summary.enrichedThisWeek} accounts enriched this week.`,
        actionLabel: "View Prospects",
        actionHref: "/prospects/search",
      });
    }
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Insights & Actions
        </CardTitle>
        <CardDescription>Recommended next steps based on your active pipeline.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3">
             {Array.from({ length: 3 }).map((_, i) => (
               <Skeleton key={i} className="h-24 w-full rounded-lg" />
             ))}
          </div>
        ) : insights.length === 0 ? (
          <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No insights available right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className="group relative flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex gap-3">
                  <div className="mt-0.5 shrink-0">
                    {insight.type === "opportunity" && <Target className="h-4 w-4 text-green-500" />}
                    {insight.type === "risk" && <TrendingDown className="h-4 w-4 text-orange-500" />}
                    {insight.type === "action" && <AlertCircle className="h-4 w-4 text-blue-500" />}
                  </div>
                  <p className="text-sm font-medium leading-tight">{insight.message}</p>
                </div>
                <div className="ml-7 flex">
                  <Link
                    href={insight.actionHref}
                    className={buttonVariants({ variant: "secondary", size: "sm", className: "h-7 text-xs" })}
                  >
                    {insight.actionLabel}
                    <ArrowRight className="ml-1.5 h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
