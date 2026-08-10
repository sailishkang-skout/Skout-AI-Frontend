"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { CompanyFormSheet } from "@/components/crm/company-form-sheet";
import { FieldSourceBadge } from "@/components/crm/field-source-badge";
import { ContactFormSheet } from "@/components/crm/contact-form-sheet";
import { DealFormSheet } from "@/components/crm/deal-form-sheet";
import { RelatedItemRow, RelatedListPanel } from "@/components/crm/related-list-panel";
import { useCompaniesApi } from "@/lib/crm/companies";
import { useContactsApi } from "@/lib/crm/contacts";
import { useDealsApi } from "@/lib/crm/deals";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { useWorkspaceRole, isForbiddenError } from "@/lib/workspace-role";
import { dealStatusTone, formatMoney } from "@/lib/crm-display";

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const companiesApi = useCompaniesApi();
  const contactsApi = useContactsApi();
  const dealsApi = useDealsApi();
  const authReady = useAuthReady();
  const { canDelete } = useWorkspaceRole();

  const [editOpen, setEditOpen] = useState(false);
  const [contactSheetOpen, setContactSheetOpen] = useState(false);
  const [dealSheetOpen, setDealSheetOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const company = useQuery({
    queryKey: ["crm", "companies", id],
    queryFn: () => companiesApi.get(id),
    enabled: authReady && Boolean(id),
  });

  const contacts = useQuery({
    queryKey: ["crm", "contacts", { companyId: id }],
    queryFn: () => contactsApi.list({ companyId: id, limit: 50 }),
    enabled: authReady && Boolean(id),
  });

  // GET /deals has no companyId filter server-side — fetch and filter client-side.
  const deals = useQuery({
    queryKey: ["crm", "deals"],
    queryFn: () => dealsApi.list({ limit: 100 }),
    enabled: authReady && Boolean(id),
  });
  const companyDeals = (deals.data?.data ?? []).filter((d) => d.companyId === id);

  const remove = useMutation({
    mutationFn: () => companiesApi.remove(id),
    onSuccess: () => router.push("/crm/companies"),
    onError: (err) => {
      setDeleteError(
        isForbiddenError(err)
          ? "You don't have permission to delete this — ask a workspace admin or owner."
          : formatQueryError(err, "Could not delete this company.")
      );
    },
  });

  if (company.isLoading) {
    return (
      <PageShell data-testid="page-crm-company-detail">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </PageShell>
    );
  }

  if (company.isError || !company.data) {
    return (
      <PageShell data-testid="page-crm-company-detail">
        <Alert variant="error" onRetry={() => company.refetch()}>
          {formatQueryError(company.error, "Could not load this company.")}
        </Alert>
      </PageShell>
    );
  }

  const data = company.data;

  return (
    <PageShell data-testid="page-crm-company-detail">
      <Link href="/crm/companies" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to companies
      </Link>

      {deleteError && <Alert variant="warning" dismissible>{deleteError}</Alert>}

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{data.name}</h1>
              {data.domain && <p className="text-sm text-muted-foreground">{data.domain}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              {canDelete && (
                <Button size="sm" variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
                  {remove.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Delete
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
            {data.industry && (
              <span className="flex items-center gap-1.5">
                {data.industry}
                <FieldSourceBadge field="industry" fieldSources={data.fieldSources} />
              </span>
            )}
            {data.employeeCount != null && (
              <span className="flex items-center gap-1.5">
                {data.employeeCount} employees
                <FieldSourceBadge field="employeeCount" fieldSources={data.fieldSources} />
              </span>
            )}
            {data.revenue != null && <span>{formatMoney(data.revenue)}</span>}
            {data.location && (
              <span className="flex items-center gap-1.5">
                {data.location}
                <FieldSourceBadge field="location" fieldSources={data.fieldSources} />
              </span>
            )}
          </div>
          <Badge tone={data.status === "customer" ? "success" : data.status === "churned" ? "danger" : "default"}>
            {data.status}
          </Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <RelatedListPanel
          title="Contacts"
          items={contacts.data?.data}
          loading={contacts.isLoading}
          emptyLabel="No contacts at this company yet."
          onAdd={() => setContactSheetOpen(true)}
          addLabel="Add contact"
          renderItem={(contact) => (
            <RelatedItemRow href={`/crm/contacts/${contact.id}`}>
              <span className="truncate">
                {contact.firstName} {contact.lastName}
              </span>
              {contact.title && <span className="shrink-0 text-xs text-muted-foreground">{contact.title}</span>}
            </RelatedItemRow>
          )}
        />
        <RelatedListPanel
          title="Deals"
          items={companyDeals}
          loading={deals.isLoading}
          emptyLabel="No deals for this company yet."
          onAdd={() => setDealSheetOpen(true)}
          addLabel="Add deal"
          renderItem={(deal) => (
            <RelatedItemRow href={`/crm/deals/${deal.id}`}>
              <span className="truncate">{deal.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                {formatMoney(deal.amount, deal.currency)}
                <Badge tone={dealStatusTone(deal.status)}>{deal.status}</Badge>
              </span>
            </RelatedItemRow>
          )}
        />
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Activity</h2>
          <ActivityTimeline entityType="company" entityId={id} />
        </CardContent>
      </Card>

      <CompanyFormSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        company={data}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["crm", "companies", id] })}
      />
      <ContactFormSheet
        open={contactSheetOpen}
        onClose={() => setContactSheetOpen(false)}
        defaultCompanyId={id}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["crm", "contacts", { companyId: id }] })}
      />
      <DealFormSheet
        open={dealSheetOpen}
        onClose={() => setDealSheetOpen(false)}
        defaultCompanyId={id}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["crm", "deals"] })}
      />
    </PageShell>
  );
}
