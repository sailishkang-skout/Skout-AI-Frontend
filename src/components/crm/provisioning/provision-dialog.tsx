"use client";

import { useEffect, useRef, useState } from "react";
import { useCopsAdminApi } from "@/lib/cops-admin";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "../form-field";
import { useAuthReady } from "@/lib/api-client";
import {
  INTEGRATIONS,
  newIdempotencyKey,
  PROGRESS_POLL_MS,
  provisioningErrorMessage,
  provisioningFromError,
  useCopsProvisioningApi,
  type Integration,
  type Provisioning,
} from "@/lib/cops-provisioning";
import { ProvisioningSteps } from "./provisioning-steps";

const INTEGRATION_LABEL: Record<Integration, string> = { crm: "CRM", email: "Email", calendar: "Calendar" };

/**
 * Provision-trial flow (COPS-04): plan, trial length, credits and admin invite. One Idempotency-Key
 * per open dialog, so "Retry" after a failed step resumes the same provisioning; while the request
 * runs, the steps are re-read every second to show progress.
 */
export function ProvisionDialog({
  open,
  onClose,
  accountId,
  accountName,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  accountId: string;
  accountName?: string;
  onDone: (p: Provisioning) => void;
}) {
  const api = useCopsProvisioningApi();
  const authReady = useAuthReady();
  const key = useRef(newIdempotencyKey());
  const [opportunityId, setOpportunityId] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [plan, setPlan] = useState("trial");
  const [trialDays, setTrialDays] = useState("14");
  const [credits, setCredits] = useState("500");
  const [integrations, setIntegrations] = useState<Integration[]>(["crm", "email"]);
  // COPS-07: trial templates set by an admin fill plan, length, credits and integrations.
  const adminApi = useCopsAdminApi();
  const templates = useQuery({ queryKey: ["cops-trial-templates"], queryFn: () => adminApi.trialTemplates(), enabled: open, retry: false });
  const [templateKey, setTemplateKey] = useState("");
  function applyTemplate(key: string) {
    setTemplateKey(key);
    const t = templates.data?.data.find((x) => x.key === key);
    if (!t) return;
    setPlan(t.plan);
    setTrialDays(String(t.trial_days));
    setCredits(String(t.credits));
    setIntegrations(t.integrations.filter((i): i is Integration => i === "crm" || i === "email" || i === "calendar"));
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Provisioning | null>(null);

  useEffect(() => {
    if (!open) return;
    key.current = newIdempotencyKey();
    setError(null);
    setResult(null);
    setBusy(false);
    setWorkspaceName(accountName ?? "");
  }, [open, accountName]);

  const opportunities = useQuery({
    queryKey: ["cops-account-opportunities", accountId],
    queryFn: () => api.opportunities(accountId),
    enabled: open && authReady,
  });
  const opps = (opportunities.data?.data ?? []).filter((o) => o.status !== "lost");
  useEffect(() => {
    if (!opportunityId && opps[0]) setOpportunityId(opps[0].id);
  }, [opps, opportunityId]);

  // Live step progress while the provision request is running.
  const progress = useQuery({
    queryKey: ["cops-provisioning-progress", accountId],
    queryFn: () => api.listProvisionings(accountId),
    enabled: open && busy,
    refetchInterval: busy ? PROGRESS_POLL_MS : false,
  });
  const live = busy ? progress.data?.data?.[0] : undefined;
  const shown = result ?? live ?? null;

  const days = Number(trialDays);
  const amount = Number(credits);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim());
  const valid =
    Boolean(opportunityId) && emailOk && Number.isInteger(days) && days >= 1 && days <= 90 && Number.isInteger(amount) && amount >= 0 && amount <= 1_000_000;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.provision(
        accountId,
        {
          opportunity_id: opportunityId,
          admin_email: adminEmail.trim(),
          ...(workspaceName.trim() ? { workspace_name: workspaceName.trim() } : {}),
          plan: plan.trim() || "trial",
          trial_days: days,
          credits: amount,
          integrations,
        },
        key.current
      );
      setResult(res.data);
      onDone(res.data);
    } catch (err) {
      const failed = provisioningFromError(err);
      if (failed) setResult(failed);
      setError(provisioningErrorMessage(err, "Could not provision the workspace."));
    } finally {
      setBusy(false);
    }
  }

  const locked = busy || Boolean(result);
  const succeeded = result?.status === "succeeded";
  const failed = result?.status === "failed";

  return (
    <Dialog open={open} onClose={onClose} title="Provision trial workspace" description="Creates a real workspace for this customer and invites their admin.">
      <div className="space-y-4" data-testid="provision-dialog">
        {error && <Alert variant="error">{error}</Alert>}
        {!result && (
          <fieldset disabled={locked} className="grid gap-3 sm:grid-cols-2">
            {(templates.data?.data.length ?? 0) > 0 && (
              <div className="sm:col-span-2">
                <Field label="Trial template">
                  <Select value={templateKey} onChange={(e) => applyTemplate(e.target.value)} aria-label="Trial template" data-testid="provision-template">
                    <option value="">Custom</option>
                    {templates.data!.data.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.name} ({t.trial_days} days, {t.credits} credits)
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
            <div className="sm:col-span-2">
              <Field label="Opportunity" required>
                <Select value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)} aria-label="Opportunity">
                  {opps.length === 0 && <option value="">{opportunities.isLoading ? "Loading…" : "No opportunities on this account"}</option>}
                  {opps.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Admin email" required>
                <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} aria-label="Admin email" placeholder="admin@customer.com" />
              </Field>
            </div>
            <Field label="Workspace name">
              <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} maxLength={120} aria-label="Workspace name" />
            </Field>
            <Field label="Plan" required>
              <Input value={plan} onChange={(e) => setPlan(e.target.value)} maxLength={64} aria-label="Plan" />
            </Field>
            <Field label="Trial length (days)" required>
              <Input type="number" min={1} max={90} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} aria-label="Trial length (days)" />
            </Field>
            <Field label="Trial credits" required>
              <Input type="number" min={0} max={1000000} value={credits} onChange={(e) => setCredits(e.target.value)} aria-label="Trial credits" />
            </Field>
            <div className="sm:col-span-2">
              <span className="text-sm font-medium">Integration placeholders</span>
              <div className="mt-1.5 flex gap-4">
                {INTEGRATIONS.map((i) => (
                  <label key={i} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={integrations.includes(i)}
                      onChange={(e) => setIntegrations((cur) => (e.target.checked ? [...cur, i] : cur.filter((x) => x !== i)))}
                    />
                    {INTEGRATION_LABEL[i]}
                  </label>
                ))}
              </div>
            </div>
          </fieldset>
        )}

        {(busy || shown) && <ProvisioningSteps steps={shown?.steps} running={busy} />}

        {succeeded && result && (
          <Alert variant="success" data-testid="provision-success">
            Workspace ready{result.duration_ms != null ? ` in ${(result.duration_ms / 1000).toFixed(1)} s` : ""}.{" "}
            {result.admin_invite?.email_sent === false ? null : <>Invitation sent to {result.admin_invite?.email ?? "the admin"}.</>}
          </Alert>
        )}
        {succeeded && result?.admin_invite?.email_sent === false && (
          <Alert variant="warning" data-testid="provision-invite-not-sent">
            The invitation email to {result.admin_invite.email} could not be sent. Copy the invite link from the Onboarding tab and share it with the admin.
          </Alert>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {succeeded ? "Close" : "Cancel"}
          </Button>
          {!succeeded && (
            <Button onClick={submit} disabled={busy || (!result && !valid)} data-testid="provision-submit">
              {busy && <Loader2 className="animate-spin" />}
              {failed ? "Retry from failed step" : "Provision"}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
