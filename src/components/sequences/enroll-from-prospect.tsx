"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useSequencesApi } from "@/lib/sequences";

/** Compact "enroll into a sequence" widget embedded in the prospect detail sheet. */
export function EnrollFromProspect({ prospectId }: { prospectId: string }) {
  const authReady = useAuthReady();
  const sequencesApi = useSequencesApi();
  const [sequenceId, setSequenceId] = useState("");

  const sequences = useQuery({
    queryKey: ["sequences"],
    queryFn: sequencesApi.list,
    enabled: authReady,
  });

  const activeSequences = (sequences.data?.data ?? []).filter((s) => s.status === "active");

  const enroll = useMutation({
    mutationFn: () => sequencesApi.enroll(sequenceId, { prospectIds: [prospectId] }),
  });

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Enroll in sequence</p>
        {!enroll.isSuccess && !enroll.isError && (
          <Select
            value={sequenceId}
            onChange={(e) => setSequenceId(e.target.value)}
            disabled={activeSequences.length === 0}
            className="mt-1.5 h-8 text-xs"
          >
            <option value="">
              {activeSequences.length === 0 ? "No active sequences" : "Select a sequence…"}
            </option>
            {activeSequences.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        {enroll.isSuccess && (
          <p className="mt-1 text-xs text-green-700 dark:text-green-400">
            {enroll.data.enrolled > 0 ? "Enrolled." : "Already enrolled in this sequence."}
          </p>
        )}
        {enroll.isError && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {formatQueryError(enroll.error, "Could not enroll.")}
          </p>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 gap-1.5 text-xs"
        disabled={!sequenceId || enroll.isPending}
        onClick={() => enroll.mutate()}
      >
        {enroll.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
        Enroll
      </Button>
    </div>
  );
}
