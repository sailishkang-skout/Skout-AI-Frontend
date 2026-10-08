"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Download, Loader2, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ApiError, formatQueryError, useAuthReady } from "@/lib/api-client";
import { downloadBlob, formatCaptureDate, useResearchApi, type PeopleFilters } from "@/lib/enrichment-research";
import { useWorkspaceRole } from "@/lib/workspace-role";
import { EmploymentBadge, IdentityBadge, Pagination } from "./evidence-badge";

export function AddLinkedinUrlDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const api = useResearchApi();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const add = useMutation({
    mutationFn: () => api.addLinkedinUrl(url.trim()),
    onSuccess: (result) => {
      onClose();
      setUrl("");
      router.push(result.kind === "person" ? `/enrichment/people/${result.prospectId}` : `/enrichment/companies/${result.companyId}`);
    },
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a LinkedIn URL"
      description="Registers a public profile (/in/…) or company (/company/…) URL so you can capture it with the extension. Nothing is fetched from LinkedIn and no details are filled in until you capture the page."
    >
      <div className="space-y-3">
        <Input aria-label="LinkedIn URL" placeholder="https://www.linkedin.com/in/…" value={url} onChange={(event) => setUrl(event.target.value)} />
        {add.isError && <p className="text-sm text-red-700 dark:text-red-300">{formatQueryError(add.error, "Could not add this URL.")}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!url.trim() || add.isPending} onClick={() => add.mutate()}>
            {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Add URL
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function PeopleList() {
  const api = useResearchApi();
  const authReady = useAuthReady();
  const { hasPermission } = useWorkspaceRole();
  const [filters, setFilters] = useState<PeopleFilters>({ page: 1 });
  const [adding, setAdding] = useState(false);
  const update = (patch: PeopleFilters) => setFilters((previous) => ({ ...previous, page: 1, ...patch }));

  const people = useQuery({
    queryKey: ["enrichment-research", "people", filters],
    queryFn: () => api.people(filters),
    enabled: authReady,
    placeholderData: keepPreviousData,
  });
  const exportCsv = useMutation({
    mutationFn: () => api.exportCsv("people"),
    onSuccess: (blob) => downloadBlob(blob, "skout-people.csv"),
  });
  const forbidden = people.error instanceof ApiError && people.error.status === 403;
  const rows = people.data?.people ?? [];

  return (
    <PageShell>
      <PageHeader
        title="People"
        description="People captured into this workspace, with where each one came from and whether their employer is verified."
        actions={
          <div className="flex gap-2">
            {hasPermission("enrichment:capture") && (
              <Button variant="outline" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" />
                Add LinkedIn URL
              </Button>
            )}
            {hasPermission("enrichment:export") && (
              <Button variant="outline" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
                {exportCsv.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export CSV
              </Button>
            )}
          </div>
        }
      />

      {exportCsv.isError && (
        <Alert variant="warning" dismissible>
          {formatQueryError(exportCsv.error, "Could not export people.")}
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Input aria-label="Search people" placeholder="Search name, title or company" value={filters.q ?? ""} onChange={(event) => update({ q: event.target.value })} />
        <Select aria-label="Employment" value={filters.state ?? ""} onChange={(event) => update({ state: (event.target.value || undefined) as PeopleFilters["state"] })}>
          <option value="">Verified and candidates</option>
          <option value="verified">Verified employees</option>
          <option value="candidate">Discovered candidates</option>
        </Select>
        <Select aria-label="LinkedIn identity" value={filters.identity ?? ""} onChange={(event) => update({ identity: (event.target.value || undefined) as PeopleFilters["identity"] })}>
          <option value="">Any LinkedIn identity</option>
          <option value="public_profile">Public profile</option>
          <option value="sales_lead">Sales Navigator lead only</option>
        </Select>
        <Input aria-label="Department" placeholder="Department, e.g. Sales" value={filters.department ?? ""} onChange={(event) => update({ department: event.target.value })} />
      </div>

      {people.isError ? (
        <Alert variant={forbidden ? "warning" : "error"} onRetry={forbidden ? undefined : () => people.refetch()}>
          {forbidden ? "You don't have permission to view enrichment data. Ask a workspace admin." : formatQueryError(people.error, "Could not load people.")}
        </Alert>
      ) : people.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="font-medium">No people match</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Capture a LinkedIn profile, company or Sales Navigator search with the Skout extension, or change the filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((person) => (
            <Card key={person.prospectId}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link href={`/enrichment/people/${person.prospectId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {person.fullName ?? "Not captured yet"}
                  </Link>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {[person.title ?? person.headline, person.companyName, person.location].filter(Boolean).join(" · ") || "No details captured"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Captured {formatCaptureDate(person.capturedAt)}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <EmploymentBadge state={person.employmentState} />
                  <IdentityBadge identity={person.identity} />
                </div>
              </CardContent>
            </Card>
          ))}
          <Pagination page={people.data!.page} pageSize={people.data!.pageSize} total={people.data!.total} onPage={(page) => setFilters((previous) => ({ ...previous, page }))} />
        </div>
      )}

      <AddLinkedinUrlDialog open={adding} onClose={() => setAdding(false)} />
    </PageShell>
  );
}
