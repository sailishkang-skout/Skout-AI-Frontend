"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ApiError, formatQueryError, useAuthReady } from "@/lib/api-client";
import { formatDateTime, useProviderApi, type ProviderConnection, type ProviderInfo } from "@/lib/enrichment-provider";
import { useWorkspaceRole } from "@/lib/workspace-role";

const LEGAL: Record<ProviderInfo["legalStatus"], { label: string; tone: "success" | "warning" | "danger" }> = {
  approved: { label: "Approved", tone: "success" },
  pending_legal_review: { label: "Awaiting legal approval", tone: "warning" },
  prohibited: { label: "Not permitted", tone: "danger" },
};

const CONNECTION_STATUS: Record<ProviderConnection["status"], { label: string; tone: "success" | "warning" | "muted" }> = {
  active: { label: "Connected", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  revoked: { label: "Disconnected", tone: "muted" },
};

const CONNECTION_ERRORS: Record<string, string> = {
  provider_credential_required: "The provider key is missing. Add it under Settings → Integrations.",
  provider_credential_rejected: "The provider rejected the stored key. Update it under Settings → Integrations.",
  provider_account_not_found: "The provider no longer has this account. Reconnect it.",
  provider_account_unavailable: "The provider account could not read a profile. Reconnect it.",
  provider_unreachable: "The provider could not be reached at the last check.",
};

/**
 * Provider connection settings. A connection is a provider account id; the provider key is
 * managed under Settings → Integrations and is never shown or entered here.
 */
export function ProviderConnections() {
  const api = useProviderApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { hasPermission } = useWorkspaceRole();
  const isAdmin = hasPermission("enrichment:admin");
  const [accountId, setAccountId] = useState("");
  const [toDisconnect, setToDisconnect] = useState<ProviderConnection | null>(null);

  const providers = useQuery({ queryKey: ["enrichment-provider", "providers"], queryFn: api.providers, enabled: authReady });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["enrichment-provider", "providers"] });
  const connect = useMutation({
    mutationFn: () => api.connectUnipile(accountId.trim()),
    onSuccess: async () => {
      setAccountId("");
      await refresh();
    },
  });
  const check = useMutation({ mutationFn: (id: string) => api.checkConnection(id), onSuccess: refresh });
  const disconnect = useMutation({
    mutationFn: (id: string) => api.disconnect(id),
    onSuccess: async () => {
      setToDisconnect(null);
      await refresh();
    },
  });

  if (providers.isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </PageShell>
    );
  }
  if (providers.isError || !providers.data) {
    const forbidden = providers.error instanceof ApiError && providers.error.status === 403;
    return (
      <PageShell>
        <PageHeader title="Enrichment providers" description="" />
        <Alert variant={forbidden ? "warning" : "error"} onRetry={forbidden ? undefined : () => providers.refetch()}>
          {forbidden ? "You don't have access to enrichment providers. Ask a workspace admin." : formatQueryError(providers.error, "Could not load providers.")}
        </Alert>
      </PageShell>
    );
  }

  const { providers: list = [], connections = [], testMode } = providers.data;
  const unipile = list.find((provider) => provider.id === "unipile");
  const mutationError = connect.error ?? check.error ?? disconnect.error;

  return (
    <PageShell>
      <PageHeader
        title="Enrichment providers"
        description="Provider accounts background enrichment may use. Keys stay on the server and are never shown here."
      />

      {testMode && (
        <Alert variant="warning" title="Test mode">
          Enrichment runs finish without calling a provider in this environment.
        </Alert>
      )}
      {mutationError && (
        <Alert variant="warning" dismissible>
          {mutationError instanceof ApiError && mutationError.status === 403
            ? "Only workspace admins can manage provider connections."
            : formatQueryError(mutationError, "The action could not be completed.")}
        </Alert>
      )}

      {list.map((provider) => (
        <Card key={provider.id} data-testid={`provider-${provider.id}`}>
          <CardContent className="space-y-2 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{provider.name}</h2>
              <Badge tone={LEGAL[provider.legalStatus].tone}>{LEGAL[provider.legalStatus].label}</Badge>
              <Badge tone={provider.permitted ? "success" : "muted"}>{provider.permitted ? "Enabled" : "Not enabled"}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{provider.purpose}</p>
            {provider.reason && <p className="text-sm">{provider.reason}</p>}
            <p className="text-xs text-muted-foreground">Raw provider responses are kept for {provider.rawResponseRetentionDays} days as evidence.</p>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-semibold">Connections</h2>
          {connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No provider account is connected. Enrichment runs stop with “Action required” until one is.
            </p>
          ) : (
            <ul className="divide-y">
              {connections.map((connection) => (
                <li key={connection.id} className="flex flex-wrap items-center justify-between gap-3 py-3" data-testid="provider-connection">
                  <div className="space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium capitalize">{connection.provider}</span>
                      <Badge tone={CONNECTION_STATUS[connection.status].tone}>{CONNECTION_STATUS[connection.status].label}</Badge>
                      {connection.status === "active" && connection.lastErrorCode && <Badge tone="danger">Needs attention</Badge>}
                    </div>
                    <p className="break-all text-muted-foreground">Account {connection.externalAccountId}</p>
                    <p className="text-xs text-muted-foreground">
                      Uses the {connection.credentialSource === "workspace" ? "workspace's own" : "platform"} key · last checked {formatDateTime(connection.lastCheckedAt)}
                    </p>
                    {connection.status === "active" && connection.lastErrorCode && (
                      <p className="text-red-700 dark:text-red-300">{CONNECTION_ERRORS[connection.lastErrorCode] ?? "The last check failed."}</p>
                    )}
                  </div>
                  {isAdmin && connection.status !== "revoked" && (
                    <div className="flex gap-2">
                      <Button variant="outline" disabled={check.isPending} onClick={() => check.mutate(connection.id)}>
                        {check.isPending && check.variables === connection.id && <Loader2 className="h-4 w-4 animate-spin" />}
                        Check
                      </Button>
                      <Button variant="destructive" onClick={() => setToDisconnect(connection)}>
                        Disconnect
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isAdmin ? (
            <form
              className="space-y-2 border-t pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (accountId.trim() && !connect.isPending) connect.mutate();
              }}
            >
              <label htmlFor="unipile-account" className="text-sm font-medium">
                Connect a Unipile LinkedIn account
              </label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="unipile-account"
                  className="max-w-md"
                  placeholder="Unipile account id"
                  autoComplete="off"
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  disabled={unipile ? !unipile.permitted : false}
                />
                <Button type="submit" disabled={!accountId.trim() || connect.isPending || (unipile ? !unipile.permitted : false)}>
                  {connect.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Connect
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the account id only. The Unipile API key is stored under{" "}
                <Link href="/settings/integrations" className="underline underline-offset-4">
                  Settings → Integrations
                </Link>{" "}
                and the account must exist under that key.
                {unipile && !unipile.permitted && ` ${unipile.reason ?? "Unipile is not enabled."}`}
              </p>
            </form>
          ) : (
            <p className="border-t pt-4 text-sm text-muted-foreground">Only workspace admins can connect or disconnect a provider.</p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(toDisconnect)}
        onClose={() => setToDisconnect(null)}
        title="Disconnect this provider account?"
        description="Enrichment runs stop with “Action required” until an account is connected again. Past runs and their evidence are kept. The change is recorded in the audit log."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDisconnect(null)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={disconnect.isPending} onClick={() => toDisconnect && disconnect.mutate(toDisconnect.id)}>
            {disconnect.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Disconnect
          </Button>
        </div>
      </Dialog>
    </PageShell>
  );
}
