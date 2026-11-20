"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SECTION_STATE_WORDS, VERIFICATION_LABELS, VERIFICATION_TONES, timeAgo, type CaptureVerification } from "@/lib/company-jobs";

const SECTION_NAMES: Record<string, string> = { skills: "Skills", education: "Education", experience: "Experience", people: "People", jobs: "Job roles", about: "Company details" };

/** What the capture's verification scan concluded: the status, each section, and what was not found. */
export function CaptureVerificationCard({ verification, subject }: { verification: CaptureVerification | null | undefined; subject: "profile" | "company" }) {
  if (!verification) {
    return (
      <Card data-testid="capture-verification">
        <CardContent className="space-y-1 p-6">
          <h2 className="font-semibold">Capture verification</h2>
          <p className="text-sm text-muted-foreground">
            This {subject} was captured before verification scans existed. Capture it again with the Skout extension to see whether every section was loaded and checked.
          </p>
        </CardContent>
      </Card>
    );
  }
  const sections = Object.entries(verification.sections ?? {});
  const notes = (verification.notes ?? []).filter((note) => !/^(Skills|Education|Experience): captured/.test(note));
  return (
    <Card data-testid="capture-verification">
      <CardContent className="space-y-3 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Capture verification</h2>
          <Badge tone={VERIFICATION_TONES[verification.status]}>{VERIFICATION_LABELS[verification.status]}</Badge>
          <span className="text-xs text-muted-foreground">
            {verification.passes} scan{verification.passes === 1 ? "" : "s"}
            {verification.verifiedAt ? ` · ${timeAgo(verification.verifiedAt)}` : ""}
          </span>
        </div>
        {sections.length > 0 && (
          <ul className="divide-y text-sm" aria-label="Verified sections">
            {sections.map(([key, section]) => (
              <li key={key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium">
                  {SECTION_NAMES[key] ?? key} <span className="font-normal text-muted-foreground">{section.found}{section.expected !== undefined ? ` of ${section.expected}` : ""}</span>
                </span>
                <Badge tone={section.state === "complete" || section.state === "none" ? "success" : section.state === "incomplete" || section.state === "not_loaded" ? "warning" : "danger"}>
                  {SECTION_STATE_WORDS[section.state]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        {verification.missing && verification.missing.length > 0 && (
          <p className="text-sm">
            <span className="font-medium">Not found on LinkedIn:</span> <span className="text-muted-foreground">{verification.missing.join(", ")}</span>
          </p>
        )}
        {notes.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
