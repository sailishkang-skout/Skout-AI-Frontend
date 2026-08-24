"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import {
  IDENTITY_MERGE_PROPOSALS_QUERY_KEY,
  useIdentityMergeApi,
} from "@/lib/identity-merge";
import { useCompaniesApi } from "@/lib/crm/companies";
import { useContactsApi } from "@/lib/crm/contacts";
import type { Company, Contact } from "@/types/crm";
import type { IdentityMergeProposal } from "@/types/api";

/**
 * §5.2 (Enterprise Completion Plan, Task 22) — review queue for pending identity-merge
 * proposals, against the API apps/api/src/routes/identity-merge.routes.ts already ships.
 *
 * Important, deliberate scope limit surfaced in the banner below: resolving a proposal here
 * (approve or reject) only records the decision and — on approve — a reversible merge event.
 * It does NOT itself merge the underlying company/contact records; that's documented as the
 * caller's responsibility in identity-merge.service.ts's own comment ("resolveMergeProposal
 * does not itself touch the underlying entity records"). No route exists yet to actually apply
 * a merge to CRM data, so this UI cannot silently promise something the backend doesn't do.
 */

const ENTITY_LABEL: Record<string, string> = {
  company: "Company",
  contact: "Contact",
};

function EntityPreview({ entityType, entityId }: { entityType: string; entityId: string }) {
  const companiesApi = useCompaniesApi();
  const contactsApi = useContactsApi();

  const isCompany = entityType === "company";
  const isContact = entityType === "contact";

  const companyQuery = useQuery({
    queryKey: ["identity-merge", "company", entityId],
    queryFn: () => companiesApi.get(entityId),
    enabled: isCompany,
  });
  const contactQuery = useQuery({
    queryKey: ["identity-merge", "contact", entityId],
    queryFn: () => contactsApi.get(entityId),
    enabled: isContact,
  });

  if (!isCompany && !isContact) {
    return (
      <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        {entityType} · {entityId}
        <br />
        No preview available for this entity type — only company and contact records can be
        previewed.
      </div>
    );
  }

  const query = isCompany ? companyQuery : contactQuery;

  if (query.isLoading) {
    return <Skeleton className="h-16 w-full rounded-md" />;
  }
  if (query.error || !query.data) {
    return (
      <div className="rounded-md border border-dashed border-red-300 px-3 py-2 text-xs text-red-700 dark:border-red-800/60 dark:text-red-300">
        Couldn&apos;t load this {ENTITY_LABEL[entityType]?.toLowerCase() ?? entityType} record
        (id {entityId}).
      </div>
    );
  }

  if (isCompany) {
    const company = query.data as Company;
    return (
      <div className="rounded-md border border-border px-3 py-2 text-sm">
        <p className="font-medium">{company.name}</p>
        <p className="text-xs text-muted-foreground">
          {company.domain ?? "no domain"}
          {company.location ? ` · ${company.location}` : ""}
        </p>
      </div>
    );
  }

  const contact = query.data as Contact;
  return (
    <div className="rounded-md border border-border px-3 py-2 text-sm">
      <p className="font-medium">
        {contact.firstName} {contact.lastName ?? ""}
      </p>
      <p className="text-xs text-muted-foreground">
        {contact.title ?? "no title"}
        {contact.email ? ` · ${contact.email}` : ""}
      </p>
    </div>
  );
}

function useEntitySnapshot(entityType: string, entityId: string) {
  const companiesApi = useCompaniesApi();
  const contactsApi = useContactsApi();
  const isCompany = entityType === "company";
  const isContact = entityType === "contact";

  const companyQuery = useQuery({
    queryKey: ["identity-merge", "company", entityId],
    queryFn: () => companiesApi.get(entityId),
    enabled: isCompany,
  });
  const contactQuery = useQuery({
    queryKey: ["identity-merge", "contact", entityId],
    queryFn: () => contactsApi.get(entityId),
    enabled: isContact,
  });

  if (isCompany) return { data: companyQuery.data, ready: Boolean(companyQuery.data) };
  if (isContact) return { data: contactQuery.data, ready: Boolean(contactQuery.data) };
  // Unknown entity type — no live record to snapshot; approve still proceeds (see resolve
  // handler below) with just the ids and a note, since the backend only requires *some*
  // beforeSnapshot value, not a specific shape.
  return { data: undefined, ready: true };
}

