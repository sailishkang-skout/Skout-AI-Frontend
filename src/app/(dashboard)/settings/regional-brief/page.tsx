"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError } from "@/lib/api-client";
import {
  useRegionalBriefApi,
  type CreateSlotInput,
  type CreateVersionInput,
  type RegionalBriefFieldCategory,
  type RegionalBriefLayerType,
  type RegionalBriefSlot,
  type RegionalBriefVersionStatus,
} from "@/lib/regional-brief";

const STATUS_TONE: Record<RegionalBriefVersionStatus, "success" | "warning" | "muted" | "danger"> = {
  approved: "success",
  pending_review: "warning",
  draft: "muted",
  rejected: "danger",
  superseded: "muted",
};

// These layers are shared across every tenant, so only a platform admin may approve or
// reject changes to them (matching the backend's admin gate). Tenant/outcome_learning
// slots are workspace-scoped and any workspace member may act on them.
const GLOBAL_LAYERS: RegionalBriefLayerType[] = ["global", "region", "country", "industry"];

const STATUS_FILTERS: { label: string; value: RegionalBriefVersionStatus | "all" }[] = [
  { label: "All statuses", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Pending review", value: "pending_review" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Superseded", value: "superseded" },
];

const LAYER_ORDER: RegionalBriefLayerType[] = [
  "global",
  "region",
  "country",
  "industry",
  "tenant",
  "outcome_learning",
];

const FIELD_CATEGORIES: RegionalBriefFieldCategory[] = [
  "market_economics",
  "business_practice",
  "channel_policy",
  "telecom_requirements",
  "data_compliance",
  "explainability",
];

function slotScopeLabel(slot: RegionalBriefSlot): string {
  return slot.countryId ?? slot.regionId ?? slot.industry ?? slot.workspaceId ?? "—";
}

