"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Download, Loader2, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ApiError, formatQueryError, useAuthReady } from "@/lib/api-client";
import { downloadBlob, useResearchApi, type CompanySummary } from "@/lib/enrichment-research";
import { useWorkspaceRole } from "@/lib/workspace-role";
import { Pagination } from "./evidence-badge";
import { AddLinkedinUrlDialog } from "./people-list";
import { ResultsBar, SortHeader, StatGrid, sortRows, type SortDirection } from "./list-ui";

export function CompaniesList() {
  const api = useResearchApi();
  const authReady = useAuthReady();
  const { hasPermission } = useWorkspaceRole();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [sort, setSort] = useState<{ key: "name" | "verified" | "candidates" | "roles"; direction: SortDirection }>({ key: "name", direction: "asc" });

  const companies = useQuery({
    queryKey: ["enrichment-research", "companies", q, page],
    queryFn: () => api.companies({ q, page }),
    enabled: authReady,
    placeholderData: keepPreviousData,
  });
  const overview = useQuery({ queryKey: ["enrichment-research", "overview"], queryFn: api.overview, enabled: authReady });
  const exportCsv = useMutation({
    mutationFn: () => api.exportCsv("companies"),
    onSuccess: (blob) => downloadBlob(blob, "skout-companies.csv"),
  });
  const forbidden = companies.error instanceof ApiError && companies.error.status === 403;
  const rows = useMemo(() => {
    const list = companies.data?.companies ?? [];
    const key = {
      name: (row: CompanySummary) => row.name,
      verified: (row: CompanySummary) => row.verifiedEmployees,
      candidates: (row: CompanySummary) => row.discoveryCandidates,
      roles: (row: CompanySummary) => row.openRoles ?? 0,
    }[sort.key];
    return sortRows(list, key, sort.direction);
  }, [companies.data, sort]);
  const toggleSort = (key: "name" | "verified" | "candidates" | "roles") =>
    setSort((previous) => ({ key, direction: previous.key === key && previous.direction === "asc" ? "desc" : key === "name" ? "asc" : "desc" }));

  return (
    <PageShell>
      <PageHeader
        title="Companies"
        description="Companies in this workspace, with employees verified from their own profile counted separately from discovered candidates."
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
          {formatQueryError(exportCsv.error, "Could not export companies.")}
        </Alert>
      )}
      {!overview.isError && (
        <StatGrid
          loading={overview.isLoading}
          items={[
            { label: "Companies", value: overview.data?.companies.total ?? 0 },
            { label: "Verified employees", value: overview.data?.people.verifiedEmployment ?? 0, tone: "success", note: "Across all companies" },
            { label: "Discovered candidates", value: overview.data?.people.discoveryCandidates ?? 0, tone: "warning", note: "Across all companies" },
            { label: "Captures, last 7 days", value: overview.data?.captures.runsLast7Days ?? 0, note: `${(overview.data?.captures.leadsLast7Days ?? 0).toLocaleString()} leads` },
          ]}
        />
      )}
      <Input
        className="max-w-md"
        aria-label="Search companies"
        placeholder="Search name, domain or industry"
        value={q}
        onChange={(event) => {
          setQ(event.target.value);
          setPage(1);
        }}
      />
      {companies.isError ? (
        <Alert variant={forbidden ? "warning" : "error"} onRetry={forbidden ? undefined : () => companies.refetch()}>
          {forbidden ? "You don't have permission to view enrichment data. Ask a workspace admin." : formatQueryError(companies.error, "Could not load companies.")}
        </Alert>
      ) : companies.isLoading ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="font-medium">No companies match</p>
            <p className="mt-1 text-sm text-muted-foreground">Capture a LinkedIn company page with the Skout extension, or change the search.</p>
            {q && (
              <Button variant="outline" className="mt-4" onClick={() => setQ("")}>
                Clear search
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <ResultsBar shown={rows.length} total={companies.data!.total} noun="companies" filtered={Boolean(q)} onClear={() => { setQ(""); setPage(1); }}>
            {companies.isFetching && <Loader2 className="h-3 w-3 animate-spin" aria-label="Updating" />}
          </ResultsBar>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <SortHeader label="Company" active={sort.key === "name"} direction={sort.direction} onSort={() => toggleSort("name")} />
                  <th className="px-4 py-3 font-medium uppercase tracking-wide">Industry</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide">Location</th>
                  <SortHeader label="Verified" active={sort.key === "verified"} direction={sort.direction} onSort={() => toggleSort("verified")} />
                  <SortHeader label="Candidates" active={sort.key === "candidates"} direction={sort.direction} onSort={() => toggleSort("candidates")} />
                  <SortHeader label="Open roles" active={sort.key === "roles"} direction={sort.direction} onSort={() => toggleSort("roles")} />
                  <th className="px-4 py-3 text-right font-medium uppercase tracking-wide">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((company) => (
                  <tr key={company.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/enrichment/companies/${company.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                        {company.name}
                      </Link>
                      <p className="max-w-[16rem] truncate text-xs text-muted-foreground">{company.domain ?? "No domain captured"}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{company.industry ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{company.location ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone="success">{company.verifiedEmployees} verified</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="warning">{company.discoveryCandidates} candidates</Badge>
                    </td>
                    <td className="px-4 py-3">{company.openRoles !== undefined ? <Badge tone="info">{company.openRoles} open roles</Badge> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-right text-xs font-medium">
                      <Link href={`/enrichment/companies/${company.id}`} className="text-primary underline-offset-4 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Sorting orders the companies on this page.</p>
          <Pagination page={companies.data!.page} pageSize={companies.data!.pageSize} total={companies.data!.total} onPage={setPage} />
        </div>
      )}
      <AddLinkedinUrlDialog open={adding} onClose={() => setAdding(false)} />
    </PageShell>
  );
}
