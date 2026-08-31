"use client";

/** R22.2 — generic GTM-provider import UI (HubSpot, Apollo). Mirrors CRM HubSpot import + Integrations
 * connection patterns: source mode, destination mode, preview table, optional Apollo sequence import. */

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plug, RefreshCw } from "lucide-react";
import { ApolloSequenceImporter } from "@/components/import/apollo-sequence-importer";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useCrmApi } from "@/lib/crm";
import { useEnrichmentApi } from "@/lib/enrichment";
import { useImportAdaptersApi } from "@/lib/import-adapters";
import { useIntegrationsApi } from "@/lib/integrations";
import type { ImportProvider } from "@/types/api";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 25;
const MAX_CONTACTS_CAP = 500;

const PROVIDER_LABEL: Record<ImportProvider, string> = {
  hubspot: "HubSpot",
  apollo: "Apollo.io",
};

function StepHeading({ step, title, description }: { step: number; title: string; description?: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {step}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}

export function ProviderImportPanel({ provider, description }: { provider: ImportProvider; description: string }) {
  const authReady = useAuthReady();
  const adapters = useImportAdaptersApi();
  const enrichmentApi = useEnrichmentApi();
  const integrationsApi = useIntegrationsApi();
  const crmApi = useCrmApi();
  const queryClient = useQueryClient();

  const [sourceMode, setSourceMode] = useState<"all" | "list">("all");
  const [sourceListId, setSourceListId] = useState("");
  const [manualListId, setManualListId] = useState("");
  const [targetMode, setTargetMode] = useState<"new" | "existing">("new");
  const [destListId, setDestListId] = useState("");
  const [newListName, setNewListName] = useState("");
  const [maxContacts, setMaxContacts] = useState(MAX_CONTACTS_CAP);
  const [previewOpen, setPreviewOpen] = useState(false);

  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: integrationsApi.list,
    enabled: authReady && provider === "apollo",
  });

  const crmConnections = useQuery({
    queryKey: ["crm", "connections"],
    queryFn: crmApi.listConnections,
    enabled: authReady && provider === "hubspot",
  });

  const apolloIntegration = integrations.data?.data.find((i) => i.provider === "apollo");
  const hubspotConnection = crmConnections.data?.data.find((c) => c.provider === "hubspot");
  const connected =
    provider === "apollo"
      ? Boolean(apolloIntegration?.connected)
      : hubspotConnection?.status === "connected";

  const effectiveSourceListId =
    sourceMode === "list" ? manualListId.trim() || sourceListId : undefined;

  const providerLists = useQuery({
    queryKey: ["import-provider-lists", provider],
    queryFn: () => adapters.listLists(provider),
    enabled: authReady && connected,
    retry: false,
  });

  const skoutLists = useQuery({
    queryKey: ["lists"],
    queryFn: enrichmentApi.listLists,
    enabled: authReady,
  });

  const preview = useQuery({
    queryKey: ["import-provider-contacts", provider, effectiveSourceListId, maxContacts],
    queryFn: () =>
      adapters.listContacts(provider, {
        listId: effectiveSourceListId,
        maxContacts: PREVIEW_LIMIT,
      }),
    enabled: authReady && connected && previewOpen,
    retry: false,
  });

  const commit = useMutation({
    mutationFn: () =>
      adapters.commit(provider, {
        sourceListId: effectiveSourceListId,
        listId: targetMode === "existing" ? destListId || undefined : undefined,
        newListName: targetMode === "new" && newListName.trim() ? newListName.trim() : undefined,
        maxContacts: Math.min(Math.max(maxContacts, 1), MAX_CONTACTS_CAP),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
    },
  });

  const canCommit =
    connected &&
    (targetMode === "existing" ? Boolean(destListId) : Boolean(newListName.trim())) &&
    (sourceMode === "all" || Boolean(effectiveSourceListId)) &&
    !commit.isPending;

  const connectHref = provider === "hubspot" ? "/settings/crm" : "/settings/integrations";
  const connectLabel = provider === "hubspot" ? "Connect HubSpot" : "Connect Apollo";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Import from {PROVIDER_LABEL[provider]}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            {connected ? (
              <Badge tone="success">
                Connected
                {provider === "apollo" && apolloIntegration?.keyHint ? ` ${apolloIntegration.keyHint}` : ""}
                {provider === "hubspot" && hubspotConnection?.externalAccountId
                  ? ` · Portal ${hubspotConnection.externalAccountId}`
                  : ""}
              </Badge>
            ) : (
              <Badge tone="muted">Not connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!connected && (
            <Alert variant="warning">
              Connect {PROVIDER_LABEL[provider]} before importing contacts.{" "}
              <Link href={connectHref} className="font-medium underline underline-offset-2">
                {connectLabel}
              </Link>
            </Alert>
          )}

          {connected && providerLists.isError && (
            <Alert variant="error">
              {formatQueryError(
                providerLists.error,
                `Could not reach ${PROVIDER_LABEL[provider]}. Check your connection and try again.`
              )}
            </Alert>
          )}

          <section className="space-y-3">
            <StepHeading
              step={1}
              title="Source"
              description={`Choose which ${PROVIDER_LABEL[provider]} contacts to pull into Skout.`}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`${provider}-source`}
                  checked={sourceMode === "all"}
                  onChange={() => {
                    setSourceMode("all");
                    setSourceListId("");
                    setManualListId("");
                    setPreviewOpen(false);
                  }}
                  disabled={!connected}
                />
                All contacts (up to {maxContacts})
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`${provider}-source`}
                  checked={sourceMode === "list"}
                  onChange={() => setSourceMode("list")}
                  disabled={!connected}
                />
                Specific {provider === "hubspot" ? "HubSpot" : "Apollo"} list
              </label>
            </div>

            {sourceMode === "list" && (
              <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[12rem] flex-1 space-y-2">
                    <label className="text-sm font-medium">Saved list</label>
                    <Select
                      value={sourceListId}
                      onChange={(e) => {
                        setSourceListId(e.target.value);
                        setPreviewOpen(false);
                      }}
                      disabled={!connected || providerLists.isLoading || providerLists.isError}
                    >
                      <option value="">{providerLists.isLoading ? "Loading lists…" : "Select a list…"}</option>
                      {(providerLists.data?.data ?? []).map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.count})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!connected || providerLists.isFetching}
                    onClick={() => providerLists.refetch()}
                  >
                    {providerLists.isFetching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Refresh lists
                  </Button>
                </div>
                {provider === "hubspot" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor={`${provider}-manual-list`}>
                      Or HubSpot list ID
                    </label>
                    <Input
                      id={`${provider}-manual-list`}
                      placeholder="Numeric ID from HubSpot list URL"
                      value={manualListId}
                      onChange={(e) => {
                        setManualListId(e.target.value);
                        setPreviewOpen(false);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      In HubSpot, open a contact list — the ID is often in the URL (e.g. …/lists/<strong>47</strong>).
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="max-w-xs space-y-2">
              <label className="text-sm font-medium" htmlFor={`${provider}-max-contacts`}>
                Max contacts to import
              </label>
              <Input
                id={`${provider}-max-contacts`}
                type="number"
                min={1}
                max={MAX_CONTACTS_CAP}
                value={maxContacts}
                onChange={(e) => {
                  setMaxContacts(Number(e.target.value) || 1);
                  setPreviewOpen(false);
                }}
                disabled={!connected}
              />
              <p className="text-xs text-muted-foreground">Cap is {MAX_CONTACTS_CAP} per import run.</p>
            </div>
          </section>

          <section className="space-y-3 border-t pt-4">
            <StepHeading step={2} title="Destination in Skout" description="Contacts land in a reviewable list — never auto-activated into a sequence." />
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`${provider}-target`}
                  checked={targetMode === "new"}
                  onChange={() => {
                    setTargetMode("new");
                    setDestListId("");
                  }}
                  disabled={!connected}
                />
                New list
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`${provider}-target`}
                  checked={targetMode === "existing"}
                  onChange={() => {
                    setTargetMode("existing");
                    setNewListName("");
                  }}
                  disabled={!connected}
                />
                Existing list
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {targetMode === "existing" ? (
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Skout list</label>
                  <Select value={destListId} onChange={(e) => setDestListId(e.target.value)} disabled={!connected}>
                    <option value="">Select a list…</option>
                    {(skoutLists.data?.data ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.prospectCount})
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">New list name</label>
                  <Input
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder={`${PROVIDER_LABEL[provider]} import`}
                    disabled={!connected}
                  />
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3 border-t pt-4">
            <StepHeading step={3} title="Preview & import" description="Review a sample, then import. Duplicates are skipped via prospect identity matching." />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={!connected || providerLists.isError}>
                Preview contacts
              </Button>
              <Button onClick={() => commit.mutate()} disabled={!canCommit}>
                {commit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Import into Skout
              </Button>
              {!connected && (
                <Link href={connectHref}>
                  <Button variant="outline" size="sm">
                    <Plug className="h-3.5 w-3.5" />
                    {connectLabel}
                  </Button>
                </Link>
              )}
            </div>

            {previewOpen && (
              <div className="overflow-x-auto rounded-md border">
                {preview.isLoading ? (
                  <p className="p-3 text-sm text-muted-foreground">Loading preview…</p>
                ) : preview.isError ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    {formatQueryError(preview.error, "Could not load contacts.")}
                  </p>
                ) : (preview.data?.data.length ?? 0) === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">No contacts found for this selection.</p>
                ) : (
                  <>
                    <table className="w-full text-left text-sm">
                      <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Domain</th>
                          <th className="px-3 py-2">Company</th>
                          <th className="px-3 py-2">Title</th>
                          <th className="px-3 py-2">Phone</th>
                          <th className="px-3 py-2">LinkedIn</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(preview.data?.data ?? []).map((c, idx) => (
                          <tr key={`${c.email ?? c.companyDomain}-${idx}`} className="border-b last:border-0">
                            <td className="px-3 py-2">{c.fullName ?? "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{c.email ?? "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{c.companyDomain}</td>
                            <td className="px-3 py-2 text-muted-foreground">{c.companyName ?? "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{c.title ?? "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{c.phone ?? "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {c.linkedinUrl ? (
                                <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                  Profile
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      Showing first {PREVIEW_LIMIT} of up to {maxContacts} contacts for this import.
                    </p>
                  </>
                )}
              </div>
            )}

            {commit.isError && <Alert variant="error">{formatQueryError(commit.error, "Import failed.")}</Alert>}
            {commit.data && (
              <Alert variant="success">
                Imported {commit.data.data.imported} contact{commit.data.data.imported === 1 ? "" : "s"} into “
                {commit.data.data.listName}”
                {commit.data.data.skipped > 0 ? ` (${commit.data.data.skipped} skipped)` : ""}.{" "}
                <Link href={`/lists/${commit.data.data.listId}`} className="font-medium underline">
                  Open list
                </Link>
              </Alert>
            )}
          </section>
        </CardContent>
      </Card>

      {provider === "apollo" && connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Apollo sequences (optional)</CardTitle>
            <CardDescription>R22.3 — import cadences as draft sequences, separate from contact import above.</CardDescription>
          </CardHeader>
          <CardContent>
            <ApolloSequenceImporter compact />
          </CardContent>
        </Card>
      )}

      <p className={cn("text-xs text-muted-foreground")}>
        {provider === "apollo"
          ? "Apollo import uses your workspace API key (Settings → Integrations). Enrichment BYOK is separate."
          : "HubSpot import uses your CRM OAuth connection (Settings → CRM)."}
      </p>
    </div>
  );
}
