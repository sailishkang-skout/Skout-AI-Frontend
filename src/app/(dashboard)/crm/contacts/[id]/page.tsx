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
import { CallButton } from "@/components/crm/call-button";
import { NextBestActionCard } from "@/components/crm/next-best-action-card";
import { ContactFormSheet } from "@/components/crm/contact-form-sheet";
import { DealFormSheet } from "@/components/crm/deal-form-sheet";
import { RelatedItemRow, RelatedListPanel } from "@/components/crm/related-list-panel";
import { useCompaniesApi } from "@/lib/crm/companies";
import { useContactsApi } from "@/lib/crm/contacts";
import { useDealsApi } from "@/lib/crm/deals";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { useWorkspaceRole, isForbiddenError } from "@/lib/workspace-role";
import { dealStatusTone, formatMoney } from "@/lib/crm-display";

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const contactsApi = useContactsApi();
  const companiesApi = useCompaniesApi();
  const dealsApi = useDealsApi();
  const authReady = useAuthReady();
  const { canDelete } = useWorkspaceRole();

  const [editOpen, setEditOpen] = useState(false);
  const [dealSheetOpen, setDealSheetOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const contact = useQuery({
    queryKey: ["crm", "contacts", id],
    queryFn: () => contactsApi.get(id),
    enabled: authReady && Boolean(id),
  });

  const company = useQuery({
    queryKey: ["crm", "companies", contact.data?.companyId],
    queryFn: () => companiesApi.get(contact.data!.companyId!),
    enabled: authReady && Boolean(contact.data?.companyId),
  });

  const deals = useQuery({
    queryKey: ["crm", "deals"],
    queryFn: () => dealsApi.list({ limit: 100 }),
    enabled: authReady && Boolean(contact.data?.companyId),
  });
  const relatedDeals = (deals.data?.data ?? []).filter((d) => d.companyId === contact.data?.companyId);

  const remove = useMutation({
    mutationFn: () => contactsApi.remove(id),
    onSuccess: () => router.push("/crm/contacts"),
    onError: (err) => {
      setDeleteError(
        isForbiddenError(err)
          ? "You don't have permission to delete this — ask a workspace admin or owner."
          : formatQueryError(err, "Could not delete this contact.")
      );
    },
  });

  if (contact.isLoading) {
    return (
      <PageShell data-testid="page-crm-contact-detail">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </PageShell>
    );
  }

  if (contact.isError || !contact.data) {
    return (
      <PageShell data-testid="page-crm-contact-detail">
        <Alert variant="error" onRetry={() => contact.refetch()}>
          {formatQueryError(contact.error, "Could not load this contact.")}
        </Alert>
      </PageShell>
    );
  }

  const data = contact.data;

  return (
    <PageShell data-testid="page-crm-contact-detail">
      <Link href="/crm/contacts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to contacts
      </Link>

      {deleteError && <Alert variant="warning" dismissible>{deleteError}</Alert>}

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">
                {data.firstName} {data.lastName}
              </h1>
              {data.title && <p className="text-sm text-muted-foreground">{data.title}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <CallButton phone={data.phone} contactId={data.id} />
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
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            {data.email && <span>{data.email}</span>}
            {data.phone && <span>{data.phone}</span>}
          </div>
          <Badge tone="info">{data.lifecycleStage.toUpperCase()}</Badge>
        </CardContent>
      </Card>

      <NextBestActionCard entityType="contact" entityId={id} />

      {company.data && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Company</p>
            <Link href={`/crm/companies/${company.data.id}`} className="font-medium hover:underline">
              {company.data.name}
            </Link>
          </CardContent>
        </Card>
      )}

      <RelatedListPanel
        title="Deals"
        items={relatedDeals}
        loading={deals.isLoading}
        emptyLabel="No deals involving this contact's company yet."
        onAdd={data.companyId ? () => setDealSheetOpen(true) : undefined}
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

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Activity</h2>
          <ActivityTimeline entityType="contact" entityId={id} />
        </CardContent>
      </Card>

      <ContactFormSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        contact={data}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["crm", "contacts", id] })}
      />
      {data.companyId && (
        <DealFormSheet
          open={dealSheetOpen}
          onClose={() => setDealSheetOpen(false)}
          defaultCompanyId={data.companyId}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["crm", "deals"] })}
        />
      )}
    </PageShell>
  );
}
