"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ApiError, formatQueryError, useAuthReady } from "@/lib/api-client";
import { campaignStatus, sendBlockedReason, useCampaignApi, type CampaignDetail, type DraftStep, type Recipient } from "@/lib/enrichment-campaigns";
import { VERIFICATION, type VerificationStatus } from "@/lib/enrichment-provider";
import { formatCaptureDate } from "@/lib/enrichment-research";
import { useWorkspaceRole } from "@/lib/workspace-role";
import { ClaimEvidence } from "./claim-evidence";

const EDITABLE = new Set(["draft", "pending_review", "approved", "rejected", "changes_required"]);
const TEXTAREA =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const message = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.status === 403 ? "You don't have permission for this action. Ask a workspace admin." : formatQueryError(error, fallback);

/** Step copy. Step 1 carries each recipient's opening; the talking points themselves are shown per recipient below. */
function Composer({ detail, canEdit, onSave, saving }: { detail: CampaignDetail; canEdit: boolean; onSave: (steps: DraftStep[]) => void; saving: boolean }) {
  const [steps, setSteps] = useState<DraftStep[]>(detail.draft.steps);
  const saved = JSON.stringify(detail.draft.steps);
  useEffect(() => setSteps(JSON.parse(saved) as DraftStep[]), [saved]);
  const dirty = JSON.stringify(steps) !== saved;
  const edit = (order: number, patch: Partial<DraftStep>) => setSteps((current) => current.map((step) => (step.order === order ? { ...step, ...patch } : step)));

  return (
    <Card data-testid="composer">
      <CardContent className="space-y-4 p-6">
        <div>
          <h2 className="font-semibold">Copy</h2>
          <p className="text-sm text-muted-foreground">
            <code>{detail.openingToken}</code> in step 1 is replaced, per recipient, by the talking points shown in the recipient table — each one worded from a single piece of evidence. Follow-ups say nothing about the recipient.
          </p>
        </div>
        {detail.problems.length > 0 && (
          <Alert variant="warning" title="Finish the copy before submitting">
            <ul className="list-disc pl-4">
              {detail.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </Alert>
        )}
        {steps.map((step) => (
          <fieldset key={step.order} className="space-y-2 rounded-md border p-3" disabled={!canEdit}>
            <legend className="px-1 text-sm font-medium">
              Step {step.order} · {step.order === 1 ? "sent on enrollment" : `${step.delayDays} day${step.delayDays === 1 ? "" : "s"} after the previous step`}
            </legend>
            <Input aria-label={`Step ${step.order} subject`} value={step.subject} onChange={(event) => edit(step.order, { subject: event.target.value })} />
            <textarea aria-label={`Step ${step.order} body`} className={TEXTAREA} rows={step.order === 1 ? 9 : 5} value={step.body} onChange={(event) => edit(step.order, { body: event.target.value })} />
          </fieldset>
        ))}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={!dirty || saving} onClick={() => onSave(steps)}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save copy
            </Button>
            {detail.campaign.approvedAt && dirty && <p className="text-sm text-amber-700 dark:text-amber-300">Saving withdraws the current approval; the campaign will need review again.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecipientRow({ recipient, canEdit, onDecide, busy }: { recipient: Recipient; canEdit: boolean; onDecide: (decision: "included" | "removed", comment?: string) => void; busy: boolean }) {
  const [comment, setComment] = useState("");
  const verification = VERIFICATION[recipient.emailVerification as VerificationStatus] ?? VERIFICATION.unverified;
  const { claims } = recipient;
  const inCopy = claims.reason ? [claims.reason, ...claims.talkingPoints.slice(0, 1)] : [];
  const excluded = recipient.eligibility === "excluded";

  return (
    <tr className="border-t align-top" data-testid="recipient" data-eligibility={recipient.eligibility} data-decision={recipient.decision}>
      <td className="space-y-1 py-3 pr-3">
        <Link href={`/enrichment/people/${encodeURIComponent(recipient.prospectId)}`} className="font-medium text-primary underline-offset-4 hover:underline">
          {recipient.fullName ?? "Not captured yet"}
        </Link>
        <p className="break-all text-muted-foreground">{recipient.email ?? "No email"}</p>
        <div className="flex flex-wrap gap-1">
          <Badge tone={verification.tone}>{verification.label}</Badge>
          <Badge tone={recipient.consentStatus === "active" ? "success" : "muted"}>{recipient.consentStatus === "active" ? "Consent on record" : "No consent record"}</Badge>
          <Badge tone={recipient.suppressed ? "danger" : "muted"}>{recipient.suppressed ? "Suppressed" : "Not suppressed"}</Badge>
        </div>
      </td>
      <td className="py-3 pr-3">
        {inCopy.length > 0 ? (
          <ul className="space-y-2">
            {inCopy.map((claim) => (
              <ClaimEvidence key={claim.evidenceId} claim={claim} />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No supported talking point. Step 1 goes out without an opening line.</p>
        )}
        {claims.flagged.length > 0 && (
          <ul className="mt-2 space-y-2 border-t pt-2">
            {claims.flagged.map((claim) => (
              <ClaimEvidence key={claim.evidenceId} claim={claim} />
            ))}
          </ul>
        )}
      </td>
      <td className="space-y-2 py-3">
        {excluded ? (
          <>
            <Badge tone="danger">Excluded</Badge>
            <p className="text-sm">{recipient.exclusionMessage ?? "Cannot be contacted."}</p>
          </>
        ) : (
          <>
            <Badge tone={recipient.decision === "included" ? "success" : "muted"}>{recipient.decision === "included" ? "Included" : "Removed"}</Badge>
            {recipient.decisionComment && <p className="text-sm text-muted-foreground">“{recipient.decisionComment}”</p>}
            {recipient.enrolled && <p className="text-xs text-muted-foreground">Enrolled{recipient.outcome.sentAt ? ` · first email ${formatCaptureDate(recipient.outcome.sentAt)}` : ""}</p>}
            {recipient.outcome.repliedAt && <Badge tone="success">Replied</Badge>}
            {recipient.outcome.bouncedAt && <Badge tone="danger">Bounced</Badge>}
            {recipient.outcome.unsubscribedAt && <Badge tone="warning">Unsubscribed</Badge>}
            {canEdit && !recipient.enrolled && (
              <div className="space-y-1">
                {recipient.decision === "included" && (
                  <Input aria-label={`Reason for removing ${recipient.fullName ?? "this recipient"}`} placeholder="Reason (optional)" value={comment} onChange={(event) => setComment(event.target.value)} />
                )}
                <Button variant="outline" disabled={busy} onClick={() => onDecide(recipient.decision === "included" ? "removed" : "included", comment.trim() || undefined)}>
                  {recipient.decision === "included" ? "Remove" : "Include"}
                </Button>
              </div>
            )}
          </>
        )}
      </td>
    </tr>
  );
}

export function CampaignDetailView({ campaignId }: { campaignId: string }) {
  const api = useCampaignApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { hasPermission } = useWorkspaceRole();
  const canBuild = hasPermission("enrichment:enrich");
  const canApprove = hasPermission("sequences:send");
  const [comment, setComment] = useState("");
  const [consentBasis, setConsentBasis] = useState("");
  const [notice, setNotice] = useState("");

  const key = ["enrichment-campaigns", "detail", campaignId];
  const query = useQuery({ queryKey: key, queryFn: () => api.campaign(campaignId), enabled: authReady });
  const done = async (result?: CampaignDetail) => {
    if (result?.campaign) queryClient.setQueryData(key, result);
    else await queryClient.invalidateQueries({ queryKey: key });
    await queryClient.invalidateQueries({ queryKey: ["enrichment-campaigns", "list"] });
    await queryClient.invalidateQueries({ queryKey: ["enrichment-campaigns", "review-queue"] });
  };

  const saveDraft = useMutation({ mutationFn: (steps: DraftStep[]) => api.saveDraft(campaignId, steps), onSuccess: () => done() });
  const decide = useMutation({
    mutationFn: (input: { prospectId: string; decision: "included" | "removed"; comment?: string }) => api.setRecipient(campaignId, input.prospectId, input.decision, input.comment),
    onSuccess: () => done(),
  });
  const refresh = useMutation({ mutationFn: () => api.refresh(campaignId), onSuccess: done });
  const submit = useMutation({ mutationFn: () => api.submit(campaignId), onSuccess: done });
  const review = useMutation({
    mutationFn: (decision: "approved" | "rejected") => api.review(campaignId, decision, comment.trim(), consentBasis.trim() || undefined),
    onSuccess: async (result) => {
      setComment("");
      await done(result);
    },
  });
  const launch = useMutation({
    mutationFn: () => api.launch(campaignId),
    onSuccess: async (result) => {
      setNotice(`Launched. ${result.enrolled} recipient${result.enrolled === 1 ? "" : "s"} enrolled${result.skipped.length ? `; ${result.skipped.length} left out because they can no longer be contacted` : ""}.`);
      await done(result);
    },
    // A refusal usually means the status changed underneath us (for example evidence changed).
    onError: () => done(),
  });

  if (query.isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </PageShell>
    );
  }
  if (query.isError || !query.data) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <PageShell>
        <PageHeader title="Campaign" description="" />
        <Alert variant={missing ? "warning" : "error"} onRetry={missing ? undefined : () => query.refetch()}>
          {missing ? "This campaign is not in the workspace." : formatQueryError(query.error, "Could not load this campaign.")}
        </Alert>
        <Link href="/enrichment/campaigns" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Back to campaigns
        </Link>
      </PageShell>
    );
  }

  const detail = query.data;
  const { campaign, counts } = detail;
  const status = campaignStatus(campaign.status);
  const editable = canBuild && EDITABLE.has(campaign.status);
  const blocked = sendBlockedReason(detail);
  const error = saveDraft.error ?? decide.error ?? refresh.error ?? submit.error ?? review.error ?? launch.error;
  const needsBasis = detail.consentEnforced && counts.consentMissing > 0;
  const canSubmit = ["draft", "rejected", "changes_required"].includes(campaign.status);

  return (
    <PageShell>
      <PageHeader
        title={campaign.name}
        description={campaign.trigger === "job_change" ? "Suggested from a detected job change. Review it like any other campaign; nothing has been sent." : "Review each talking point against its evidence, then approve the recipients and copy."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone} data-testid="campaign-status" data-status={campaign.status}>
              {status.label}
            </Badge>
            {editable && (
              <Button variant="outline" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
                {refresh.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Re-check evidence
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
      {error && (
        <Alert variant="warning" dismissible>
          {message(error, "The action could not be completed.")}
        </Alert>
      )}
      {campaign.status === "changes_required" && (
        <Alert variant="warning" title="Needs review again">
          {campaign.reviewComment ?? "Something changed after approval."} The previous approval no longer applies.
        </Alert>
      )}
      {campaign.status === "rejected" && campaign.reviewComment && (
        <Alert variant="warning" title="Rejected by the reviewer">
          {campaign.reviewComment}
        </Alert>
      )}
      {detail.sandbox.active && (
        <Alert variant="default" title="Sandbox sending">
          {detail.sandbox.allowedRecipients.length
            ? `This is not production. Campaign emails go only to: ${detail.sandbox.allowedRecipients.join(", ")}. Everyone else is skipped.`
            : "This is not production and no sandbox recipients are configured, so launching sends no email."}
        </Alert>
      )}

      <Composer detail={detail} canEdit={editable} onSave={(steps) => saveDraft.mutate(steps)} saving={saveDraft.isPending} />

      <Card data-testid="recipients">
        <CardContent className="space-y-3 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Recipients</h2>
            <p className="text-sm text-muted-foreground">
              {counts.included} of {counts.total} will be enrolled · {counts.excluded} excluded
              {counts.withoutTalkingPoint > 0 && ` · ${counts.withoutTalkingPoint} without a supported talking point`}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Person and contact status</th>
                  <th className="pb-2 pr-3 font-medium">Talking points and their evidence</th>
                  <th className="pb-2 font-medium">Decision</th>
                </tr>
              </thead>
              <tbody>
                {detail.recipients.map((recipient) => (
                  <RecipientRow
                    key={recipient.prospectId}
                    recipient={recipient}
                    canEdit={editable}
                    busy={decide.isPending}
                    onDecide={(decision, reason) => decide.mutate({ prospectId: recipient.prospectId, decision, comment: reason })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="approval">
        <CardContent className="space-y-4 p-6">
          <h2 className="font-semibold">Approval and launch</h2>

          {canSubmit && canBuild && (
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={submit.isPending || detail.problems.length > 0 || counts.included === 0} onClick={() => submit.mutate()}>
                {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit for review
              </Button>
              {counts.included === 0 && <p className="text-sm text-muted-foreground">Nobody in this campaign can be contacted. See each recipient&apos;s reason above.</p>}
            </div>
          )}

          {campaign.status === "pending_review" &&
            (canApprove ? (
              <div className="space-y-2">
                <label htmlFor="review-comment" className="text-sm font-medium">
                  Review comment
                </label>
                <textarea id="review-comment" className={TEXTAREA} rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Required when rejecting; optional when approving." />
                {counts.consentMissing > 0 && (
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">
                      Lawful basis for the {counts.consentMissing} recipient{counts.consentMissing === 1 ? "" : "s"} with no consent record{needsBasis ? " (required)" : ""}
                    </span>
                    <Input className="max-w-sm" value={consentBasis} onChange={(event) => setConsentBasis(event.target.value)} placeholder="e.g. legitimate_interest" />
                  </label>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button disabled={review.isPending || (needsBasis && !consentBasis.trim())} onClick={() => review.mutate("approved")}>
                    {review.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Approve recipients and copy
                  </Button>
                  <Button variant="destructive" disabled={review.isPending || !comment.trim()} title={comment.trim() ? undefined : "Add a comment saying what needs to change"} onClick={() => review.mutate("rejected")}>
                    Reject
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for someone with the send permission to approve or reject this campaign.</p>
            ))}

          <div className="space-y-1 border-t pt-4">
            <Button disabled={!detail.sendEnabled || !canApprove || launch.isPending} title={blocked ?? (canApprove ? undefined : "You need the send permission to launch")} onClick={() => launch.mutate()}>
              {launch.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Launch sequence
            </Button>
            <p className="text-sm text-muted-foreground" data-testid="send-state">
              {blocked ??
                (canApprove
                  ? `Approved ${formatCaptureDate(campaign.approvedAt)}. Launching enrolls the ${counts.included} included recipient${counts.included === 1 ? "" : "s"} in a new sequence.`
                  : "Approved. Someone with the send permission can launch it.")}
            </p>
          </div>

          {campaign.status === "launched" && (
            <dl className="grid gap-3 border-t pt-4 sm:grid-cols-5" data-testid="outcomes">
              {(["enrolled", "sent", "replied", "bounced", "unsubscribed"] as const).map((outcome) => (
                <div key={outcome}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{outcome}</dt>
                  <dd className="text-xl font-semibold">{detail.outcomes[outcome]}</dd>
                </div>
              ))}
            </dl>
          )}

          {detail.reviews.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium">Review history</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {detail.reviews.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-2">
                    <Badge tone={entry.decision === "approved" ? "success" : entry.decision === "rejected" ? "danger" : "warning"}>
                      {entry.decision === "invalidated" ? "Approval withdrawn" : entry.decision === "approved" ? "Approved" : "Rejected"}
                    </Badge>
                    <span className="text-muted-foreground">{formatCaptureDate(entry.createdAt)}</span>
                    {entry.comment && <span>“{entry.comment}”</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
