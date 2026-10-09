"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { CopsRequestError } from "@/lib/cops-fetch";
import { useCopsAccountApi, type Account360 } from "@/lib/cops-crm";
import { CopsAccountTimeline } from "./cops-account-timeline";
import { isRiskSignal, signalLabel, signalReasonText, timeAgoShort } from "@/lib/signals";
import type { Signal } from "@/types/api";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "contacts", label: "Contacts" },
  { id: "commercial", label: "Commercial", ships: "COPS-03 (commercial workspace)" },
  { id: "onboarding", label: "Onboarding", ships: "COPS-05 (onboarding and activation)" },
  { id: "usage", label: "Usage", ships: "COPS-05 (activation tracking)" },
  { id: "success", label: "Success", ships: "COPS-11 (customer success)" },
  { id: "engineering", label: "Engineering", ships: "COPS-06 (engineering tickets)" },
  { id: "billing", label: "Billing", ships: "COPS-04 (credits) and COPS-08 (subscriptions)" },
  { id: "documents", label: "Documents", ships: "COPS-03 (proposals and contracts)" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const humanize = (v: string | null | undefined) => (v ? v.replace(/_/g, " ") : "—");

function riskTone(state: string) {
  return state === "at_risk" || state === "incident_impacted" ? "danger" : "warning";
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium capitalize">{value}</p>
    </div>
  );
}

/** Appendix G wording where the Bible gives one; the action itself ships with the named ticket. */
const APPENDIX_G: Partial<Record<TabId, { title: string; action: string }>> = {
  onboarding: { title: "No onboarding yet", action: "Provision a workspace or start an onboarding plan" },
  engineering: { title: "No open tickets: this account is healthy", action: "Create ticket" },
};

function EmptyTab({ id, label, ships }: { id: TabId; label: string; ships: string }) {
  const g = APPENDIX_G[id];
  return (
    <div className="rounded-md border border-dashed p-8 text-center" data-testid={`empty-tab-${id}`}>
      <p className="text-sm font-medium">{g?.title ?? `${label} is not available yet`}</p>
      {g && (
        <button
          type="button"
          disabled
          title={`Available with ${ships}`}
          className="mt-3 rounded-md border px-3 py-1.5 text-sm font-medium opacity-60"
        >
          {g.action}
        </button>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{g ? "This action" : "It"} arrives with {ships}.</p>
    </div>
  );
}

function Overview({ data }: { data: Account360 }) {
  const h = data.header;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Field label="Account state" value={humanize(h?.lifecycle.account)} />
      <Field label="Health" value={humanize(h?.health)} />
      <Field label="Support" value={humanize(h?.lifecycle.support)} />
      <Field label="Contacts" value={data.contacts?.length ?? 0} />
      <Field label="Commercial state" value={humanize(h?.commercial_state)} />
      <Field label="Onboarding" value={h?.onboarding_pct == null ? "—" : `${h.onboarding_pct}%`} />
      <Field label="Plan" value={humanize(h?.plan)} />
      <Field label="Renewal" value={h?.renewal_at ? new Date(h.renewal_at).toLocaleDateString() : "—"} />
    </div>
  );
}

function Contacts({ data }: { data: Account360 }) {
  const contacts = data.contacts ?? [];
  if (contacts.length === 0) {
    return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No contacts on this account yet.</p>;
  }
  return (
    <ul className="divide-y rounded-md border">
      {contacts.map((c) => (
        <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
          <span className="font-medium">{[c.firstName, c.lastName].filter(Boolean).join(" ")}</span>
          <span className="text-muted-foreground">{c.email ?? "No email"}</span>
        </li>
      ))}
    </ul>
  );
}

function RightRail({ data, signals }: { data: Account360; signals: Signal[] }) {
  const actions = data.next_actions ?? [];
  const risks = data.risks ?? [];
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Next actions</CardTitle>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No open tasks on this account.</p>
          ) : (
            <ul className="space-y-2">
              {actions.map((t) => (
                <li key={t.id} className="text-sm">
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {humanize(t.type)}
                    {t.dueDate ? ` · due ${new Date(t.dueDate).toLocaleDateString()}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Risks</CardTitle>
        </CardHeader>
        <CardContent>
          {risks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No risks flagged.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {risks.map((r) => (
                <Badge key={r.dimension} tone={riskTone(r.state)} className="capitalize">
                  {humanize(r.dimension)}: {humanize(r.state)}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent signals</CardTitle>
        </CardHeader>
        <CardContent>
          {signals.length === 0 ? (
            <p className="text-xs text-muted-foreground">No recent signals for this account.</p>
          ) : (
            <ul className="space-y-2" data-testid="cops-recent-signals">
              {[...signals]
                .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
                .slice(0, 5)
                .map((s) => (
                  <li key={s.id} className="text-sm">
                    <p className="flex items-center gap-1.5 font-medium">
                      <Badge tone={isRiskSignal(s.signalType) ? "danger" : "info"}>{signalLabel(s.signalType)}</Badge>
                      <span className="text-xs font-normal text-muted-foreground">{timeAgoShort(s.observedAt)}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{signalReasonText(s)}</p>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** COPS-02 Customer 360 workspace for one account: tabs plus a right rail of next actions and risks. */
/**
 * `signals` come from the page's existing account-360 load, so the rail adds no extra request.
 */
export function CopsCustomer360({ accountId, signals = [] }: { accountId: string; signals?: Signal[] }) {
  const api = useCopsAccountApi();
  const authReady = useAuthReady();
  const [tab, setTab] = useState<TabId>("overview");

  const view = useQuery({
    queryKey: ["cops-360", accountId],
    queryFn: () => api.get360(accountId),
    enabled: authReady && Boolean(accountId),
  });

  const data = view.data?.data;
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]" data-testid="cops-customer-360">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1" role="tablist" aria-label="Customer 360 sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === t.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent role="tabpanel" aria-label={current.label}>
          {tab === "timeline" ? (
            <CopsAccountTimeline accountId={accountId} />
          ) : "ships" in current ? (
            <EmptyTab id={current.id} label={current.label} ships={current.ships} />
          ) : view.isLoading ? (
            <Skeleton className="h-24 w-full rounded-md" />
          ) : view.isError ? (
            <Alert variant="error">
              {view.error instanceof CopsRequestError && view.error.envelope?.code === "FORBIDDEN"
                ? "You don't have access to this account."
                : "Could not load this account."}
            </Alert>
          ) : data ? (
            tab === "overview" ? <Overview data={data} /> : <Contacts data={data} />
          ) : null}
        </CardContent>
      </Card>
      {data && <RightRail data={data} signals={signals} />}
    </div>
  );
}
