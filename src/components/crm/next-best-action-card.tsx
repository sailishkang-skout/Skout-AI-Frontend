"use client";

/** R20.3 — AI next-best-action suggestion for one contact or deal. */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { formatQueryError, useApiFetch, useAuthReady } from "@/lib/api-client";
import { useSequencesApi } from "@/lib/sequences";

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
  const authReady = useAuthReady();
  const sequencesApi = useSequencesApi();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [taskCreated, setTaskCreated] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [showSequencePicker, setShowSequencePicker] = useState(false);
  const [selectedSequenceId, setSelectedSequenceId] = useState("");

  const sequences = useQuery({
    queryKey: ["sequences", "list"],
    queryFn: sequencesApi.list,
    enabled: authReady && showSequencePicker,
  });
  const activeSequences = (sequences.data?.data ?? []).filter((s) => s.status === "active");

  const suggest = useMutation({
    mutationFn: () =>
      apiFetch<{ data: { label: string; suggestion: Suggestion; suggestionId: string } }>("/api/v1/ai/next-best-action", {
        method: "POST",
        body: JSON.stringify({ entityType, entityId }),
      }),
    onSuccess: (res) => {
      setSuggestion(res.data.suggestion);
      setSuggestionId(res.data.suggestionId);
      setTaskCreated(false);
      setEnrolled(false);
      setShowSequencePicker(false);
    },
  });

  const createTask = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/ai/next-best-action/create-task", {
        method: "POST",
        body: JSON.stringify({ entityType, entityId, title: suggestion!.headline, suggestionId }),
      }),
    onSuccess: () => setTaskCreated(true),
  });

  const enroll = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/ai/next-best-action/enroll", {
        method: "POST",
        body: JSON.stringify({ entityId, sequenceId: selectedSequenceId, suggestionId }),
      }),
    onSuccess: () => setEnrolled(true),
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
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" disabled={taskCreated || createTask.isPending} onClick={() => createTask.mutate()}>
                  {createTask.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {taskCreated ? "Task created" : "Create task"}
                </Button>
                {/* R20.3 — "Enroll in sequence" accept option. Only meaningful for contacts —
                    a deal has no single prospectId to enroll (see R14.1 identity-gap note). */}
                {entityType === "contact" &&
                  (showSequencePicker ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={selectedSequenceId}
                        onChange={(e) => setSelectedSequenceId(e.target.value)}
                        className="h-8 w-44 text-xs"
                        disabled={sequences.isLoading || enrolled}
                      >
                        <option value="" disabled>
                          {sequences.isLoading ? "Loading…" : "Choose a sequence…"}
                        </option>
                        {activeSequences.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!selectedSequenceId || enrolled || enroll.isPending}
                        onClick={() => enroll.mutate()}
                      >
                        {enroll.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {enrolled ? "Enrolled" : "Enroll"}
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" disabled={enrolled} onClick={() => setShowSequencePicker(true)}>
                      {enrolled ? "Enrolled" : "Enroll in sequence"}
                    </Button>
                  ))}
              </div>
            )}
            {enroll.isError && (
              <Alert variant="error" className="text-xs">
                {formatQueryError(enroll.error, "Could not enroll in this sequence.")}
              </Alert>
            )}
          </div>
        )}

        {!suggestion && !suggest.isPending && (
          <p className="text-sm text-muted-foreground">
            Get an AI-suggested next step grounded in this record&apos;s actual activity, tasks, and meeting history.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
