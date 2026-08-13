"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Loader2, Users, UserX } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useEnrichmentApi } from "@/lib/enrichment";
import { useSequencesApi } from "@/lib/sequences";
import type { SequenceEnrollmentStatus } from "@/types/api";

const ENROLLMENT_STATUS_CONFIG: Record<
  SequenceEnrollmentStatus,
  { tone: "success" | "info" | "warning" | "muted" | "danger"; label: string }
> = {
  active:    { tone: "info",    label: "Active"    },
  completed: { tone: "success", label: "Completed" },
  bounced:   { tone: "danger",  label: "Bounced"   },
  replied:   { tone: "success", label: "Replied"   },
  cancelled: { tone: "muted",   label: "Stopped"   },
};

export function EnrollPanel({
  sequenceId,
  sequenceStatus,
}: {
  sequenceId: string;
  sequenceStatus: string;
}) {
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const sequencesApi = useSequencesApi();
  const enrichmentApi = useEnrichmentApi();

  const [selectedListId, setSelectedListId] = useState("");
  const [prospectIdsDraft, setProspectIdsDraft] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const enrollmentRows = useMemo(() => enrollments.data?.data ?? [], [enrollments.data]);

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

  const isActive = sequenceStatus === "active";
  const canEnroll = isActive && (Boolean(selectedListId) || prospectIdsDraft.trim().length > 0);
  const listOptions = useMemo(() => lists.data?.data ?? [], [lists.data]);

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<SequenceEnrollmentStatus, number>> = {};
    for (const r of enrollmentRows) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return counts;
  }, [enrollmentRows]);

  return (
    <div className="space-y-5">
      {!isActive && (
        <Alert variant="warning">
          Activate this sequence before enrolling prospects.
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-muted-foreground" />
            Enroll prospects
          </CardTitle>
          <CardDescription>
            Pick a list to enroll everyone on it. Prefer lists over pasting IDs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">List</label>
            <Select
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              disabled={!isActive}
              className="w-full sm:max-w-sm"
            >
              <option value="">Select a list…</option>
              {listOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.prospectCount})
                </option>
              ))}
            </Select>
          </div>

          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            Advanced: paste prospect IDs
          </button>

          {showAdvanced && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Prospect IDs</label>
              <textarea
                placeholder={"prospect-id-1\nprospect-id-2"}
                value={prospectIdsDraft}
                onChange={(e) => setProspectIdsDraft(e.target.value)}
                disabled={!isActive}
                rows={3}
                className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={() => enroll.mutate()}
              disabled={!canEnroll || enroll.isPending}
              className="gap-2"
            >
              {enroll.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              Enroll
            </Button>
          </div>

          {enroll.isSuccess && (
            <Alert variant="success">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Enrolled {enroll.data.enrolled} prospect{enroll.data.enrolled !== 1 ? "s" : ""}
                {enroll.data.skipped > 0 && `, skipped ${enroll.data.skipped} already enrolled`}.
              </div>
            </Alert>
          )}
          {enroll.isError && (
            <Alert variant="error">
              {formatQueryError(enroll.error, "Could not enroll prospects.")}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Enrollments</CardTitle>
            <div className="flex items-center gap-1.5">
              {(["active", "completed", "replied", "bounced"] as SequenceEnrollmentStatus[]).map((s) =>
                (statusCounts[s] ?? 0) > 0 ? (
                  <Badge key={s} tone={ENROLLMENT_STATUS_CONFIG[s].tone}>
                    {statusCounts[s]} {ENROLLMENT_STATUS_CONFIG[s].label}
                  </Badge>
                ) : null,
              )}
            </div>
          </div>
          <CardDescription>
            {enrollmentRows.length} prospect{enrollmentRows.length !== 1 ? "s" : ""} enrolled
            {enrollmentRows.some((r) => r.status === "active") && " · refreshing automatically"}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {enrollments.isLoading && (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          )}

          {!enrollments.isLoading && enrollmentRows.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <UserX className="h-6 w-6" />
              No enrollments yet
            </div>
          )}

          {enrollmentRows.length > 0 && (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="border-b border-border">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Prospect</th>
                  <th className="px-4 py-2.5 font-medium">Company</th>
                  <th className="px-4 py-2.5 font-medium">Enrolled</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {enrollmentRows.map((e) => {
                  const cfg = ENROLLMENT_STATUS_CONFIG[e.status];
                  const name = e.prospectName?.trim() || e.email || "Unknown prospect";
                  return (
                    <tr key={e.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{name}</p>
                          {e.prospectTitle && (
                            <p className="truncate text-xs text-muted-foreground">{e.prospectTitle}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {e.companyName ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {new Date(e.enrolledAt).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={cfg.tone}>{cfg.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
