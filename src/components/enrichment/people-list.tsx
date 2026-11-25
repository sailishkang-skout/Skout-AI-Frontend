"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Loader2, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ApiError, formatQueryError, useAuthReady } from "@/lib/api-client";
import { downloadBlob, formatCaptureDate, useResearchApi, type PeopleFilters, type PersonSummary } from "@/lib/enrichment-research";
import { parseLinkedinUrl } from "@/lib/linkedin-url";
import { useWorkspaceRole } from "@/lib/workspace-role";
import { EmploymentBadge, IdentityBadge, Pagination } from "./evidence-badge";
import { ResultsBar, SortHeader, StatGrid, sortRows, type SortDirection } from "./list-ui";

export function AddLinkedinUrlDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const api = useResearchApi();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const parsed = url.trim() ? parseLinkedinUrl(url) : null;
  const add = useMutation({
    mutationFn: () => {
      const clean = parseLinkedinUrl(url);
      if (!clean.ok) throw new Error(clean.reason);
      return api.addLinkedinUrl(clean.url);
    },
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
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (parsed?.ok && !add.isPending) add.mutate();
        }}
      >
        <Input aria-label="LinkedIn URL" placeholder="https://www.linkedin.com/in/… or …/company/…" value={url} onChange={(event) => { setUrl(event.target.value); add.reset(); }} />
        {parsed?.ok && (
          <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="url-detected">
            <Badge tone="success">{parsed.kind === "person" ? "Person" : "Company"}</Badge>
            <span className="break-all text-muted-foreground">{parsed.url}</span>
          </p>
        )}
        {parsed && !parsed.ok && <p className="text-sm text-red-700 dark:text-red-300" role="alert">{parsed.reason}</p>}
        {add.isError && <p className="text-sm text-red-700 dark:text-red-300" role="alert">{formatQueryError(add.error, "Could not add this URL.")}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!parsed?.ok || add.isPending}>
            {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Add URL
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function PeopleList() {
  const api = useResearchApi();
  const authReady = useAuthReady();
  const { hasPermission } = useWorkspaceRole();
  const [filters, setFilters] = useState<PeopleFilters>({ page: 1 });
  const [adding, setAdding] = useState(false);
  const [sort, setSort] = useState<{ key: "name" | "company" | "captured"; direction: SortDirection }>({ key: "captured", direction: "desc" });
  const update = (patch: PeopleFilters) => setFilters((previous) => ({ ...previous, page: 1, ...patch }));
  const filtered = Boolean(filters.q || filters.state || filters.identity || filters.department);

  const people = useQuery({
    queryKey: ["enrichment-research", "people", filters],
    queryFn: () => api.people(filters),
    enabled: authReady,
    placeholderData: keepPreviousData,
  });
  const overview = useQuery({ queryKey: ["enrichment-research", "overview"], queryFn: api.overview, enabled: authReady });
  const exportCsv = useMutation({
    mutationFn: () => api.exportCsv("people"),
    onSuccess: (blob) => downloadBlob(blob, "skout-people.csv"),
  });
  const forbidden = people.error instanceof ApiError && people.error.status === 403;
  const rows = useMemo(() => {
    const list = people.data?.people ?? [];
    const key = { name: (row: PersonSummary) => row.fullName, company: (row: PersonSummary) => row.companyName, captured: (row: PersonSummary) => new Date(row.capturedAt).getTime() }[sort.key];
    return sortRows(list, key, sort.direction);
  }, [people.data, sort]);
  const toggleSort = (key: "name" | "company" | "captured") => setSort((previous) => ({ key, direction: previous.key === key && previous.direction === "asc" ? "desc" : "asc" }));

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

      {!overview.isError && (
        <StatGrid
          loading={overview.isLoading}
          items={[
            { label: "People", value: overview.data?.people.total ?? 0 },
            { label: "Verified employees", value: overview.data?.people.verifiedEmployment ?? 0, tone: "success", note: "Employer confirmed from their own profile" },
            { label: "Discovered candidates", value: overview.data?.people.discoveryCandidates ?? 0, tone: "warning", note: "Seen on a company page or search" },
            { label: "Public profiles", value: overview.data?.people.publicProfiles ?? 0, note: `${(overview.data?.people.salesNavigatorOnly ?? 0).toLocaleString()} Sales Navigator only` },
          ]}
        />
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
            {filtered && (
              <Button variant="outline" className="mt-4" onClick={() => setFilters({ page: 1 })}>
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <ResultsBar shown={rows.length} total={people.data!.total} noun="people" filtered={filtered} onClear={() => setFilters({ page: 1 })}>
            {people.isFetching && <Loader2 className="h-3 w-3 animate-spin" aria-label="Updating" />}
          </ResultsBar>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <SortHeader label="Person" active={sort.key === "name"} direction={sort.direction} onSort={() => toggleSort("name")} />
                  <SortHeader label="Company" active={sort.key === "company"} direction={sort.direction} onSort={() => toggleSort("company")} />
                  <th className="px-4 py-3 font-medium uppercase tracking-wide">Location</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide">Status</th>
                  <SortHeader label="Captured" active={sort.key === "captured"} direction={sort.direction} onSort={() => toggleSort("captured")} />
                  <th className="px-4 py-3 text-right font-medium uppercase tracking-wide">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((person) => (
                  <tr key={person.prospectId} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/enrichment/people/${person.prospectId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                        {person.fullName ?? "Not captured yet"}
                      </Link>
                      <p className="max-w-[18rem] truncate text-xs text-muted-foreground">{person.title ?? person.headline ?? "No details captured"}</p>
                    </td>
                    <td className="px-4 py-3">{person.companyName ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{person.location ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <EmploymentBadge state={person.employmentState} />
                        <IdentityBadge identity={person.identity} />
                        {person.pendingCapture && <Badge tone="warning">Needs capture</Badge>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatCaptureDate(person.capturedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3 text-xs font-medium">
                        <Link href={`/enrichment/people/${person.prospectId}`} className="text-primary underline-offset-4 hover:underline">
                          View
                        </Link>
                        {person.linkedinUrl && (
                          <a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline" aria-label={`Open ${person.fullName ?? "profile"} on LinkedIn`}>
                            LinkedIn <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Sorting orders the people on this page.</p>
          <Pagination page={people.data!.page} pageSize={people.data!.pageSize} total={people.data!.total} onPage={(page) => setFilters((previous) => ({ ...previous, page }))} />
        </div>
      )}

      <AddLinkedinUrlDialog open={adding} onClose={() => setAdding(false)} />
    </PageShell>
  );
}
