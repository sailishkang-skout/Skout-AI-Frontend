"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { ScoreBadge } from "@/components/scoring/score-badge";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { formatQueryError, useApiFetch, useAuthReady } from "@/lib/api-client";
import type { ListMemberDetail, ProspectDetail, ProspectSummary } from "@/types/api";

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
  const prospectId = prospect?.prospectId ?? member?.prospectId ?? null;

  const detail = useQuery({
    queryKey: ["prospects", "detail", prospectId],
    queryFn: () => api<ProspectDetail>(`/api/v1/search/prospects/${prospectId}`),
    enabled: authReady && open && Boolean(prospectId),
    staleTime: 60_000,
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

        {(score || d.icpScore != null) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">ICP score</span>
            <ScoreBadge score={score?.score ?? d.icpScore ?? 0} reasoning={score?.reasoning} />
            {d.intentScore != null && (
              <Badge tone="info">Intent {d.intentScore}</Badge>
            )}
            {d.outreachReadiness && <Badge tone="muted">{d.outreachReadiness}</Badge>}
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
          <DetailRow label="State" value={detail.data?.state} />
          <DetailRow label="City" value={detail.data?.city} />
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
