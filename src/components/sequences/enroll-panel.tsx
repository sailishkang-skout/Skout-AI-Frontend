"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useEnrichmentApi } from "@/lib/enrichment";
import { useSequencesApi } from "@/lib/sequences";
import type { SequenceEnrollmentStatus } from "@/types/api";

function enrollmentStatusTone(status: SequenceEnrollmentStatus) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "active":
      return "info" as const;
    case "bounced":
      return "danger" as const;
    case "replied":
      return "success" as const;
    default:
      return "muted" as const;
  }
}

export function EnrollPanel({ sequenceId, sequenceStatus }: { sequenceId: string; sequenceStatus: string }) {
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const sequencesApi = useSequencesApi();
  const enrichmentApi = useEnrichmentApi();

  const [selectedListId, setSelectedListId] = useState("");
  const [prospectIdsDraft, setProspectIdsDraft] = useState("");

  const lists = useQuery({
    queryKey: ["lists"],
    queryFn: enrichmentApi.listLists,
    enabled: authReady,
  });

  const enrollments = useQuery({
    queryKey: ["sequences", sequenceId, "enrollments"],
    queryFn: () => sequencesApi.listEnrollments(sequenceId),
    enabled: authReady && Boolean(sequenceId),
    refetchInterval: (query) => {
      const rows = query.state.data?.data ?? [];
      return rows.some((r) => r.status === "active") ? 5000 : false;
    },
  });

  const enrollmentRows = enrollments.data?.data ?? [];

  const enroll = useMutation({
    mutationFn: () => {
      const ids = prospectIdsDraft
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return sequencesApi.enroll(sequenceId, {
        ...(selectedListId ? { listId: selectedListId } : {}),
        ...(ids.length ? { prospectIds: ids } : {}),
      });
    },
    onSuccess: () => {
      setProspectIdsDraft("");
      queryClient.invalidateQueries({ queryKey: ["sequences", sequenceId, "enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["sequences", sequenceId, "analytics"] });
    },
  });

  const canEnroll = sequenceStatus === "active" && (Boolean(selectedListId) || prospectIdsDraft.trim().length > 0);

  const listOptions = useMemo(() => lists.data?.data ?? [], [lists.data]);

  return (
    <div className="space-y-4">
      {sequenceStatus !== "active" && (
        <Alert variant="warning">Activate this sequence before enrolling prospects.</Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enroll prospects</CardTitle>
          <CardDescription>Enroll an entire list, or paste prospect IDs (one per line or comma-separated).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              disabled={sequenceStatus !== "active"}
              className="sm:w-64"
            >
              <option value="">Select a list (optional)…</option>
              {listOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.prospectCount})
                </option>
              ))}
            </Select>
          </div>

          <textarea
            placeholder="prospect-id-1&#10;prospect-id-2"
            value={prospectIdsDraft}
            onChange={(e) => setProspectIdsDraft(e.target.value)}
            disabled={sequenceStatus !== "active"}
            rows={3}
            className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />

          <Button onClick={() => enroll.mutate()} disabled={!canEnroll || enroll.isPending}>
            {enroll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Enroll
          </Button>

          {enroll.isSuccess && (
            <Alert variant="success">
              Enrolled {enroll.data.enrolled}, skipped {enroll.data.skipped} (already enrolled) of {enroll.data.total} total.
            </Alert>
          )}
          {enroll.isError && <Alert variant="error">{formatQueryError(enroll.error, "Could not enroll prospects.")}</Alert>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enrollment status</CardTitle>
          <CardDescription>
            {enrollmentRows.length} prospect{enrollmentRows.length === 1 ? "" : "s"} enrolled — live status refreshes automatically while active.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enrollments.isLoading && (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          )}
          {!enrollments.isLoading && enrollmentRows.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No enrollments yet.</p>
          )}
          {enrollmentRows.length > 0 && (
            <ul>
              {enrollmentRows.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 border-b py-3 text-sm last:border-0">
                  <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{e.prospectId}</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      Enrolled {new Date(e.enrolledAt).toLocaleDateString()}
                    </span>
                    <Badge tone={enrollmentStatusTone(e.status)}>{e.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
