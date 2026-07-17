"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, CheckCheck, ExternalLink, Loader2, Pencil, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import {
  aiDraftStatusLabel,
  aiDraftStatusTone,
  draftSendFailureLabel,
  useAiDraftsApi,
} from "@/lib/ai-drafts";
import { cn } from "@/lib/utils";
import type { AiDraft, AiDraftStatus } from "@/types/api";

const STATUS_FILTERS: { label: string; value: AiDraftStatus | "all" }[] = [
  { label: "Needs review", value: "pending_review" },
  { label: "Edited", value: "edited" },
  { label: "Approved", value: "approved" },
  { label: "Sent", value: "sent" },
  { label: "Rejected", value: "rejected" },
  { label: "All", value: "all" },
];

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value.trim());
}

/** Strip anything unsafe before rendering AI/model HTML in the review preview. */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "");
}

/**
 * Preview-only: swap merge tokens for the draft's REAL prospect data so reviewers see
 * roughly what the recipient will get. Tokens we don't have a real value for (e.g.
 * {{senderName}}, {{unsubscribeUrl}}, or a missing title) are left as-is — never replaced
 * with invented filler — and highlighted separately so it's clear they resolve at send time.
 * The stored template always keeps its {{tokens}}; only this on-screen preview is resolved.
 */
