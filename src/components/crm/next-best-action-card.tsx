"use client";

/** R20.3 — AI next-best-action suggestion for one contact or deal. */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatQueryError, useApiFetch } from "@/lib/api-client";

type ActionType = "call" | "email" | "meeting" | "wait" | "task";

interface Suggestion {
  actionType: ActionType;
  headline: string;
  rationale: string;
  draftMessage?: string;
}

const ACTION_TONE: Record<ActionType, "info" | "success" | "warning" | "muted"> = {
  call: "info",
  email: "info",
  meeting: "success",
  wait: "muted",
  task: "warning",
};

export function NextBestActionCard({ entityType, entityId }: { entityType: "contact" | "deal"; entityId: string }) {
  const apiFetch = useApiFetch();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [taskCreated, setTaskCreated] = useState(false);

  const suggest = useMutation({
    mutationFn: () =>
      apiFetch<{ data: { label: string; suggestion: Suggestion } }>("/api/v1/ai/next-best-action", {
        method: "POST",
        body: JSON.stringify({ entityType, entityId }),
      }),
    onSuccess: (res) => {
      setSuggestion(res.data.suggestion);
      setTaskCreated(false);
    },
  });

  const createTask = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/ai/next-best-action/create-task", {
        method: "POST",
        body: JSON.stringify({ entityType, entityId, title: suggestion!.headline }),
      }),
    onSuccess: () => setTaskCreated(true),
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Next best action
          </h2>
          <Button size="sm" variant="outline" disabled={suggest.isPending} onClick={() => suggest.mutate()}>
            {suggest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {suggestion ? "Refresh" : "Suggest"}
          </Button>
        </div>

        {suggest.isError && (
          <Alert variant="error">{formatQueryError(suggest.error, "Could not generate a suggestion.")}</Alert>
        )}

        {suggestion && (
          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Badge tone={ACTION_TONE[suggestion.actionType]}>{suggestion.actionType}</Badge>
              <p className="text-sm font-medium">{suggestion.headline}</p>
            </div>
            <p className="text-sm text-muted-foreground">{suggestion.rationale}</p>
            {suggestion.draftMessage && (
              <p className="whitespace-pre-wrap rounded bg-background p-2 text-xs text-muted-foreground">
                {suggestion.draftMessage}
              </p>
            )}
            {suggestion.actionType !== "wait" && (
              <Button size="sm" variant="outline" disabled={taskCreated || createTask.isPending} onClick={() => createTask.mutate()}>
                {createTask.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {taskCreated ? "Task created" : "Create task"}
              </Button>
            )}
          </div>
        )}

        {!suggestion && !suggest.isPending && (
          <p className="text-sm text-muted-foreground">
            Get an AI-suggested next step grounded in this record's actual activity, tasks, and meeting history.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
