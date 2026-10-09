"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { can, useMyPermissions } from "@/lib/cops-commercial";
import { ConfigEditor } from "@/components/cops-admin/config-editor";
import { ActivationPanel, FeatureFlagsPanel, GatePolicyPanel, OpsPanel, RetentionPanel } from "@/components/cops-admin/admin-panels";
import { CopsNotificationRoutesPanel } from "@/components/notifications/cops-notification-routes-panel";
import { PipelinesPanel } from "@/components/cops-admin/pipelines-panel";

const TABS = [
  { id: "trials", label: "Trial templates" },
  { id: "credits", label: "Credit packages" },
  { id: "emails", label: "Email templates" },
  { id: "activation", label: "Activation" },
  { id: "gate", label: "Gate policy" },
  { id: "routing", label: "Notification routing" },
  { id: "pipelines", label: "Pipelines" },
  { id: "modules", label: "Modules" },
  { id: "privacy", label: "Retention and privacy" },
  { id: "ops", label: "Operations" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/**
 * COPS-07 CustomerOps admin (Bible p.16): configuration without a code change. Reads need
 * admin:read; every change needs admin:admin, a reason, and is saved as a new version.
 */
export default function CopsAdminPage() {
  const { permissions, loaded } = useMyPermissions();
  const canRead = can(permissions, ["admin:read", "admin:admin"]);
  const canWrite = can(permissions, ["admin:admin"]);
  const [tab, setTab] = useState<TabId>("trials");

  return (
    <div className="space-y-4 p-6" data-testid="page-cops-admin">
      <div>
        <h1 className="text-xl font-semibold">CustomerOps admin</h1>
        <p className="text-sm text-muted-foreground">Templates, policies, retention and workflow health for this workspace.</p>
      </div>
      {loaded && !canRead ? (
        <Alert>This page is for workspace admins.</Alert>
      ) : (
        <>
          {loaded && !canWrite && <Alert>You can view this configuration. Only a workspace admin can change it.</Alert>}
          <div role="tablist" className="flex flex-wrap gap-1 rounded-md bg-muted p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`rounded px-3 py-1.5 text-sm ${tab === t.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                data-testid={`admin-tab-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === "trials" && (
              <ConfigEditor kind="trial_template" title="Trial templates" canWrite={canWrite} keyHint="for example enterprise_30" emptyTitle="No trial templates yet" emptyHint="Add one so reps can provision a trial without typing the plan, length and credits." />
            )}
            {tab === "credits" && (
              <ConfigEditor kind="credit_package" title="Credit packages" canWrite={canWrite} keyHint="for example starter_1000" emptyTitle="No credit packages yet" emptyHint="Add the packages your team grants or sells, so amounts are consistent." />
            )}
            {tab === "emails" && (
              <ConfigEditor kind="email_template" title="Onboarding email templates" canWrite={canWrite} keyHint="welcome_trial, welcome_paid, welcome_trial_enterprise or welcome_paid_enterprise" emptyTitle="The built-in wording is in use" emptyHint="Add a template with the key of the email you want to reword, for example welcome_trial." />
            )}
            {tab === "activation" && <ActivationPanel canWrite={canWrite} />}
            {tab === "gate" && <GatePolicyPanel canWrite={canWrite} />}
            {tab === "routing" && <CopsNotificationRoutesPanel />}
            {tab === "pipelines" && <PipelinesPanel canWrite={canWrite} />}
            {tab === "modules" && <FeatureFlagsPanel canWrite={canWrite} />}
            {tab === "privacy" && <RetentionPanel canWrite={canWrite} />}
            {tab === "ops" && <OpsPanel />}
          </div>
        </>
      )}
    </div>
  );
}