const PREVIEW_UNSUBSCRIBE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/v1/unsubscribe/preview`;

function resolvePreviewTokens(text: string, draft: AiDraft): string {
  const fullName = draft.prospectName?.trim();
  const firstName = fullName ? fullName.split(/\s+/)[0] : undefined;
  const values: Record<string, string | undefined> = {
    firstName,
    lastName: fullName ? fullName.split(/\s+/).slice(1).join(" ") || undefined : undefined,
    fullName,
    companyName: draft.companyName?.trim() || undefined,
    companyDomain: draft.companyName?.trim() || undefined,
    title: draft.prospectTitle?.trim() || undefined,
    // Resolve to a representative URL so the preview link is real (the true per-recipient
    // unsubscribe URL is generated at send time). Kept here because it lives inside an href.
    unsubscribeUrl: PREVIEW_UNSUBSCRIBE_URL,
  };
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * Wrap any leftover {{token}} in a subtle chip so reviewers know it fills in at send time.
 * Tag-aware: HTML tags/attributes are matched as whole units and left untouched, so tokens
 * inside attributes (e.g. href="{{...}}") are never wrapped (which would corrupt the markup).
 */
function highlightTokens(html: string): string {
  return html.replace(/(<[^>]*>)|(\{\{\w+\}\})/g, (_match, tag: string, token: string) => {
    if (tag) return tag;
    return `<span class="rounded bg-amber-100 px-1 text-[0.85em] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">${token}</span>`;
  });
}

export default function AiReviewPage() {
  const api = useAiDraftsApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AiDraftStatus | "all">("pending_review");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const drafts = useQuery({
    queryKey: ["ai-drafts", status],
    queryFn: () => api.list(status === "all" ? {} : { status }),
    enabled: authReady,
  });

  const items = drafts.data?.data ?? [];
  const reviewable = useMemo(
    () => items.filter((d) => d.status === "pending_review" || d.status === "edited"),
    [items]
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ai-drafts"] });

  const approve = useMutation({
    mutationFn: (id: string) => api.approve(id),
    onSuccess: (draft) => {
      const send = draft.send;
      if (send?.sent) {
        setMessage(
          `Draft approved — email sent${send.to ? ` to ${send.to}` : ""}. View it in Inbox → Sent.`
        );
        setStatus("sent");
      } else if (send && !send.sent) {
        setError(`Draft approved, but the email ${draftSendFailureLabel(send.reason)}.`);
        setStatus("approved");
      } else {
        // Enrollment-linked drafts send when their sequence step runs.
        setMessage("Draft approved — it will send with its sequence step");
        setStatus("approved");
      }
      setSelected(new Set());
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.reject(id),
    onSuccess: () => {
      setMessage("Draft rejected");
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const saveEdit = useMutation({
    mutationFn: ({ id, subject, body }: { id: string; subject: string; body: string }) =>
      api.update(id, { subject, body }),
    onSuccess: () => {
      setEditingId(null);
      setStatus("edited");
      setMessage("Draft saved — moved to Edited");
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const bulkApprove = useMutation({
    mutationFn: (ids: string[]) => api.bulkApprove(ids),
    onSuccess: (res) => {
      const parts = [`Approved ${res.approved} draft${res.approved === 1 ? "" : "s"}`];
      if (res.sent > 0) parts.push(`sent ${res.sent} (Inbox → Sent)`);
      setMessage(`${parts.join(" — ")}.`);
      if (res.sendFailures.length > 0) {
        setError(
          `${res.sendFailures.length} approved draft${
            res.sendFailures.length === 1 ? "" : "s"
          } could not be emailed (e.g. ${draftSendFailureLabel(res.sendFailures[0]?.reason)}).`
        );
      }
      if (res.sent > 0) setStatus("sent");
      setSelected(new Set());
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const startEdit = (d: AiDraft) => {
    setEditingId(d.id);
    setEditSubject(d.subject);
    setEditBody(d.body);
    setError(null);
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <PageShell data-testid="page-ai-review">
      <PageHeader
        title="AI Review Queue"
        description="Approve & send AI outreach drafts. Sent mail appears in Inbox → Sent (Outbox)."
      />

      <div className="space-y-2">
        {message && (
          <Alert variant="success" dismissible>
            {message}
          </Alert>
        )}
        {error && (
          <Alert variant="error" dismissible>
            {error}
          </Alert>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as AiDraftStatus | "all");
            setSelected(new Set());
          }}
          className="w-44"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>

        <span className="text-sm text-muted-foreground">
          {drafts.data ? `${drafts.data.total} draft${drafts.data.total === 1 ? "" : "s"}` : "—"}
        </span>

        <div className="ml-auto flex flex-wrap gap-2">
          <Link
            href="/inbox?folder=sent"
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Sent / Outbox
          </Link>
          {reviewable.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelected(new Set(reviewable.map((d) => d.id)))}
            >
              Select reviewable ({reviewable.length})
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={selected.size === 0 || bulkApprove.isPending}
            onClick={() => bulkApprove.mutate(Array.from(selected))}
          >
            {bulkApprove.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            )}
            Bulk approve ({selected.size})
          </Button>
        </div>
      </div>

      {drafts.isPending && (
        <div className="space-y-3">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      )}

      {drafts.isError && (
        <Alert variant="error">Could not load drafts. Check that the API is running.</Alert>
      )}

      {!drafts.isPending && items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No drafts in this queue</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Drafts appear here after personalization or when you generate outreach with AI.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((draft) => {
          const canReview = draft.status === "pending_review" || draft.status === "edited";
          const isEditing = editingId === draft.id;
          return (
            <article
              key={draft.id}
              data-draft-id={draft.id}
              className={cn(
                "rounded-xl border border-border bg-background p-4",
                selected.has(draft.id) && "ring-2 ring-primary/40"
              )}
            >
              <div className="flex flex-wrap items-start gap-3">
                {canReview && (
                  <input
                    type="checkbox"
                    className="mt-1"
                    aria-label={`Select draft ${draft.subject}`}
                    checked={selected.has(draft.id)}
                    onChange={() => toggleSelected(draft.id)}
                  />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={aiDraftStatusTone(draft.status)}>
                      {aiDraftStatusLabel(draft.status)}
                    </Badge>
                    {draft.icpScore != null && <Badge tone="muted">ICP {draft.icpScore}</Badge>}
                    {draft.model && <Badge tone="muted">{draft.model}</Badge>}
                  </div>

                  <div>
                    <p className="font-medium">
                      {draft.prospectName || draft.prospectId}
                      {draft.prospectTitle ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {draft.prospectTitle}
                        </span>
                      ) : null}
                    </p>
                    {draft.companyName && (
                      <p className="text-sm text-muted-foreground">{draft.companyName}</p>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        aria-label="Draft subject"
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                      />
                      <textarea
                        aria-label="Draft body"
                        rows={8}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={saveEdit.isPending || !editSubject.trim() || !editBody.trim()}
                          onClick={() =>
                            saveEdit.mutate({
                              id: draft.id,
                              subject: editSubject.trim(),
                              body: editBody.trim(),
                            })
                          }
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {resolvePreviewTokens(draft.subject, draft)}
                      </p>
                      {looksLikeHtml(draft.body) ? (
                        <div
                          className="prose prose-sm max-w-none rounded-lg bg-muted/40 p-3 text-sm [&_*]:!text-foreground"
                          dangerouslySetInnerHTML={{
                            __html: highlightTokens(
                              sanitizeHtml(resolvePreviewTokens(draft.body, draft))
                            ),
                          }}
                        />
                      ) : (
                        <pre className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm text-foreground/90">
                          {resolvePreviewTokens(draft.body, draft)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>

                {!isEditing && canReview && (
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <Button type="button" size="sm" variant="outline" onClick={() => startEdit(draft)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate(draft.id)}
                    >
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      Approve & send
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={reject.isPending}
                      onClick={() => reject.mutate(draft.id)}
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                )}
                {!isEditing && draft.status === "approved" && !draft.enrollmentStepId && (
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      size="sm"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate(draft.id)}
                    >
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      Retry send
                    </Button>
                  </div>
                )}
                {!isEditing && draft.status === "sent" && (
                  <Link
                    href="/inbox?folder=sent"
                    className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View in Sent
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </PageShell>
  );
}
