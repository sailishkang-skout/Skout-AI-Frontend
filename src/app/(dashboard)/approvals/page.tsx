"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Field } from "@/components/crm/form-field";
import { useAuthReady } from "@/lib/api-client";
import { CopsRequestError } from "@/lib/cops-fetch";
import { COMMERCIAL_POLL_MS, formatMoney, statusTone } from "@/lib/cops-commercial";
import { advancedErrorMessage, APPROVER_LABEL, describeRule, useCopsAdvancedApi, type Approval, type ApprovalStatus, type ApproverRole } from "@/lib/cops-commercial-advanced";

const STATUS_LABEL: Record<ApprovalStatus, string> = { pending: "Waiting for a decision", approved: "Approved", rejected: "Rejected", voided: "Voided by a change of terms", expired: "Expired" };

/**
 * COPS-08 approval queue (Bible p.34, p.62): the commercial exceptions waiting for a decision.
 * Anyone with an approve permission sees the queue; the API accepts a decision only from someone
 * who holds that approver role, and says so plainly when they do not.
 */
export default function ApprovalsPage() {
  const api = useCopsAdvancedApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ApprovalStatus>("pending");
  const [deciding, setDeciding] = useState<{ approval: Approval; role: ApproverRole; decision: "approved" | "rejected" } | null>(null);
  const queryKey = ["cops-approvals", status];
  const queue = useQuery({
    queryKey,
    queryFn: () => api.approvalQueue(status),
    enabled: authReady,
    refetchInterval: (query) => (query.state.error instanceof CopsRequestError && query.state.error.envelope?.code === "FORBIDDEN" ? false : COMMERCIAL_POLL_MS),
    refetchIntervalInBackground: false,
  });
  const rows = queue.data?.data ?? [];
  const forbidden = queue.error instanceof CopsRequestError && queue.error.envelope?.code === "FORBIDDEN";

  return (
    <div className="space-y-4 p-6" data-testid="page-cops-approvals">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Approvals</h1>
          <p className="text-sm text-muted-foreground">Proposals over a threshold. Each approver role decides its own part; the proposal can go out when all have agreed.</p>
        </div>
        <Select aria-label="Approval status" value={status} onChange={(e) => setStatus(e.target.value as ApprovalStatus)} className="w-56">
          {(Object.keys(STATUS_LABEL) as ApprovalStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{STATUS_LABEL[status]}</CardTitle>
        </CardHeader>
        <CardContent>
          {queue.isLoading ? (
            <Skeleton className="h-40 w-full rounded-md" />
          ) : queue.isError ? (
            <Alert variant={forbidden ? "default" : "error"} data-testid="approvals-error">
              {forbidden ? "The approval queue is visible to roles that can approve commercial terms." : "Could not load the approval queue."}
            </Alert>
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center" data-testid="approvals-empty">
              <p className="text-sm font-medium">{status === "pending" ? "Nothing is waiting for approval" : `No approvals are ${STATUS_LABEL[status].toLowerCase()}`}</p>
              <p className="mt-1 text-sm text-muted-foreground">Deals under every threshold never come here.</p>
            </div>
          ) : (
            <ul className="divide-y rounded-md border" data-testid="approvals-list">
              {rows.map((a) => (
                <li key={a.id} className="space-y-2 p-3" data-testid={`approval-${a.id}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    {(a.opportunity_name || a.account_name) && (
                      <span className="text-sm font-medium">
                        {a.opportunity_name}
                        {a.account_name ? <span className="font-normal text-muted-foreground"> · {a.account_name}</span> : null}
                      </span>
                    )}
                    <span className="text-sm font-medium">{formatMoney(a.terms.contract_value_minor, a.terms.currency)}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.terms.seats} seats · {a.terms.term_months} months · {a.terms.discount_pct}% discount · proposal v{a.proposal_version}
                    </span>
                    <Badge tone={statusTone(a.status === "approved" ? "signed" : a.status === "pending" ? "sent" : "declined")} className="capitalize">
                      {a.status}
                    </Badge>
                    <Link href={a.account_id ? `/crm/360?id=${a.account_id}` : "/commercial"} className="ml-auto text-xs text-primary hover:underline">
                      {a.account_id ? "Open the account" : "Open the Commercial Desk"}
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {a.matched_rules.map((r) => describeRule(r, a.terms.currency, formatMoney)).join(" · ")} · requested {new Date(a.requested_at).toLocaleDateString()}
                    {a.status === "pending" ? ` · lapses ${new Date(a.expires_at).toLocaleDateString()}` : ""}
                    {a.status_reason ? ` · ${a.status_reason}` : ""}
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {a.decisions.map((d) => (
                      <li key={d.role} className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs" data-testid={`decision-${d.role}`}>
                        <span className="font-medium">{APPROVER_LABEL[d.role]}</span>
                        {d.decision === "pending" && a.status === "pending" ? (
                          <>
                            <Button size="sm" onClick={() => setDeciding({ approval: a, role: d.role, decision: "approved" })}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setDeciding({ approval: a, role: d.role, decision: "rejected" })}>
                              Reject
                            </Button>
                          </>
                        ) : (
                          <Badge tone={d.decision === "approved" ? "success" : d.decision === "rejected" ? "danger" : "muted"} className="capitalize">
                            {d.decision}
                          </Badge>
                        )}
                        {d.comment && <span className="text-muted-foreground">“{d.comment}”</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <DecisionDialog
        deciding={deciding}
        onClose={() => setDeciding(null)}
        onSubmit={async (comment) => {
          if (!deciding) return;
          const res = await api.decideApproval(deciding.approval.id, { role: deciding.role, decision: deciding.decision, ...(comment ? { comment } : {}) });
          toast({ title: deciding.decision === "approved" ? (res.data.status === "approved" ? "Approved: the proposal can go out" : "Your approval is recorded") : "Rejected", variant: "success" });
          await queryClient.invalidateQueries({ queryKey: ["cops-approvals"] });
        }}
      />
    </div>
  );
}

function DecisionDialog({ deciding, onClose, onSubmit }: { deciding: { role: ApproverRole; decision: "approved" | "rejected" } | null; onClose: () => void; onSubmit: (comment: string) => Promise<void> }) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rejecting = deciding?.decision === "rejected";

  useEffect(() => {
    setComment("");
    setError(null);
    setBusy(false);
  }, [deciding]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(comment.trim());
      onClose();
    } catch (err) {
      setError(advancedErrorMessage(err, "Could not record the decision."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={deciding !== null}
      onClose={onClose}
      title={deciding ? `${rejecting ? "Reject" : "Approve"} as ${APPROVER_LABEL[deciding.role]}` : ""}
      description="Your decision, name and the time are recorded in the audit log."
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="error" data-testid="decision-error">
            {error}
          </Alert>
        )}
        <Field label={rejecting ? "Why are you rejecting?" : "Comment (optional)"} required={rejecting}>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={2000}
            aria-label="Comment"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={rejecting ? "destructive" : "default"} onClick={submit} disabled={busy || (rejecting && !comment.trim())}>
            {busy && <Loader2 className="animate-spin" />}
            {rejecting ? "Reject" : "Approve"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