function ProposalCard({
  proposal,
  onResolve,
  resolving,
}: {
  proposal: IdentityMergeProposal;
  onResolve: (proposal: IdentityMergeProposal, decision: "approved" | "rejected") => void;
  resolving: boolean;
}) {
  const left = useEntitySnapshot(proposal.entityType, proposal.leftEntityId);
  const right = useEntitySnapshot(proposal.entityType, proposal.rightEntityId);
  const scorePct = Math.round(proposal.score * 100);
  const canApprove = left.ready && right.ready && !resolving;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone={scorePct >= 90 ? "success" : scorePct >= 75 ? "warning" : "default"}>
            {scorePct}% match
          </Badge>
          <Badge tone="default">{ENTITY_LABEL[proposal.entityType] ?? proposal.entityType}</Badge>
          <span className="text-xs text-muted-foreground">
            Proposed {new Date(proposal.createdAt).toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <EntityPreview entityType={proposal.entityType} entityId={proposal.leftEntityId} />
          <EntityPreview entityType={proposal.entityType} entityId={proposal.rightEntityId} />
        </div>

        {Object.keys(proposal.signals ?? {}).length > 0 && (
          <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Match signals:{" "}
            {Object.entries(proposal.signals)
              .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
              .join(" · ")}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={resolving}
            onClick={() => onResolve(proposal, "rejected")}
          >
            Reject
          </Button>
          <Button
            size="sm"
            disabled={!canApprove}
            onClick={() => onResolve(proposal, "approved")}
          >
            Approve merge
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function IdentityMergeReviewPage() {
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const identityMergeApi = useIdentityMergeApi();
  const companiesApi = useCompaniesApi();
  const contactsApi = useContactsApi();

  const proposalsQuery = useQuery({
    queryKey: IDENTITY_MERGE_PROPOSALS_QUERY_KEY,
    queryFn: () => identityMergeApi.listProposals(),
    enabled: authReady,
  });

  const resolve = useMutation({
    mutationFn: async ({
      proposal,
      decision,
    }: {
      proposal: IdentityMergeProposal;
      decision: "approved" | "rejected";
    }) => {
      let beforeSnapshot: unknown;
      if (decision === "approved") {
        if (proposal.entityType === "company") {
          const [left, right] = await Promise.all([
            companiesApi.get(proposal.leftEntityId),
            companiesApi.get(proposal.rightEntityId),
          ]);
          beforeSnapshot = { entityType: proposal.entityType, left, right };
        } else if (proposal.entityType === "contact") {
          const [left, right] = await Promise.all([
            contactsApi.get(proposal.leftEntityId),
            contactsApi.get(proposal.rightEntityId),
          ]);
          beforeSnapshot = { entityType: proposal.entityType, left, right };
        } else {
          beforeSnapshot = {
            entityType: proposal.entityType,
            leftEntityId: proposal.leftEntityId,
            rightEntityId: proposal.rightEntityId,
            note: "No live record snapshot available for this entity type.",
          };
        }
      }
      return identityMergeApi.resolveProposal(proposal.id, decision, beforeSnapshot);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IDENTITY_MERGE_PROPOSALS_QUERY_KEY });
    },
  });

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Identity merge review"
        description="Probable duplicate companies or contacts, scored automatically — approve to record a merge decision, or reject to dismiss."
      />

      <Alert variant="warning" title="Approving records a decision — it doesn't merge records yet">
        Approving a proposal here marks it approved and records a reversible merge event with a
        snapshot of both records as they looked at review time. It does not currently update the
        company/contact records themselves — there is no automatic merge-apply step in the API
        yet. Treat an approved proposal as confirmation that these are the same real-world
        company or person, to be merged through the normal edit/delete tools until that step
        ships.
      </Alert>

      {proposalsQuery.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      )}

      {proposalsQuery.error && (
        <Alert
          variant="error"
          title="Something went wrong"
          dismissible
          onRetry={() => proposalsQuery.refetch()}
        >
          {formatQueryError(proposalsQuery.error, "We couldn't load pending merge proposals.")}
        </Alert>
      )}

      {proposalsQuery.data && proposalsQuery.data.data.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          No pending identity-merge proposals.
        </div>
      )}

      {proposalsQuery.data && proposalsQuery.data.data.length > 0 && (
        <div className="space-y-3">
          {proposalsQuery.data.data.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              resolving={resolve.isPending && resolve.variables?.proposal.id === proposal.id}
              onResolve={(p, decision) => resolve.mutate({ proposal: p, decision })}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
