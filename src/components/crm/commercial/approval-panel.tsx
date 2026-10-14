"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useAuthReady } from "@/lib/api-client";
import { COMMERCIAL_POLL_MS, formatMoney } from "@/lib/cops-commercial";
import { advancedErrorMessage, approvalBanner, APPROVER_LABEL, describeRule, useCopsAdvancedApi, type ApproverRole } from "@/lib/cops-commercial-advanced";

const names = (roles: ApproverRole[]) => roles.map((r) => APPROVER_LABEL[r]).join(", ");

/**
 * COPS-08: the approval state of a proposal, under its row on the Commercial Desk. A deal under
 * every threshold renders nothing at all: no added step. Polls with the rest of the desk, so a
 * decision shows without a refresh.
 */
export function ApprovalPanel({ proposalId, version, canRequest, onChanged }: { proposalId: string; version: number; canRequest: boolean; onChanged: () => void }) {
  const api = useCopsAdvancedApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const queryKey = ["cops-approval", proposalId, version];
  const evaluation = useQuery({
    queryKey,
    queryFn: () => api.evaluateApprovals(proposalId),
    enabled: authReady,
    refetchInterval: COMMERCIAL_POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const data = evaluation.data?.data;
  if (!data) return null;
  const banner = approvalBanner(data);
  if (banner.state === "none") return null;

  async function request() {
    setBusy(true);
    try {
      await api.requestApproval(proposalId);
      toast({ title: "Approval requested", description: "The approvers have been notified.", variant: "success" });
      await queryClient.invalidateQueries({ queryKey });
      onChanged();
    } catch (err) {
      toast({ title: "Could not request approval", description: advancedErrorMessage(err, "Please try again."), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const rules = data.matched_rules.map((r) => describeRule(r, data.currency, formatMoney));
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs" data-testid={`approval-panel-${proposalId}`} data-state={banner.state}>
      {banner.state === "needed" && (
        <>
          <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden />
          <span className="font-medium">Needs approval from {names(banner.approvers)}</span>
          <span className="text-muted-foreground">{rules.join(" · ")}</span>
          {canRequest && (
            <Button size="sm" className="ml-auto" disabled={busy} onClick={request}>
              {busy && <Loader2 className="animate-spin" />}
              Request approval
            </Button>
          )}
        </>
      )}
      {banner.state === "pending" && (
        <>
          <Clock className="h-4 w-4 text-sky-600" aria-hidden />
          <span className="font-medium">Waiting for {names(banner.waiting)}</span>
          {banner.approved.length > 0 && <span className="text-muted-foreground">Approved by {names(banner.approved)}</span>}
          <span className="text-muted-foreground">{rules.join(" · ")}</span>
          {data.approval && <span className="ml-auto text-muted-foreground">Lapses {new Date(data.approval.expires_at).toLocaleDateString()}</span>}
        </>
      )}
      {banner.state === "approved" && (
        <>
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
          <Badge tone="success">Approved</Badge>
          <span className="text-muted-foreground">{rules.join(" · ")}</span>
        </>
      )}
      {banner.state === "grandfathered" && (
        <span className="text-muted-foreground">In progress before approvals were introduced, so none is needed. Would have needed {names(data.required_approvers)}.</span>
      )}
      {data.approval === null && banner.state === "needed" && data.unevaluated.length > 0 && (
        <span className="basis-full text-muted-foreground">Contract value has no thresholds for {data.currency}, so that rule was not checked.</span>
      )}
    </div>
  );
}
