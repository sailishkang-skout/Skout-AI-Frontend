"use client";

import { ExternalLink } from "lucide-react";
import { ScoreBadge } from "@/components/scoring/score-badge";
import { Sheet } from "@/components/ui/sheet";
import {
  memberCompanyDomain,
  memberCompanyLabel,
  memberDisplayName,
  memberSnap,
  memberSubtitle,
} from "@/lib/list-members";
import type { ListMemberDetail } from "@/types/api";

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div className="grid gap-0.5 border-b border-border py-3 last:border-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}

export function ProspectMemberSheet({
  member,
  open,
  onClose,
}: {
  member: ListMemberDetail | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!member) return null;

  const name = memberDisplayName(member);
  const subtitle = memberSubtitle(member);
  const linkedinUrl = memberSnap(member, "linkedinUrl");
  const email = memberSnap(member, "email");
  const phone = memberSnap(member, "phone");
  const industry = memberSnap(member, "industry");
  const country = memberSnap(member, "country");
  const seniority = memberSnap(member, "seniority");
  const companyDomain = memberCompanyDomain(member);
  const company = memberCompanyLabel(member);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={name}
      description={subtitle || "Prospect details"}
    >
      <div className="space-y-4">
        {member.score && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">ICP score</span>
            <ScoreBadge score={member.score.score} reasoning={member.score.reasoning} />
          </div>
        )}

        {linkedinUrl && (
          <a
            href={linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            View LinkedIn profile
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        <dl>
          <DetailRow label="Title" value={memberSnap(member, "title")} />
          <DetailRow label="Company" value={company} />
          <DetailRow label="Company domain" value={companyDomain} />
          <DetailRow label="Email" value={email} />
          <DetailRow label="Phone" value={phone} />
          <DetailRow label="Seniority" value={seniority} />
          <DetailRow label="Industry" value={industry} />
          <DetailRow label="Country" value={country} />
          <DetailRow label="Added to list" value={new Date(member.addedAt).toLocaleString()} />
          <DetailRow label="Prospect ID" value={member.prospectId} />
        </dl>
      </div>
    </Sheet>
  );
}
