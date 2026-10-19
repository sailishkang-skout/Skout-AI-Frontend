"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { DailyBarChart } from "@/components/analytics/daily-bar-chart";
import { useAuthReady } from "@/lib/api-client";
import { CopsRequestError } from "@/lib/cops-fetch";
import { evidenceText, orderedMilestones, useCopsOnboardingApi } from "@/lib/cops-onboarding";
import { usageSeries, useCopsProvisioningApi } from "@/lib/cops-provisioning";

function Stat({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId?: string }) {
  return (
    <div className="rounded-md border p-3" data-testid={testId}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString() : "—");

/**
 * Customer 360 Usage tab (COPS-02, data from COPS-04/05): how the customer uses the product. First
 * login, the product milestones they reached (with the event that proved each one), credits used
 * over the last 30 days and the wallet balance. Read-only; actions live on the Onboarding tab.
 */
export function CopsUsageTab({ accountId }: { accountId: string }) {
  const onboardingApi = useCopsOnboardingApi();
  const provApi = useCopsProvisioningApi();
  const authReady = useAuthReady();
  const onboarding = useQuery({
    queryKey: ["cops-onboarding", accountId],
    queryFn: () => onboardingApi.onboarding(accountId),
    enabled: authReady,
    retry: false,
  });
  const wallet = useQuery({
    queryKey: ["cops-wallet-summary", accountId],
    queryFn: () => provApi.wallet(accountId),
    enabled: authReady,
    retry: false,
  });

  if (onboarding.isLoading || wallet.isLoading) return <Skeleton className="h-40 w-full rounded-md" />;

  const notProvisioned = [onboarding.error, wallet.error].some((e) => e instanceof CopsRequestError && e.envelope?.code === "NOT_PROVISIONED");
  if (notProvisioned) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center" data-testid="usage-empty">
        <p className="text-sm font-medium">No usage yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Usage appears once the trial workspace is provisioned (Onboarding tab).</p>
      </div>
    );
  }
  if (onboarding.error instanceof CopsRequestError && onboarding.error.envelope?.code === "FORBIDDEN") {
    return <Alert variant="error">Usage is visible to onboarding, commercial and finance roles.</Alert>;
  }
  if (onboarding.isError && !onboarding.data) {
    return <Alert variant="error">Could not load usage. Try again in a moment.</Alert>;
  }

  const activation = onboarding.data?.data.activation ?? null;
  const milestones = orderedMilestones(activation?.milestones ?? []);
  const done = milestones.filter((m) => m.completed_at);
  const usage = wallet.data?.data.usage ?? [];
  const used30 = usage.reduce((sum, u) => sum + u.consumed, 0);
  const lastActive = done.map((m) => m.completed_at!).sort().at(-1) ?? activation?.first_login_at ?? null;

  return (
    <div className="space-y-5" data-testid="usage-tab">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="First login" value={day(activation?.first_login_at)} testId="usage-first-login" />
        <Stat
          label="Milestones reached"
          value={`${done.length} / ${milestones.length}`}
          hint={activation?.activated_at ? `Activated ${day(activation.activated_at)}` : `${activation?.activation_pct ?? 0}% to activation`}
          testId="usage-milestones"
        />
        <Stat label="Credits used, 30 days" value={used30.toLocaleString()} testId="usage-credits-30d" />
        <Stat
          label="Credit balance"
          value={wallet.data ? wallet.data.data.balance.toLocaleString() : "—"}
          hint={lastActive ? `Last product activity ${day(lastActive)}` : undefined}
          testId="usage-balance"
        />
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Credits used, last 30 days</h3>
        <div className="h-40">
          <DailyBarChart data={usageSeries(usage)} emptyLabel="No credits used in the last 30 days" valueLabel="Credits used" />
        </div>
      </section>

      <section className="space-y-2" data-testid="usage-milestones-list">
        <h3 className="text-sm font-medium">Product milestones</h3>
        {milestones.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activation template for this account yet.</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {milestones.map((m) => (
              <li key={m.key} className="flex items-start justify-between gap-3 px-3 py-2">
                <span className="flex items-center gap-2">
                  {m.completed_at ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Reached" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" aria-label="Not reached" />
                  )}
                  {m.label}
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  {m.completed_at ? `${day(m.completed_at)}${evidenceText(m) ? ` · ${evidenceText(m)}` : ""}` : m.source === "event" ? "waiting for the product event" : "set by CS"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
