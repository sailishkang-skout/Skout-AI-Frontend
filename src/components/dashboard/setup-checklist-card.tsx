"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CheckCircle2, Circle, ListChecks } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthReady } from "@/lib/api-client";
import { SETUP_CHECKLIST_KEY, useDashboardApi } from "@/lib/dashboard";

/** R8.1 — "never a blank dashboard": tracks the same setup steps that gate sending. */
export function SetupChecklistCard() {
  const authReady = useAuthReady();
  const dashboardApi = useDashboardApi();

  const checklist = useQuery({
    queryKey: SETUP_CHECKLIST_KEY,
    queryFn: async () => (await dashboardApi.getSetupChecklist()).data,
    enabled: authReady,
    staleTime: 30_000,
  });

  const data = checklist.data;
  if (!data || data.complete) return null;

  const doneCount = data.items.filter((i) => i.done).length;

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
      </CardContent>
    </Card>
  );
}
