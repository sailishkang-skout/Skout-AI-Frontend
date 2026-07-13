"use client";

import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { ScoreBadge } from "@/components/scoring/score-badge";
import { GenerateDraftFromProspect } from "@/components/prospects/generate-draft-from-prospect";
import { EnrollFromProspect } from "@/components/sequences/enroll-from-prospect";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ApiError, formatQueryError, useApiFetch, useAuthReady } from "@/lib/api-client";
import { useEnrichmentApi } from "@/lib/enrichment";
import { scoreBandColor, scoreBandLabel } from "@/lib/scoring";
import type { DimensionScore, ListMemberDetail, ProspectDetail, ProspectSnapshotInput, ProspectSummary, ScoreResult } from "@/types/api";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  if (value == null || value === "" || value === false) return null;
  const display = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  return (
    <div className="grid gap-0.5 border-b border-border py-3 last:border-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{display}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <dl>{children}</dl>
    </section>
  );
}

function formatMoney(n?: number) {
  if (n == null) return undefined;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

const DIMENSION_LABELS: Record<string, string> = {
  industry: "Industry",
  seniority: "Seniority",
  geography: "Geography",
  company_size: "Company size",
  title: "Title",
  signals: "Intent signals",
};

const DIMENSION_ORDER = ["industry", "seniority", "geography", "company_size", "title", "signals"];

function DimensionRow({ name, dim }: { name: string; dim: DimensionScore }) {
  const label = DIMENSION_LABELS[name] ?? name.replace(/_/g, " ");
  const pct = Math.max(0, Math.min(100, dim.score));
  const barColor = dim.matched
    ? "bg-emerald-500 dark:bg-emerald-400"
    : "bg-rose-400 dark:bg-rose-500";

  return (
    <div className="grid gap-1 py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
            dim.matched
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
              : "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400"
          }`}
          aria-hidden
        >
          {dim.matched ? "✓" : "✗"}
        </span>
        <span className="min-w-[90px] text-xs font-medium text-foreground">{label}</span>
        <div className="flex flex-1 items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="w-7 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
            {pct}
          </span>
        </div>
      </div>
      {dim.explanation && (
        <p className="pl-6 text-[11px] leading-snug text-muted-foreground">{dim.explanation}</p>
      )}
    </div>
  );
}

function IcpScoreCard({
  score,
  band,
  reasoning,
  intentScore,
  outreachReadiness,
  source,
  dimensions,
  isPending,
  onRescore,
}: {
  score: number;
  band: string | null;
  reasoning: string | null;
  intentScore?: number | null;
  outreachReadiness?: string | null;
  source?: "llm" | "heuristic";
  dimensions?: Record<string, DimensionScore>;
  isPending: boolean;
  onRescore: () => void;
}) {
  const colors = scoreBandColor(score);
  const orderedDims = dimensions
    ? [
        ...DIMENSION_ORDER.filter((k) => k in dimensions).map((k) => [k, dimensions[k]] as [string, DimensionScore]),
        ...Object.entries(dimensions).filter(([k]) => !DIMENSION_ORDER.includes(k)),
      ]
    : [];

  return (
    <div className={`rounded-xl border p-4 ${colors.bg} ${colors.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ScoreBadge score={score} reasoning={reasoning} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ICP Score</p>
            {band && (
              <p className={`text-sm font-bold ${colors.text}`}>{band} fit</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {source && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              source === "llm"
                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}>
              {source === "llm" ? "AI" : "Heuristic"}
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs"
            onClick={onRescore}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className={`h-3 w-3 ${colors.text}`} />
            )}
            Re-score
          </Button>
        </div>
      </div>

      {(intentScore != null || outreachReadiness) && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-current/10 pt-3">
          {intentScore != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              Intent <span className="font-bold">{intentScore}</span>
            </span>
          )}
          {outreachReadiness && (
            <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              {outreachReadiness}
            </span>
          )}
        </div>
      )}

      {orderedDims.length > 0 && (
        <div className="mt-3 border-t border-current/10 pt-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Score breakdown
          </p>
          <dl>
            {orderedDims.map(([key, dim]) => (
              <DimensionRow key={key} name={key} dim={dim} />
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

export function ProspectDetailSheet({
  prospect,
  member,
  score,
  enrichedEmail,
  enrichedEmailStatus,
  open,
  onClose,
}: {
  prospect: ProspectSummary | null;
  member?: ListMemberDetail | null;
  score?: { score: number; reasoning?: string | null } | null;
  enrichedEmail?: string;
  enrichedEmailStatus?: string;
  open: boolean;
  onClose: () => void;
}) {
  const api = useApiFetch();
  const authReady = useAuthReady();
  const enrichmentApi = useEnrichmentApi();
  const queryClient = useQueryClient();
  const prospectId = prospect?.prospectId ?? member?.prospectId ?? null;

  const detail = useQuery({
    queryKey: ["prospects", "detail", prospectId],
    queryFn: () => api<ProspectDetail>(`/api/v1/search/prospects/${prospectId}`),
    enabled: authReady && open && Boolean(prospectId),
    staleTime: 60_000,
  });

  // Cached score from a previous Score button click inside this sheet
  const cachedScore = useQuery<ScoreResult>({
    queryKey: ["prospect-score", prospectId],
    enabled: false,
    staleTime: Infinity,
  });

  const scoreResult = cachedScore.data;

  const scoreMutation = useMutation({
    mutationFn: () => {
      const p = detail.data ?? prospect;
      if (!p) throw new Error("No prospect data");
      const snapshot: ProspectSnapshotInput = {
        prospectId: p.prospectId,
        companyId: p.companyId,
        fullName: p.fullName,
        title: p.title,
        seniority: p.seniority,
        industry: p.industry,
        country: p.country,
        companyDomain: p.companyDomain,
        employeeCount: p.employeeCount,
      };
      return enrichmentApi.scoreProspect(snapshot);
    },
    onSuccess: (data) => {
      queryClient.setQueryData<ScoreResult>(["prospect-score", prospectId], data);
      void queryClient.invalidateQueries({ queryKey: ["scores"] });
    },
  });

  const d = detail.data ?? prospect;
  if (!d) return null;

  const title = d.fullName || d.companyName || "Prospect";
  const subtitle =
    d.recordType === "company"
      ? d.companyDomain
      : [d.title, d.companyDomain].filter(Boolean).join(" · ");

  const email = enrichedEmail ?? detail.data?.email ?? (member?.snapshot as { email?: string })?.email;
  const emailStatus =
    enrichedEmailStatus ?? (member?.snapshot as { emailStatus?: string })?.emailStatus;

  // Resolve the best available score: prop passed from parent → cached mutation result → inline from detail
  const resolvedScore = score?.score ?? scoreResult?.icpScore ?? d.icpScore;
  const resolvedReasoning = score?.reasoning ?? scoreResult?.reasoning ?? null;
  const resolvedBand = resolvedScore != null ? scoreBandLabel(resolvedScore) : null;
  const resolvedSource = scoreResult?.source;
  const resolvedDimensions = scoreResult?.dimensions;

  const isIcpError =
    scoreMutation.error instanceof ApiError && scoreMutation.error.status === 400;

  return (
    <Sheet open={open} onClose={onClose} title={title} description={subtitle || "Prospect details"}>
      <div className="space-y-6">
        {detail.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading full record…
          </div>
        )}

        {detail.error && (
          <Alert variant="warning">
            {formatQueryError(detail.error, "Could not load full details — showing summary only.")}
          </Alert>
        )}

        {/* ICP Score card */}
        {resolvedScore != null ? (
          <IcpScoreCard
            score={resolvedScore}
            band={resolvedBand}
            reasoning={resolvedReasoning}
            intentScore={d.intentScore}
            outreachReadiness={d.outreachReadiness}
            source={resolvedSource}
            dimensions={resolvedDimensions}
            isPending={scoreMutation.isPending}
            onRescore={() => scoreMutation.mutate()}
          />
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">ICP Score</p>
              <p className="text-xs text-muted-foreground">Not scored yet</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => scoreMutation.mutate()}
              disabled={scoreMutation.isPending}
            >
              {scoreMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              )}
              {scoreMutation.isPending ? "Scoring…" : "Score with AI"}
            </Button>
          </div>
        )}

        {isIcpError && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-white dark:bg-amber-500">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
                <path d="M5 1a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 5 1Zm0 7a.875.875 0 1 1 0-1.75A.875.875 0 0 1 5 8Z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">ICP not configured</p>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                Set up your Ideal Customer Profile to enable AI scoring.
              </p>
              <Link
                href="/settings/icp"
                className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-400 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400"
              >
                Set up ICP →
              </Link>
            </div>
          </div>
        )}
        {scoreMutation.error && !isIcpError && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden className="shrink-0">
              <path d="M7 1a6 6 0 1 1 0 12A6 6 0 0 1 7 1Zm0 3.25a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0V5A.75.75 0 0 0 7 4.25Zm0 5.5a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Z" />
            </svg>
            Could not score this prospect. Please try again.
          </div>
        )}

        {detail.data?.linkedinUrl && (
          <a
            href={detail.data.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            View LinkedIn profile
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {prospectId && (
          <div className="space-y-3">
            <GenerateDraftFromProspect
              prospectId={prospectId}
              fullName={d.fullName}
              title={d.title}
              companyName={d.companyName}
              companyDomain={d.companyDomain}
            />
            <EnrollFromProspect prospectId={prospectId} />
          </div>
        )}

        <Section title="Contact">
          <DetailRow label="Full name" value={d.fullName} />
          <DetailRow label="Title" value={d.title} />
          <DetailRow label="Department" value={detail.data?.department} />
          <DetailRow label="Seniority" value={d.seniority !== "unknown" ? d.seniority : undefined} />
          <DetailRow label="Job function" value={detail.data?.jobFunction} />
          <DetailRow label="Email" value={email} />
          {emailStatus && <DetailRow label="Email status" value={emailStatus} />}
          <DetailRow label="Phone" value={detail.data?.phone} />
          <DetailRow label="LinkedIn" value={detail.data?.linkedinUrl} />
          <DetailRow label="Country" value={d.country} />
          <DetailRow
            label="State"
            value={detail.data?.state ?? ("state" in (prospect ?? {}) ? (prospect as { state?: string }).state : undefined)}
          />
          <DetailRow
            label="City"
            value={detail.data?.city ?? ("city" in (prospect ?? {}) ? (prospect as { city?: string }).city : undefined)}
          />
        </Section>

        <Section title="Company">
          <DetailRow label="Company name" value={d.companyName} />
          <DetailRow label="Domain" value={d.companyDomain} />
          <DetailRow label="Industry" value={d.industry} />
          <DetailRow label="Sub-industry" value={detail.data?.subIndustry} />
          <DetailRow label="Record type" value={d.recordType} />
          <DetailRow label="Employees" value={d.employeeCount?.toLocaleString()} />
          <DetailRow label="Size bucket" value={detail.data?.employeeBucket} />
          <DetailRow label="Stage" value={detail.data?.companyStage} />
          <DetailRow label="Founded year" value={detail.data?.foundedYear} />
          <DetailRow
            label="Headcount growth"
            value={
              detail.data?.headcountGrowth != null
                ? `${detail.data.headcountGrowth}%`
                : undefined
            }
          />
          <DetailRow label="Email provider" value={detail.data?.companyEmailProvider} />
          <DetailRow label="Currently hiring" value={detail.data?.currentlyHiring} />
        </Section>

        <Section title="Funding & revenue">
          <DetailRow label="Annual revenue" value={formatMoney(detail.data?.annualRevenue)} />
          <DetailRow label="Total funding" value={formatMoney(detail.data?.totalFunding)} />
          <DetailRow label="Last round" value={detail.data?.lastFundingRound} />
          <DetailRow label="Last round date" value={detail.data?.lastFundingDate} />
        </Section>

        <Section title="Experience">
          <DetailRow label="Years at company" value={detail.data?.yearsAtCompany} />
          <DetailRow label="Years in role" value={detail.data?.yearsInRole} />
          <DetailRow label="Total experience" value={detail.data?.totalYearsExperience} />
          <DetailRow label="Previous company" value={detail.data?.previousCompany} />
        </Section>

        {d.painPoints && d.painPoints.length > 0 && (
          <Section title="Pain points">
            <div className="flex flex-wrap gap-1.5 py-2">
              {d.painPoints.map((p) => (
                <Badge key={p} tone="warning">
                  {p}
                </Badge>
              ))}
            </div>
          </Section>
        )}

        {d.signals && d.signals.length > 0 && (
          <Section title="Signals">
            <ul className="space-y-2 py-2">
              {d.signals.map((s) => (
                <li key={`${s.type}-${s.observedAt}`} className="text-sm">
                  <span className="font-medium">{s.type.replace(/_/g, " ")}</span>
                  {s.detail && <span className="text-muted-foreground"> — {s.detail}</span>}
                  <span className="block text-xs text-muted-foreground">
                    {new Date(s.observedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {d.techStack && d.techStack.length > 0 && (
          <Section title="Technographics">
            <ul className="space-y-1 py-2">
              {d.techStack.map((t) => (
                <li key={`${t.category}-${t.technology}`} className="text-sm">
                  <span className="font-medium">{t.technology}</span>
                  <span className="text-muted-foreground"> ({t.category})</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Identifiers">
          <DetailRow label="Prospect ID" value={d.prospectId} />
          <DetailRow label="Company ID" value={d.companyId} />
          {member && (
            <DetailRow label="Added to list" value={new Date(member.addedAt).toLocaleString()} />
          )}
          <DetailRow
            label="Last updated"
            value={d.updatedAt ? new Date(d.updatedAt).toLocaleString() : undefined}
          />
        </Section>
      </div>
    </Sheet>
  );
}
