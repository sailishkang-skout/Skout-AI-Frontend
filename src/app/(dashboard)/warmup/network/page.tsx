"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WarmupEmpty, WarmupStatGrid, WarmupStatusBreakdown } from "@/components/warmup/warmup-ui";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useWarmupToolApi } from "@/lib/warmup-tool";

export default function WarmupNetworkPage() {
  const api = useWarmupToolApi();
  const authReady = useAuthReady();

  const health = useQuery({
    queryKey: ["warmup-tool", "network-health"],
    queryFn: () => api.networkHealth(),
    enabled: authReady,
  });
  const domains = useQuery({
    queryKey: ["warmup-tool", "network-domains"],
    queryFn: () => api.listNetworkDomains(),
    enabled: authReady,
  });
  const mailboxes = useQuery({
    queryKey: ["warmup-tool", "network-mailboxes"],
    queryFn: () => api.listNetworkMailboxes(),
    enabled: authReady,
  });

  const h = health.data;

  return (
    <PageShell>
      <PageHeader
        title="Partner network"
        description="Read-only view of the warm-up recipient network. Zeros are expected until network inventory is provisioned for this environment."
      />

      {(health.isError || domains.isError || mailboxes.isError) && (
        <Alert className="mb-4">
          {formatQueryError(health.error ?? domains.error ?? mailboxes.error, "Could not load partner network.")}
        </Alert>
      )}

      <div className="mb-6">
        <WarmupStatGrid
          items={[
            { label: "Networks", value: h?.networks ?? (health.isLoading ? "…" : 0) },
            { label: "Active networks", value: h?.activeNetworks ?? 0, tone: "success" },
            { label: "Network domains", value: h?.domains ?? 0 },
            { label: "Network mailboxes", value: h?.mailboxes ?? 0 },
            { label: "Credential unavailable", value: h?.credentialUnavailable ?? 0, tone: "warning" },
            { label: "Remaining capacity today", value: h?.remainingMailboxCapacityToday ?? 0 },
          ]}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <WarmupStatusBreakdown title="Domains by status" counts={h?.domainsByStatus} />
        <WarmupStatusBreakdown title="Mailboxes by status" counts={h?.mailboxesByStatus} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Network domains</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {domains.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!domains.isLoading && (domains.data ?? []).length === 0 && (
              <WarmupEmpty>No partner domains registered in this environment yet.</WarmupEmpty>
            )}
            {(domains.data ?? []).map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{d.domainName ?? d.id}</span>
                {d.status && <Badge tone="muted">{d.status}</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Network mailboxes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mailboxes.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!mailboxes.isLoading && (mailboxes.data ?? []).length === 0 && (
              <WarmupEmpty>No partner mailboxes registered in this environment yet.</WarmupEmpty>
            )}
            {(mailboxes.data ?? []).map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="font-mono text-xs">{m.id.slice(0, 8)}…</span>
                <div className="flex gap-2">
                  {m.provider && <Badge tone="muted">{m.provider}</Badge>}
                  {m.status && <Badge>{m.status}</Badge>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
