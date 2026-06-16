"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ExternalLink, Loader2, Plug, Unplug } from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, useAuthReady } from "@/lib/api-client";
import { useCrmApi } from "@/lib/crm";

function CrmSettingsContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const crmApi = useCrmApi();
  const authReady = useAuthReady();
  const [banner, setBanner] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const connections = useQuery({
    queryKey: ["crm", "connections"],
    queryFn: crmApi.listConnections,
    enabled: authReady,
  });

  const hubspot = connections.data?.data.find((c) => c.provider === "hubspot");

  useEffect(() => {
    const status = searchParams.get("hubspot");
    if (status === "connected") {
      setBanner("HubSpot connected successfully.");
      queryClient.invalidateQueries({ queryKey: ["crm", "connections"] });
    } else if (status === "error") {
      setConnectError("HubSpot authorization failed. Try connecting again.");
    }
  }, [searchParams, queryClient]);

  const connect = useMutation({
    mutationFn: crmApi.connectHubSpot,
    onSuccess: (data) => {
      setConnectError(null);
      window.location.href = data.authorizationUrl;
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 503) {
        setConnectError("HubSpot is not configured on the server. Add HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET.");
      } else {
        setConnectError("Could not start HubSpot connection.");
      }
    },
  });

  const disconnect = useMutation({
    mutationFn: crmApi.disconnectHubSpot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "connections"] });
      setBanner("HubSpot disconnected.");
    },
  });

  return (
    <PageShell width="narrow">
      <PageHeader
        title="CRM settings"
        description="Connect HubSpot to push enriched list contacts into your CRM."
      />

      <DemoBanner />

      {banner && (
        <Alert variant="success">
          <Check className="h-4 w-4" />
          {banner}
        </Alert>
      )}

      {connectError && <Alert variant="warning">{connectError}</Alert>}

      {connections.error && (
        <Alert variant="warning">API unavailable — start the backend on port 3001.</Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">HubSpot</CardTitle>
          <CardDescription>
            One-way push from Skout lists to HubSpot contacts. Costs 1 credit per contact exported.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Status</span>
            {hubspot?.status === "connected" ? (
              <Badge tone="success">Connected</Badge>
            ) : hubspot?.status === "error" ? (
              <Badge tone="warning">Reconnect required</Badge>
            ) : (
              <Badge tone="muted">Not connected</Badge>
            )}
            {hubspot?.externalAccountId && (
              <span className="text-xs text-muted-foreground">Portal {hubspot.externalAccountId}</span>
            )}
          </div>

          {hubspot?.status === "connected" ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
                className="w-full sm:w-auto"
              >
                {disconnect.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unplug className="h-4 w-4" />
                )}
                Disconnect
              </Button>
              <a
                href="https://app.hubspot.com/contacts"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent sm:w-auto"
              >
                <ExternalLink className="h-4 w-4" />
                Open HubSpot
              </a>
            </div>
          ) : (
            <Button
              onClick={() => connect.mutate()}
              disabled={connect.isPending}
              className="w-full sm:w-auto"
            >
              {connect.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plug className="h-4 w-4" />
              )}
              Connect HubSpot
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            After connecting, open a list and use &quot;Export to HubSpot&quot; from the list detail page.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}

export default function CrmSettingsPage() {
  return (
    <Suspense
      fallback={
        <PageShell width="narrow">
          <PageHeader title="CRM settings" description="Loading…" />
        </PageShell>
      }
    >
      <CrmSettingsContent />
    </Suspense>
  );
}
