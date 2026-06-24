"use client";

import { useQuery } from "@tanstack/react-query";
import { Briefcase, Building2, Loader2, Mail, Trophy, Users, Zap } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { useApiFetch, useAuthReady } from "@/lib/api-client";
import type { ProspectDetail, ProspectSummary } from "@/types/api";

export function ProspectDetailSheet({
  prospectId,
  initialData,
  open,
  onClose,
}: {
  prospectId: string | null;
  initialData?: ProspectSummary;
  open: boolean;
  onClose: () => void;
}) {
  const api = useApiFetch();
  const authReady = useAuthReady();

  const detail = useQuery({
    queryKey: ["prospect-detail", prospectId],
    queryFn: () => api<ProspectDetail>(`/api/v1/search/prospects/${prospectId}`),
    enabled: authReady && open && !!prospectId,
  });

  const prospect = detail.data ?? (initialData as ProspectDetail | undefined);

  const description = [
    prospect?.title,
    prospect?.companyName ?? prospect?.companyDomain,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={prospect?.fullName ?? "Prospect"}
      description={description || undefined}
    >
      {detail.isLoading && !prospect && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {detail.isError && !prospect && (
        <Alert variant="error">Could not load prospect details.</Alert>
      )}

      {prospect && <ProspectBody prospect={prospect} />}
    </Sheet>
  );
}

function ProspectBody({ prospect }: { prospect: ProspectDetail }) {
  const location = [prospect.city, prospect.state, prospect.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      <Section title="Contact" icon={<Mail className="h-3.5 w-3.5" />}>
        <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
          {prospect.seniority && prospect.seniority !== "unknown" && (
            <Row label="Seniority" value={prospect.seniority} />
          )}
          {prospect.department && <Row label="Department" value={prospect.department} />}
          {prospect.jobFunction && <Row label="Function" value={prospect.jobFunction} />}
          {prospect.email && <Row label="Email" value={prospect.email} mono />}
          {prospect.phone && <Row label="Phone" value={prospect.phone} />}
          {prospect.linkedinUrl && (
            <Row
              label="LinkedIn"
              value={
                <a
                  href={prospect.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-primary underline underline-offset-2"
                >
                  View profile
                </a>
              }
            />
          )}
          {prospect.yearsAtCompany != null && (
            <Row label="At company" value={`${prospect.yearsAtCompany} yr`} />
          )}
          {prospect.yearsInRole != null && (
            <Row label="In role" value={`${prospect.yearsInRole} yr`} />
          )}
          {prospect.previousCompany && (
            <Row label="Prev. company" value={prospect.previousCompany} />
          )}
        </dl>
      </Section>

      <Section title="Company" icon={<Building2 className="h-3.5 w-3.5" />}>
        <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <Row label="Domain" value={prospect.companyDomain} mono />
          {prospect.industry && <Row label="Industry" value={prospect.industry} />}
          {prospect.subIndustry && <Row label="Sub-industry" value={prospect.subIndustry} />}
          {location && <Row label="Location" value={location} />}
          {prospect.employeeCount != null && (
            <Row label="Employees" value={prospect.employeeCount.toLocaleString()} />
          )}
          {prospect.companyStage && <Row label="Stage" value={prospect.companyStage} />}
          {prospect.lastFundingRound && (
            <Row label="Last round" value={prospect.lastFundingRound} />
          )}
          {prospect.totalFunding != null && (
            <Row
              label="Total funding"
              value={`$${(prospect.totalFunding / 1_000_000).toFixed(1)}M`}
            />
          )}
        </dl>
      </Section>

      {prospect.currentlyHiring != null && (
        <Section title="Hiring" icon={<Users className="h-3.5 w-3.5" />}>
          <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <Row label="Currently hiring" value={prospect.currentlyHiring ? "Yes" : "No"} />
          </dl>
        </Section>
      )}

      {prospect.signals && prospect.signals.length > 0 && (
        <Section title="Signals" icon={<Zap className="h-3.5 w-3.5" />}>
          <ul className="divide-y rounded-lg border text-sm">
            {prospect.signals.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <Badge tone="warning">{s.type.replace(/_/g, " ")}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.observedAt).toLocaleDateString()}
                </span>
                {s.detail && (
                  <span className="text-xs text-muted-foreground">{s.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {prospect.techStack && prospect.techStack.length > 0 && (
        <Section title="Tech Stack" icon={<Briefcase className="h-3.5 w-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {prospect.techStack.map((t, i) => (
              <Badge key={i} tone="muted">
                {t.technology}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {prospect.icpScore != null && (
        <Section title="Scoring" icon={<Trophy className="h-3.5 w-3.5" />}>
          <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <Row label="ICP score" value={`${prospect.icpScore} / 100`} />
            {prospect.outreachReadiness && (
              <Row label="Outreach readiness" value={prospect.outreachReadiness} />
            )}
            {prospect.painPoints && prospect.painPoints.length > 0 && (
              <Row label="Pain points" value={prospect.painPoints.join(", ")} />
            )}
          </dl>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "break-all font-mono text-xs sm:text-sm" : "break-words"}>{value}</dd>
    </div>
  );
}
