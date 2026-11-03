"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Building2, Loader2, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyFormSheet } from "@/components/crm/company-form-sheet";
import { useCompaniesApi } from "@/lib/crm/companies";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { useWorkspaceRole, isForbiddenError } from "@/lib/workspace-role";

export default function CompaniesPage() {
  const queryClient = useQueryClient();
  const companiesApi = useCompaniesApi();
  const authReady = useAuthReady();
  const { canDelete } = useWorkspaceRole();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const companies = useQuery({
    queryKey: ["crm", "companies"],
    queryFn: () => companiesApi.list({ limit: 100 }),
    enabled: authReady,
  });

  const remove = useMutation({
    mutationFn: (id: string) => companiesApi.remove(id),
    onSuccess: () => {
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["crm", "companies"] });
    },
    onError: (err) => {
      setDeleteError(
        isForbiddenError(err)
          ? "You don't have permission to delete this — ask a workspace admin or owner."
          : formatQueryError(err, "Could not delete this company.")
      );
    },
  });

  const rows = companies.data?.data ?? [];

  return (
    <PageShell data-testid="page-crm-companies">
      <PageHeader
        title="Companies"
        description="Accounts your contacts and deals belong to."
        actions={
          <Button data-testid="create-company-button" onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4" />
            New company
          </Button>
        }
      />

      {companies.isError && (
        <Alert variant="error" onRetry={() => companies.refetch()}>
          {formatQueryError(companies.error, "Could not load companies.")}
        </Alert>
      )}
      {deleteError && (
        <Alert variant="warning" dismissible>
          {deleteError}
        </Alert>
      )}

      {companies.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="rounded-full bg-muted p-4">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium">No companies yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create your first company to start tracking contacts and deals.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((company) => (
            <Card key={company.id}>
              <CardContent className="flex items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <Link href={`/crm/companies/${company.id}`} className="hover:underline">
                    <p className="truncate font-medium">{company.name}</p>
                  </Link>
                  {company.domain && <p className="truncate text-xs text-muted-foreground">{company.domain}</p>}
                  {company.industry && <p className="mt-1 text-xs text-muted-foreground">{company.industry}</p>}
                  <Badge tone={company.status === "customer" ? "success" : company.status === "churned" ? "danger" : "default"} className="mt-2">
                    {company.status}
                  </Badge>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => remove.mutate(company.id)}
                    disabled={remove.isPending && remove.variables === company.id}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    aria-label={`Delete ${company.name}`}
                  >
                    {remove.isPending && remove.variables === company.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CompanyFormSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </PageShell>
  );
}
