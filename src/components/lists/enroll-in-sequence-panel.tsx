"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useAuthReady } from "@/lib/api-client";
import { useSequencesApi } from "@/lib/sequences";

/**
 * ADI-15 (§4, §10.1) — the "enroll in a sequence" picker, extracted out of the static Lists
 * detail page so it's reusable wherever else the platform needs to offer this one-click hand-off:
 * Smart Lists (once activated into a static list) and Account 360's signal action rail (a single
 * prospect, not a whole list). Pass exactly one of `listId` / `prospectIds`.
 */
export function EnrollInSequencePanel({
  listId,
  prospectIds,
  onEnrolled,
  onCancel,
}: {
  listId?: string;
  prospectIds?: string[];
  onEnrolled?: () => void;
  onCancel: () => void;
}) {
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const sequencesApi = useSequencesApi();
  const [selectedSeqId, setSelectedSeqId] = useState("");

  const allSequences = useQuery({
    queryKey: ["sequences"],
    queryFn: () => sequencesApi.list(),
    enabled: authReady,
  });

  const runSequence = useMutation({
    mutationFn: (seqId: string) => sequencesApi.enroll(seqId, listId ? { listId } : { prospectIds }),
    onSuccess: () => {
      setSelectedSeqId("");
      if (listId) {
        queryClient.invalidateQueries({ queryKey: ["lists", listId, "sequences"] });
        queryClient.invalidateQueries({ queryKey: ["sequences", selectedSeqId, "lists"] });
      }
      onEnrolled?.();
    },
  });

  const activeSequences = (allSequences.data?.data ?? []).filter((s) => s.status === "active");
  const isSingleProspect = Boolean(prospectIds?.length);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {isSingleProspect ? "Enroll in a sequence" : "Enroll this list in a sequence"}
        </CardTitle>
        <CardDescription>
          {isSingleProspect
            ? "Select an active sequence to enroll this prospect in."
            : "Select an active sequence to run on all prospects in this list."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Select
            value={selectedSeqId}
            onChange={(e) => setSelectedSeqId(e.target.value)}
            className="max-w-sm"
          >
            <option value="">— choose a sequence —</option>
            {activeSequences.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!selectedSeqId || runSequence.isPending}
              onClick={() => runSequence.mutate(selectedSeqId)}
            >
              {runSequence.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Enroll
            </Button>
            <Button size="sm" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
        {allSequences.isLoading && (
          <p className="text-sm text-muted-foreground">Loading sequences…</p>
        )}
        {!allSequences.isLoading && activeSequences.length === 0 && (
          <p className="text-sm text-muted-foreground">No active sequences found. Activate a sequence first.</p>
        )}
        {runSequence.isError && (
          <p className="text-sm text-destructive">
            {runSequence.error instanceof Error
              ? runSequence.error.message
              : isSingleProspect
                ? "Could not enroll this prospect. Please try again."
                : "Could not enroll this list. Please try again."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
