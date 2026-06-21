"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Download, ExternalLink, Loader2, Plug, Unplug } from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, useAuthReady } from "@/lib/api-client";
import { useCrmApi } from "@/lib/crm";
import { useEnrichmentApi } from "@/lib/enrichment";

function CrmSettingsContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const crmApi = useCrmApi();
  const enrichmentApi = useEnrichmentApi();
  const authReady = useAuthReady();
  const [banner, setBanner] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [importSource, setImportSource] = useState<"all" | "list">("all");
  const [hubspotListId, setHubspotListId] = useState("");
  const [targetMode, setTargetMode] = useState<"new" | "existing">("new");
  const [newListName, setNewListName] = useState("HubSpot import");
  const [targetListId, setTargetListId] = useState("");

  const connections = useQuery({
    queryKey: ["crm", "connections"],
    queryFn: crmApi.listConnections,
    enabled: authReady,
  });

  const hubspot = connections.data?.data.find((c) => c.provider === "hubspot");
  const hubspotConnected = hubspot?.status === "connected";

  const hubspotLists = useQuery({
    queryKey: ["crm", "hubspot", "lists"],
    queryFn: crmApi.listHubSpotLists,
    enabled: authReady && hubspotConnected,
  });

  const skoutLists = useQuery({
    queryKey: ["lists"],
    queryFn: enrichmentApi.listLists,
    enabled: authReady && hubspotConnected,
  });

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
      queryClient.removeQueries({ queryKey: ["crm", "hubspot", "lists"] });
      setBanner("HubSpot disconnected.");
      setConnectError(null);
    },
    onError: () => {
      setConnectError("Could not disconnect HubSpot. Try again.");
    },
  });

  const importContacts = useMutation({
    mutationFn: () =>
      crmApi.importFromHubSpot({
        source: importSource,
        hubspotListId: importSource === "list" ? hubspotListId : undefined,
        newListName: targetMode === "new" ? newListName.trim() : undefined,
        targetListId: targetMode === "existing" ? targetListId : undefined,
      }),
    onSuccess: (data) => {
      setImportError(null);
      setBanner(`Imported ${data.imported} contacts into your list.`);
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.message === "hubspot_import_empty") {
          setImportError("No importable contacts found (need email or company).");
        } else if (err.message === "hubspot_list_required") {
          setImportError("Select a HubSpot list to import.");
        } else {
          setImportError("Import failed. Reconnect HubSpot if you recently added list permissions.");
        }
      } else {
        setImportError("Import failed.");
      }
    },
  });

  const canImport =
    hubspotConnected &&
    (importSource === "all" || hubspotListId) &&
    (targetMode === "new" ? newListName.trim().length > 0 : Boolean(targetListId));

  return (
    <PageShell width="narrow">
      <PageHeader
        title="CRM settings"
        description="Connect HubSpot to import contacts into Skout lists and export enriched leads back to HubSpot."
      />

      <DemoBanner />

      {banner && (
        <Alert variant="success">
          <Check className="h-4 w-4" />
          {banner}
        </Alert>
      )}

      {connectError && <Alert variant="warning">{connectError}</Alert>}
      {importError && <Alert variant="warning">{importError}</Alert>}

      {connections.error && (
        <Alert variant="error" title="Something went wrong" dismissible>
          We couldn&apos;t load your CRM connections. Please try again.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">HubSpot connection</CardTitle>
          <CardDescription>
            Export: 1 credit per contact pushed to HubSpot. Import from HubSpot is free (up to 500 contacts per run).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Status</span>
            {hubspotConnected ? (
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

          {hubspotConnected ? (
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
        </CardContent>
      </Card>

      {hubspotConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Import from HubSpot</CardTitle>
            <CardDescription>
              Pull contacts into a new Skout list or add them to an existing list.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">Source</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="import-source"
                    checked={importSource === "all"}
                    onChange={() => setImportSource("all")}
                  />
                  All HubSpot contacts (max 500)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="import-source"
                    checked={importSource === "list"}
                    onChange={() => setImportSource("list")}
                  />
                  Specific HubSpot list
                </label>
              </div>
            </div>

            {importSource === "list" && (
              <div className="space-y-3">
                {!hubspotLists.isError && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="hubspot-list">
                      HubSpot list
                    </label>
                    <select
                      id="hubspot-list"
                      className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                      value={hubspotListId}
                      onChange={(e) => setHubspotListId(e.target.value)}
                      disabled={hubspotLists.isLoading}
                    >
                      <option value="">Select a list…</option>
                      {(hubspotLists.data?.data ?? []).map((list) => (
                        <option key={list.listId} value={list.listId}>
                          {list.name} ({list.size} contacts)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {hubspotLists.isError && (
                  <Alert variant="warning">
                    <p className="font-medium">List permission not granted yet</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm">
                      <li>
                        Run:{" "}
                        <code className="rounded bg-muted px-1 text-xs">
                          cd ~/hubspot-skout-app/skout-crm && hs project upload
                        </code>
                      </li>
                      <li>Reconnect your HubSpot account</li>
                      <li>
                        Click <strong>Disconnect</strong>, then <strong>Connect HubSpot</strong> again
                      </li>
                      <li>Approve all permissions on the HubSpot screen</li>
                    </ol>
                  </Alert>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="hubspot-list-id-manual">
                    HubSpot list ID{hubspotLists.isError ? "" : " (optional)"}
                  </label>
                  <Input
                    id="hubspot-list-id-manual"
                    placeholder="Numeric ID from HubSpot list URL"
                    value={hubspotListId}
                    onChange={(e) => setHubspotListId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    In HubSpot, open a contact list — the ID is often in the URL (e.g. …/lists/<strong>47</strong>).
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Destination in Skout</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="target-mode"
                    checked={targetMode === "new"}
                    onChange={() => setTargetMode("new")}
                  />
                  New list
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="target-mode"
                    checked={targetMode === "existing"}
                    onChange={() => setTargetMode("existing")}
                  />
                  Existing list
                </label>
              </div>
            </div>

            {targetMode === "new" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="new-list-name">
                  New list name
                </label>
                <Input
                  id="new-list-name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="target-list">
                  Skout list
                </label>
                <select
                  id="target-list"
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={targetListId}
                  onChange={(e) => setTargetListId(e.target.value)}
                >
                  <option value="">Select a list…</option>
                  {(skoutLists.data?.data ?? []).map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list.prospectCount})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              onClick={() => importContacts.mutate()}
              disabled={!canImport || importContacts.isPending}
              className="w-full sm:w-auto"
            >
              {importContacts.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Import contacts
            </Button>

            {importContacts.isSuccess && (
              <p className="text-sm text-muted-foreground">
                <Link href={`/lists/${importContacts.data.listId}`} className="font-medium underline">
                  Open imported list →
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      )}
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
