"use client";

import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ThreadContext } from "@/types/api";
import type { BadgeProps } from "@/components/ui/badge";

function icpBandTone(band: string | null): BadgeProps["tone"] {
  switch (band?.toLowerCase()) {
    case "high":
      return "success";
    case "medium":
      return "warning";
    case "low":
      return "danger";
    default:
      return "muted";
  }
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between gap-3 py-2 border-b last:border-0 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium break-all">{String(value)}</span>
    </div>
  );
}

export function ContextPanel({
  open,
  onClose,
  context,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  context: ThreadContext | null | undefined;
  loading: boolean;
}) {
  const prospect = context?.prospect ?? null;
  const sequence = context?.sequence ?? null;

  return (
    <Sheet open={open} onClose={onClose} title="Prospect & Sequence">
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : !prospect && !sequence ? (
        <p className="text-sm text-muted-foreground">
          No context available for this thread.
        </p>
      ) : (
        <div className="space-y-8">
          {/* Prospect section */}
          {prospect && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Prospect
              </h3>

              {/* Name + title card */}
              <div className="rounded-lg bg-muted/40 px-3 py-2.5 mb-3">
                <p className="font-semibold text-sm">{prospect.fullName ?? "—"}</p>
                {prospect.title && (
                  <p className="text-xs text-muted-foreground mt-0.5">{prospect.title}</p>
                )}
                {prospect.companyName && (
                  <p className="text-xs text-muted-foreground">{prospect.companyName}</p>
                )}
              </div>

              <div className="divide-y">
                <Row label="Email" value={prospect.email} />
                <Row label="Domain" value={prospect.companyDomain} />
                <Row label="Industry" value={prospect.industry} />
                <Row label="Country" value={prospect.country} />
                <Row
                  label="Employees"
                  value={
                    prospect.employeeCount != null
                      ? prospect.employeeCount.toLocaleString()
                      : null
                  }
                />
                {prospect.linkedinUrl && (
                  <div className="flex justify-between gap-3 py-2 border-b last:border-0 text-sm">
                    <span className="text-muted-foreground shrink-0">LinkedIn</span>
                    <a
                      href={prospect.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2 text-right"
                    >
                      View profile
                    </a>
                  </div>
                )}
              </div>

              {/* ICP score */}
              {(prospect.icpScore !== null || prospect.icpBand !== null) && (
                <div className="mt-4 rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground">ICP Score</span>
                    {prospect.icpBand && (
                      <Badge tone={icpBandTone(prospect.icpBand)}>{prospect.icpBand}</Badge>
                    )}
                  </div>
                  {prospect.icpScore !== null && (
                    <>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-semibold">{prospect.icpScore} / 100</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${prospect.icpScore}%` }}
                        />
                      </div>
                    </>
                  )}
                  {prospect.icpReasoning && (
                    <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">
                      {prospect.icpReasoning}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Sequence section */}
          {sequence && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Sequence
              </h3>
              <div className="divide-y">
                <Row label="Name" value={sequence.sequenceName} />
                <Row label="Status" value={sequence.sequenceStatus} />
                <Row label="Enrollment" value={sequence.enrollmentStatus} />
                <Row
                  label="Enrolled"
                  value={new Date(sequence.enrolledAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                />
                {sequence.completedAt && (
                  <Row
                    label="Completed"
                    value={new Date(sequence.completedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  />
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}
