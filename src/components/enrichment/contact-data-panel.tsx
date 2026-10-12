"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, formatQueryError, useAuthReady } from "@/lib/api-client";
import {
  formatDateTime,
  jobStatus,
  provenanceLabel,
  useProviderApi,
  VERIFICATION,
  type ContactValue,
} from "@/lib/enrichment-provider";

function ContactRow({ label, value, absentText }: { label: string; value: ContactValue | null; absentText: string }) {
  if (!value) {
    return (
      <div className="space-y-1" data-testid={`contact-${label.toLowerCase()}`} data-state="absent">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="text-sm text-muted-foreground">{absentText}</dd>
      </div>
    );
  }
  const verification = VERIFICATION[value.verification.status] ?? VERIFICATION.unverified;
  const { ageDays } = value.freshness;
  return (
    <div className="space-y-1" data-testid={`contact-${label.toLowerCase()}`} data-state="present">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-all text-sm font-medium">{value.value}</dd>
      <div className="flex flex-wrap items-center gap-1">
        <Badge tone={verification.tone}>{verification.label}</Badge>
        {value.freshness.stale && <Badge tone="danger">Stale</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">
        {provenanceLabel(value.provenance)}
        {value.provenance.confidence !== null && ` · ${Math.round(value.provenance.confidence * 100)}% provider confidence`}
        {value.provenance.observedAt && ` · ${formatDateTime(value.provenance.observedAt)}`}
        {ageDays !== null && ` (${ageDays === 0 ? "today" : `${ageDays} day${ageDays === 1 ? "" : "s"} ago`})`}
      </p>
      <p className="text-xs text-muted-foreground">
        {value.verification.provider
          ? `Checked by ${value.verification.provider} on ${formatDateTime(value.verification.verifiedAt)}${
              value.verification.deliverabilityScore !== null ? ` · deliverability ${value.verification.deliverabilityScore}/100` : ""
            }`
          : "Nobody has verified this value."}
      </p>
    </div>
  );
}

/**
 * Email and phone for one person, each with who supplied it, its verification status and its
 * age. A field with no value says so; nothing is suggested in its place.
 */
export function ContactDataPanel({
  prospectId,
  canEnrich,
  onFindContactData,
  findPending,
  findDisabledReason,
}: {
  prospectId: string;
  canEnrich: boolean;
  onFindContactData: () => void;
  findPending: boolean;
  findDisabledReason?: string;
}) {
  const api = useProviderApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const key = ["enrichment-provider", "contact-data", prospectId];
  const query = useQuery({ queryKey: key, queryFn: () => api.contactData(prospectId), enabled: authReady });
  const verify = useMutation({
    mutationFn: () => api.verifyEmail(prospectId),
    onSuccess: (result) => queryClient.setQueryData(key, result),
  });
  const data = query.data?.contactData;

  return (
    <Card data-testid="contact-data">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Contact data</h2>
          {canEnrich && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={findPending || Boolean(findDisabledReason)} title={findDisabledReason} onClick={onFindContactData}>
                {findPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Find contact data
              </Button>
              <Button variant="outline" disabled={!data?.email || verify.isPending} title={data?.email ? undefined : "There is no email to verify"} onClick={() => verify.mutate()}>
                {verify.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify email
              </Button>
            </div>
          )}
        </div>

        {verify.error && (
          <Alert variant="warning" dismissible>
            {verify.error instanceof ApiError && verify.error.status === 403
              ? "You don't have permission to verify. Ask a workspace admin."
              : formatQueryError(verify.error, "The email could not be verified.")}
          </Alert>
        )}

        {query.isError ? (
          <Alert variant="error" onRetry={() => query.refetch()}>
            {formatQueryError(query.error, "Could not load contact data.")}
          </Alert>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">{query.isLoading ? "Loading…" : "Contact data is not available."}</p>
        ) : (
          <>
            <dl className="grid gap-4 sm:grid-cols-2">
              <ContactRow label="Email" value={data.email} absentText="No email on record." />
              <ContactRow label="Phone" value={data.phone} absentText="No phone number on record." />
            </dl>
            {data.otherPhones.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Also returned: {data.otherPhones.map((phone) => `${phone.type === "hq" ? "company" : "direct"} ${phone.value}`).join(", ")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {data.lastRun
                ? `Last contact lookup: ${jobStatus(data.lastRun.status).label.toLowerCase()}, ${formatDateTime(data.lastRun.completedAt ?? data.lastRun.queuedAt)}.`
                : "No contact lookup has been run."}{" "}
              Values older than {data.freshnessDays} days are marked stale. Missing values are left empty; Skout does not guess contact details.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