function SlotVersions({ slot, canEditGlobal }: { slot: RegionalBriefSlot; canEditGlobal: boolean }) {
  const api = useRegionalBriefApi();
  const queryClient = useQueryClient();
  const versions = useQuery({
    queryKey: ["regional-brief", "versions", slot.id],
    queryFn: () => api.listVersions(slot.id),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["regional-brief"] });

  const approve = useMutation({
    mutationFn: (versionId: string) => api.approveVersion(versionId),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: ({ versionId, reason }: { versionId: string; reason: string }) =>
      api.rejectVersion(versionId, reason),
    onSuccess: invalidate,
  });

  const isGlobalLayer = GLOBAL_LAYERS.includes(slot.layerType);
  const canAct = !isGlobalLayer || canEditGlobal;

  if (versions.isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (versions.isError) {
    return <Alert variant="error">{formatQueryError(versions.error, "Could not load versions.")}</Alert>;
  }

  const items = versions.data?.data ?? [];

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No versions yet.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((v) => (
        <div key={v.id} className="rounded-lg border px-3 py-2.5 text-sm space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              v{v.version} — {v.content.summary}
            </span>
            <Badge tone={STATUS_TONE[v.status] ?? "muted"}>{v.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {v.source} · confidence {v.confidence} · {v.evidence}
          </p>
          {(v.status === "draft" || v.status === "pending_review") && canAct && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => approve.mutate(v.id)} disabled={approve.isPending}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const reason = window.prompt("Rejection reason?");
                  if (reason) reject.mutate({ versionId: v.id, reason });
                }}
                disabled={reject.isPending}
              >
                Reject
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ResolvePreview() {
  const api = useRegionalBriefApi();
  const [country, setCountry] = useState("US");
  const resolved = useQuery({
    queryKey: ["regional-brief", "resolve", country],
    queryFn: () => api.resolve(country),
    enabled: country.trim().length === 2,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resolve preview</CardTitle>
        <CardDescription>See what a country actually resolves to across every layer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={country}
          onChange={(e) => setCountry(e.target.value.toUpperCase())}
          placeholder="US"
          maxLength={2}
          aria-label="Country ISO code"
        />

        {resolved.isLoading && <Skeleton className="h-24 w-full" />}
        {resolved.isError && (
          <Alert variant="error">{formatQueryError(resolved.error, "Could not resolve that country.")}</Alert>
        )}
        {resolved.data?.entries.length === 0 && (
          <p className="text-sm text-muted-foreground">No resolved facts for this country yet.</p>
        )}

        {resolved.data?.entries.map((entry) => (
          <div key={entry.fieldCategory} className="rounded-lg border px-3 py-2.5 text-sm space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{entry.fieldCategory}</span>
              <Badge tone={entry.isStale ? "warning" : "muted"}>
                {entry.resolvedFromLayer}
                {entry.isStale ? " · stale" : ""}
              </Badge>
            </div>
            <p className="text-muted-foreground">{entry.content.summary}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CreateDraftForm({ canEditGlobal }: { canEditGlobal: boolean }) {
  const api = useRegionalBriefApi();
  const queryClient = useQueryClient();

  const [layerType, setLayerType] = useState<RegionalBriefLayerType>("country");
  const [countryIso, setCountryIso] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [industry, setIndustry] = useState("");
  const [fieldCategory, setFieldCategory] = useState<RegionalBriefFieldCategory>("market_economics");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [source, setSource] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [confidence, setConfidence] = useState("0.8");
  const [evidence, setEvidence] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const blockedByGlobalScope = GLOBAL_LAYERS.includes(layerType) && !canEditGlobal;

  const createDraft = useMutation({
    mutationFn: async () => {
      const slotInput: CreateSlotInput = {
        layerType,
        countryIso: countryIso.trim() || undefined,
        regionCode: regionCode.trim() || undefined,
        industry: industry.trim() || undefined,
        fieldCategory,
      };
      const slot = await api.createSlot(slotInput);

      const versionInput: CreateVersionInput = {
        content: {
          summary: summary.trim(),
          details: details
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        },
        source: source.trim(),
        effectiveDate,
        confidence: Number(confidence),
        evidence: evidence.trim(),
      };
      return api.createVersion(slot.id, versionInput);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regional-brief"] });
      setSuccessMessage("Draft created — it now awaits review.");
      setSummary("");
      setDetails("");
      setSource("");
      setEvidence("");
    },
  });

  const canSubmit =
    !blockedByGlobalScope &&
    summary.trim().length > 0 &&
    source.trim().length > 0 &&
    effectiveDate.length > 0 &&
    evidence.trim().length > 0 &&
    !createDraft.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Propose a new draft</CardTitle>
        <CardDescription>
          Every fact needs a source, an effective date, and evidence before it can go up for review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Layer</span>
            <Select value={layerType} onChange={(e) => setLayerType(e.target.value as RegionalBriefLayerType)}>
              {LAYER_ORDER.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Field category</span>
            <Select
              value={fieldCategory}
              onChange={(e) => setFieldCategory(e.target.value as RegionalBriefFieldCategory)}
            >
              {FIELD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Country ISO</span>
            <Input
              value={countryIso}
              onChange={(e) => setCountryIso(e.target.value.toUpperCase())}
              placeholder="US"
              maxLength={2}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Region code</span>
            <Input value={regionCode} onChange={(e) => setRegionCode(e.target.value)} placeholder="EMEA" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Industry</span>
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="fintech" />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Summary</span>
          <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One-line summary of this fact" />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Details (one per line)</span>
          <textarea
            rows={4}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Source</span>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. IMF 2026 report" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Effective date</span>
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Confidence (0–1)</span>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Evidence</span>
          <Input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Link or citation" />
        </label>

        {blockedByGlobalScope && (
          <Alert variant="warning">
            Only platform admins can propose drafts on the global, region, country, or industry layers.
          </Alert>
        )}
        {createDraft.isError && (
          <Alert variant="error">{formatQueryError(createDraft.error, "Could not create that draft.")}</Alert>
        )}
        {successMessage && (
          <Alert variant="success" dismissible>
            {successMessage}
          </Alert>
        )}

        <Button type="button" disabled={!canSubmit} onClick={() => createDraft.mutate()}>
          Create draft
        </Button>
      </CardContent>
    </Card>
  );
}

export default function RegionalBriefPage() {
  const api = useRegionalBriefApi();
  const [statusFilter, setStatusFilter] = useState<RegionalBriefVersionStatus | "all">("all");

  const adminCheck = useQuery({
    queryKey: ["regional-brief", "admin-check"],
    queryFn: () => api.adminCheck(),
  });

  const slots = useQuery({
    queryKey: ["regional-brief", "slots", statusFilter],
    queryFn: () => api.listSlots(statusFilter === "all" ? undefined : { status: statusFilter }),
  });

  const canEditGlobal = adminCheck.data?.platformAdmin ?? false;

  return (
    <PageShell data-testid="page-regional-brief">
      <PageHeader
        title="Regional Selling Brief"
        description="Versioned, layered regional and country selling knowledge — every fact carries a source, confidence, and evidence trail."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as RegionalBriefVersionStatus | "all")}
          className="w-48"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <span className="text-sm text-muted-foreground">
          {slots.data ? `${slots.data.total} slot${slots.data.total === 1 ? "" : "s"}` : "—"}
        </span>
      </div>

      {slots.isError && (
        <Alert variant="error" title="Something went wrong">
          {formatQueryError(slots.error, "Could not load regional brief slots.")}
        </Alert>
      )}

      {slots.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          {slots.data?.data.map((slot) => (
            <Card key={slot.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {slot.fieldCategory}
                  <span className="ml-2 font-normal text-sm text-muted-foreground">
                    {slotScopeLabel(slot)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SlotVersions slot={slot} canEditGlobal={canEditGlobal} />
              </CardContent>
            </Card>
          ))}

          <CreateDraftForm canEditGlobal={canEditGlobal} />
        </div>
        <ResolvePreview />
      </div>
    </PageShell>
  );
}
