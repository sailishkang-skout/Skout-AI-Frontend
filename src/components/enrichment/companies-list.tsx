"use client";

import { useState } from "react";
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
import { downloadBlob, useResearchApi } from "@/lib/enrichment-research";
import { useWorkspaceRole } from "@/lib/workspace-role";
import { Pagination } from "./evidence-badge";
import { AddLinkedinUrlDialog } from "./people-list";

export function CompaniesList() {
  const api = useResearchApi();
  const authReady = useAuthReady();
  const { hasPermission } = useWorkspaceRole();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);

  const companies = useQuery({
    queryKey: ["enrichment-research", "companies", q, page],
    queryFn: () => api.companies({ q, page }),
    enabled: authReady,
    placeholderData: keepPreviousData,
  });
  const exportCsv = useMutation({
    mutationFn: () => api.exportCsv("companies"),
    onSuccess: (blob) => downloadBlob(blob, "skout-companies.csv"),
  });
  const forbidden = companies.error instanceof ApiError && companies.error.status === 403;
  const rows = companies.data?.companies ?? [];

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
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((company) => (
            <Card key={company.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link href={`/enrichment/companies/${company.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {company.name}
                  </Link>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {[company.domain, company.industry, company.location].filter(Boolean).join(" · ") || "No details captured"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge tone="success">{company.verifiedEmployees} verified</Badge>
                  <Badge tone="warning">{company.discoveryCandidates} candidates</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          <Pagination page={companies.data!.page} pageSize={companies.data!.pageSize} total={companies.data!.total} onPage={setPage} />
        </div>
      )}
      <AddLinkedinUrlDialog open={adding} onClose={() => setAdding(false)} />
    </PageShell>
  );
}
