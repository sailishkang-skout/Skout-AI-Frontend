"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { CheckCircle2, Circle, ListChecks, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthReady } from "@/lib/api-client";
import { DASHBOARD_SUMMARY_KEY, SETUP_CHECKLIST_KEY, useDashboardApi } from "@/lib/dashboard";

/** R8.1 — "never a blank dashboard": tracks the same setup steps that gate sending. */
export function SetupChecklistCard() {
  const authReady = useAuthReady();
  const dashboardApi = useDashboardApi();
  const queryClient = useQueryClient();

  const checklist = useQuery({
    queryKey: SETUP_CHECKLIST_KEY,
    queryFn: async () => (await dashboardApi.getSetupChecklist()).data,
    enabled: authReady,
    staleTime: 30_000,
  });

  const seedDemo = useMutation({
    mutationFn: () => dashboardApi.seedDemoData(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETUP_CHECKLIST_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_KEY });
    },
  });

  const data = checklist.data;
  if (!data || data.complete) return null;

  const doneCount = data.items.filter((i) => i.done).length;
  const listAndProspectDone = data.items.find((i) => i.id === "list")?.done && data.items.find((i) => i.id === "prospect")?.done;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-primary" aria-hidden />
          Finish setting up your workspace
        </CardTitle>
        <CardDescription>
          {doneCount} of {data.items.length} done
          {!data.readyForOutboundSend && " — sending is disabled until this is complete"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {data.items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className={item.done ? "text-muted-foreground line-through" : ""}>
                  {item.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {!listAndProspectDone && (
          <div className="mt-3 border-t border-border pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedDemo.mutate()}
              disabled={seedDemo.isPending}
              className="gap-2"
            >
              {seedDemo.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Load demo data
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              Adds a sample list with a few fake prospects so you can see how it looks — safe,
              never sends anything real.
            </p>
            {seedDemo.isError && (
              <p className="mt-1 text-xs text-destructive">Could not load demo data — try again.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
