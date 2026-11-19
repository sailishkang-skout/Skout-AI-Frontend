"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Briefcase, CheckCircle2, Clock, ExternalLink, Loader2, TrendingUp, UserCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ApiError, formatQueryError, useAuthReady } from "@/lib/api-client";
import { formatCaptureDate, useResearchApi, type JobChange } from "@/lib/enrichment-research";
import { useWorkspaceRole } from "@/lib/workspace-role";
import { Pagination } from "./evidence-badge";

type Role = JobChange["from"];

const KIND_LABELS: Record<NonNullable<JobChange["kind"]>, string> = {
  new_company: "New company",
  new_role: "New role",
  left_company: "Left company",
};
const KIND_TONES: Record<NonNullable<JobChange["kind"]>, "info" | "success" | "warning"> = {
  new_company: "info",
  new_role: "success",
  left_company: "warning",
};

/** What kind of move it is; older APIs do not say, so it is read from the two roles. */
export function changeKind(change: Pick<JobChange, "kind" | "from" | "to">): NonNullable<JobChange["kind"]> {
  if (change.kind) return change.kind;
  const same = (a: string | null, b: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
  if (change.to.company && change.from.company && same(change.to.company, change.from.company)) return "new_role";
  return change.to.company ? "new_company" : "left_company";
}

/** One plain sentence about the change: the API's, or one built from the two roles. */
export function changeSummary(change: Pick<JobChange, "summary" | "fullName" | "kind" | "from" | "to">): string {
  if (change.summary) return change.summary;
  const who = change.fullName ?? "This person";
  const kind = changeKind(change);
  if (kind === "new_role") return `${who} has a new role at ${change.to.company}: ${change.from.title ?? "previous role"} → ${change.to.title ?? "new role"}.`;
  if (kind === "left_company") return `${who} no longer lists ${change.from.company ?? "their employer"} as a current employer.`;
  const joined = `${who} joined ${change.to.company}${change.to.title ? ` as ${change.to.title}` : ""}`;
  return change.from.company ? `${joined}, after ${roleLine(change.from)}.` : `${joined}. The previous employer was not captured.`;
}

const roleLine = (role: Role) => (role.title && role.company ? `${role.title} at ${role.company}` : role.company ?? role.title ?? "");

function RoleBox({ label, role, emphasis }: { label: string; role: Role; emphasis?: boolean }) {
  return (
    <div className={`min-w-0 flex-1 rounded-lg border px-3 py-2 ${emphasis ? "border-primary/30 bg-primary/5" : "bg-muted/30"}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {role.company || role.title ? (
        <>
          <div className="truncate text-sm font-medium">{role.title ?? "Title not captured"}</div>
          <div className="truncate text-sm text-muted-foreground">{role.company ?? "Company not captured"}</div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground">Not captured</div>
      )}
    </div>
  );
}

/** One detected job change. `onReview` is omitted for people who cannot mark it reviewed. */
export function JobChangeRow({ change, onReview, reviewing }: { change: JobChange; onReview?: () => void; reviewing?: boolean }) {
  const kind = changeKind(change);
  const name = change.fullName ?? "Unknown person";
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary" aria-hidden="true">
              {name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/enrichment/people/${change.prospectId}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                  {name}
                </Link>
                <Badge tone={KIND_TONES[kind]}>{KIND_LABELS[kind]}</Badge>
              </div>
              {change.headline && <p className="truncate text-xs text-muted-foreground">{change.headline}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {change.requiresReview ? (
              <Badge tone="warning">Needs review</Badge>
            ) : (
              <Badge tone="muted">Reviewed {formatCaptureDate(change.reviewedAt)}</Badge>
            )}
            {change.requiresReview && onReview && (
              <Button variant="outline" disabled={reviewing} onClick={onReview}>
                {reviewing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                Mark reviewed
              </Button>
            )}
          </div>
        </div>

        <p className="text-sm">{changeSummary(change)}</p>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <RoleBox label="Before" role={change.from} />
          <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
          <RoleBox label="Now" role={change.to} emphasis />
        </div>

        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <dt className="sr-only">Detected</dt>
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <dd>Detected {formatCaptureDate(change.detectedAt)}</dd>
          </div>
          {change.startedAt && (
            <div className="flex items-center gap-1">
              <dt className="sr-only">Started</dt>
              <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
              <dd>In the new role since {change.startedAt}</dd>
            </div>
          )}
          <div className="flex items-center gap-1">
            <dt className="sr-only">How it was found</dt>
            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <dd>
              {change.detectedBy === "work_history"
                ? "Found in their LinkedIn work history (moved in the last 90 days)"
                : "Found by comparing two captures of their profile"}
            </dd>
          </div>
          {change.sourceUrl && (
            <div className="flex items-center gap-1">
              <dt className="sr-only">Source</dt>
              <dd>
                <a href={change.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  LinkedIn profile <ExternalLink className="h-3 w-3" />
                </a>
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

const STATUS_TABS = [
  { value: "pending", label: "Needs review" },
  { value: "reviewed", label: "Reviewed" },
  { value: "all", label: "All" },
] as const;

export function JobChanges() {
  const api = useResearchApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { hasPermission } = useWorkspaceRole();
  const [status, setStatus] = useState<"pending" | "reviewed" | "all">("pending");
  const [page, setPage] = useState(1);

  const feed = useQuery({
    queryKey: ["enrichment-research", "job-changes", status, page],
    queryFn: () => api.jobChanges({ status, page }),
    enabled: authReady,
    placeholderData: keepPreviousData,
  });
  const review = useMutation({
    mutationFn: (id: string) => api.reviewJobChange(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enrichment-research"] }),
  });
  const forbidden = feed.error instanceof ApiError && feed.error.status === 403;
  const rows = feed.data?.jobChanges ?? [];
  const counts = feed.data?.counts;
  // Deduplicate job changes: keep only unique entries per person per detected time
  const seen = new Set<string>();
  const uniqueRows = rows.filter((change) => {
    const key = `${change.prospectId}-${new Date(change.detectedAt).getTime()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <PageShell>
      <PageHeader
        title="Job changes"
        description="People in your workspace who moved to a new company or a new role. Review each one before you update their sequences."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Needs review", value: counts?.pending, icon: <TrendingUp className="h-4 w-4 text-amber-600" aria-hidden="true" /> },
          { label: "Found in the last 7 days", value: counts?.lastSevenDays, icon: <Clock className="h-4 w-4 text-primary" aria-hidden="true" /> },
          { label: "Reviewed", value: counts?.reviewed, icon: <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" /> },
        ].map((tile) => (
          <Card key={tile.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {tile.icon}
                {tile.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums" aria-label={`${tile.label}: ${tile.value ?? "loading"}`}>
                {tile.value === undefined ? <Skeleton className="h-7 w-10" /> : tile.value.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div role="tablist" aria-label="Review status" className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              status === tab.value ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-accent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        A job change is a prompt to review the person. Skout does not message anyone or change a sequence enrollment because of one.
      </p>

      {review.isError && (
        <Alert variant="warning" dismissible>
          {formatQueryError(review.error, "Could not mark the change reviewed.")}
        </Alert>
      )}
      {feed.isError ? (
        <Alert variant={forbidden ? "warning" : "error"} onRetry={forbidden ? undefined : () => feed.refetch()}>
          {forbidden ? "You don't have permission to view enrichment data. Ask a workspace admin." : formatQueryError(feed.error, "Could not load job changes.")}
        </Alert>
      ) : feed.isLoading ? (
        <div className="space-y-2" aria-label="Loading job changes">
          <Skeleton className="h-36 w-full rounded-lg" />
          <Skeleton className="h-36 w-full rounded-lg" />
        </div>
      ) : uniqueRows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="font-medium">{status === "pending" ? "Nothing to review" : "No job changes"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A job change appears when a profile is captured again with a different current company or role, or when the work
              history shows a move in the last 90 days.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {uniqueRows.map((change) => (
            <JobChangeRow
              key={change.id}
              change={change}
              reviewing={review.isPending && review.variables === change.id}
              onReview={hasPermission("enrichment:capture") ? () => review.mutate(change.id) : undefined}
            />
          ))}
          <Pagination page={feed.data!.page} pageSize={feed.data!.pageSize} total={feed.data!.total} onPage={setPage} />
        </div>
      )}
    </PageShell>
  );
}