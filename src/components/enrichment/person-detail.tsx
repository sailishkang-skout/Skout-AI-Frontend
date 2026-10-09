"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ApiError, formatQueryError, useAuthReady } from "@/lib/api-client";
import {
  downloadBlob,
  factsByAttribute,
  formatCaptureDate,
  sourceLabel,
  useResearchApi,
  type CapturedItem,
  type ChangeEvent,
  type EvidenceFact,
} from "@/lib/enrichment-research";
import { useWorkspaceRole } from "@/lib/workspace-role";
import { EmploymentBadge, EvidenceBadge, Fact, IdentityBadge } from "./evidence-badge";

const str = (value: unknown): string => (typeof value === "string" ? value : "");

function Section({ title, fact, children }: { title: string; fact?: EvidenceFact; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{title}</h2>
          <EvidenceBadge fact={fact} />
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Timeline({ items, empty }: { items: CapturedItem[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="space-y-3 border-l pl-4">
      {items.map((item, index) => (
        <li key={`${str(item.name)}-${str(item.title)}-${index}`} className="text-sm">
          <p className="font-medium">{str(item.title) || "Role not shown"}</p>
          <p className="text-muted-foreground">{[str(item.name), str(item.employmentType), str(item.dates), str(item.location)].filter(Boolean).join(" · ")}</p>
          {str(item.description) && <p className="mt-1 whitespace-pre-line text-muted-foreground">{str(item.description)}</p>}
        </li>
      ))}
    </ol>
  );
}

export function describeChange(change: ChangeEvent): string {
  const role = (value: unknown) => {
    const first = Array.isArray(value) ? (value[0] as CapturedItem | undefined) : undefined;
    return first ? [str(first.title), str(first.name)].filter(Boolean).join(" at ") : "";
  };
  const show = (value: unknown) => (change.field === "currentCompanies" ? role(value) : typeof value === "string" ? value : value == null ? "" : "updated");
  const before = show(change.oldValue);
  const after = show(change.newValue);
  return before && after ? `${before} → ${after}` : after || before || "updated";
}

export function PersonDetailView({ prospectId }: { prospectId: string }) {
  const api = useResearchApi();
  const authReady = useAuthReady();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useWorkspaceRole();
  const [attachUrl, setAttachUrl] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState("");

  const detail = useQuery({
    queryKey: ["enrichment-research", "person", prospectId],
    queryFn: () => api.person(prospectId),
    enabled: authReady,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["enrichment-research"] });

  const attach = useMutation({
    mutationFn: () => api.attachPublicUrl(prospectId, attachUrl.trim()),
    onSuccess: async (result) => {
      setAttachUrl("");
      await refresh();
      if (result.prospectId !== prospectId) router.replace(`/enrichment/people/${result.prospectId}`);
      else setNotice("Public profile URL attached. Capture that profile to verify the current employer.");
    },
  });
  const reEnrich = useMutation({
    mutationFn: () => api.reEnrich(detail.data!.person),
    onSuccess: (job) => setNotice(`Re-enrichment queued (job ${job.jobId.slice(0, 8)}, ${job.status}). Results appear on the Enrichment overview.`),
  });
  const csv = useMutation({
    mutationFn: () => api.personCsv(prospectId),
    onSuccess: (blob) => downloadBlob(blob, `person-${prospectId.slice(0, 12)}.csv`),
  });
  const remove = useMutation({
    mutationFn: () => api.deletePerson(prospectId),
    onSuccess: async () => {
      await refresh();
      router.push("/enrichment/people");
    },
  });

  if (detail.isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </PageShell>
    );
  }
  if (detail.isError || !detail.data) {
    const missing = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <PageShell>
        <PageHeader title="Person" description="" />
        <Alert variant={missing ? "warning" : "error"} onRetry={missing ? undefined : () => detail.refetch()}>
          {missing ? "This person is not in the workspace. They may have been deleted or merged into another record." : formatQueryError(detail.error, "Could not load this person.")}
        </Alert>
        <Link href="/enrichment/people" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Back to people
        </Link>
      </PageShell>
    );
  }

  const person = detail.data.person;
  const facts = factsByAttribute(person.facts);
  const mutationError = attach.error ?? reEnrich.error ?? csv.error ?? remove.error;
  const relationship = person.relationshipContext ?? {};
  const relationshipLines = [
    typeof relationship.degree === "number" ? `${relationship.degree}${["st", "nd", "rd"][relationship.degree - 1] ?? "th"}-degree connection` : "",
    str(relationship.mutualConnectionsText),
    str(relationship.sharedCompanyText),
  ].filter(Boolean);

  return (
    <PageShell>
      <PageHeader
        title={person.fullName ?? "Not captured yet"}
        description={person.headline ?? (person.pendingCapture ? "Only the LinkedIn URL is saved. Open the profile and capture it with the Skout extension." : "")}
        actions={
          <div className="flex flex-wrap gap-2">
            {hasPermission("enrichment:enrich") && (
              <Button
                variant="outline"
                disabled={reEnrich.isPending || !person.companyDomain}
                title={person.companyDomain ? undefined : "Re-enrichment needs a company for this person"}
                onClick={() => reEnrich.mutate()}
              >
                {reEnrich.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Re-enrich
              </Button>
            )}
            {hasPermission("enrichment:export") && (
              <Button variant="outline" disabled={csv.isPending} onClick={() => csv.mutate()}>
                <Download className="h-4 w-4" />
                CSV
              </Button>
            )}
            {hasPermission("enrichment:delete") && (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        }
      />

      {notice && (
        <Alert variant="success" dismissible>
          {notice}
        </Alert>
      )}
      {mutationError && (
        <Alert variant="warning" dismissible>
          {mutationError instanceof ApiError && mutationError.status === 403
            ? "You don't have permission for this action. Ask a workspace admin."
            : formatQueryError(mutationError, "The action could not be completed.")}
        </Alert>
      )}
      {person.freshness.stale && (
        <Alert variant="warning">
          Everything here was captured more than 90 days ago (last capture {formatCaptureDate(person.freshness.capturedAt)}). Capture the profile again before relying on it.
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <EmploymentBadge state={person.employmentState} />
            <IdentityBadge identity={person.identity} />
            <Badge tone="muted">Last captured {formatCaptureDate(person.freshness.capturedAt)}</Badge>
            {person.linkedinUrl && (
              <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
                Open LinkedIn profile <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {!person.linkedinUrl && person.salesNavigatorLeadUrl && (
              <a href={person.salesNavigatorLeadUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
                Open Sales Navigator lead <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Name" fact={facts.fullName}>{person.fullName ?? "Not captured"}</Fact>
            <Fact label="Headline" fact={facts.headline}>{person.headline ?? "Not captured"}</Fact>
            <Fact label="Current employer" fact={facts.employment}>
              {person.companyId ? (
                <Link href={`/enrichment/companies/${person.companyId}`} className="text-primary underline-offset-4 hover:underline">
                  {person.companyName}
                </Link>
              ) : (
                person.companyName ?? "Not captured"
              )}
              {person.title ? ` · ${person.title}` : ""}
              {person.employmentState === "candidate" && (
                <span className="block text-xs text-muted-foreground">Seen on a search card. Not confirmed by this person&apos;s own profile.</span>
              )}
            </Fact>
            <Fact label="Location" fact={facts.locationName}>{person.location ?? "Not captured"}</Fact>
          </dl>
        </CardContent>
      </Card>

      {person.identity === "sales_lead" && hasPermission("enrichment:capture") && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="font-semibold">Attach the public LinkedIn profile</h2>
            <p className="text-sm text-muted-foreground">
              This record is a Sales Navigator lead without a public profile link. If you have opened this person&apos;s real public profile, paste its URL. Skout never builds a profile URL from a lead ID, and attaching one does not verify their employer.
            </p>
            <div className="flex flex-wrap gap-2">
              <Input className="max-w-md" aria-label="Public LinkedIn profile URL" placeholder="https://www.linkedin.com/in/…" value={attachUrl} onChange={(event) => setAttachUrl(event.target.value)} />
              <Button disabled={!attachUrl.trim() || attach.isPending} onClick={() => attach.mutate()}>
                {attach.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Attach URL
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {person.summary && (
        <Section title="About" fact={facts.summary}>
          <p className="whitespace-pre-line text-sm">{person.summary}</p>
        </Section>
      )}

      <Section title="Experience" fact={facts.currentCompanies ?? facts.previousCompanies}>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current</h3>
        <Timeline items={person.experience.current} empty="No current role captured." />
        <h3 className="flex items-center gap-2 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Past {person.experience.previous.length > 0 && <EvidenceBadge fact={facts.previousCompanies} />}
        </h3>
        <Timeline items={person.experience.previous} empty="No past roles captured." />
      </Section>

      <Section title="Education" fact={facts.educations}>
        {person.educations.length ? (
          <ul className="space-y-2 text-sm">
            {person.educations.map((item, index) => (
              <li key={`${str(item.school)}-${index}`}>
                <span className="font-medium">{str(item.school)}</span>
                {str(item.degree) && <span className="text-muted-foreground"> · {str(item.degree)}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No education captured.</p>
        )}
      </Section>

      <Section title="Skills" fact={facts.skills}>
        {person.skills.length ? (
          <div className="flex flex-wrap gap-1">
            {person.skills.map((skill, index) => {
              const name = typeof skill === "string" ? skill : str(skill.name);
              const endorsements = typeof skill === "object" && typeof skill.endorsements === "number" ? ` · ${skill.endorsements}` : "";
              return (
                <Badge key={`${name}-${index}`} tone="muted">
                  {name}
                  {endorsements}
                </Badge>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No skills captured.</p>
        )}
      </Section>

      <Section title="Relationship context" fact={facts.relationshipContext}>
        {relationshipLines.length ? (
          <ul className="space-y-1 text-sm">
            {relationshipLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No relationship context captured.</p>
        )}
        <p className="text-xs text-muted-foreground">Relationship details depend on who captured the page.</p>
      </Section>

      {person.candidateCompanies.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="font-semibold">Seen at these companies</h2>
            <ul className="space-y-2 text-sm">
              {person.candidateCompanies.map((item) => (
                <li key={item.companyId} className="flex flex-wrap items-center gap-2">
                  <Link href={`/enrichment/companies/${item.companyId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {item.companyName}
                  </Link>
                  <Badge tone="muted">
                    {item.source.replace(/[-_]/g, " ")} · {formatCaptureDate(item.capturedAt)}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="font-semibold">Captured evidence</h2>
          {person.evidence.length ? (
            <ul className="divide-y text-sm">
              {person.evidence.map((fact) => (
                <li key={fact.evidenceId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">{fact.attribute}</span>
                  <EvidenceBadge fact={fact} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No evidence recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="font-semibold">Change history</h2>
          {person.changes.length ? (
            <ul className="divide-y text-sm">
              {person.changes.map((change) => (
                <li key={change.id} className="flex flex-wrap items-center gap-2 py-2">
                  {change.isJobChange && <Badge tone="warning">Job change</Badge>}
                  <span className="font-medium">{change.field}</span>
                  <span className="text-muted-foreground">{describeChange(change)}</span>
                  <span className="text-xs text-muted-foreground">detected {formatCaptureDate(change.detectedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No changes detected between captures.</p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${person.fullName ?? "this person"}?`}
        description="Removes the captured record with its identity keys, evidence, snapshots and change history from this workspace. A CRM contact that existed before the capture is kept. The deletion is recorded in the audit log."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete record
          </Button>
        </div>
      </Dialog>
      <p className="text-xs text-muted-foreground">
        Sources: {Array.from(new Set(person.evidence.map((fact) => sourceLabel(fact.source)))).join(", ") || "none recorded"}. LinkedIn content is observed and often self-reported.
      </p>
    </PageShell>
  );
}
