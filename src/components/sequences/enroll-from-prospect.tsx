"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useSequencesApi } from "@/lib/sequences";
import type { SequenceEnrollmentStatus } from "@/types/api";

function enrollmentTone(status: SequenceEnrollmentStatus) {
  if (status === "active") return "info" as const;
  if (status === "completed") return "success" as const;
  if (status === "bounced") return "danger" as const;
  if (status === "replied") return "success" as const;
  return "muted" as const;
}

/** Compact "enroll into a sequence" widget embedded in the prospect detail sheet. */
export function EnrollFromProspect({ prospectId }: { prospectId: string }) {
  const authReady = useAuthReady();
  const sequencesApi = useSequencesApi();
  const queryClient = useQueryClient();
  const [sequenceId, setSequenceId] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  const sequences = useQuery({
    queryKey: ["sequences"],
    queryFn: sequencesApi.list,
    enabled: authReady,
  });

  const enrollments = useQuery({
    queryKey: ["prospect-enrollments", prospectId],
    queryFn: () => sequencesApi.getProspectEnrollments(prospectId),
    enabled: authReady,
  });

  const activeSequences = (sequences.data?.data ?? []).filter((s) => s.status === "active");
  const prospectEnrollments = enrollments.data?.data ?? [];

  // IDs of sequences the prospect is actively enrolled in (to disable re-enrolling)
  const activeEnrolledIds = new Set(
    prospectEnrollments
      .filter((e) => e.status === "active")
      .map((e) => e.sequenceId),
  );

  const enroll = useMutation({
    mutationFn: () =>
      sequencesApi.enroll(sequenceId, {
        prospectIds: [prospectId],
        ...(consentConfirmed ? { consentBasis: "legitimate_interest" as const } : {}),
      }),
    onSuccess: () => {
      setSequenceId("");
      setConsentConfirmed(false);
      void queryClient.invalidateQueries({ queryKey: ["prospect-enrollments", prospectId] });
    },
  });

  const unenroll = useMutation({
    mutationFn: ({ seqId }: { seqId: string }) =>
      sequencesApi.unenroll(seqId, prospectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prospect-enrollments", prospectId] });
    },
  });

  const canEnroll = !!sequenceId && !activeEnrolledIds.has(sequenceId) && consentConfirmed;

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
      {/* Current enrollments */}
      {prospectEnrollments.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Enrolled sequences</p>
          {prospectEnrollments.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Badge tone={enrollmentTone(e.status)} className="capitalize shrink-0">
                  {e.status}
                </Badge>
                <span className="truncate text-xs">
                  {e.sequenceName ?? e.sequenceId}
                </span>
              </div>
              {e.status === "active" && (
                <button
                  type="button"
                  onClick={() => unenroll.mutate({ seqId: e.sequenceId })}
                  disabled={unenroll.isPending && unenroll.variables?.seqId === e.sequenceId}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  title="Unenroll from sequence"
                >
                  {unenroll.isPending && unenroll.variables?.seqId === e.sequenceId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserMinus className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Enroll form */}
      <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
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
                <option key={s.id} value={s.id} disabled={activeEnrolledIds.has(s.id)}>
                  {s.name}
                  {activeEnrolledIds.has(s.id) ? " (already enrolled)" : ""}
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
          disabled={!canEnroll || enroll.isPending}
          onClick={() => enroll.mutate()}
        >
          {enroll.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mail className="h-3.5 w-3.5" />
          )}
          Enroll
        </Button>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={consentConfirmed}
          onChange={(e) => setConsentConfirmed(e.target.checked)}
        />
        <span>Confirm email consent basis (legitimate interest) before enroll</span>
      </label>
      </div>

      {unenroll.isError && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {formatQueryError(unenroll.error, "Could not unenroll.")}
        </p>
      )}
    </div>
  );
}
