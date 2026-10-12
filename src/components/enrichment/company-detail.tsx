"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ApiError, formatQueryError, useAuthReady } from "@/lib/api-client";
import { downloadBlob, factsByAttribute, formatCaptureDate, useResearchApi, type PeopleFilters } from "@/lib/enrichment-research";
import { useWorkspaceRole } from "@/lib/workspace-role";
import { EvidenceBadge, Fact, IdentityBadge, Pagination } from "./evidence-badge";

type Group = "verified" | "candidates";

const GROUP_COPY: Record<Group, { title: string; note: string; empty: string }> = {
  verified: {
    title: "Verified employees",
    note: "Confirmed by a capture of the person's own public profile.",
    empty: "No verified employees yet. Capture a candidate's public profile to verify where they work.",
  },
  candidates: {
    title: "Discovered candidates",
    note: "Seen on LinkedIn people results or Sales Navigator cards. These can include former employees, affiliates and people at similarly named companies. Open each public profile to verify.",
    empty: "No discovered candidates match.",
  },
};

function CompanyPeople({ companyId, group }: { companyId: string; group: Group }) {
  const api = useResearchApi();
  const authReady = useAuthReady();
  const [filters, setFilters] = useState<PeopleFilters>({ page: 1 });
  const update = (patch: PeopleFilters) => setFilters((previous) => ({ ...previous, page: 1, ...patch }));
  const people = useQuery({
    queryKey: ["enrichment-research", "company-people", companyId, group, filters],
    queryFn: () => api.companyPeople(companyId, { ...filters, group }),
    enabled: authReady,
    placeholderData: keepPreviousData,
  });
  const copy = GROUP_COPY[group];
  const rows = people.data?.people ?? [];

  return (
    <Card data-testid={`company-people-${group}`}>
      <CardContent className="space-y-3 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">{copy.title}</h2>
          <Badge tone={group === "verified" ? "success" : "warning"}>{people.data?.total ?? 0}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{copy.note}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input aria-label={`Search ${copy.title}`} placeholder="Name or title" value={filters.q ?? ""} onChange={(event) => update({ q: event.target.value })} />
          <Input aria-label={`Department filter for ${copy.title}`} placeholder="Department, e.g. Sales" value={filters.department ?? ""} onChange={(event) => update({ department: event.target.value })} />
          <Input aria-label={`Seniority filter for ${copy.title}`} placeholder="Seniority, e.g. Director" value={filters.seniority ?? ""} onChange={(event) => update({ seniority: event.target.value })} />
        </div>
        {people.isError ? (
          <Alert variant="error" onRetry={() => people.refetch()}>
            {formatQueryError(people.error, "Could not load people for this company.")}
          </Alert>
        ) : people.isLoading ? (
          <Skeleton className="h-16 w-full rounded-lg" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.empty}</p>
        ) : (
          <>
            <ul className="divide-y text-sm">
              {rows.map((person) => (
                <li key={person.prospectId} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <Link href={`/enrichment/people/${person.prospectId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                      {person.fullName ?? "Not captured yet"}
                    </Link>
                    <p className="truncate text-muted-foreground">{person.title ?? person.headline ?? "No title captured"}</p>
                    <p className="text-xs text-muted-foreground">
                      {group === "candidates" && person.discoverySource
                        ? `${person.discoverySource.replace(/[-_]/g, " ")} · seen ${formatCaptureDate(person.discoveredAt)}`
                        : `Profile captured ${formatCaptureDate(person.capturedAt)}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <IdentityBadge identity={person.identity} />
                    {person.linkedinUrl && (
                      <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        Open profile <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={people.data!.page} pageSize={people.data!.pageSize} total={people.data!.total} onPage={(page) => setFilters((previous) => ({ ...previous, page }))} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function CompanyDetailView({ companyId }: { companyId: string }) {
  const api = useResearchApi();
  const authReady = useAuthReady();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useWorkspaceRole();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const detail = useQuery({
    queryKey: ["enrichment-research", "company", companyId],
    queryFn: () => api.company(companyId),
    enabled: authReady,
  });
  const csv = useMutation({
    mutationFn: () => api.companyPeopleCsv(companyId),
    onSuccess: (blob) => downloadBlob(blob, `company-${companyId.slice(0, 8)}-people.csv`),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteCompany(companyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enrichment-research"] });
      router.push("/enrichment/companies");
    },
  });

  if (detail.isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </PageShell>
    );
  }
  if (detail.isError || !detail.data) {
    const missing = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <PageShell>
        <PageHeader title="Company" description="" />
        <Alert variant={missing ? "warning" : "error"} onRetry={missing ? undefined : () => detail.refetch()}>
          {missing ? "This company is not in the workspace. It may have been deleted." : formatQueryError(detail.error, "Could not load this company.")}
        </Alert>
        <Link href="/enrichment/companies" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Back to companies
        </Link>
      </PageShell>
    );
  }

  const company = detail.data.company;
  const facts = factsByAttribute(company.facts);
  const mutationError = csv.error ?? remove.error;

  return (
    <PageShell>
      <PageHeader
        title={company.name}
        description={company.capture.tagline ?? ""}
        actions={
          <div className="flex flex-wrap gap-2">
            {hasPermission("enrichment:export") && (
              <Button variant="outline" disabled={csv.isPending} onClick={() => csv.mutate()}>
                <Download className="h-4 w-4" />
                People CSV
              </Button>
            )}
            {hasPermission("enrichment:delete") && (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        }
      />

      {mutationError && (
        <Alert variant="warning" dismissible>
          {mutationError instanceof ApiError && mutationError.status === 403
            ? "You don't have permission for this action. Ask a workspace admin."
            : formatQueryError(mutationError, "The action could not be completed.")}
        </Alert>
      )}
      {company.freshness.stale && (
        <Alert variant="warning">
          This company was last captured {formatCaptureDate(company.freshness.capturedAt)}, more than 90 days ago. Capture the company page again before relying on it.
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="muted">Last captured {formatCaptureDate(company.freshness.capturedAt)}</Badge>
            {company.linkedinUrl && (
              <a href={company.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
                Open LinkedIn company page <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Name" fact={facts.name}>{company.name}</Fact>
            <Fact label="Website" fact={facts.website ?? facts.domain}>{company.capture.website ?? company.domain ?? "Not captured"}</Fact>
            <Fact label="Industry" fact={facts.industry}>{company.industry ?? "Not captured"}</Fact>
            <Fact label="Headquarters" fact={facts.headquarter}>{company.capture.headquarter ?? company.location ?? "Not captured"}</Fact>
            <Fact label="Company size" fact={facts.size}>{company.capture.size ?? "Not captured"}</Fact>
            <Fact label="Members shown on LinkedIn" fact={facts.employeesOnLi ?? facts.peopleStats}>
              {company.people.visibleAssociatedMembers ?? "Not captured"}
              <span className="block text-xs text-muted-foreground">The count LinkedIn displayed, not the number of records that can be captured.</span>
            </Fact>
          </dl>
          {company.capture.overview && (
            <div className="space-y-1">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Overview</h3>
              <p className="whitespace-pre-line text-sm">{company.capture.overview}</p>
              <EvidenceBadge fact={facts.overview} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
          <div className="space-y-1">
            <h2 className="font-semibold">Find more people by department</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              In Sales Navigator, set Current company to {company.name} and one Function at a time, then capture the results with the extension. Each run reads at most 10 pages or 250 leads; repeated searches merge by LinkedIn identity. New people appear below as discovered candidates.
            </p>
          </div>
          <Link href="/enrichment/capture" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Open the guided capture
          </Link>
        </CardContent>
      </Card>

      <CompanyPeople companyId={companyId} group="verified" />
      <CompanyPeople companyId={companyId} group="candidates" />

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="font-semibold">Captured evidence</h2>
          {company.evidence.length ? (
            <ul className="divide-y text-sm">
              {company.evidence.map((fact) => (
                <li key={fact.evidenceId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">{fact.attribute}</span>
                  <EvidenceBadge fact={fact} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No evidence recorded yet. Capture the LinkedIn company page with the extension.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="font-semibold">Change history</h2>
          {company.changes.length ? (
            <ul className="divide-y text-sm">
              {company.changes.map((change) => (
                <li key={change.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="font-medium">{change.field}</span>
                  <span className="text-muted-foreground">
                    {typeof change.oldValue === "string" || typeof change.oldValue === "number" ? `${change.oldValue} → ` : ""}
                    {typeof change.newValue === "string" || typeof change.newValue === "number" ? String(change.newValue) : "updated"}
                  </span>
                  <span className="text-xs text-muted-foreground">detected {formatCaptureDate(change.detectedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No changes detected between captures.</p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${company.name}?`}
        description="Removes the company with its captured evidence, snapshots, change history and candidate links. The people stay in the workspace without this employer. The deletion is recorded in the audit log."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete company
          </Button>
        </div>
      </Dialog>
    </PageShell>
  );
}
