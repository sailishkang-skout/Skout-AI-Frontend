"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ApiError, formatQueryError, useAuthReady } from "@/lib/api-client";
import { campaignStatus, cleanFilters, useCampaignApi, type AudienceFilters } from "@/lib/enrichment-campaigns";
import { formatCaptureDate } from "@/lib/enrichment-research";
import { useWorkspaceRole } from "@/lib/workspace-role";
import { ClaimEvidence } from "./claim-evidence";

const TEXT_FILTERS: Array<{ key: keyof AudienceFilters; label: string; placeholder: string }> = [
  { key: "role", label: "Role", placeholder: "e.g. revenue operations" },
  { key: "department", label: "Department", placeholder: "e.g. sales" },
  { key: "seniority", label: "Seniority", placeholder: "e.g. director" },
  { key: "location", label: "Location", placeholder: "e.g. Berlin" },
  { key: "industry", label: "Company industry", placeholder: "e.g. software" },
];

function Count({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-md border p-3" data-testid={`count-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function permissionMessage(error: unknown, fallback: string) {
  return error instanceof ApiError && error.status === 403 ? "You don't have permission for this action. Ask a workspace admin." : formatQueryError(error, fallback);
}

/** Filters with live counts and freshness; saving an audience starts a campaign draft from it. */
function AudienceBuilder({ canBuild }: { canBuild: boolean }) {
  const api = useCampaignApi();
  const authReady = useAuthReady();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<AudienceFilters>({});
  const [applied, setApplied] = useState<AudienceFilters>({});
  const [name, setName] = useState("");

  // Counts follow the filters a moment after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => setApplied(cleanFilters(filters)), 350);
    return () => clearTimeout(timer);
  }, [filters]);

  const preview = useQuery({
    queryKey: ["enrichment-campaigns", "audience-preview", applied],
    queryFn: () => api.previewAudience(applied),
    enabled: authReady,
    placeholderData: (previous) => previous,
  });
  const build = useMutation({
    mutationFn: async () => {
      const { audience } = await api.saveAudience(name.trim(), applied);
      const { campaign } = await api.createCampaign(name.trim(), audience.id);
      return campaign;
    },
    onSuccess: async (campaign) => {
      await queryClient.invalidateQueries({ queryKey: ["enrichment-campaigns"] });
      router.push(`/enrichment/campaigns/${campaign.id}`);
    },
  });

  const counts = preview.data?.counts;
  const set = (key: keyof AudienceFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const blocked = !counts || counts.total === 0 ? "Nobody matches these filters." : preview.data?.tooLarge ? `Narrow the audience to ${preview.data.maxAudienceSize} people or fewer so each recipient can be reviewed.` : null;

  return (
    <Card data-testid="audience-builder">
      <CardContent className="space-y-4 p-6">
        <div>
          <h2 className="font-semibold">Build an audience</h2>
          <p className="text-sm text-muted-foreground">Segment captured people. Counts update as you type.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEXT_FILTERS.map((filter) => (
            <label key={filter.key} className="space-y-1 text-sm">
              <span className="font-medium">{filter.label}</span>
              <Input placeholder={filter.placeholder} value={filters[filter.key] ?? ""} onChange={(event) => set(filter.key, event.target.value)} />
            </label>
          ))}
          <label className="space-y-1 text-sm">
            <span className="font-medium">Evidence</span>
            <Select value={filters.evidenceState ?? ""} onChange={(event) => set("evidenceState", event.target.value)}>
              <option value="">Verified and discovery</option>
              <option value="verified">Verified employment only</option>
              <option value="discovery">Discovery only</option>
            </Select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Freshness</span>
            <Select value={filters.freshness ?? ""} onChange={(event) => set("freshness", event.target.value)}>
              <option value="">Any age</option>
              <option value="fresh">Fresh only</option>
              <option value="stale">Stale only</option>
            </Select>
          </label>
        </div>

        {preview.isError ? (
          <Alert variant="error" onRetry={() => preview.refetch()}>
            {formatQueryError(preview.error, "Could not count this audience.")}
          </Alert>
        ) : counts ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-live="polite">
              <Count label="People" value={counts.total} />
              <Count label="Verified" value={counts.verifiedEmployment} hint="employer confirmed" />
              <Count label="Discovery" value={counts.discoveryOnly} hint="search card only" />
              <Count label="Fresh" value={counts.fresh} hint={`within ${counts.freshnessDays} days`} />
              <Count label="Stale" value={counts.stale} />
              <Count label="Verified email" value={counts.verifiedEmail} hint={`${counts.suppressed} suppressed`} />
            </div>
            {counts.total > 0 && counts.verifiedEmail === 0 && (
              <Alert variant="warning">Nobody in this audience has a verified email yet, so nobody could be enrolled. Find and verify contact data first.</Alert>
            )}
            {preview.data!.sample.length > 0 && (
              <ul className="divide-y text-sm">
                {preview.data!.sample.slice(0, 8).map((person) => (
                  <li key={person.prospectId} className="flex flex-wrap items-center gap-2 py-2">
                    <Link href={`/enrichment/people/${encodeURIComponent(person.prospectId)}`} className="font-medium text-primary underline-offset-4 hover:underline">
                      {person.fullName ?? "Not captured yet"}
                    </Link>
                    <span className="text-muted-foreground">{[person.title, person.companyName, person.location].filter(Boolean).join(" · ")}</span>
                    <Badge tone={person.employmentState === "verified" ? "success" : "warning"}>{person.employmentState === "verified" ? "Verified" : "Discovery"}</Badge>
                    <span className="text-xs text-muted-foreground">captured {formatCaptureDate(person.capturedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Counting…</p>
        )}

        {canBuild ? (
          <form
            className="flex flex-wrap items-end gap-2 border-t pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim() && !blocked && !build.isPending) build.mutate();
            }}
          >
            <label className="space-y-1 text-sm">
              <span className="font-medium">Campaign name</span>
              <Input className="w-72" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Revenue leaders, Berlin" />
            </label>
            <Button type="submit" disabled={!name.trim() || Boolean(blocked) || build.isPending} title={blocked ?? undefined}>
              {build.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save audience and draft campaign
            </Button>
            {blocked && <p className="w-full text-sm text-muted-foreground">{blocked}</p>}
            <p className="w-full text-xs text-muted-foreground">This saves the audience as a list and drafts a campaign. Nobody is enrolled or emailed until a reviewer approves it.</p>
          </form>
        ) : (
          <p className="border-t pt-4 text-sm text-muted-foreground">You need the “run enrichment” permission to build a campaign.</p>
        )}
        {build.error && (
          <Alert variant="warning" dismissible>
            {permissionMessage(build.error, "The campaign could not be created.")}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

/** Job-change suggestions. Each is a draft waiting for a person; none is sent from here. */
function ReviewQueue({ canBuild }: { canBuild: boolean }) {
  const api = useCampaignApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const queue = useQuery({ queryKey: ["enrichment-campaigns", "review-queue"], queryFn: api.reviewQueue, enabled: authReady });
  const dismiss = useMutation({
    mutationFn: (id: string) => api.dismiss(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enrichment-campaigns"] }),
  });
  const items = queue.data?.items ?? [];

  return (
    <Card data-testid="review-queue">
      <CardContent className="space-y-3 p-6">
        <div>
          <h2 className="font-semibold">Job-change review queue</h2>
          <p className="text-sm text-muted-foreground">When someone changes role, Skout drafts a suggestion here. It is sent only if a person reviews, approves and launches it.</p>
        </div>
        {queue.isError ? (
          <Alert variant="error" onRetry={() => queue.refetch()}>
            {formatQueryError(queue.error, "Could not load the review queue.")}
          </Alert>
        ) : queue.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No job changes are waiting for review.</p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.campaign.id} className="space-y-2 py-3" data-testid="review-item">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{item.recipient?.fullName ?? item.campaign.name}</span>
                    <Badge tone={campaignStatus(item.campaign.status).tone}>{campaignStatus(item.campaign.status).label}</Badge>
                    <Badge tone="muted">Not sent</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/enrichment/campaigns/${item.campaign.id}`} className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted">
                      Review
                    </Link>
                    {canBuild && (
                      <Button variant="outline" disabled={dismiss.isPending} onClick={() => dismiss.mutate(item.campaign.id)}>
                        Dismiss
                      </Button>
                    )}
                  </div>
                </div>
                {item.claimsInCopy.length > 0 ? (
                  <ul className="space-y-2">
                    {item.claimsInCopy.map((claim) => (
                      <ClaimEvidence key={claim.evidenceId} claim={claim} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No verified, fresh evidence supports a talking point yet.</p>
                )}
                {item.recipient?.exclusionMessage && <p className="text-sm text-amber-700 dark:text-amber-300">Cannot be contacted: {item.recipient.exclusionMessage}.</p>}
              </li>
            ))}
          </ul>
        )}
        {dismiss.error && (
          <Alert variant="warning" dismissible>
            {permissionMessage(dismiss.error, "The suggestion could not be dismissed.")}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function CampaignList() {
  const api = useCampaignApi();
  const authReady = useAuthReady();
  const campaigns = useQuery({ queryKey: ["enrichment-campaigns", "list"], queryFn: api.campaigns, enabled: authReady });
  const rows = (campaigns.data?.campaigns ?? []).filter((campaign) => campaign.trigger === "manual");
  return (
    <Card data-testid="campaign-list">
      <CardContent className="space-y-3 p-6">
        <h2 className="font-semibold">Campaigns</h2>
        {campaigns.isError ? (
          <Alert variant="error" onRetry={() => campaigns.refetch()}>
            {formatQueryError(campaigns.error, "Could not load campaigns.")}
          </Alert>
        ) : campaigns.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns yet. Build an audience above to draft the first one.</p>
        ) : (
          <ul className="divide-y text-sm">
            {rows.map((campaign) => (
              <li key={campaign.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/enrichment/campaigns/${campaign.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  {campaign.name}
                </Link>
                <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  {campaign.recipientCount} recipients
                  <Badge tone={campaignStatus(campaign.status).tone}>{campaignStatus(campaign.status).label}</Badge>
                  <span className="text-xs">updated {formatCaptureDate(campaign.updatedAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function CampaignsHome() {
  const { hasPermission } = useWorkspaceRole();
  const canBuild = hasPermission("enrichment:enrich");
  return (
    <PageShell>
      <PageHeader title="Campaigns" description="Turn captured evidence into a reviewed sequence: pick an audience, check each talking point against its source, approve, then launch." />
      <AudienceBuilder canBuild={canBuild} />
      <ReviewQueue canBuild={canBuild} />
      <CampaignList />
    </PageShell>
  );
}
