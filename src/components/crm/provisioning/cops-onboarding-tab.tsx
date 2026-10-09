"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { CopsRequestError } from "@/lib/cops-fetch";
import { can, useMyPermissions } from "@/lib/cops-commercial";
import {
  formatDuration,
  PROVISIONING_PERMS,
  provisioningErrorMessage,
  provisioningFromError,
  trialDaysLeft,
  useCopsProvisioningApi,
  type Provisioning,
} from "@/lib/cops-provisioning";
import { ProvisionDialog } from "./provision-dialog";
import { ProvisioningSteps } from "./provisioning-steps";
import { AmountReasonDialog } from "./amount-reason-dialog";
import { OnboardingControl } from "../onboarding/onboarding-control";

const STATUS_TONE = {
  succeeded: "success",
  failed: "danger",
  running: "info",
  pending: "warning",
} as const;

/**
 * Customer 360 Onboarding tab (COPS-04 part): provision the trial workspace, see each saga step,
 * retry a failed one, and extend the trial. Activation tracking joins this tab in COPS-05.
 */
export function CopsOnboardingTab({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName?: string;
}) {
  const api = useCopsProvisioningApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { permissions } = useMyPermissions();
  const [dialog, setDialog] = useState<"provision" | "extend" | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const queryKey = ["cops-provisioning", accountId];
  const canWrite = can(permissions, PROVISIONING_PERMS.write);

  const view = useQuery({
    queryKey,
    queryFn: () => api.listProvisionings(accountId),
    enabled: authReady && Boolean(accountId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["cops-wallet", accountId] });
    queryClient.invalidateQueries({ queryKey: ["cops-360", accountId] });
  };

  async function retry(p: Provisioning) {
    setRetrying(true);
    setActionError(null);
    try {
      await api.retry(p.id);
    } catch (err) {
      if (!provisioningFromError(err))
        setActionError(provisioningErrorMessage(err, "Retry failed."));
    } finally {
      setRetrying(false);
      refresh();
    }
  }

  if (view.isLoading) return <Skeleton className="h-40 w-full rounded-md" />;
  if (view.isError) {
    const forbidden =
      view.error instanceof CopsRequestError &&
      view.error.envelope?.code === "FORBIDDEN";
    return (
      <Alert variant={forbidden ? "default" : "error"}>
        {forbidden
          ? "Onboarding details are visible to onboarding, commercial and finance roles."
          : "Could not load onboarding."}
      </Alert>
    );
  }

  const latest = view.data?.data?.[0];
  const dialogs = (
    <>
      <ProvisionDialog
        open={dialog === "provision"}
        onClose={() => {
          setDialog(null);
          refresh();
        }}
        accountId={accountId}
        accountName={accountName}
        onDone={refresh}
      />
      <AmountReasonDialog
        open={dialog === "extend"}
        onClose={() => setDialog(null)}
        mode="extend"
        onSubmit={async ({ amount, reason }) => {
          await api.extendTrial(accountId, { days: amount, reason });
          refresh();
        }}
      />
    </>
  );

  // Dialogs render at one fixed position so the provision dialog keeps its result when this tab
  // switches from the empty state to the provisioned view underneath it.
  return (
    <>
      {latest ? renderProvisioned(latest) : renderEmpty()}
      {dialogs}
    </>
  );

  function renderEmpty() {
    // Bible Appendix G: no onboarding -> provision or start plan.
    return (
      <div
        className="rounded-md border border-dashed p-8 text-center"
        data-testid="onboarding-empty"
      >
        <p className="text-sm font-medium">No onboarding yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Provision a trial workspace for this customer to start onboarding.
        </p>
        {canWrite ? (
          <Button
            className="mt-3"
            onClick={() => setDialog("provision")}
            data-testid="open-provision"
          >
            Provision trial
          </Button>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Ask someone with onboarding access to provision this account.
          </p>
        )}
      </div>
    );
  }

  function renderProvisioned(latest: Provisioning) {
    const daysLeft = trialDaysLeft(latest.trial_ends_at);
    const invite = latest.admin_invite;

    return (
      <div className="space-y-4" data-testid="onboarding-provisioning">
        {actionError && <Alert variant="error">{actionError}</Alert>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Trial workspace</p>
            <Badge
              tone={STATUS_TONE[latest.status]}
              className="capitalize"
              data-testid="provisioning-status"
            >
              {latest.status}
            </Badge>
            {latest.within_target === false && (
              <Badge tone="warning">Over 2-minute target</Badge>
            )}
          </div>
          <div className="flex gap-2">
            {canWrite && latest.status === "failed" && (
              <Button
                size="sm"
                onClick={() => retry(latest)}
                disabled={retrying}
                data-testid="retry-provisioning"
              >
                {retrying && <Loader2 className="animate-spin" />}
                Retry from failed step
              </Button>
            )}
            {canWrite && latest.status === "succeeded" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDialog("extend")}
                data-testid="open-extend-trial"
              >
                Extend trial
              </Button>
            )}
          </div>
        </div>

        {latest.status === "failed" && latest.last_error && (
          <Alert variant="warning">Failed at {latest.last_error}</Alert>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Info label="Plan" value={latest.plan} />
          <Info
            label="Trial ends"
            value={
              latest.trial_ends_at
                ? new Date(latest.trial_ends_at).toLocaleDateString()
                : "—"
            }
          />
          <Info
            label="Days left"
            value={daysLeft == null ? "—" : String(daysLeft)}
          />
          <Info
            label="Provisioned in"
            value={formatDuration(latest.duration_ms)}
          />
        </div>

        {invite && (
          <div
            className="rounded-md border p-3 text-sm"
            data-testid="admin-invite"
          >
            <p>
              Admin invite: <span className="font-medium">{invite.email}</span>{" "}
              <Badge tone={invite.accepted_at ? "success" : "info"}>
                {invite.accepted_at ? "accepted" : "pending"}
              </Badge>
              {invite.email_sent === false && !invite.accepted_at && (
                <span className="ml-2 text-xs text-amber-700" data-testid="admin-invite-not-sent">
                  Invitation email was not sent; share the link.
                </span>
              )}
            </p>
            {invite.accept_url && canWrite && (
              <button
                type="button"
                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={async () => {
                  await navigator.clipboard?.writeText(invite.accept_url!);
                  setCopied(true);
                }}
              >
                <Copy className="h-3 w-3" />
                {copied
                  ? "Link copied"
                  : "Copy invite link (if the email did not arrive)"}
              </button>
            )}
          </div>
        )}

        {latest.status === "succeeded" ? (
          <>
            {/* COPS-05 Onboarding Control: activation, follow-up, blockers, emails. */}
            <OnboardingControl accountId={accountId} accountName={accountName ?? "this account"} provisioning={latest} />
            <details className="rounded-md border p-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Provisioning steps</summary>
              <div className="pt-3">
                <ProvisioningSteps steps={latest.steps} running={retrying} />
              </div>
            </details>
          </>
        ) : (
          <ProvisioningSteps steps={latest.steps} running={retrying} />
        )}
      </div>
    );
  }
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium capitalize">{value}</p>
    </div>
  );
}
